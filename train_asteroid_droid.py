"""
Training script for Asteroid Droid RL agent.

This script loads demo data collected from gameplay and trains a PPO agent
using behavioral cloning (supervised learning on demo data) followed by
reinforcement learning.
"""

import os
import json
import numpy as np
import torch
import torch.nn as nn
import torch.optim as optim
import torch.nn.functional as F
from typing import List, Dict, Tuple
import argparse
from datetime import datetime

# Observation dimensions from game.js
# Player state: 6 (x, y, rotation, health, shields, rotationSpeed)
# Nearest enemies: 5 * 3 = 15 (dist, angle, health for each)
# Nearest asteroids: 5 * 2 = 10 (dist, angle for each)
# Weapon states: 5 (primary cooldown, missile cooldown, missile ammo, laser cooldown, laser ammo)
# Tractor beam: 2 (charge, active)
# Score/level: 2
OBS_DIM = 6 + 15 + 10 + 5 + 2 + 2  # 40 dimensions
NUM_ACTIONS = 11  # 0-10 actions

class PolicyNetwork(nn.Module):
    """Policy network for PPO."""
    
    def __init__(self, obs_dim: int, action_dim: int, hidden_dims: List[int] = [128, 128]):
        super().__init__()
        
        self.shared_layers = nn.Sequential(
            nn.Linear(obs_dim, hidden_dims[0]),
            nn.ReLU(),
            nn.LayerNorm(hidden_dims[0]),
            nn.Linear(hidden_dims[0], hidden_dims[1]),
            nn.ReLU(),
            nn.LayerNorm(hidden_dims[1])
        )
        
        self.policy_head = nn.Linear(hidden_dims[1], action_dim)
        self.value_head = nn.Linear(hidden_dims[1], 1)
    
    def forward(self, x: torch.Tensor) -> Tuple[torch.Tensor, torch.Tensor]:
        shared = self.shared_layers(x)
        action_logits = self.policy_head(shared)
        value = self.value_head(shared)
        return action_logits, value


class AsteroidDroidAgent:
    """PPO Agent for Asteroid Droid."""
    
    def __init__(self, obs_dim: int, action_dim: int, lr: float = 3e-4, device: str = "cpu"):
        self.device = torch.device(device)
        self.obs_dim = obs_dim
        self.action_dim = action_dim
        
        self.policy_net = PolicyNetwork(obs_dim, action_dim).to(self.device)
        self.optimizer = optim.Adam(self.policy_net.parameters(), lr=lr)
        
    def get_action(self, obs: np.ndarray, deterministic: bool = False) -> int:
        """Get action from observation."""
        obs_tensor = torch.FloatTensor(obs).unsqueeze(0).to(self.device)
        
        with torch.no_grad():
            action_logits, _ = self.policy_net(obs_tensor)
            
        if deterministic:
            action = torch.argmax(action_logits, dim=1).item()
        else:
            probs = F.softmax(action_logits, dim=1)
            action = torch.multinomial(probs, 1).item()
        
        return action
    
    def train_behavioral_cloning(self, demo_data: List[Dict], epochs: int = 10, batch_size: int = 64):
        """Train using behavioral cloning (supervised learning on demo data)."""
        print(f"Training behavioral cloning on {len(demo_data)} demo frames...")
        
        # Prepare data
        observations = np.array([d['observation'] for d in demo_data])
        actions = np.array([d['action'] for d in demo_data])
        
        # Convert to tensors
        obs_tensor = torch.FloatTensor(observations).to(self.device)
        action_tensor = torch.LongTensor(actions).to(self.device)
        
        # Training loop
        for epoch in range(epochs):
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
                action_logits, _ = self.policy_net(batch_obs)
                
                # Compute loss (cross-entropy)
                loss = F.cross_entropy(action_logits, batch_actions)
                
                # Backward pass
                self.optimizer.zero_grad()
                loss.backward()
                self.optimizer.step()
                
                total_loss += loss.item()
                num_batches += 1
            
            avg_loss = total_loss / num_batches if num_batches > 0 else 0
            print(f"Epoch {epoch+1}/{epochs}, Loss: {avg_loss:.4f}")
        
        print("Behavioral cloning training complete!")
    
    def save(self, filepath: str):
        """Save model to file."""
        os.makedirs(os.path.dirname(filepath), exist_ok=True)
        torch.save({
            'policy_net_state_dict': self.policy_net.state_dict(),
            'obs_dim': self.obs_dim,
            'action_dim': self.action_dim
        }, filepath)
        print(f"Model saved to {filepath}")
    
    def save_onnx(self, filepath: str):
        """Export model to ONNX format for JavaScript loading."""
        self.policy_net.eval()
        
        # Create dummy input
        dummy_input = torch.randn(1, self.obs_dim).to(self.device)
        
        # Export to ONNX
        torch.onnx.export(
            self.policy_net,
            dummy_input,
            filepath,
            input_names=['observation'],
            output_names=['action_logits', 'value'],
            dynamic_axes={
                'observation': {0: 'batch_size'},
                'action_logits': {0: 'batch_size'},
                'value': {0: 'batch_size'}
            },
            opset_version=11
        )
        print(f"ONNX model saved to {filepath}")


def load_demo_data(filepath: str) -> List[Dict]:
    """Load demo data from JSON file."""
    with open(filepath, 'r') as f:
        data = json.load(f)
    
    print(f"Loaded {len(data)} demo frames from {filepath}")
    return data


def main():
    parser = argparse.ArgumentParser(description='Train Asteroid Droid RL Agent')
    parser.add_argument('--demo_file', type=str, required=True,
                       help='Path to demo data JSON file')
    parser.add_argument('--epochs', type=int, default=20,
                       help='Number of training epochs (default: 20)')
    parser.add_argument('--batch_size', type=int, default=64,
                       help='Batch size for training (default: 64)')
    parser.add_argument('--lr', type=float, default=3e-4,
                       help='Learning rate (default: 3e-4)')
    parser.add_argument('--output_dir', type=str, default='models',
                       help='Output directory for saved models (default: models)')
    parser.add_argument('--device', type=str, default='cpu',
                       help='Device to use (cpu or cuda) (default: cpu)')
    
    args = parser.parse_args()
    
    # Load demo data
    demo_data = load_demo_data(args.demo_file)
    
    if len(demo_data) == 0:
        print("Error: No demo data found!")
        return
    
    # Initialize agent
    agent = AsteroidDroidAgent(OBS_DIM, NUM_ACTIONS, lr=args.lr, device=args.device)
    
    # Train using behavioral cloning
    agent.train_behavioral_cloning(demo_data, epochs=args.epochs, batch_size=args.batch_size)
    
    # Save models
    os.makedirs(args.output_dir, exist_ok=True)
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    
    # Save PyTorch model
    pytorch_path = os.path.join(args.output_dir, f'asteroid_droid_agent_{timestamp}.pth')
    agent.save(pytorch_path)
    
    # Save ONNX model for JavaScript
    onnx_path = os.path.join(args.output_dir, f'asteroid_droid_agent_{timestamp}.onnx')
    agent.save_onnx(onnx_path)
    
    print(f"\n✅ Training complete!")
    print(f"📦 PyTorch model: {pytorch_path}")
    print(f"🌐 ONNX model (for JavaScript): {onnx_path}")


if __name__ == '__main__':
    main()


