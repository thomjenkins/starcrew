// Upgrade System
import { UPGRADE_DEFAULTS } from '../utils/Constants.js';

export class UpgradeSystem {
    constructor() {
        this.upgradePoints = 0;
        this.upgrades = JSON.parse(JSON.stringify(UPGRADE_DEFAULTS)); // Deep copy
    }

    addUpgradePoint() {
        this.upgradePoints++;
    }

    getUpgradePoints() {
        return this.upgradePoints;
    }

    getUpgrades() {
        return this.upgrades;
    }

    getUpgradeList() {
        return [
            { key: 'health', name: 'Health', cost: this.upgrades.health.cost, level: this.upgrades.health.level },
            { key: 'shields', name: 'Shields', cost: this.upgrades.shields.cost, level: this.upgrades.shields.level },
            { key: 'speed', name: 'Speed', cost: this.upgrades.speed.cost, level: this.upgrades.speed.level },
            { key: 'primaryDamage', name: 'Primary Damage', cost: this.upgrades.primaryDamage.cost, level: this.upgrades.primaryDamage.level },
            { key: 'missileDamage', name: 'Missile Damage', cost: this.upgrades.missileDamage.cost, level: this.upgrades.missileDamage.level },
            { key: 'laserDamage', name: 'Laser Damage', cost: this.upgrades.laserDamage.cost, level: this.upgrades.laserDamage.level },
            { key: 'shieldRegen', name: 'Shield Regen', cost: this.upgrades.shieldRegen.cost, level: this.upgrades.shieldRegen.level },
            { key: 'ally', name: 'Ally Ship', cost: this.upgrades.ally.cost, level: this.upgrades.ally.level }
        ];
    }

    applyUpgrade(key, player, weaponSystem) {
        if (this.upgradePoints < this.upgrades[key].cost) return false;
        
        this.upgradePoints -= this.upgrades[key].cost;
        this.upgrades[key].level++;

        // Apply upgrade effects
        switch(key) {
            case 'health':
                player.maxHealth += 20;
                player.health = player.maxHealth;
                break;
            case 'shields':
                player.maxShields += 10;
                player.shields = player.maxShields;
                break;
            case 'speed':
                player.speed += 0.5;
                break;
            case 'primaryDamage':
                // Damage is applied in shoot function
                break;
            case 'missileDamage':
                // Damage is applied in shoot function
                break;
            case 'laserDamage':
                // Damage is applied in shoot function
                break;
            case 'shieldRegen':
                player.shieldRegen += 0.02;
                break;
            case 'ally':
                // Ally spawning is handled separately
                break;
        }

        return true;
    }

    reset() {
        this.upgradePoints = 0;
        Object.keys(this.upgrades).forEach(key => {
            this.upgrades[key].level = 0;
        });
    }
}



