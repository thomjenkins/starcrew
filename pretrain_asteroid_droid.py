"""
Offline pre-training script for Asteroid Droid agent.
Trains using heuristic policy and exports weights for JavaScript.
This model will be deployed with the game as the starting point.
"""

import numpy as np
import torch
import torch.nn as nn
import torch.optim as optim
import json
import os

# Updated observation dimensions (matches game.js exactly)
OBS_DIM = 63  # Fixed: was 59, game.js uses 63 (added powerups: 2 * 2 = 4 dimensions)
NUM_ACTIONS = 20

# Action constants (matches game.js ACTIONS)
ACTIONS = {
    'NO_OP': 0, 'MOVE_UP': 1, 'MOVE_DOWN': 2, 'MOVE_LEFT': 3, 'MOVE_RIGHT': 4,
    'ROTATE_LEFT': 5, 'ROTATE_RIGHT': 6, 'SHOOT_PRIMARY': 7, 'SHOOT_MISSILE': 8,
    'SHOOT_LASER': 9, 'ACTIVATE_TRACTOR': 10, 'ASSIGN_CREW_SHIELDS': 11,
    'ASSIGN_CREW_ENGINEERING': 12, 'ASSIGN_CREW_WEAPONS': 13,
    'ASSIGN_CREW_NAVIGATION': 14, 'UNASSIGN_CREW': 15,
    'SELECT_UPGRADE_HEALTH': 16, 'SELECT_UPGRADE_SHIELDS': 17,
    'SELECT_UPGRADE_ALLY': 18, 'SELECT_UPGRADE_CARGO_ALLY': 19
}

class PolicyNetwork(nn.Module):
    """Policy network matching TensorFlow.js structure exactly."""
    
    def __init__(self, obs_dim: int, action_dim: int):
        super().__init__()
        # Shared layers (matches game.js: 256 -> LayerNorm -> 256 -> LayerNorm)
        self.shared = nn.Sequential(
            nn.Linear(obs_dim, 256),
            nn.ReLU(),
            nn.LayerNorm(256),
            nn.Linear(256, 256),
            nn.ReLU(),
            nn.LayerNorm(256)
        )
        self.policy_head = nn.Linear(256, action_dim)
        self.value_head = nn.Linear(256, 1)
    
    def forward(self, x):
        shared = self.shared(x)
        return self.policy_head(shared), self.value_head(shared)

