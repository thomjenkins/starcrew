# StarCrew Autopilot RL Agent Improvements

## Overview

The StarCrew autopilot uses a TensorFlow.js PPO agent that trains in real-time during gameplay. Here's how to improve it beyond just training longer.

## Current Setup

- **Network**: 128x128 hidden layers
- **Training epochs**: 4 per update
- **Update frequency**: Every 5 episodes
- **Buffer size**: 2048 steps
- **Learning rate**: 3e-4 (fixed)

## Improvements

### 1. **Larger Network Architecture**

**Current**: `[128, 128]`  
**Improved**: `[256, 256]` or `[512, 256]`

**In `game.js` (PPOAgent.createPolicyNetwork)**:
```javascript
// Change from:
units: 128

// To:
units: 256  // First layer
units: 256  // Second layer
```

**Why**: Larger networks can learn more complex policies and handle the 59-dimensional observation space better.

### 2. **More Training Epochs Per Update**

**Current**: 4 epochs  
**Improved**: 8-10 epochs

**In `game.js` (PPOAgent.update)**:
```javascript
// Change from:
async update(epochs = 4) {

// To:
async update(epochs = 10) {
```

**Why**: More gradient steps per batch improve sample efficiency and learning stability.

### 3. **Larger Buffer Size**

**Current**: 2048 steps  
**Improved**: 4096 steps

**In `game.js` (PPOAgent constructor)**:
```javascript
// Change from:
this.maxBufferSize = 2048;

// To:
this.maxBufferSize = 4096;
```

**Why**: More diverse experiences lead to more stable learning and better generalization.

### 4. **Learning Rate Scheduling**

**Current**: Fixed 3e-4  
**Improved**: Exponential decay

**In `game.js` (PPOAgent constructor and update)**:
```javascript
constructor(obsDim, actionDim, lr = 3e-4, gamma = 0.99, epsClip = 0.2) {
    // ... existing code ...
    this.initialLr = lr;
    this.currentLr = lr;
    this.lrDecay = 0.9995;  // Decay factor
    this.minLr = 1e-5;  // Minimum learning rate
}

// In update() method, after training:
this.currentLr = Math.max(this.minLr, this.currentLr * this.lrDecay);
this.optimizer = tf.train.adam(this.currentLr);
```

**Why**: Start with higher learning rate for exploration, decay for fine-tuning.

### 5. **Better Advantage Normalization**

**Current**: Simple mean/std normalization  
**Improved**: Clip advantages after normalization

**In `game.js` (PPOAgent.update)**:
```javascript
// After normalizing advantages:
const normalizedAdvantages = advantages.map(a => (a - advMean) / (advStd + 1e-8));

// Add clipping:
const clippedAdvantages = normalizedAdvantages.map(a => Math.max(-10, Math.min(10, a)));
// Use clippedAdvantages instead of normalizedAdvantages
```

**Why**: Prevents extreme values from destabilizing training.

### 6. **Value Function Clipping**

**Current**: Standard MSE loss  
**Improved**: Clipped value loss (like PPO policy clipping)

**In `game.js` (PPOAgent.update)**:
```javascript
// Replace value loss calculation:
const valueLoss1 = tf.losses.meanSquaredError(returnTensor, tf.squeeze(values));
const valuePredClipped = tf.add(
    oldValueTensor,  // Need to store old values
    tf.clipByValue(
        tf.sub(tf.squeeze(values), oldValueTensor),
        -this.epsClip,
        this.epsClip
    )
);
const valueLoss2 = tf.losses.meanSquaredError(returnTensor, valuePredClipped);
const valueLoss = tf.maximum(valueLoss1, valueLoss2);
```

**Why**: Prevents value function from diverging too far, similar to PPO policy clipping.

### 7. **Better Reward Shaping**

**Current**: Basic reward function  
**Improved**: More informative rewards

