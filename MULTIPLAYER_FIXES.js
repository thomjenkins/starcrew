// ============================================================================
// MULTIPLAYER SYNC IMPROVEMENTS - Apply these changes to game.js
// ============================================================================

// 1. Add this variable declaration near line 235 (with other multiplayer variables):
let previousRemoteAllies = new Map(); // Track previous ally states to detect destruction

// 2. Replace the 'playerUpdated' handler (around line 8670) with this improved version:
networkManager.on('playerUpdated', (data) => {
    // Remote player state updated
    if (data.player && data.player.id !== networkManager.getPlayerId()) {
        remotePlayers.set(data.player.id, data.player);
        
        // Store crew allocation if present
        if (data.player.cargoCrewAllocation) {
            remoteCrewAllocations.set(data.player.id, data.player.cargoCrewAllocation);
        }
        
        // Detect destroyed remote allies and show explosions
        const previousAllies = previousRemoteAllies.get(data.player.id) || [];
        const currentAllies = data.player.allies || [];
        
        // Find allies that were destroyed (in previous but not in current)
        previousAllies.forEach(prevAlly => {
            // Check if this ally still exists in current list
            // Match by ID if available, or by position if close enough
            const stillExists = currentAllies.some(currAlly => {
                if (prevAlly.id && currAlly.id) {
                    return currAlly.id === prevAlly.id;
                }
                // Fallback: check if position is very close (within 5 pixels)
                const dist = Math.hypot(currAlly.x - prevAlly.x, currAlly.y - prevAlly.y);
                return dist < 5;
            });
            
            if (!stillExists) {
                // Ally was destroyed - show explosion at last known position
                createExplosion(prevAlly.x, prevAlly.y, 25);
                sounds.enemyExplosion();
            }
        });
        
        // Store current allies as previous for next comparison
        if (data.player.allies && Array.isArray(data.player.allies)) {
            // Deep copy allies for comparison
            previousRemoteAllies.set(data.player.id, data.player.allies.map(a => ({
                x: a.x,
                y: a.y,
                id: a.id || null,
                health: a.health,
                maxHealth: a.maxHealth
            })));
            remoteAllies.set(data.player.id, data.player.allies);
        } else {
            previousRemoteAllies.delete(data.player.id);
            remoteAllies.delete(data.player.id);
        }
        
        // Store remote bullets if present
        if (data.player.bullets && Array.isArray(data.player.bullets)) {
            remoteBullets.set(data.player.id, data.player.bullets);
        }
        
        // Update UI if command module is open
        if (gameState.commandModuleOpen) {
            updateCommandModuleUI();
        }
    }
});

// 3. Update the 'playerLeft' handler (around line 8697) to clean up tracking:
networkManager.on('playerLeft', (data) => {
    remotePlayers.delete(data.playerId);
    remoteCrewAllocations.delete(data.playerId);
    remoteAllies.delete(data.playerId);
    remoteBullets.delete(data.playerId);
    previousRemoteAllies.delete(data.playerId); // Clean up tracking
    updatePlayerCountUI();
    
    // Update UI if command module is open
    if (gameState.commandModuleOpen) {
        updateCommandModuleUI();
    }
});

// 4. Replace the 'gameEntitiesUpdated' handler (around line 8711) with this improved version:
networkManager.on('gameEntitiesUpdated', (data) => {
    if (data.entities) {
        // Preserve tractor beam target if active
        let preservedTractorTarget = null;
        let preservedTractorTargetType = null;
        if (tractorBeam.active && tractorBeam.target) {
            preservedTractorTarget = tractorBeam.target;
            preservedTractorTargetType = tractorBeam.targetType;
        }
        
        // Sync entities
        if (data.entities.enemies) {
            enemies = data.entities.enemies;
            // Restore tractor beam target if it still exists
            if (preservedTractorTarget && preservedTractorTargetType === 'enemy') {
                const targetId = preservedTractorTarget.id;
                const newTarget = enemies.find(e => e.id === targetId);
                if (newTarget) {
                    tractorBeam.target = newTarget;
                } else {
                    // Target was destroyed, deactivate tractor beam
                    tractorBeam.active = false;
                    tractorBeam.target = null;
                    tractorBeam.targetType = null;
                }
            }
        }
        if (data.entities.asteroids) {
            asteroids = data.entities.asteroids;
            // Restore tractor beam target if it still exists
            if (preservedTractorTarget && preservedTractorTargetType === 'asteroid') {
                const targetId = preservedTractorTarget.id;
                const newTarget = asteroids.find(a => a.id === targetId);
                if (newTarget) {
                    tractorBeam.target = newTarget;
                } else {
                    // Target was destroyed, deactivate tractor beam
                    tractorBeam.active = false;
                    tractorBeam.target = null;
                    tractorBeam.targetType = null;
                }
            }
        }
        if (data.entities.bosses) {
            bosses = data.entities.bosses;
            // Restore tractor beam target if it still exists
            if (preservedTractorTarget && preservedTractorTargetType === 'boss') {
                const targetId = preservedTractorTarget.id;
                const newTarget = bosses.find(b => b.id === targetId);
                if (newTarget) {
                    tractorBeam.target = newTarget;
                } else {
                    // Target was destroyed, deactivate tractor beam
                    tractorBeam.active = false;
                    tractorBeam.target = null;
                    tractorBeam.targetType = null;
                }
            }
        }
        // Sync cargo vessel (only in mission mode)
        if (data.entities.cargoVessel && gameState.gameMode === 'mission') {
            cargoVessel = data.entities.cargoVessel;
        }
    }
});