def get_heuristic_action(obs):
    """Heuristic policy matching game.js getHeuristicAction exactly."""
    player_health = obs[3]
    player_shields = obs[4]
    nearest_enemy_dist = obs[6]
    nearest_enemy_angle = obs[7]
    nearest_bullet_dist = obs[40]
    nearest_bullet_angle = obs[41]
    nearest_asteroid_dist = obs[21]
    nearest_asteroid_angle = obs[22]
    primary_ready = obs[31] < 0.1
    missile_ready = obs[32] < 0.1 and obs[33] > 0
    laser_ready = obs[34] < 0.1 and obs[35] > 0
    tractor_charge = obs[36]
    tractor_active = obs[37] > 0.5
    tractor_ready = tractor_charge > 0.3 and not tractor_active
    cargo_dist = obs[50]
    cargo_angle = obs[51]
    cargo_health = obs[52]
    has_cargo = cargo_dist < 0.99
    
    action_scores = np.zeros(NUM_ACTIONS)
    
    # 1. CRITICAL: Avoid enemy bullets
    if nearest_bullet_dist < 0.3:
        if abs(nearest_bullet_angle) < 0.25:
            action_scores[ACTIONS['MOVE_LEFT']] += 3
            action_scores[ACTIONS['MOVE_RIGHT']] += 3
        if 0.25 < nearest_bullet_angle < 0.75:
            action_scores[ACTIONS['MOVE_DOWN']] += 3
        if -0.75 < nearest_bullet_angle < -0.25:
            action_scores[ACTIONS['MOVE_UP']] += 3
    
    # 2. Combat: Shoot enemies
    if nearest_enemy_dist < 0.5:
        if primary_ready:
            action_scores[ACTIONS['SHOOT_PRIMARY']] += 4
        if missile_ready and nearest_enemy_dist < 0.3:
            action_scores[ACTIONS['SHOOT_MISSILE']] += 3
        if laser_ready and nearest_enemy_dist < 0.4:
            action_scores[ACTIONS['SHOOT_LASER']] += 2
        if nearest_enemy_angle > 0.1:
            action_scores[ACTIONS['ROTATE_RIGHT']] += 1
        elif nearest_enemy_angle < -0.1:
            action_scores[ACTIONS['ROTATE_LEFT']] += 1
    
    # 3. Cargo protection
    if has_cargo and cargo_health > 0.3:
        if cargo_dist > 0.4:
            if cargo_angle > 0.1:
                action_scores[ACTIONS['MOVE_RIGHT']] += 1
            elif cargo_angle < -0.1:
                action_scores[ACTIONS['MOVE_LEFT']] += 1
            if abs(cargo_angle) < 0.5:
                if cargo_angle > 0.25:
                    action_scores[ACTIONS['MOVE_DOWN']] += 1
                elif cargo_angle < -0.25:
                    action_scores[ACTIONS['MOVE_UP']] += 1
    
    # 4. Asteroid mining + tractor beam
    if nearest_asteroid_dist < 0.4:
        if primary_ready:
            action_scores[ACTIONS['SHOOT_PRIMARY']] += 2
        if tractor_ready and 0.2 < nearest_asteroid_dist < 0.35:
            action_scores[ACTIONS['ACTIVATE_TRACTOR']] += 3
    
    # 4b. Tractor beam on enemies
    if 0.3 < nearest_enemy_dist < 0.5 and tractor_ready:
        action_scores[ACTIONS['ACTIVATE_TRACTOR']] += 2
    
    # 5. Health management
    if player_health < 0.3 or player_shields < 0.2:
        if nearest_enemy_dist < 0.6:
            if nearest_enemy_angle > 0:
                action_scores[ACTIONS['MOVE_LEFT']] += 2
            else:
                action_scores[ACTIONS['MOVE_RIGHT']] += 2
            if abs(nearest_enemy_angle) < 0.5:
                action_scores[ACTIONS['MOVE_DOWN']] += 2
    
    # 6. Crew management
    if player_shields < 0.3 and obs[54] < 0.8:
        action_scores[ACTIONS['ASSIGN_CREW_SHIELDS']] += 1
    if player_health < 0.4 and obs[55] < 0.8:
        action_scores[ACTIONS['ASSIGN_CREW_ENGINEERING']] += 1
    if nearest_enemy_dist < 0.5 and obs[56] < 0.8:
        action_scores[ACTIONS['ASSIGN_CREW_WEAPONS']] += 1
    
    # 7. Upgrade selection
    upgrade_menu_open = obs[58] > 0.5
    if upgrade_menu_open:
        if player_health < 0.5:
            action_scores[ACTIONS['SELECT_UPGRADE_HEALTH']] += 3
        elif player_shields < 0.5:
            action_scores[ACTIONS['SELECT_UPGRADE_SHIELDS']] += 2
        elif has_cargo and cargo_health < 0.7:
            action_scores[ACTIONS['SELECT_UPGRADE_CARGO_ALLY']] += 2
        else:
            action_scores[ACTIONS['SELECT_UPGRADE_ALLY']] += 1
    
    # Add noise
    action_scores += np.random.uniform(-0.05, 0.05, NUM_ACTIONS)
    
    return np.argmax(action_scores)