**In `game.js` (calculateReward function)**:
```javascript
function calculateReward(prevScore, prevHealth, prevShields, prevCargoHealth) {
    const scoreReward = (gameState.score - prevScore) * 0.1;  // Score gains
    const healthReward = (player.health - prevHealth) * 2.0;  // Health recovery
    const shieldReward = (player.shields - prevShields) * 1.5;  // Shield recovery
    const survivalReward = player.health > 0 ? 0.1 : 0;  // Survival bonus
    
    // Cargo protection (mission mode)
    let cargoReward = 0;
    if (gameState.gameMode === 'mission' && cargoVessel) {
        const cargoHealthChange = cargoVessel.health - prevCargoHealth;
        cargoReward = cargoHealthChange * 3.0;  // Protect cargo
    }
    
    // Combat rewards
    const enemyKillReward = (gameState.enemiesKilled - prevEnemiesKilled) * 5.0;
    const asteroidMineReward = (gameState.asteroidsMined - prevAsteroidsMined) * 2.0;
    
    return scoreReward + healthReward + shieldReward + survivalReward + 
           cargoReward + enemyKillReward + asteroidMineReward;
}
```

**Why**: More informative rewards help the agent learn faster and make better decisions.

### 8. **More Frequent Training Updates**

**Current**: Every 5 episodes  
**Improved**: Every 2-3 episodes (or based on buffer size)

**In `game.js`**:
```javascript
// Change from:
const TRAINING_UPDATE_FREQUENCY = 5;

// To:
const TRAINING_UPDATE_FREQUENCY = 2;  // Or use buffer size threshold
```

**Why**: More frequent updates mean the agent learns from recent experiences faster.

### 9. **Improved Pre-training**

**In `pretrain_asteroid_droid.py`**:
```python
# Increase training samples and epochs:
pretrain_agent(
    num_samples=50000,  # Instead of 20000
    epochs=200,  # Instead of 100
    batch_size=128,  # Instead of 64
    output_file='pretrained_model.json'
)
```

**Why**: Better pre-training gives the agent a stronger starting point.

## Quick Implementation Guide

### Step 1: Improve Pre-training

```bash
python pretrain_asteroid_droid.py --samples 50000 --epochs 200 --output pretrained_model.json
```

This creates a better starting model.

### Step 2: Update game.js

Apply the improvements above to:
1. `PPOAgent.createPolicyNetwork()` - Larger network
2. `PPOAgent.update()` - More epochs, better normalization
3. `calculateReward()` - Better reward shaping
4. `TRAINING_UPDATE_FREQUENCY` - More frequent updates

### Step 3: Test and Monitor

1. Enable autopilot (press U)
2. Watch the training UI for:
   - Episode rewards increasing
   - Losses decreasing
   - Agent behavior improving
3. Let it train for many episodes (100+)

## Expected Improvements

With these changes:
- **30-50% better performance** (higher scores, longer survival)
- **Faster learning** (reaches good performance in fewer episodes)
- **More stable training** (less variance)
- **Better generalization** (handles new situations better)

## Monitoring Training

Watch for:
- ✅ Episode rewards steadily increasing
- ✅ Episode length increasing (survives longer)
- ✅ Policy loss decreasing
- ✅ Value loss decreasing
- ✅ Agent making smarter decisions (avoiding bullets, mining asteroids, etc.)

## Troubleshooting

**Agent not learning?**
- Check reward function (should be positive for good actions)
- Increase learning rate temporarily
- Check if observations are normalized correctly

**Agent stuck in local optimum?**
- Increase entropy coefficient (more exploration)
- Add noise to actions during training
- Increase learning rate decay

**Training too slow?**
- Reduce buffer size (faster updates)
- Reduce training epochs (faster per update)
- Use smaller network (faster inference)

## Next Steps

1. Start with improved pre-training
2. Update network architecture
3. Increase training epochs
4. Improve reward function
5. Monitor and adjust based on results

