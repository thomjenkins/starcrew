// Player Entity
import { PLAYER_DEFAULTS } from '../utils/Constants.js';

export class Player {
    constructor(x = 0, y = 0) {
        this.x = x;
        this.y = y;
        this.width = PLAYER_DEFAULTS.width;
        this.height = PLAYER_DEFAULTS.height;
        this.speed = PLAYER_DEFAULTS.speed;
        this.health = PLAYER_DEFAULTS.health;
        this.maxHealth = PLAYER_DEFAULTS.maxHealth;
        this.shields = PLAYER_DEFAULTS.shields;
        this.maxShields = PLAYER_DEFAULTS.maxShields;
        this.shieldRegen = PLAYER_DEFAULTS.shieldRegen;
        this.weaponLevel = PLAYER_DEFAULTS.weaponLevel;
        this.engineGlow = 0;
        this.rotation = 0; // Rotation angle in radians (0 = pointing up)
        this.rotationSpeed = PLAYER_DEFAULTS.rotationSpeed;
    }

    reset() {
        this.health = this.maxHealth;
        this.shields = this.maxShields;
        this.speed = PLAYER_DEFAULTS.speed;
        this.shieldRegen = PLAYER_DEFAULTS.shieldRegen;
        this.engineGlow = 0;
    }

    takeDamage(amount) {
        if (this.shields > 0) {
            this.shields = Math.max(0, this.shields - amount);
            if (this.shields < amount) {
                const remaining = amount - this.shields;
                this.shields = 0;
                this.health = Math.max(0, this.health - remaining);
            }
        } else {
            this.health = Math.max(0, this.health - amount);
        }
        return this.health <= 0;
    }

    regenerateShields() {
        if (this.shields < this.maxShields) {
            this.shields = Math.min(this.maxShields, this.shields + this.shieldRegen);
        }
    }
}