def generate_synthetic_observation():
    """Generate synthetic observation matching game.js generateSyntheticObservation."""
    obs = np.zeros(OBS_DIM)
    
    # Player state (0-5)
    obs[0:2] = np.random.uniform(-0.4, 0.4, 2)
    obs[2] = np.random.random()
    obs[3:5] = np.random.random(2)
    obs[5] = np.random.uniform(0.1, 0.2)
    
    # Enemies (6-20): 5 enemies * 3 values
    for i in range(5):
        if np.random.random() < 0.7:
            obs[6 + i*3] = np.random.random() * 0.8
            obs[7 + i*3] = np.random.uniform(-1, 1)
            obs[8 + i*3] = np.random.random()
        else:
            obs[6 + i*3] = 1.0
    
    # Asteroids (21-30): 5 asteroids * 2 values
    for i in range(5):
        if np.random.random() < 0.5:
            obs[21 + i*2] = np.random.random() * 0.7
            obs[22 + i*2] = np.random.uniform(-1, 1)
        else:
            obs[21 + i*2] = 1.0
    
    # Weapons (31-35)
    obs[31:36] = np.random.random(5)
    
    # Tractor beam (36-37)
    obs[36] = np.random.random()
    obs[37] = 1.0 if np.random.random() < 0.1 else 0.0
    
    # Score/level (38-39)
    obs[38] = np.random.random() * 0.5
    obs[39] = np.random.random() * 0.3
    
    # Enemy bullets (40-49): 5 bullets * 2 values
    for i in range(5):
        if np.random.random() < 0.3:
            obs[40 + i*2] = np.random.random() * 0.5
            obs[41 + i*2] = np.random.uniform(-1, 1)
        else:
            obs[40 + i*2] = 1.0
    
    # Cargo (50-53)
    if np.random.random() < 0.5:
        obs[50] = np.random.random() * 0.6
        obs[51] = np.random.uniform(-1, 1)
        obs[52] = np.random.uniform(0.5, 1.0)
        obs[53] = 1 if np.random.random() < 0.5 else -1
    else:
        obs[50] = 1.0
    
    # Crew (54-57)
    obs[54:58] = np.random.random(4)
    
    # Upgrade menu (58)
    obs[58] = 1.0 if np.random.random() < 0.1 else 0.0
    
    # Powerups (59-62): 2 powerups * 2 values (dist, angle)
    for i in range(2):
        if np.random.random() < 0.3:
            obs[59 + i*2] = np.random.random() * 0.6
            obs[60 + i*2] = np.random.uniform(-1, 1)
        else:
            obs[59 + i*2] = 1.0
            obs[60 + i*2] = 0.0
    
    return obs

