// HUD (Heads-Up Display) Manager
export class HUD {
    constructor() {
        this.hudToggle = null;
        this.hudContent = null;
        this.initialized = false;
    }

    init() {
        this.hudToggle = document.getElementById('hudToggle');
        this.hudContent = document.getElementById('hudContent');
        
        if (this.hudToggle && this.hudContent) {
            this.hudToggle.addEventListener('click', () => {
                this.hudContent.classList.toggle('collapsed');
                this.hudToggle.textContent = this.hudContent.classList.contains('collapsed') ? '▲' : '▼';
            });
            this.initialized = true;
        }
    }

    updateScore(score) {
        const scoreElement = document.getElementById('score');
        if (scoreElement) {
            scoreElement.textContent = score;
        }
    }

    updateLevel(level) {
        const levelElement = document.getElementById('level');
        if (levelElement) {
            levelElement.textContent = level;
        }
    }

    updateHealth(health, maxHealth) {
        const healthText = document.getElementById('healthText');
        const healthFill = document.getElementById('healthFill');
        if (healthText) {
            healthText.textContent = `${Math.ceil(health)}/${maxHealth}`;
        }
        if (healthFill) {
            const percent = health / maxHealth;
            healthFill.style.width = `${percent * 100}%`;
        }
    }

    updateShields(shields, maxShields) {
        const shieldText = document.getElementById('shieldText');
        const shieldFill = document.getElementById('shieldFill');
        if (shieldText) {
            shieldText.textContent = `${Math.ceil(shields)}/${maxShields}`;
        }
        if (shieldFill) {
            const percent = shields / maxShields;
            shieldFill.style.width = `${percent * 100}%`;
        }
    }

    updateAllies(count) {
        const alliesElement = document.getElementById('allies');
        if (alliesElement) {
            alliesElement.textContent = count;
        }
    }

    updateWeapons(weapons) {
        // Update primary ammo
        const primaryAmmo = document.getElementById('primaryAmmo');
        if (primaryAmmo) {
            primaryAmmo.textContent = weapons.primary.ammo === Infinity ? '∞' : weapons.primary.ammo;
        }
        const primaryCooldown = document.getElementById('primaryCooldown');
        if (primaryCooldown) {
            const percent = weapons.primary.cooldown / weapons.primary.maxCooldown;
            primaryCooldown.style.width = `${(1 - percent) * 100}%`;
        }

        // Update missile ammo
        const missileAmmo = document.getElementById('missileAmmo');
        if (missileAmmo) {
            missileAmmo.textContent = weapons.missile.ammo;
        }
        const missileCooldown = document.getElementById('missileCooldown');
        if (missileCooldown) {
            const percent = weapons.missile.cooldown / weapons.missile.maxCooldown;
            missileCooldown.style.width = `${(1 - percent) * 100}%`;
        }

        // Update laser ammo
        const laserAmmo = document.getElementById('laserAmmo');
        if (laserAmmo) {
            laserAmmo.textContent = weapons.laser.ammo;
        }
        const laserCooldown = document.getElementById('laserCooldown');
        if (laserCooldown) {
            const percent = weapons.laser.cooldown / weapons.laser.maxCooldown;
            laserCooldown.style.width = `${(1 - percent) * 100}%`;
        }

        // Update cluster ammo
        const clusterAmmo = document.getElementById('clusterAmmo');
        if (clusterAmmo) {
            clusterAmmo.textContent = weapons.cluster.ammo;
        }
        const clusterCooldown = document.getElementById('clusterCooldown');
        if (clusterCooldown) {
            const percent = weapons.cluster.cooldown / weapons.cluster.maxCooldown;
            clusterCooldown.style.width = `${(1 - percent) * 100}%`;
        }
    }

    updateCargoHealth(health, maxHealth) {
        const cargoHealthStat = document.getElementById('cargoHealthStat');
        const cargoHealthText = document.getElementById('cargoHealthText');
        const cargoHealthFill = document.getElementById('cargoHealthFill');
        
        if (cargoHealthStat) {
            cargoHealthStat.style.display = 'block';
        }
        if (cargoHealthText) {
            cargoHealthText.textContent = `${Math.ceil(health)}/${maxHealth}`;
        }
        if (cargoHealthFill) {
            const percent = health / maxHealth;
            cargoHealthFill.style.width = `${percent * 100}%`;
        }
    }

    hideCargoHealth() {
        const cargoHealthStat = document.getElementById('cargoHealthStat');
        if (cargoHealthStat) {
            cargoHealthStat.style.display = 'none';
        }
    }
}



