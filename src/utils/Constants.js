// Game Constants
export const MAX_PARTICLES = 200; // Limit total particles for performance

// Player defaults
export const PLAYER_DEFAULTS = {
    width: 40,
    height: 40,
    speed: 5,
    health: 100,
    maxHealth: 100,
    shields: 50,
    maxShields: 50,
    shieldRegen: 0.05,
    weaponLevel: 1,
    rotationSpeed: 0.08
};

// Tractor Beam defaults
export const TRACTOR_BEAM_DEFAULTS = {
    maxCharge: 100,
    maxDuration: 180, // frames (3 seconds at 60fps)
    rechargeRate: 0.5,
    drainRate: 0.6,
    range: 200
};

// Weapon defaults
export const WEAPON_DEFAULTS = {
    primary: {
        damage: 10,
        maxCooldown: 5,
        ammo: Infinity,
        color: '#ffff00'
    },
    missile: {
        damage: 50,
        maxCooldown: 60,
        ammo: 5,
        maxAmmo: 5,
        color: '#ff6600'
    },
    laser: {
        damage: 30,
        maxCooldown: 90,
        ammo: 3,
        maxAmmo: 3,
        color: '#00ffff'
    },
    cluster: {
        damage: 100,
        maxCooldown: 120,
        ammo: 0,
        maxAmmo: 0,
        color: '#ff00ff',
        spreadRadius: 150
    }
};

// Crew effects
export const CREW_EFFECTS = {
    shields: { regenMultiplier: 0.1 }, // 10% per crew
    engineering: { healthRegen: 0.5 }, // 0.5 HP/sec per crew
    weapons: { cooldownReduction: 0.05, damageBonus: 0.03 }, // 5% cooldown, 3% damage per crew
    navigation: { speedBonus: 0.05 } // 5% speed per crew
};

// Upgrade defaults
export const UPGRADE_DEFAULTS = {
    health: { level: 0, cost: 1 },
    shields: { level: 0, cost: 1 },
    speed: { level: 0, cost: 1 },
    primaryDamage: { level: 0, cost: 1 },
    missileDamage: { level: 0, cost: 1 },
    laserDamage: { level: 0, cost: 1 },
    shieldRegen: { level: 0, cost: 1 },
    ally: { level: 0, cost: 2 }
};

// Spawn defaults
export const SPAWN_DEFAULTS = {
    enemy: {
        maxAttempts: 20,
        minDistance: 120,
        edgeOffset: 50
    },
    asteroid: {
        minSize: 20,
        maxSize: 60
    }
};

// Mission mode defaults
export const MISSION_DEFAULTS = {
    cargoShipPrice: 2000,
    baseJourneyTime: 30000 // 30 seconds base journey time
};