def load_model_from_json(json_file):
    """Load model weights from JSON file (for resuming training)."""
    try:
        with open(json_file, 'r') as f:
            data = json.load(f)
        
        if 'weights' not in data:
            print(f"⚠️  No weights found in {json_file}")
            return None, None
        
        print(f"✅ Loading model from {json_file}")
        print(f"   Previous obs_dim: {data.get('obs_dim', 'unknown')}")
        print(f"   Previous action_dim: {data.get('action_dim', 'unknown')}")
        print(f"   Previous episode: {data.get('episode', 0)}")
        print(f"   Previous bestScore: {data.get('bestScore', 0)}")
        
        # Reconstruct weights from JSON
        weights_data = data['weights']
        state_dict = {}
        
        # Map JSON weights back to PyTorch state dict format
        # Order: dense1 (weight, bias), layernorm1 (weight, bias), dense2 (weight, bias), layernorm2 (weight, bias), policy_head (weight, bias), value_head (weight, bias)
        idx = 0
        
        # Dense layer 1
        state_dict['shared.0.weight'] = torch.FloatTensor(np.array(weights_data[idx]['data']).reshape(weights_data[idx]['shape']))
        idx += 1
        state_dict['shared.0.bias'] = torch.FloatTensor(np.array(weights_data[idx]['data']).reshape(weights_data[idx]['shape']))
        idx += 1
        
        # LayerNorm 1
        state_dict['shared.2.weight'] = torch.FloatTensor(np.array(weights_data[idx]['data']).reshape(weights_data[idx]['shape']))
        idx += 1
        state_dict['shared.2.bias'] = torch.FloatTensor(np.array(weights_data[idx]['data']).reshape(weights_data[idx]['shape']))
        idx += 1
        
        # Dense layer 2
        state_dict['shared.3.weight'] = torch.FloatTensor(np.array(weights_data[idx]['data']).reshape(weights_data[idx]['shape']))
        idx += 1
        state_dict['shared.3.bias'] = torch.FloatTensor(np.array(weights_data[idx]['data']).reshape(weights_data[idx]['shape']))
        idx += 1
        
        # LayerNorm 2
        state_dict['shared.5.weight'] = torch.FloatTensor(np.array(weights_data[idx]['data']).reshape(weights_data[idx]['shape']))
        idx += 1
        state_dict['shared.5.bias'] = torch.FloatTensor(np.array(weights_data[idx]['data']).reshape(weights_data[idx]['shape']))
        idx += 1
        
        # Policy head
        state_dict['policy_head.weight'] = torch.FloatTensor(np.array(weights_data[idx]['data']).reshape(weights_data[idx]['shape']))
        idx += 1
        state_dict['policy_head.bias'] = torch.FloatTensor(np.array(weights_data[idx]['data']).reshape(weights_data[idx]['shape']))
        idx += 1
        
        # Value head
        state_dict['value_head.weight'] = torch.FloatTensor(np.array(weights_data[idx]['data']).reshape(weights_data[idx]['shape']))
        idx += 1
        state_dict['value_head.bias'] = torch.FloatTensor(np.array(weights_data[idx]['data']).reshape(weights_data[idx]['shape']))
        
        return state_dict, data
    except Exception as e:
        print(f"⚠️  Failed to load model from {json_file}: {e}")
        return None, None


