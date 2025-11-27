// Weapon System
import { WEAPON_DEFAULTS } from '../utils/Constants.js';

export class WeaponSystem {
    constructor() {
        this.weapons = {
            primary: { cooldown: 0, ...WEAPON_DEFAULTS.primary },
            missile: { cooldown: 0, ...WEAPON_DEFAULTS.missile },
            laser: { cooldown: 0, ...WEAPON_DEFAULTS.laser },
            cluster: { cooldown: 0, ...WEAPON_DEFAULTS.cluster }
        };
    }

    canShoot(weaponType) {
        const weapon = this.weapons[weaponType];
        return weapon && weapon.cooldown === 0 && weapon.ammo > 0;
    }

    shoot(weaponType) {
        const weapon = this.weapons[weaponType];
        if (!this.canShoot(weaponType)) return null;

        weapon.cooldown = weapon.maxCooldown;
        if (weapon.ammo !== Infinity) weapon.ammo--;

        return {
            damage: weapon.damage,
            color: weapon.color,
            type: weaponType
        };
    }

    update() {
        // Update cooldowns
        Object.values(this.weapons).forEach(weapon => {
            if (weapon.cooldown > 0) {
                weapon.cooldown--;
            }
        });
    }

    reset() {
        this.weapons.primary.damage = WEAPON_DEFAULTS.primary.damage;
        this.weapons.missile.ammo = WEAPON_DEFAULTS.missile.ammo;
        this.weapons.laser.ammo = WEAPON_DEFAULTS.laser.ammo;
        this.weapons.cluster.ammo = WEAPON_DEFAULTS.cluster.ammo;
        this.weapons.primary.cooldown = 0;
        this.weapons.missile.cooldown = 0;
        this.weapons.laser.cooldown = 0;
        this.weapons.cluster.cooldown = 0;
    }

    getWeapon(weaponType) {
        return this.weapons[weaponType];
    }

    getAllWeapons() {
        return this.weapons;
    }
}



