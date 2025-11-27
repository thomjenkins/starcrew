# Asteroid Droid - RL Training Guide

This guide explains how to train and use a reinforcement learning agent for Asteroid Droid.

## Quick Start

### 1. Collect Demo Data

1. Play the game normally - demo data is automatically collected
2. Click the 💾 button in the HUD to save your demo data
3. This downloads a JSON file with your gameplay data

### 2. Train the Agent

```bash
# Install dependencies (if not already installed)
pip install torch numpy

# Train the agent using your demo data
python train_asteroid_droid.py --demo_file asteroid_droid_demo_1234567890.json --epochs 20
```

This will:
- Load your demo data
- Train a neural network using behavioral cloning
- Save both PyTorch (.pth) and ONNX (.onnx) models

### 3. Use the Trained Agent

1. Place the `.onnx` model file in the `models/` directory
2. Name it `asteroid_droid_agent.onnx` (or update the path in `game.js`)
3. Press **U** during gameplay to toggle autopilot
4. Watch the AI agent play!

## Training Options

```bash
python train_asteroid_droid.py \
    --demo_file your_demo.json \
    --epochs 20 \
    --batch_size 64 \
    --lr 0.0003 \
    --output_dir models \
    --device cpu
```

### Arguments:
- `--demo_file`: Path to your demo data JSON file (required)
- `--epochs`: Number of training epochs (default: 20)
- `--batch_size`: Batch size for training (default: 64)
- `--lr`: Learning rate (default: 3e-4)
- `--output_dir`: Directory to save models (default: models)
- `--device`: Device to use - `cpu` or `cuda` (default: cpu)

## How It Works

### Observation Space (40 dimensions)
- Player state: position, rotation, health, shields, rotation speed
- Nearest 5 enemies: distance, angle, health for each
- Nearest 5 asteroids: distance, angle for each
- Weapon states: cooldowns and ammo
- Tractor beam: charge and active status
- Score and level

### Action Space (11 actions)
- Movement: UP, DOWN, LEFT, RIGHT
- Rotation: LEFT, RIGHT
- Weapons: PRIMARY, MISSILE, LASER
- Tractor beam activation
- NO_OP (do nothing)

### Training Method
The agent is trained using **Behavioral Cloning** - a form of imitation learning where the neural network learns to mimic player behavior from the demo data.

## Next Steps

1. **Collect more data**: Play more to get better training data
2. **Train longer**: Increase `--epochs` for better performance
3. **Fine-tune**: Adjust learning rate and batch size
4. **Add RL**: Extend training with reinforcement learning (PPO) after behavioral cloning

## Troubleshooting

- **Agent not loading**: Make sure the ONNX model is in the `models/` directory
- **Poor performance**: Collect more demo data or train for more epochs
- **Model too large**: The ONNX model should be < 1MB for web use