def pretrain_agent(num_samples=200000, epochs=1000, batch_size=256, output_file='pretrained_model.json', resume_from=None):
    """Pre-train agent using heuristic policy with extensive training.
    
    Args:
        num_samples: Number of training samples to generate
        epochs: Number of training epochs
        batch_size: Batch size for training
        output_file: Output JSON file path
        resume_from: Path to existing model JSON to continue training from
    """
    if resume_from:
        print(f"🔄 Resuming training from {resume_from}")
    else:
        print(f"🆕 Starting fresh training")
    
    print(f"Pre-training agent with {num_samples} samples over {epochs} epochs...")
    print("⚠️  This will take significantly longer - be patient!")
    
    # Create model
    model = PolicyNetwork(OBS_DIM, NUM_ACTIONS)
    
    # Load existing model if resuming
    start_epoch = 0
    previous_best_loss = float('inf')
    previous_metadata = {}
    
    if resume_from and os.path.exists(resume_from):
        state_dict, metadata = load_model_from_json(resume_from)
        if state_dict:
            try:
                model.load_state_dict(state_dict)
                print("✅ Successfully loaded model weights")
                previous_metadata = metadata
                # Try to get previous training info if stored
                if 'training_epochs' in metadata:
                    start_epoch = metadata['training_epochs']
                    print(f"   Resuming from epoch {start_epoch}")
                if 'best_loss' in metadata:
                    previous_best_loss = metadata['best_loss']
                    print(f"   Previous best loss: {previous_best_loss:.4f}")
            except Exception as e:
                print(f"⚠️  Could not load weights (shape mismatch?): {e}")
                print("   Starting with random weights instead")
    
    # Use learning rate scheduling for better convergence
    initial_lr = 0.001 if start_epoch == 0 else 0.0005  # Lower LR when resuming
    optimizer = optim.Adam(model.parameters(), lr=initial_lr)
    scheduler = optim.lr_scheduler.ReduceLROnPlateau(optimizer, mode='min', factor=0.5, patience=50, verbose=True)
    criterion = nn.CrossEntropyLoss()
    
    # Generate training data
    print("Generating training data...")
    observations = []
    actions = []
    
    for i in range(num_samples):
        obs = generate_synthetic_observation()
        action = get_heuristic_action(obs)
        observations.append(obs)
        actions.append(action)
        
        if (i + 1) % 5000 == 0:
            print(f"  Generated {i + 1}/{num_samples} samples")
    
    # Convert to tensors (convert list to numpy array first for better performance)
    obs_tensor = torch.FloatTensor(np.array(observations))
    action_tensor = torch.LongTensor(np.array(actions))
    
    # Training loop with learning rate scheduling
    print("Training...")
    best_loss = previous_best_loss
    patience_counter = 0
    for epoch in range(start_epoch, start_epoch + epochs):
        model.train()
        total_loss = 0
        num_batches = 0
        
        # Shuffle data
        indices = torch.randperm(len(obs_tensor))
        obs_shuffled = obs_tensor[indices]
        action_shuffled = action_tensor[indices]
        
        # Mini-batch training
        for i in range(0, len(obs_tensor), batch_size):
            batch_obs = obs_shuffled[i:i+batch_size]
            batch_actions = action_shuffled[i:i+batch_size]
            
            # Forward pass
            policy_logits, _ = model(batch_obs)
            loss = criterion(policy_logits, batch_actions)
            
            # Backward pass with gradient clipping
            optimizer.zero_grad()
            loss.backward()
            torch.nn.utils.clip_grad_norm_(model.parameters(), max_norm=1.0)  # Gradient clipping
            optimizer.step()
            
            total_loss += loss.item()
            num_batches += 1
        
        avg_loss = total_loss / num_batches
        if avg_loss < best_loss:
            best_loss = avg_loss
            patience_counter = 0
        else:
            patience_counter += 1
        
        # Update learning rate scheduler
        scheduler.step(avg_loss)
        current_lr = optimizer.param_groups[0]['lr']
        
        # Print progress more frequently for long training
        if (epoch + 1) % 50 == 0 or epoch == 0:
            print(f"  Epoch {epoch + 1}/{epochs}, Loss: {avg_loss:.4f} (best: {best_loss:.4f}), LR: {current_lr:.6f}")
        
        # Early stopping if loss hasn't improved for a while
        if patience_counter >= 200 and epoch > 500:
            print(f"  Early stopping at epoch {epoch + 1} (no improvement for 200 epochs)")
            break
    
    # Export weights in JavaScript-compatible format
    print("Exporting weights for JavaScript...")
    weights_data = []
    
    # Get model weights in the order TensorFlow.js expects
    # TensorFlow.js model structure: input -> dense(128) -> LayerNorm -> dense(128) -> LayerNorm -> [policy_head, value_head]
    state_dict = model.state_dict()
    
    # Extract weights in order (matching TensorFlow.js layer order)
    # Dense layer 1
    weights_data.append({
        'shape': list(state_dict['shared.0.weight'].shape),
        'dtype': 'float32',
        'data': state_dict['shared.0.weight'].cpu().numpy().flatten().tolist()
    })
    weights_data.append({
        'shape': list(state_dict['shared.0.bias'].shape),
        'dtype': 'float32',
        'data': state_dict['shared.0.bias'].cpu().numpy().flatten().tolist()
    })
    
    # LayerNorm 1 (scale and bias)
    weights_data.append({
        'shape': list(state_dict['shared.2.weight'].shape),
        'dtype': 'float32',
        'data': state_dict['shared.2.weight'].cpu().numpy().flatten().tolist()
    })
    weights_data.append({
        'shape': list(state_dict['shared.2.bias'].shape),
        'dtype': 'float32',
        'data': state_dict['shared.2.bias'].cpu().numpy().flatten().tolist()
    })
    
    # Dense layer 2
    weights_data.append({
        'shape': list(state_dict['shared.3.weight'].shape),
        'dtype': 'float32',
        'data': state_dict['shared.3.weight'].cpu().numpy().flatten().tolist()
    })
    weights_data.append({
        'shape': list(state_dict['shared.3.bias'].shape),
        'dtype': 'float32',
        'data': state_dict['shared.3.bias'].cpu().numpy().flatten().tolist()
    })
    
    # LayerNorm 2
    weights_data.append({
        'shape': list(state_dict['shared.5.weight'].shape),
        'dtype': 'float32',
        'data': state_dict['shared.5.weight'].cpu().numpy().flatten().tolist()
    })
    weights_data.append({
        'shape': list(state_dict['shared.5.bias'].shape),
        'dtype': 'float32',
        'data': state_dict['shared.5.bias'].cpu().numpy().flatten().tolist()
    })
    
    # Policy head
    weights_data.append({
        'shape': list(state_dict['policy_head.weight'].shape),
        'dtype': 'float32',
        'data': state_dict['policy_head.weight'].cpu().numpy().flatten().tolist()
    })
    weights_data.append({
        'shape': list(state_dict['policy_head.bias'].shape),
        'dtype': 'float32',
        'data': state_dict['policy_head.bias'].cpu().numpy().flatten().tolist()
    })
    
    # Value head
    weights_data.append({
        'shape': list(state_dict['value_head.weight'].shape),
        'dtype': 'float32',
        'data': state_dict['value_head.weight'].cpu().numpy().flatten().tolist()
    })
    weights_data.append({
        'shape': list(state_dict['value_head.bias'].shape),
        'dtype': 'float32',
        'data': state_dict['value_head.bias'].cpu().numpy().flatten().tolist()
    })
    
    # Save to JSON (preserve previous metadata if resuming)
    output = {
        'weights': weights_data,
        'obs_dim': OBS_DIM,
        'action_dim': NUM_ACTIONS,
        'episode': previous_metadata.get('episode', 0),
        'bestScore': previous_metadata.get('bestScore', 0),
        'pretrained': True,
        'training_epochs': start_epoch + epochs,  # Track total epochs trained
        'best_loss': best_loss,  # Track best loss achieved
        'resumed_from': resume_from if resume_from else None
    }
    
    with open(output_file, 'w') as f:
        json.dump(output, f)
    
    print(f"\n✅ Pre-trained model saved to {output_file}")
    print(f"   Model has {len(weights_data)} weight layers")
    print(f"   Final training loss: {best_loss:.4f}")
    
    # Test the model
    model.eval()
    correct = 0
    total = 100
    for _ in range(total):
        test_obs = generate_synthetic_observation()
        with torch.no_grad():
            test_logits, _ = model(torch.FloatTensor(np.array([test_obs])))
            predicted_action = torch.argmax(test_logits, dim=1).item()
            heuristic_action = get_heuristic_action(test_obs)
            if predicted_action == heuristic_action:
                correct += 1
    
    accuracy = (correct / total) * 100
    print(f"   Test accuracy: {accuracy:.1f}% ({correct}/{total} matches heuristic)")
    print(f"\n📦 Deploy {output_file} with your game - the agent will start with this base knowledge!")

if __name__ == '__main__':
    import argparse
    parser = argparse.ArgumentParser(description='Pre-train Asteroid Droid agent offline')
    parser.add_argument('--samples', type=int, default=200000, help='Number of training samples (default: 200000)')
    parser.add_argument('--epochs', type=int, default=1000, help='Number of training epochs (default: 1000)')
    parser.add_argument('--batch_size', type=int, default=256, help='Batch size (default: 256)')
    parser.add_argument('--output', type=str, default='pretrained_model.json', help='Output file (default: pretrained_model.json)')
    parser.add_argument('--resume_from', type=str, default=None, help='Path to existing model JSON to continue training from')
    args = parser.parse_args()
    
    pretrain_agent(args.samples, args.epochs, batch_size=args.batch_size, output_file=args.output, resume_from=args.resume_from)


