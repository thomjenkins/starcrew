let canvas;
let ctx;

// Game state
let gameState = {
    running: true,
    paused: false,
    score: 0,
    level: 1,
    enemiesKilled: 0,
    starfieldOffset: 0,
    gameMode: 'normal', // 'normal' or 'mission'
    missionComplete: false,
    commandModuleOpen: false,
    journeyCount: 0 // For mission mode
};

// Background image
let backgroundImage = null;
let backgroundImageLoaded = false;

function initBackground() {
    backgroundImage = new Image();
    backgroundImage.onload = () => {
        backgroundImageLoaded = true;
    };
    backgroundImage.onerror = () => {
        console.warn('Failed to load background.png, using black background');
        backgroundImageLoaded = false;
    };
    backgroundImage.src = 'background.png';
}

// Player
let player = {
    x: 0,
    y: 0,
    width: 40,
    height: 40,
    speed: 5,
    health: 100,
    maxHealth: 100,
    shields: 50,
    maxShields: 50,
    shieldRegen: 0.05,
    weaponLevel: 1,
    engineGlow: 0
};

// Weapons
const weapons = {
    primary: {
        damage: 10,
        cooldown: 0,
        maxCooldown: 5,
        ammo: Infinity,
        color: '#ffff00'
    },
    missile: {
        damage: 50,
        cooldown: 0,
        maxCooldown: 60,
        ammo: 5,
        maxAmmo: 5,
        color: '#ff6600'
    },
    laser: {
        damage: 30,
        cooldown: 0,
        maxCooldown: 90,
        ammo: 3,
        maxAmmo: 3,
        color: '#00ffff'
    },
    cluster: {
        damage: 100,
        cooldown: 0,
        maxCooldown: 120,
        ammo: 0,
        maxAmmo: 0,
        color: '#ff00ff',
        spreadRadius: 150 // How far the cluster spreads
    }
};

// Arrays
let bullets = [];
let enemies = [];
let asteroids = [];
let nebulas = [];
let powerups = [];
let allies = [];
let particles = [];
let explosions = [];

// Mission mode objects
let cargoVessel = null;
let startPlanet = null;
let endPlanet = null;

// Input
const keys = {};
let mouseX = 0;
let mouseY = 0;
let mouseActive = false;
let mouseButtonDown = false;

// Sound System
let audioContext;
let soundEnabled = true;

function initAudio() {
    try {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {
        console.warn('Web Audio API not supported');
        soundEnabled = false;
    }
}

function resumeAudioContext() {
    if (audioContext && audioContext.state === 'suspended') {
        audioContext.resume().catch(() => {});
    }
}

function playSound(frequency, duration, type = 'sine', volume = 0.3, startFreq = null) {
    if (!soundEnabled || !audioContext) return;
    
    // Resume audio context if suspended (browsers require user interaction)
    resumeAudioContext();
    
    try {
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.type = type;
        oscillator.frequency.setValueAtTime(startFreq || frequency, audioContext.currentTime);
        if (startFreq && startFreq !== frequency) {
            oscillator.frequency.exponentialRampToValueAtTime(frequency, audioContext.currentTime + duration);
        }
        
        gainNode.gain.setValueAtTime(0, audioContext.currentTime);
        gainNode.gain.linearRampToValueAtTime(volume, audioContext.currentTime + 0.01);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration);
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + duration);
    } catch (e) {
        // Silently fail if audio context is not available
    }
}

function playBeep(frequency, duration, volume = 0.2) {
    playSound(frequency, duration, 'sine', volume);
}

function playTone(frequency, duration, type = 'square', volume = 0.2) {
    playSound(frequency, duration, type, volume);
}

function playSweep(startFreq, endFreq, duration, volume = 0.2) {
    playSound(endFreq, duration, 'sine', volume, startFreq);
}

// Sound effects
const sounds = {
    primaryShot: () => {
        playBeep(800, 0.05, 0.15);
        playBeep(1000, 0.03, 0.1);
    },
    missileLaunch: () => {
        playSweep(200, 400, 0.2, 0.25);
        playBeep(300, 0.1, 0.15);
    },
    laserShot: () => {
        playTone(1200, 0.15, 'sawtooth', 0.2);
        playBeep(1500, 0.1, 0.15);
    },
    enemyExplosion: () => {
        playTone(100, 0.3, 'sawtooth', 0.3);
        playSweep(200, 50, 0.2, 0.2);
        playBeep(150, 0.1, 0.15);
    },
    asteroidExplosion: () => {
        playTone(80, 0.4, 'sawtooth', 0.25);
        playSweep(150, 40, 0.3, 0.15);
    },
    playerHit: () => {
        playTone(200, 0.2, 'square', 0.4);
        playBeep(150, 0.15, 0.3);
    },
    powerupCollect: () => {
        playSweep(400, 800, 0.3, 0.25);
        playBeep(600, 0.1, 0.2);
        playBeep(800, 0.1, 0.15);
    },
    enemyShot: () => {
        playBeep(400, 0.08, 0.15);
        playBeep(350, 0.05, 0.1);
    },
    levelUp: () => {
        playSweep(300, 600, 0.2, 0.3);
        setTimeout(() => playSweep(400, 800, 0.2, 0.3), 100);
        setTimeout(() => playSweep(500, 1000, 0.2, 0.3), 200);
    },
    allyShot: () => {
        playBeep(600, 0.06, 0.12);
        playBeep(700, 0.04, 0.08);
    }
};

// Upgrade system
let upgradePoints = 0;
const upgrades = {
    health: { level: 0, cost: 1 },
    shields: { level: 0, cost: 1 },
    speed: { level: 0, cost: 1 },
    primaryDamage: { level: 0, cost: 1 },
    missileDamage: { level: 0, cost: 1 },
    laserDamage: { level: 0, cost: 1 },
    shieldRegen: { level: 0, cost: 1 },
    ally: { level: 0, cost: 2 }
};

// Crew System
let crewMembers = [];
let totalCrew = 5;
let currency = 0;
let cumulativeCredits = 0; // Track total credits earned in current game session (resets on restart)
let crewAllocation = {
    shields: [],
    engineering: [],
    weapons: [],
    navigation: []
};
let isDraggingCrew = null;
let dragSourceStation = null;
let touchDragData = null; // Store drag data for touch events
let touchDragElement = null; // Store the element being dragged

// Cargo Ship Crew System
let cargoCrewMembers = [];
let cargoCrewAllocation = {
    engineering: [],
    navigation: []
};

// Crew effects
const crewEffects = {
    shields: { regenMultiplier: 0.1 }, // 10% per crew
    engineering: { healthRegen: 0.5 }, // 0.5 HP/sec per crew
    weapons: { cooldownReduction: 0.05, damageBonus: 0.03 }, // 5% cooldown, 3% damage per crew
    navigation: { speedBonus: 0.05 } // 5% speed per crew
};

// Event listeners
    window.addEventListener('resize', () => {
        if (canvas) {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        }
    });

document.addEventListener('keydown', (e) => {
    keys[e.key.toLowerCase()] = true;
    if (e.key === ' ') e.preventDefault();
    // Resume audio context on first user interaction
    resumeAudioContext();
    
    // Open/close command module
    if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') {
        if (gameState.commandModuleOpen) {
            closeCommandModule();
        } else if (e.key === 'Escape') {
            // ESC closes command module or upgrade menu
            if (gameState.commandModuleOpen) {
                closeCommandModule();
            } else if (!document.getElementById('upgradeMenu').classList.contains('hidden')) {
                document.getElementById('upgradeMenu').classList.add('hidden');
                gameState.paused = false;
            }
        } else if (!gameState.paused && gameState.running) {
            // P key opens command module only if not paused
            openCommandModule();
        }
    }
});

document.addEventListener('keyup', (e) => {
    keys[e.key.toLowerCase()] = false;
});

// Also resume on mouse click
document.addEventListener('click', resumeAudioContext);

// Mouse/trackpad movement tracking (will be set up after canvas is initialized)
function setupMouseControls() {
    if (!canvas) return;
    
    function updateMousePosition(e) {
        const rect = canvas.getBoundingClientRect();
        mouseX = e.clientX - rect.left;
        mouseY = e.clientY - rect.top;
        mouseActive = true;
    }
    
    function updateTouchPosition(e) {
        if (e.touches.length > 0) {
            const rect = canvas.getBoundingClientRect();
            mouseX = e.touches[0].clientX - rect.left;
            mouseY = e.touches[0].clientY - rect.top;
            mouseActive = true;
            e.preventDefault(); // Prevent scrolling
        }
    }
    
    // Mouse events
    canvas.addEventListener('mousemove', updateMousePosition);
    canvas.addEventListener('mouseleave', () => {
        mouseActive = false;
    });
    canvas.addEventListener('mouseenter', updateMousePosition);
    
    // Mouse button events for shooting
    canvas.addEventListener('mousedown', (e) => {
        if (e.button === 0) { // Left mouse button
            mouseButtonDown = true;
            e.preventDefault();
        }
    });
    
    canvas.addEventListener('mouseup', (e) => {
        if (e.button === 0) { // Left mouse button
            mouseButtonDown = false;
            e.preventDefault();
        }
    });
    
    // Also handle mouse leave to stop shooting
    canvas.addEventListener('mouseleave', () => {
        mouseButtonDown = false;
    });
    
    // Touch events for mobile/trackpad
    canvas.addEventListener('touchmove', (e) => {
        updateTouchPosition(e);
        mouseButtonDown = true; // Touch and drag = continuous shooting
    });
    
    canvas.addEventListener('touchstart', (e) => {
        updateTouchPosition(e);
        mouseButtonDown = true;
        e.preventDefault(); // Prevent scrolling
    });
    
    canvas.addEventListener('touchend', (e) => {
        mouseActive = false;
        mouseButtonDown = false;
        e.preventDefault();
    });
    
    canvas.addEventListener('touchcancel', (e) => {
        mouseActive = false;
        mouseButtonDown = false;
        e.preventDefault();
    });
}

// Draw starfield
function drawStarfield() {
    if (!ctx || !canvas) return;
    
    // Draw background image if loaded, otherwise black background
    if (backgroundImageLoaded && backgroundImage) {
        // Draw background image, scaled to cover the canvas
        ctx.drawImage(backgroundImage, 0, 0, canvas.width, canvas.height);
    } else {
        // Fallback to black background
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
}

// Draw game title in background
function drawGameTitle() {
    if (!ctx || !canvas) return;
    
    ctx.save();
    
    const title = "Star Crew";
    const fontSize = Math.max(60, canvas.width / 15);
    
    // Set font
    ctx.font = `bold ${fontSize}px Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    // Draw title with glow effect
    const x = canvas.width / 2;
    const y = canvas.height / 2;
    
    // Outer glow
    ctx.shadowBlur = 30;
    ctx.shadowColor = 'rgba(0, 150, 255, 0.5)';
    ctx.fillStyle = 'rgba(0, 150, 255, 0.15)';
    ctx.fillText(title, x, y);
    
    // Inner glow
    ctx.shadowBlur = 20;
    ctx.shadowColor = 'rgba(0, 200, 255, 0.4)';
    ctx.fillStyle = 'rgba(0, 200, 255, 0.2)';
    ctx.fillText(title, x, y);
    
    // Main text
    ctx.shadowBlur = 10;
    ctx.shadowColor = 'rgba(0, 255, 255, 0.6)';
    ctx.fillStyle = 'rgba(0, 255, 255, 0.25)';
    ctx.fillText(title, x, y);
    
    // Outline
    ctx.strokeStyle = 'rgba(0, 200, 255, 0.3)';
    ctx.lineWidth = 2;
    ctx.shadowBlur = 0;
    ctx.strokeText(title, x, y);
    
    ctx.restore();
}

// Player movement
function updatePlayer() {
    if (!canvas || !player || gameState.paused) return;
    
    // Ensure player position is valid
    if (isNaN(player.x)) player.x = canvas.width / 2;
    if (isNaN(player.y)) player.y = canvas.height - 100;
    
    // Apply navigation crew effect
    const speedMultiplier = 1 + (crewAllocation.navigation.length * crewEffects.navigation.speedBonus);
    const effectiveSpeed = player.speed * speedMultiplier;
    
    let wasMoving = false;
    
    // Mouse/trackpad control (takes priority if active)
    if (mouseActive && mouseX >= 0 && mouseY >= 0 && mouseX <= canvas.width && mouseY <= canvas.height) {
        const dx = mouseX - player.x;
        const dy = mouseY - player.y;
        const distance = Math.hypot(dx, dy);
        
        if (distance > 2) { // Only move if cursor is far enough away
            wasMoving = true;
            // Smooth movement towards mouse with speed limit
            const moveDistance = Math.min(distance, effectiveSpeed * 2);
            player.x += (dx / distance) * moveDistance;
            player.y += (dy / distance) * moveDistance;
            
            // Keep player within bounds
            player.x = Math.max(player.width / 2, Math.min(canvas.width - player.width / 2, player.x));
            player.y = Math.max(player.height / 2, Math.min(canvas.height - player.height / 2, player.y));
        }
    } else {
        // Keyboard control (fallback or alternative)
        wasMoving = keys['w'] || keys['arrowup'] || keys['s'] || keys['arrowdown'] || 
                     keys['a'] || keys['arrowleft'] || keys['d'] || keys['arrowright'];
        
        if (keys['w'] || keys['arrowup']) player.y = Math.max(player.height / 2, player.y - effectiveSpeed);
        if (keys['s'] || keys['arrowdown']) player.y = Math.min(canvas.height - player.height / 2, player.y + effectiveSpeed);
        if (keys['a'] || keys['arrowleft']) player.x = Math.max(player.width / 2, player.x - effectiveSpeed);
        if (keys['d'] || keys['arrowright']) player.x = Math.min(canvas.width - player.width / 2, player.x + effectiveSpeed);
    }

    // Engine glow effect
    if (wasMoving) {
        player.engineGlow = Math.min(1, player.engineGlow + 0.1);
    } else {
        player.engineGlow = Math.max(0, player.engineGlow - 0.05);
    }

    // Apply engineering crew effect (health regen)
    if (crewAllocation.engineering.length > 0) {
        const healthRegen = crewAllocation.engineering.length * crewEffects.engineering.healthRegen;
        player.health = Math.min(player.maxHealth, player.health + healthRegen * 0.1);
    }

    // Apply shields crew effect
    if (crewAllocation.shields.length > 0) {
        const shieldRegenBonus = 1 + (crewAllocation.shields.length * crewEffects.shields.regenMultiplier);
        if (player.shields < player.maxShields) {
            player.shields = Math.min(player.maxShields, player.shields + player.shieldRegen * shieldRegenBonus);
        }
    } else {
        // Normal shield regen
        if (player.shields < player.maxShields) {
            player.shields = Math.min(player.maxShields, player.shields + player.shieldRegen);
        }
    }

    // Weapon cooldowns (with crew effect)
    const weaponsCrewCount = crewAllocation.weapons.length;
    const cooldownMultiplier = Math.max(0.1, 1 - (weaponsCrewCount * crewEffects.weapons.cooldownReduction));
    
    Object.keys(weapons).forEach(weapon => {
        if (weapons[weapon].cooldown > 0) {
            weapons[weapon].cooldown = Math.max(0, weapons[weapon].cooldown - (1 - cooldownMultiplier));
        }
    });

    // Shooting
    // Mouse button or spacebar for primary weapon
    if ((keys[' '] || mouseButtonDown) && weapons.primary.cooldown === 0) {
        shoot('primary');
    }
    if (keys['1'] && weapons.missile.cooldown === 0 && weapons.missile.ammo > 0) {
        shoot('missile');
    }
    if (keys['2'] && weapons.laser.cooldown === 0 && weapons.laser.ammo > 0) {
        shoot('laser');
    }
    if (keys['3'] && weapons.cluster.cooldown === 0 && weapons.cluster.ammo > 0) {
        shoot('cluster');
    }
}

// Shooting
function shoot(weaponType) {
    const weapon = weapons[weaponType];
    
    if (weapon.cooldown > 0 || weapon.ammo <= 0) return;

    weapon.cooldown = weapon.maxCooldown;
    if (weapon.ammo !== Infinity) weapon.ammo--;

    let damage = weapon.damage * (1 + upgrades.primaryDamage.level * 0.1);
    // Apply weapons crew damage bonus
    const weaponsCrewCount = crewAllocation.weapons.length;
    const damageBonus = 1 + (weaponsCrewCount * crewEffects.weapons.damageBonus);
    damage = damage * damageBonus;
    
    if (weaponType === 'primary') {
        sounds.primaryShot();
        bullets.push({
            x: player.x,
            y: player.y - player.height / 2,
            vx: 0,
            vy: -8,
            damage: damage,
            color: weapon.color,
            size: 4,
            type: 'primary',
            glow: true
        });
        
        // Upgraded primary fires multiple shots
        if (upgrades.primaryDamage.level >= 2) {
            bullets.push({
                x: player.x - 15,
                y: player.y - player.height / 2,
                vx: -1,
                vy: -8,
                damage: damage * 0.8,
                color: weapon.color,
                size: 4,
                type: 'primary',
                glow: true
            });
            bullets.push({
                x: player.x + 15,
                y: player.y - player.height / 2,
                vx: 1,
                vy: -8,
                damage: damage * 0.8,
                color: weapon.color,
                size: 4,
                type: 'primary',
                glow: true
            });
        }
    } else if (weaponType === 'missile') {
        sounds.missileLaunch();
        bullets.push({
            x: player.x,
            y: player.y - player.height / 2,
            vx: 0,
            vy: -10,
            damage: damage,
            color: weapon.color,
            size: 8,
            type: 'missile',
            homing: true,
            glow: true,
            trail: []
        });
    } else if (weaponType === 'laser') {
        sounds.laserShot();
        bullets.push({
            x: player.x,
            y: player.y - player.height / 2,
            vx: 0,
            vy: -15,
            damage: damage,
            color: weapon.color,
            size: 6,
            type: 'laser',
            pierce: true,
            glow: true
        });
    } else if (weaponType === 'cluster') {
        sounds.missileLaunch();
        bullets.push({
            x: player.x,
            y: player.y - player.height / 2,
            vx: 0,
            vy: -12,
            damage: damage,
            color: weapon.color,
            size: 10,
            type: 'cluster',
            glow: true,
            clusterSpread: true // Mark as cluster bullet
        });
    }
}

// Update bullets
function updateBullets() {
    bullets = bullets.filter(bullet => {
        bullet.x += bullet.vx;
        bullet.y += bullet.vy;

        // Missile trail
        if (bullet.trail) {
            bullet.trail.push({ x: bullet.x, y: bullet.y });
            if (bullet.trail.length > 5) bullet.trail.shift();
        }

        // Homing missiles
        if (bullet.homing && enemies.length > 0) {
            const nearest = enemies.reduce((closest, enemy) => {
                const dist = Math.hypot(enemy.x - bullet.x, enemy.y - bullet.y);
                const closestDist = Math.hypot(closest.x - bullet.x, closest.y - bullet.y);
                return dist < closestDist ? enemy : closest;
            });
            
            const dx = nearest.x - bullet.x;
            const dy = nearest.y - bullet.y;
            const dist = Math.hypot(dx, dy);
            bullet.vx += (dx / dist) * 0.3;
            bullet.vy += (dy / dist) * 0.3;
        }

        let shouldRemove = false;

        // Check collisions with enemies (only for player bullets)
        if (bullet.type === 'primary' || bullet.type === 'missile' || bullet.type === 'laser' || bullet.type === 'ally' || bullet.type === 'cluster') {
            for (let i = 0; i < enemies.length; i++) {
                const enemy = enemies[i];
                if (checkCollision(bullet, enemy)) {
                    enemy.health -= bullet.damage;
                    
                    // Cluster weapon spread effect
                    if (bullet.type === 'cluster' && bullet.clusterSpread) {
                        createExplosion(bullet.x, bullet.y, 30);
                        sounds.enemyExplosion();
                        
                        // Spread to nearby enemies
                        const spreadRadius = weapons.cluster.spreadRadius;
                        const spreadDamage = bullet.damage * 0.7; // 70% damage on spread
                        const hitEnemies = new Set([i]); // Track which enemies we've hit
                        
                        // Function to recursively spread
                        function spreadCluster(centerX, centerY, depth) {
                            if (depth > 3) return; // Limit spread depth to prevent infinite loops
                            
                            for (let j = 0; j < enemies.length; j++) {
                                if (hitEnemies.has(j)) continue; // Skip already hit enemies
                                
                                const dist = Math.hypot(enemies[j].x - centerX, enemies[j].y - centerY);
                                if (dist < spreadRadius) {
                                    enemies[j].health -= spreadDamage;
                                    hitEnemies.add(j);
                                    createExplosion(enemies[j].x, enemies[j].y, 20);
                                    
                                    // Continue spreading from this enemy
                                    spreadCluster(enemies[j].x, enemies[j].y, depth + 1);
                                }
                            }
                        }
                        
                        spreadCluster(bullet.x, bullet.y, 0);
                    }
                    
                    if (!bullet.pierce && bullet.type !== 'cluster') {
                        createExplosion(bullet.x, bullet.y, 10);
                        shouldRemove = true;
                        break;
                    }
                    if (bullet.type === 'cluster') {
                        shouldRemove = true;
                        break;
                    }
                }
            }
        }

        // Check collisions with asteroids (only for player bullets, cluster doesn't spread on asteroids)
        if (!shouldRemove && (bullet.type === 'primary' || bullet.type === 'missile' || bullet.type === 'laser' || bullet.type === 'ally' || bullet.type === 'cluster')) {
            for (let i = 0; i < asteroids.length; i++) {
                const asteroid = asteroids[i];
                if (checkCollision(bullet, asteroid)) {
                    asteroid.health -= bullet.damage;
                    if (!bullet.pierce || bullet.type === 'cluster') {
                        createExplosion(bullet.x, bullet.y, 10);
                        shouldRemove = true;
                        break;
                    }
                }
            }
        }

        // Remove bullet if it hit something (and doesn't pierce) or is out of bounds
        if (shouldRemove) {
            return false;
        }

        return bullet.y > -20 && bullet.y < canvas.height + 20 && 
               bullet.x > -20 && bullet.x < canvas.width + 20;
    });
}

// Spawn enemies
function spawnEnemy() {
    // Difficulty scales with cumulative credits (every 100 credits = 1 difficulty level)
    const creditDifficulty = cumulativeCredits / 100;
    const difficulty = creditDifficulty * 0.05; // Slower speed increase
    const x = Math.random() * canvas.width;
    const hue = Math.random() * 60;
    enemies.push({
        x: x,
        y: -30,
        width: 30 + Math.random() * 20,
        height: 30 + Math.random() * 20,
        vx: (Math.random() - 0.5) * 2,
        vy: 0.5 + Math.random() * 1.5 + difficulty, // Start slower
        health: 30 + creditDifficulty * 8, // More gradual health increase
        maxHealth: 30 + creditDifficulty * 8,
        color: `hsl(${hue}, 70%, 50%)`,
        glowColor: `hsl(${hue}, 100%, 60%)`,
        shootCooldown: Math.max(40, 90 - creditDifficulty * 2), // More gradual shooting speed increase
        damage: 10 + creditDifficulty * 1.5, // More gradual damage increase
        rotation: 0,
        rotationSpeed: (Math.random() - 0.5) * 0.05,
        lastNebulaDamageTime: 0 // Track nebula damage
    });
}

// Spawn asteroids
function spawnAsteroid() {
    const size = 20 + Math.random() * 40;
    // Difficulty scales with cumulative credits (every 100 credits = 1 difficulty level)
    const creditDifficulty = cumulativeCredits / 100;
    const difficulty = creditDifficulty * 0.05; // More gradual speed increase
    asteroids.push({
        x: Math.random() * canvas.width,
        y: -size,
        width: size,
        height: size,
        vx: (Math.random() - 0.5) * 3,
        vy: 0.5 + Math.random() * 1.5 + difficulty, // Start slower
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 0.1,
        health: size * 2 + creditDifficulty * 2, // More gradual health increase
        maxHealth: size * 2 + creditDifficulty * 2,
        color: '#888',
        points: []
    });
    
    // Generate random asteroid shape
    const asteroid = asteroids[asteroids.length - 1];
    const pointCount = 8 + Math.floor(Math.random() * 4);
    for (let i = 0; i < pointCount; i++) {
        const angle = (i / pointCount) * Math.PI * 2;
        const radius = asteroid.width / 2 * (0.7 + Math.random() * 0.3);
        asteroid.points.push({
            angle: angle,
            radius: radius
        });
    }
}

// Spawn nebulas
function spawnNebula() {
    const size = 80 + Math.random() * 120;
    const hue = 240 + Math.random() * 60; // Purple/blue colors
    
    // Spawn from a random edge of the screen
    const edge = Math.floor(Math.random() * 4); // 0=top, 1=right, 2=bottom, 3=left
    let x, y, vx, vy;
    
    switch(edge) {
        case 0: // Top
            x = Math.random() * canvas.width;
            y = -size / 2;
            vx = (Math.random() - 0.5) * 0.5;
            vy = 0.3 + Math.random() * 0.3; // Move downward
            break;
        case 1: // Right
            x = canvas.width + size / 2;
            y = Math.random() * canvas.height;
            vx = -(0.3 + Math.random() * 0.3); // Move leftward
            vy = (Math.random() - 0.5) * 0.5;
            break;
        case 2: // Bottom
            x = Math.random() * canvas.width;
            y = canvas.height + size / 2;
            vx = (Math.random() - 0.5) * 0.5;
            vy = -(0.3 + Math.random() * 0.3); // Move upward
            break;
        case 3: // Left
            x = -size / 2;
            y = Math.random() * canvas.height;
            vx = 0.3 + Math.random() * 0.3; // Move rightward
            vy = (Math.random() - 0.5) * 0.5;
            break;
    }
    
    nebulas.push({
        x: x,
        y: y,
        width: size,
        height: size,
        vx: vx,
        vy: vy,
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 0.02,
        color: `hsl(${hue}, 70%, 50%)`,
        glowColor: `hsl(${hue}, 100%, 70%)`,
        damagePerSecond: 2 + (cumulativeCredits / 100) * 0.5, // Scale with cumulative credits
        lastPlayerDamageTime: 0,
        lastCargoDamageTime: 0
    });
}

// Update nebulas
function updateNebulas() {
    const now = Date.now();
    
    nebulas = nebulas.filter(nebula => {
        // Move nebula slowly
        nebula.x += nebula.vx;
        nebula.y += nebula.vy;
        nebula.rotation += nebula.rotationSpeed;
        
        // Remove nebula if it goes completely off screen (opposite side from where it entered)
        const margin = nebula.width;
        if (nebula.x < -margin || nebula.x > canvas.width + margin ||
            nebula.y < -margin || nebula.y > canvas.height + margin) {
            return false; // Remove this nebula
        }
        
        // Keep nebula in bounds (but allow it to drift off screen)
        // Only constrain if it's trying to go back the way it came
        if (nebula.vx > 0 && nebula.x > canvas.width - nebula.width / 2) {
            nebula.vx *= -0.5; // Slow down and reverse slightly
        }
        if (nebula.vx < 0 && nebula.x < nebula.width / 2) {
            nebula.vx *= -0.5;
        }
        if (nebula.vy > 0 && nebula.y > canvas.height - nebula.height / 2) {
            nebula.vy *= -0.5;
        }
        if (nebula.vy < 0 && nebula.y < nebula.height / 2) {
            nebula.vy *= -0.5;
        }
        
        return true; // Keep this nebula
    });
    
    nebulas.forEach(nebula => {
        
        // Check collision with player (damage over time)
        if (checkCollision(nebula, player)) {
            if (now - nebula.lastPlayerDamageTime > 500) { // Damage every 500ms
                takeDamage(nebula.damagePerSecond * 0.5);
                nebula.lastPlayerDamageTime = now;
                // Create small particles for visual feedback
                for (let i = 0; i < 3; i++) {
                    particles.push({
                        x: player.x + (Math.random() - 0.5) * 20,
                        y: player.y + (Math.random() - 0.5) * 20,
                        vx: (Math.random() - 0.5) * 2,
                        vy: (Math.random() - 0.5) * 2,
                        life: 10,
                        maxLife: 10,
                        size: 3,
                        color: nebula.glowColor,
                        glow: true
                    });
                }
            }
        }
        
        // Check collision with cargo vessel in mission mode
        if (gameState.gameMode === 'mission' && cargoVessel && checkCollision(nebula, cargoVessel)) {
            if (now - nebula.lastCargoDamageTime > 500) {
                cargoVessel.health -= nebula.damagePerSecond * 0.5;
                nebula.lastCargoDamageTime = now;
                // Create particles
                for (let i = 0; i < 3; i++) {
                    particles.push({
                        x: cargoVessel.x + (Math.random() - 0.5) * 20,
                        y: cargoVessel.y + (Math.random() - 0.5) * 20,
                        vx: (Math.random() - 0.5) * 2,
                        vy: (Math.random() - 0.5) * 2,
                        life: 10,
                        maxLife: 10,
                        size: 3,
                        color: nebula.glowColor,
                        glow: true
                    });
                }
            }
        }
        
        // Check collision with enemies (damage over time)
        enemies.forEach(enemy => {
            if (checkCollision(nebula, enemy)) {
                if (now - enemy.lastNebulaDamageTime > 500) { // Damage every 500ms
                    enemy.health -= nebula.damagePerSecond * 0.5;
                    enemy.lastNebulaDamageTime = now;
                    // Create particles for visual feedback
                    for (let i = 0; i < 2; i++) {
                        particles.push({
                            x: enemy.x + (Math.random() - 0.5) * 15,
                            y: enemy.y + (Math.random() - 0.5) * 15,
                            vx: (Math.random() - 0.5) * 2,
                            vy: (Math.random() - 0.5) * 2,
                            life: 10,
                            maxLife: 10,
                            size: 2,
                            color: nebula.glowColor,
                            glow: true
                        });
                    }
                }
            }
        });
    });
    
    // Remove nebulas that are too old (optional - or keep them forever)
    // For now, keep them but limit count
    if (nebulas.length > 5) {
        nebulas.shift(); // Remove oldest
    }
}

// Draw nebulas
function drawNebulas() {
    nebulas.forEach(nebula => {
        ctx.save();
        ctx.translate(nebula.x, nebula.y);
        ctx.rotate(nebula.rotation);
        
        // Create gradient for nebula
        const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, nebula.width / 2);
        gradient.addColorStop(0, nebula.glowColor);
        gradient.addColorStop(0.3, nebula.color);
        gradient.addColorStop(0.7, hexToRgba(nebula.color, 0.5));
        gradient.addColorStop(1, hexToRgba(nebula.color, 0));
        
        // Outer glow
        ctx.shadowBlur = 30;
        ctx.shadowColor = nebula.glowColor;
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.ellipse(0, 0, nebula.width / 2, nebula.height / 2, 0, 0, Math.PI * 2);
        ctx.fill();
        
        // Inner core
        ctx.shadowBlur = 0;
        const coreGradient = ctx.createRadialGradient(0, 0, 0, 0, 0, nebula.width / 4);
        coreGradient.addColorStop(0, '#ffffff');
        coreGradient.addColorStop(0.5, nebula.glowColor);
        coreGradient.addColorStop(1, 'transparent');
        ctx.fillStyle = coreGradient;
        ctx.beginPath();
        ctx.ellipse(0, 0, nebula.width / 4, nebula.height / 4, 0, 0, Math.PI * 2);
        ctx.fill();
        
        // Add some wispy clouds
        ctx.globalAlpha = 0.3;
        for (let i = 0; i < 5; i++) {
            const angle = (i / 5) * Math.PI * 2 + nebula.rotation;
            const dist = nebula.width / 3;
            const cloudX = Math.cos(angle) * dist;
            const cloudY = Math.sin(angle) * dist;
            const cloudSize = nebula.width / 6;
            
            const cloudGradient = ctx.createRadialGradient(cloudX, cloudY, 0, cloudX, cloudY, cloudSize);
            cloudGradient.addColorStop(0, hexToRgba(nebula.color, 0.6));
            cloudGradient.addColorStop(1, 'transparent');
            ctx.fillStyle = cloudGradient;
            ctx.beginPath();
            ctx.arc(cloudX, cloudY, cloudSize, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
        
        ctx.restore();
    });
}

// Update enemies
function updateEnemies() {
    enemies = enemies.filter(enemy => {
        enemy.x += enemy.vx;
        enemy.y += enemy.vy;
        enemy.rotation += enemy.rotationSpeed;
        enemy.shootCooldown--;

        // Enemy shooting
        if (enemy.shootCooldown <= 0 && enemy.y > 0) {
            enemy.shootCooldown = 60 + Math.random() * 60;
            sounds.enemyShot();
            
            // In mission mode, enemies sometimes target cargo vessel
            let targetX = player.x;
            let targetY = player.y;
            
            if (gameState.gameMode === 'mission' && cargoVessel && Math.random() < 0.4) {
                targetX = cargoVessel.x;
                targetY = cargoVessel.y;
            }
            
            const dx = targetX - enemy.x;
            const dy = targetY - enemy.y;
            const dist = Math.hypot(dx, dy);
            bullets.push({
                x: enemy.x,
                y: enemy.y + enemy.height / 2,
                vx: (dx / dist) * 3,
                vy: (dy / dist) * 3,
                damage: enemy.damage,
                color: '#ff0000',
                size: 4,
                type: 'enemy',
                glow: true
            });
        }

        // Check collision with player
        if (checkCollision(enemy, player)) {
            takeDamage(enemy.damage);
            sounds.enemyExplosion();
            createExplosion(enemy.x, enemy.y, 30);
            gameState.score += 50;
            gameState.enemiesKilled++;
            // Award credits in normal mode
            if (gameState.gameMode === 'normal') {
                currency += 5;
                cumulativeCredits += 5; // Track cumulative credits
            }
            return false;
        }
        
        // Check collision with cargo vessel in mission mode
        if (gameState.gameMode === 'mission' && cargoVessel && checkCollision(enemy, cargoVessel)) {
            cargoVessel.health -= enemy.damage * 2;
            sounds.enemyExplosion();
            createExplosion(enemy.x, enemy.y, 30);
            gameState.score += 50;
            gameState.enemiesKilled++;
            return false;
        }

        if (enemy.health <= 0) {
            sounds.enemyExplosion();
            createExplosion(enemy.x, enemy.y, 30);
            gameState.score += 50;
            gameState.enemiesKilled++;
            // Award credits in normal mode
            if (gameState.gameMode === 'normal') {
                currency += 5;
                cumulativeCredits += 5; // Track cumulative credits
            }
            
            // Drop powerup
            if (Math.random() < 0.3) {
                spawnPowerup(enemy.x, enemy.y);
            }
            return false;
        }

        return enemy.y < canvas.height + 50;
    });
}

// Update asteroids
function updateAsteroids() {
    asteroids = asteroids.filter(asteroid => {
        asteroid.x += asteroid.vx;
        asteroid.y += asteroid.vy;
        asteroid.rotation += asteroid.rotationSpeed;

        // Check collision with player
        if (checkCollision(asteroid, player)) {
            takeDamage(asteroid.width * 0.5);
            sounds.asteroidExplosion();
            createExplosion(asteroid.x, asteroid.y, asteroid.width);
            gameState.score += 20;
            // Award credits in normal mode
            if (gameState.gameMode === 'normal') {
                currency += 2;
                cumulativeCredits += 2; // Track cumulative credits
            }
            return false;
        }
        
        // Check collision with cargo vessel in mission mode
        if (gameState.gameMode === 'mission' && cargoVessel && checkCollision(asteroid, cargoVessel)) {
            cargoVessel.health -= asteroid.width * 0.8;
            sounds.asteroidExplosion();
            createExplosion(asteroid.x, asteroid.y, asteroid.width);
            gameState.score += 20;
            return false;
        }

        if (asteroid.health <= 0) {
            sounds.asteroidExplosion();
            createExplosion(asteroid.x, asteroid.y, asteroid.width);
            gameState.score += 20;
            // Award credits in normal mode
            if (gameState.gameMode === 'normal') {
                currency += 2;
                cumulativeCredits += 2; // Track cumulative credits
            }
            
            // Drop powerup
            if (Math.random() < 0.2) {
                spawnPowerup(asteroid.x, asteroid.y);
            }
            return false;
        }

        return asteroid.y < canvas.height + 50;
    });
}

// Powerups
function spawnPowerup(x, y) {
    const types = ['health', 'shield', 'ammo', 'upgrade'];
    const type = types[Math.floor(Math.random() * types.length)];
    
    powerups.push({
        x: x,
        y: y,
        width: 20,
        height: 20,
        vy: 2,
        type: type,
        rotation: 0,
        rotationSpeed: 0.05,
        pulse: 0
    });
}

function updatePowerups() {
    powerups = powerups.filter(powerup => {
        powerup.y += powerup.vy;
        powerup.rotation += powerup.rotationSpeed;
        powerup.pulse += 0.1;

        if (checkCollision(powerup, player)) {
            collectPowerup(powerup.type);
            return false;
        }

        return powerup.y < canvas.height + 20;
    });
}

function collectPowerup(type) {
    sounds.powerupCollect();
    if (type === 'health') {
        player.health = Math.min(player.maxHealth, player.health + 30);
    } else if (type === 'shield') {
        player.shields = Math.min(player.maxShields, player.shields + 25);
    } else if (type === 'ammo') {
        weapons.missile.ammo = Math.min(weapons.missile.maxAmmo, weapons.missile.ammo + 2);
        weapons.laser.ammo = Math.min(weapons.laser.maxAmmo, weapons.laser.ammo + 1);
    } else if (type === 'upgrade') {
        upgradePoints++;
        showUpgradeMenu();
    }
}

// Allies
function spawnAlly() {
    allies.push({
        x: player.x + (Math.random() - 0.5) * 100,
        y: player.y + (Math.random() - 0.5) * 100,
        width: 25,
        height: 25,
        speed: 3,
        shootCooldown: 0,
        maxShootCooldown: 30,
        damage: 15,
        offsetAngle: Math.random() * Math.PI * 2,
        orbitRadius: 80 + Math.random() * 40
    });
}

function updateAllies() {
    allies.forEach((ally, index) => {
        // Orbit around player or cargo vessel
        const target = ally.isCargoAlly ? ally.target : player;
        if (!target) return;
        
        const angle = Date.now() * 0.001 + ally.offsetAngle + (index * Math.PI * 2 / allies.length);
        ally.x = target.x + Math.cos(angle) * ally.orbitRadius;
        ally.y = target.y + Math.sin(angle) * ally.orbitRadius;

        ally.shootCooldown--;
        if (ally.shootCooldown <= 0 && enemies.length > 0) {
            const nearest = enemies.reduce((closest, enemy) => {
                const dist = Math.hypot(enemy.x - ally.x, enemy.y - ally.y);
                const closestDist = Math.hypot(closest.x - ally.x, closest.y - ally.y);
                return dist < closestDist ? enemy : closest;
            });

            const dx = nearest.x - ally.x;
            const dy = nearest.y - ally.y;
            const dist = Math.hypot(dx, dy);

            if (dist < 400) {
                ally.shootCooldown = ally.maxShootCooldown;
                sounds.allyShot();
                bullets.push({
                    x: ally.x,
                    y: ally.y,
                    vx: (dx / dist) * 6,
                    vy: (dy / dist) * 6,
                    damage: ally.damage,
                    color: '#00ff00',
                    size: 4,
                    type: 'ally',
                    glow: true
                });
            }
        }
    });
}

// Collision detection
function checkCollision(obj1, obj2) {
    // Handle bullets (which have 'size' instead of 'width'/'height')
    const w1 = obj1.width || obj1.size || 0;
    const h1 = obj1.height || obj1.size || 0;
    const w2 = obj2.width || obj2.size || 0;
    const h2 = obj2.height || obj2.size || 0;
    
    return obj1.x - w1 / 2 < obj2.x + w2 / 2 &&
           obj1.x + w1 / 2 > obj2.x - w2 / 2 &&
           obj1.y - h1 / 2 < obj2.y + h2 / 2 &&
           obj1.y + h1 / 2 > obj2.y - h2 / 2;
}

// Damage system
function takeDamage(amount) {
    sounds.playerHit();
    if (player.shields > 0) {
        player.shields = Math.max(0, player.shields - amount);
        if (player.shields < amount) {
            const remaining = amount - player.shields;
            player.shields = 0;
            player.health = Math.max(0, player.health - remaining);
        }
    } else {
        player.health = Math.max(0, player.health - amount);
    }

    if (player.health <= 0) {
        gameOver();
    }
}

// Explosions
const MAX_PARTICLES = 200; // Limit total particles for performance

function createExplosion(x, y, size) {
    // Reduce particle count and cap it
    const particleCount = Math.min(8 + Math.floor(size / 3), 25);
    
    // Don't create more particles if we're at the limit
    if (particles.length >= MAX_PARTICLES) {
        return;
    }
    
    const availableSlots = MAX_PARTICLES - particles.length;
    const actualCount = Math.min(particleCount, availableSlots);
    
    for (let i = 0; i < actualCount; i++) {
        const angle = (i / actualCount) * Math.PI * 2;
        const speed = 2 + Math.random() * 6;
        particles.push({
            x: x,
            y: y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            life: 20 + Math.random() * 15,
            maxLife: 20 + Math.random() * 15,
            size: Math.min(size * 0.15 + Math.random() * size * 0.2, 8),
            color: `hsl(${Math.random() * 60}, 100%, ${50 + Math.random() * 50}%)`,
            glow: true
        });
    }
}

function updateParticles() {
    // More efficient: use for loop and splice instead of filter for better performance
    for (let i = particles.length - 1; i >= 0; i--) {
        const particle = particles[i];
        particle.x += particle.vx;
        particle.y += particle.vy;
        particle.vx *= 0.96;
        particle.vy *= 0.96;
        particle.life--;
        
        if (particle.life <= 0) {
            particles.splice(i, 1);
        }
    }
}

// Upgrade system
function showUpgradeMenu() {
    const menu = document.getElementById('upgradeMenu');
    const options = document.getElementById('upgradeOptions');
    options.innerHTML = '';

    // Pause the game
    gameState.paused = true;

    const upgradeList = [
        { key: 'health', name: 'Max Health +20', desc: 'Increases maximum health' },
        { key: 'shields', name: 'Max Shields +15', desc: 'Increases maximum shields' },
        { key: 'speed', name: 'Speed +1', desc: 'Increases movement speed' },
        { key: 'primaryDamage', name: 'Primary Damage +10%', desc: 'Increases primary weapon damage' },
        { key: 'missileDamage', name: 'Missile Damage +10%', desc: 'Increases missile damage' },
        { key: 'laserDamage', name: 'Laser Damage +10%', desc: 'Increases laser damage' },
        { key: 'shieldRegen', name: 'Shield Regen +0.02', desc: 'Increases shield regeneration' },
        { key: 'ally', name: 'Player Ally Ship', desc: 'Adds an ally ship to help you' },
        { key: 'cargoAlly', name: 'Cargo Ship Ally', desc: 'Adds an ally ship to protect the cargo vessel' }
    ];

    upgradeList.forEach(upgrade => {
        const option = document.createElement('div');
        option.className = 'upgrade-option';
        option.innerHTML = `
            <h4>${upgrade.name}</h4>
            <p>${upgrade.desc}</p>
        `;
        option.addEventListener('click', () => {
            applyUpgrade(upgrade.key);
            menu.classList.add('hidden');
            gameState.paused = false;
        });
        options.appendChild(option);
    });

    menu.classList.remove('hidden');
}

function applyUpgrade(key) {
    if (upgradePoints <= 0) return;
    
    const upgrade = upgrades[key];
    upgradePoints--;

    if (key === 'health') {
        player.maxHealth += 20;
        player.health += 20;
    } else if (key === 'shields') {
        player.maxShields += 15;
        player.shields += 15;
    } else if (key === 'speed') {
        player.speed += 1;
    } else if (key === 'shieldRegen') {
        player.shieldRegen += 0.02;
    } else if (key === 'ally') {
        spawnAlly();
    } else if (key === 'cargoAlly') {
        spawnCargoAlly();
    } else {
        upgrade.level++;
    }
}

function spawnCargoAlly() {
    if (!cargoVessel) return;
    allies.push({
        x: cargoVessel.x + (Math.random() - 0.5) * 100,
        y: cargoVessel.y + (Math.random() - 0.5) * 100,
        width: 25,
        height: 25,
        speed: 3,
        shootCooldown: 0,
        maxShootCooldown: 30,
        damage: 15,
        offsetAngle: Math.random() * Math.PI * 2,
        orbitRadius: 80 + Math.random() * 40,
        isCargoAlly: true,
        target: cargoVessel
    });
}

// Enemy bullets collision
function updateEnemyBullets() {
    const enemyBullets = bullets.filter(b => b.type === 'enemy');
    enemyBullets.forEach(bullet => {
        if (checkCollision(bullet, player)) {
            takeDamage(bullet.damage);
            // Remove the bullet from the array
            const index = bullets.indexOf(bullet);
            if (index > -1) {
                bullets.splice(index, 1);
            }
        }
        
        // Check collision with cargo vessel in mission mode
        if (gameState.gameMode === 'mission' && cargoVessel && checkCollision(bullet, cargoVessel)) {
            cargoVessel.health -= bullet.damage;
            createExplosion(bullet.x, bullet.y, 10);
            const index = bullets.indexOf(bullet);
            if (index > -1) {
                bullets.splice(index, 1);
            }
        }
    });
}

// Helper function to convert hex color to rgba
function hexToRgba(hex, alpha) {
    if (!hex || typeof hex !== 'string') {
        return `rgba(255, 255, 255, ${alpha})`;
    }
    // Remove # if present
    hex = hex.replace('#', '');
    // Ensure we have 6 characters
    if (hex.length !== 6) {
        return `rgba(255, 255, 255, ${alpha})`;
    }
    // Parse hex to RGB
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    // Validate parsed values
    if (isNaN(r) || isNaN(g) || isNaN(b)) {
        return `rgba(255, 255, 255, ${alpha})`;
    }
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// Enhanced rendering functions
function drawPlayer() {
    if (!ctx || !player || isNaN(player.x) || isNaN(player.y)) return;
    
    ctx.save();
    ctx.translate(player.x, player.y);
    
    // Health bar above ship
    const healthPercent = player.health / player.maxHealth;
    const barWidth = player.width + 10;
    const barHeight = 4;
    const barY = -player.height / 2 - 15;
    
    // Health bar background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(-barWidth / 2, barY, barWidth, barHeight);
    
    // Health bar fill (green to red based on health)
    const healthColor = healthPercent > 0.5 
        ? `rgb(${255 * (1 - (healthPercent - 0.5) * 2)}, 255, 0)` // Green to yellow
        : `rgb(255, ${255 * healthPercent * 2}, 0)`; // Yellow to red
    ctx.fillStyle = healthColor;
    ctx.fillRect(-barWidth / 2, barY, barWidth * healthPercent, barHeight);
    
    // Health bar border
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = 1;
    ctx.strokeRect(-barWidth / 2, barY, barWidth, barHeight);
    
    // Shield effect with glow (enhanced to show status)
    if (player.shields > 0) {
        const shieldAlpha = player.shields / player.maxShields;
        const shieldPercent = player.shields / player.maxShields;
        
        // Outer shield glow
        const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, player.width / 2 + 10);
        gradient.addColorStop(0, `rgba(0, 150, 255, ${shieldAlpha * 0.6})`);
        gradient.addColorStop(0.5, `rgba(0, 150, 255, ${shieldAlpha * 0.3})`);
        gradient.addColorStop(1, `rgba(0, 150, 255, 0)`);
        
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(0, 0, player.width / 2 + 10, 0, Math.PI * 2);
        ctx.fill();
        
        // Shield ring (shows percentage)
        ctx.strokeStyle = `rgba(0, 200, 255, ${shieldAlpha})`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 0, player.width / 2 + 8, 0, Math.PI * 2);
        ctx.stroke();
        
        // Shield percentage indicator (arc)
        ctx.strokeStyle = `rgba(100, 255, 255, ${shieldAlpha})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, player.width / 2 + 12, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * shieldPercent);
        ctx.stroke();
    } else {
        // Show broken shield indicator when shields are down
        ctx.strokeStyle = 'rgba(255, 0, 0, 0.3)';
        ctx.lineWidth = 1;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.arc(0, 0, player.width / 2 + 8, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
    }

    // Engine glow
    if (player.engineGlow > 0) {
        const glowGradient = ctx.createLinearGradient(0, player.height / 2, 0, player.height / 2 + 15);
        glowGradient.addColorStop(0, `rgba(0, 200, 255, ${player.engineGlow * 0.8})`);
        glowGradient.addColorStop(0.5, `rgba(100, 200, 255, ${player.engineGlow * 0.5})`);
        glowGradient.addColorStop(1, 'rgba(0, 200, 255, 0)');
        
        ctx.fillStyle = glowGradient;
        ctx.fillRect(-player.width / 4, player.height / 2, player.width / 2, 15);
        
        // Engine particles
        for (let i = 0; i < 3; i++) {
            const offset = (i - 1) * 8;
            particles.push({
                x: player.x + offset,
                y: player.y + player.height / 2 + 5,
                vx: (Math.random() - 0.5) * 2,
                vy: 2 + Math.random() * 2,
                life: 10,
                maxLife: 10,
                size: 2,
                color: `hsl(200, 100%, ${60 + Math.random() * 40}%)`,
                glow: true
            });
        }
    }

    // Ship body with gradient
    const shipGradient = ctx.createLinearGradient(-player.width / 2, -player.height / 2, 0, player.height / 2);
    shipGradient.addColorStop(0, '#0066aa');
    shipGradient.addColorStop(0.5, '#00aaff');
    shipGradient.addColorStop(1, '#004488');
    
    ctx.fillStyle = shipGradient;
    ctx.beginPath();
    ctx.moveTo(0, -player.height / 2);
    ctx.lineTo(-player.width / 2, player.height / 2);
    ctx.lineTo(0, player.height / 2 - 5);
    ctx.lineTo(player.width / 2, player.height / 2);
    ctx.closePath();
    ctx.fill();

    // Ship details with glow
    ctx.fillStyle = '#00ccff';
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#00ccff';
    ctx.fillRect(-player.width / 4, -player.height / 4, player.width / 2, player.height / 4);
    ctx.shadowBlur = 0;
    
    // Ship outline
    ctx.strokeStyle = '#00ffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -player.height / 2);
    ctx.lineTo(-player.width / 2, player.height / 2);
    ctx.lineTo(0, player.height / 2 - 5);
    ctx.lineTo(player.width / 2, player.height / 2);
    ctx.closePath();
    ctx.stroke();
    
    ctx.restore();
}

function drawBullets() {
    bullets.forEach(bullet => {
        ctx.save();
        
        if (bullet.glow) {
            ctx.shadowBlur = bullet.size * 3;
            ctx.shadowColor = bullet.color;
        }
        
        // Missile trail
        if (bullet.trail && bullet.trail.length > 1) {
            ctx.strokeStyle = bullet.color;
            ctx.lineWidth = 2;
            ctx.globalAlpha = 0.5;
            ctx.beginPath();
            ctx.moveTo(bullet.trail[0].x, bullet.trail[0].y);
            for (let i = 1; i < bullet.trail.length; i++) {
                ctx.lineTo(bullet.trail[i].x, bullet.trail[i].y);
            }
            ctx.stroke();
            ctx.globalAlpha = 1;
        }
        
        // Bullet glow
        if (bullet.glow) {
            try {
                const gradient = ctx.createRadialGradient(bullet.x, bullet.y, 0, bullet.x, bullet.y, bullet.size * 2);
                gradient.addColorStop(0, bullet.color);
                
                // Convert color to rgba for gradient stops
                let colorWithAlpha = bullet.color;
                if (bullet.color.startsWith('#')) {
                    colorWithAlpha = hexToRgba(bullet.color, 0.5);
                } else if (bullet.color.startsWith('rgba')) {
                    colorWithAlpha = bullet.color.replace(/[\d.]+\)$/, '0.5)');
                } else if (bullet.color.startsWith('rgb')) {
                    colorWithAlpha = bullet.color.replace('rgb', 'rgba').replace(')', ', 0.5)');
                } else if (bullet.color.startsWith('hsl')) {
                    colorWithAlpha = bullet.color.replace('hsl', 'hsla').replace(')', ', 0.5)');
                }
                gradient.addColorStop(0.5, colorWithAlpha);
                
                // Fully transparent at edge
                let transparentColor = bullet.color;
                if (bullet.color.startsWith('#')) {
                    transparentColor = hexToRgba(bullet.color, 0);
                } else if (bullet.color.startsWith('rgba')) {
                    transparentColor = bullet.color.replace(/[\d.]+\)$/, '0)');
                } else if (bullet.color.startsWith('rgb')) {
                    transparentColor = bullet.color.replace('rgb', 'rgba').replace(')', ', 0)');
                } else if (bullet.color.startsWith('hsl')) {
                    transparentColor = bullet.color.replace('hsl', 'hsla').replace(')', ', 0)');
                }
                gradient.addColorStop(1, transparentColor);
                
                ctx.fillStyle = gradient;
                ctx.beginPath();
                ctx.arc(bullet.x, bullet.y, bullet.size * 2, 0, Math.PI * 2);
                ctx.fill();
            } catch (e) {
                // Fallback: just draw the bullet without glow if gradient fails
                ctx.fillStyle = bullet.color;
                ctx.beginPath();
                ctx.arc(bullet.x, bullet.y, bullet.size, 0, Math.PI * 2);
                ctx.fill();
            }
        }
        
        // Bullet core
        ctx.fillStyle = bullet.color;
        ctx.beginPath();
        ctx.arc(bullet.x, bullet.y, bullet.size, 0, Math.PI * 2);
        ctx.fill();
        
        // Laser beam effect
        if (bullet.type === 'laser') {
            ctx.strokeStyle = bullet.color;
            ctx.lineWidth = 3;
            ctx.shadowBlur = 15;
            ctx.shadowColor = bullet.color;
            ctx.beginPath();
            ctx.moveTo(bullet.x, bullet.y);
            ctx.lineTo(bullet.x, bullet.y + 30);
            ctx.stroke();
        }
        
        ctx.restore();
    });
}

function drawEnemies() {
    enemies.forEach(enemy => {
        ctx.save();
        ctx.translate(enemy.x, enemy.y);
        ctx.rotate(enemy.rotation);
        
        // Health bar
        const healthPercent = enemy.health / enemy.maxHealth;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(-enemy.width / 2 - 2, -enemy.height / 2 - 12, enemy.width + 4, 6);
        ctx.fillStyle = 'red';
        ctx.fillRect(-enemy.width / 2, -enemy.height / 2 - 10, enemy.width, 4);
        ctx.fillStyle = 'green';
        ctx.fillRect(-enemy.width / 2, -enemy.height / 2 - 10, enemy.width * healthPercent, 4);
        
        // Enemy glow
        ctx.shadowBlur = 15;
        ctx.shadowColor = enemy.glowColor;
        
        // Enemy ship with gradient
        const enemyGradient = ctx.createLinearGradient(-enemy.width / 2, -enemy.height / 2, 0, enemy.height / 2);
        enemyGradient.addColorStop(0, enemy.color);
        enemyGradient.addColorStop(1, enemy.color.replace('50%)', '30%)'));
        
        ctx.fillStyle = enemyGradient;
        ctx.beginPath();
        ctx.moveTo(0, enemy.height / 2);
        ctx.lineTo(-enemy.width / 2, -enemy.height / 2);
        ctx.lineTo(0, -enemy.height / 2 + 5);
        ctx.lineTo(enemy.width / 2, -enemy.height / 2);
        ctx.closePath();
        ctx.fill();
        
        // Enemy details
        ctx.fillStyle = enemy.glowColor;
        ctx.fillRect(-enemy.width / 4, -enemy.height / 4, enemy.width / 2, enemy.height / 4);
        
        ctx.strokeStyle = enemy.glowColor;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, enemy.height / 2);
        ctx.lineTo(-enemy.width / 2, -enemy.height / 2);
        ctx.lineTo(0, -enemy.height / 2 + 5);
        ctx.lineTo(enemy.width / 2, -enemy.height / 2);
        ctx.closePath();
        ctx.stroke();
        
        ctx.restore();
    });
}

function drawAsteroids() {
    asteroids.forEach(asteroid => {
        ctx.save();
        ctx.translate(asteroid.x, asteroid.y);
        ctx.rotate(asteroid.rotation);
        
        // Asteroid shadow/glow
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#444';
        
        // Asteroid with gradient
        const asteroidGradient = ctx.createRadialGradient(0, 0, 0, 0, 0, asteroid.width / 2);
        asteroidGradient.addColorStop(0, '#aaa');
        asteroidGradient.addColorStop(0.7, '#666');
        asteroidGradient.addColorStop(1, '#333');
        
        ctx.fillStyle = asteroidGradient;
        ctx.beginPath();
        
        if (asteroid.points && asteroid.points.length > 0) {
            asteroid.points.forEach((point, i) => {
                const x = Math.cos(point.angle + asteroid.rotation) * point.radius;
                const y = Math.sin(point.angle + asteroid.rotation) * point.radius;
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            });
        } else {
            // Fallback circle
            ctx.arc(0, 0, asteroid.width / 2, 0, Math.PI * 2);
        }
        ctx.closePath();
        ctx.fill();
        
        // Asteroid surface details
        ctx.strokeStyle = '#555';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // Craters
        ctx.fillStyle = '#444';
        for (let i = 0; i < 3; i++) {
            const angle = (i / 3) * Math.PI * 2;
            const dist = asteroid.width / 4;
            ctx.beginPath();
            ctx.arc(Math.cos(angle) * dist, Math.sin(angle) * dist, asteroid.width / 8, 0, Math.PI * 2);
            ctx.fill();
        }
        
        ctx.restore();
    });
}

function drawPowerups() {
    powerups.forEach(powerup => {
        ctx.save();
        ctx.translate(powerup.x, powerup.y);
        ctx.rotate(powerup.rotation);
        
        let color = '#ffffff';
        let glowColor = '#ffffff';
        if (powerup.type === 'health') {
            color = '#ff0000';
            glowColor = '#ff6666';
        } else if (powerup.type === 'shield') {
            color = '#0066ff';
            glowColor = '#66aaff';
        } else if (powerup.type === 'ammo') {
            color = '#ffff00';
            glowColor = '#ffffaa';
        } else if (powerup.type === 'upgrade') {
            color = '#ff00ff';
            glowColor = '#ff66ff';
        }
        
        const pulseSize = powerup.width / 2 * (1 + Math.sin(powerup.pulse) * 0.3);
        
        // Glow effect
        ctx.shadowBlur = 20;
        ctx.shadowColor = glowColor;
        
        // Powerup gradient
        const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, pulseSize);
        gradient.addColorStop(0, color);
        if (color.startsWith('#')) {
            gradient.addColorStop(0.7, hexToRgba(color, 0.7));
            gradient.addColorStop(1, hexToRgba(color, 0));
        } else {
            gradient.addColorStop(0.7, color);
            gradient.addColorStop(1, color);
        }
        
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(0, 0, pulseSize, 0, Math.PI * 2);
        ctx.fill();
        
        // Powerup core
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(0, 0, powerup.width / 2, 0, Math.PI * 2);
        ctx.fill();
        
        // Icon
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 12px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        let icon = '?';
        if (powerup.type === 'health') icon = '+';
        else if (powerup.type === 'shield') icon = '◊';
        else if (powerup.type === 'ammo') icon = '▲';
        else if (powerup.type === 'upgrade') icon = '★';
        ctx.fillText(icon, 0, 0);
        
        ctx.restore();
    });
}

function drawAllies() {
    allies.forEach(ally => {
        ctx.save();
        ctx.translate(ally.x, ally.y);
        
        // Ally glow
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#00ff00';
        
        // Ally ship with gradient
        const allyGradient = ctx.createLinearGradient(-ally.width / 2, -ally.height / 2, 0, ally.height / 2);
        allyGradient.addColorStop(0, '#00aa00');
        allyGradient.addColorStop(0.5, '#00ff00');
        allyGradient.addColorStop(1, '#006600');
        
        ctx.fillStyle = allyGradient;
        ctx.beginPath();
        ctx.moveTo(0, -ally.height / 2);
        ctx.lineTo(-ally.width / 2, ally.height / 2);
        ctx.lineTo(0, ally.height / 2 - 3);
        ctx.lineTo(ally.width / 2, ally.height / 2);
        ctx.closePath();
        ctx.fill();
        
        ctx.strokeStyle = '#00ff88';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, -ally.height / 2);
        ctx.lineTo(-ally.width / 2, ally.height / 2);
        ctx.lineTo(0, ally.height / 2 - 3);
        ctx.lineTo(ally.width / 2, ally.height / 2);
        ctx.closePath();
        ctx.stroke();
        
        ctx.restore();
    });
}

function drawParticles() {
    // Batch particles for better performance - reduce shadow operations
    ctx.save();
    
    for (let i = 0; i < particles.length; i++) {
        const particle = particles[i];
        const alpha = particle.life / particle.maxLife;
        
        // Skip very transparent particles
        if (alpha < 0.1) continue;
        
        // Only set shadow if needed (expensive operation)
        if (particle.glow && alpha > 0.3) {
            ctx.shadowBlur = particle.size * 2 * alpha;
            ctx.shadowColor = particle.color;
        } else {
            ctx.shadowBlur = 0;
        }
        
        // Convert color to RGBA for proper alpha
        const hslMatch = particle.color.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/);
        if (hslMatch) {
            const h = hslMatch[1];
            const s = hslMatch[2];
            const l = hslMatch[3];
            ctx.fillStyle = `hsla(${h}, ${s}%, ${l}%, ${alpha})`;
        } else if (particle.color.startsWith('#')) {
            ctx.fillStyle = hexToRgba(particle.color, alpha);
        } else if (particle.color.startsWith('rgba')) {
            // Already rgba, just update alpha
            ctx.fillStyle = particle.color.replace(/[\d.]+\)/, `${alpha})`);
        } else if (particle.color.startsWith('rgb')) {
            ctx.fillStyle = particle.color.replace('rgb', 'rgba').replace(')', `, ${alpha})`);
        } else {
            ctx.fillStyle = particle.color;
        }
        
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.size * alpha, 0, Math.PI * 2);
        ctx.fill();
    }
    
    ctx.restore();
}

// Mission Mode Functions
function initMissionMode() {
    // Create cargo vessel
    cargoVessel = {
        x: 100,
        y: canvas.height / 2,
        width: 60,
        height: 40,
        speed: 1.5,
        health: 200,
        maxHealth: 200,
        progress: 0,
        targetX: canvas.width - 150,
        direction: 1, // 1 = going right, -1 = going left
        journeyComplete: false
    };
    
    // Create start planet (left side)
    startPlanet = {
        x: 50,
        y: canvas.height / 2,
        radius: 40,
        color: '#4a90e2'
    };
    
    // Create end planet (right side)
    endPlanet = {
        x: canvas.width - 50,
        y: canvas.height / 2,
        radius: 40,
        color: '#e24a4a'
    };
}

function updateCargoVessel() {
    if (!cargoVessel || gameState.gameMode !== 'mission') return;
    
    // Move cargo vessel towards destination
    const dx = cargoVessel.targetX - cargoVessel.x;
    const distance = Math.abs(dx);
    
    if (distance > 5) {
        cargoVessel.x += (dx / distance) * cargoVessel.speed;
    } else {
        // Reached destination - reverse direction
        cargoVessel.direction *= -1;
        if (cargoVessel.direction === 1) {
            // Going right
            cargoVessel.targetX = canvas.width - 150;
        } else {
            // Going left
            cargoVessel.targetX = 100;
        }
        cargoVessel.journeyComplete = true;
    }
    
    // Update progress
    const totalDistance = canvas.width - 200;
    const traveled = Math.abs(cargoVessel.x - 100);
    cargoVessel.progress = Math.min(100, (traveled / totalDistance) * 100);
    
    // Check if completed a journey
    if (cargoVessel.journeyComplete && distance < 10) {
        completeJourney();
        cargoVessel.journeyComplete = false;
    }
    
    // Check if destroyed
    if (cargoVessel.health <= 0) {
        missionFailed();
    }
    
    // Apply cargo ship crew effects
    const engineeringCrewCount = cargoCrewAllocation.engineering.length;
    if (engineeringCrewCount > 0) {
        const healRate = engineeringCrewCount * 0.5; // 0.5 HP/sec per crew
        cargoVessel.health = Math.min(cargoVessel.maxHealth, cargoVessel.health + healRate * 0.1);
    }
    
    // Apply navigation crew effect
    const navigationCrewCount = cargoCrewAllocation.navigation.length;
    const speedMultiplier = 1 + (navigationCrewCount * 0.1); // 10% speed per crew
    cargoVessel.speed = 1.5 * speedMultiplier; // Base speed 1.5, modified by crew
}

function drawCargoVessel() {
    if (!cargoVessel || gameState.gameMode !== 'mission') return;
    
    ctx.save();
    ctx.translate(cargoVessel.x, cargoVessel.y);
    
    // Health bar
    const healthPercent = cargoVessel.health / cargoVessel.maxHealth;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(-cargoVessel.width / 2 - 5, -cargoVessel.height / 2 - 15, cargoVessel.width + 10, 8);
    ctx.fillStyle = 'red';
    ctx.fillRect(-cargoVessel.width / 2 - 3, -cargoVessel.height / 2 - 13, cargoVessel.width + 6, 4);
    ctx.fillStyle = 'green';
    ctx.fillRect(-cargoVessel.width / 2 - 3, -cargoVessel.height / 2 - 13, (cargoVessel.width + 6) * healthPercent, 4);
    
    // Cargo vessel body
    ctx.fillStyle = '#8b7355';
    ctx.fillRect(-cargoVessel.width / 2, -cargoVessel.height / 2, cargoVessel.width, cargoVessel.height);
    
    // Cargo vessel details
    ctx.fillStyle = '#6b5b45';
    ctx.fillRect(-cargoVessel.width / 2 + 5, -cargoVessel.height / 2 + 5, cargoVessel.width - 10, cargoVessel.height - 10);
    
    // Windows
    ctx.fillStyle = '#4a90e2';
    ctx.fillRect(-cargoVessel.width / 2 + 10, -5, 8, 8);
    ctx.fillRect(cargoVessel.width / 2 - 18, -5, 8, 8);
    
    ctx.restore();
}

function drawPlanets() {
    if (gameState.gameMode !== 'mission') return;
    
    // Draw start planet
    if (startPlanet) {
        ctx.save();
        ctx.translate(startPlanet.x, startPlanet.y);
        
        const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, startPlanet.radius);
        gradient.addColorStop(0, startPlanet.color);
        gradient.addColorStop(0.7, hexToRgba(startPlanet.color, 0.7));
        gradient.addColorStop(1, hexToRgba(startPlanet.color, 0));
        
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(0, 0, startPlanet.radius, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.strokeStyle = startPlanet.color;
        ctx.lineWidth = 2;
        ctx.stroke();
        
        ctx.restore();
    }
    
    // Draw end planet
    if (endPlanet) {
        ctx.save();
        ctx.translate(endPlanet.x, endPlanet.y);
        
        const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, endPlanet.radius);
        gradient.addColorStop(0, endPlanet.color);
        gradient.addColorStop(0.7, hexToRgba(endPlanet.color, 0.7));
        gradient.addColorStop(1, hexToRgba(endPlanet.color, 0));
        
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(0, 0, endPlanet.radius, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.strokeStyle = endPlanet.color;
        ctx.lineWidth = 2;
        ctx.stroke();
        
        ctx.restore();
    }
}

function completeJourney() {
    gameState.journeyCount++;
    const journeyReward = 50 + (gameState.journeyCount * 10);
    currency += journeyReward; // More currency per journey
    cumulativeCredits += journeyReward; // Track cumulative credits
    sounds.levelUp();
    // Update UI to show currency
    if (document.getElementById('currency')) {
        document.getElementById('currency').textContent = currency;
    }
}

function completeMission() {
    // Don't end mission - just complete journey
    completeJourney();
}

function missionFailed() {
    gameState.running = false;
    document.getElementById('finalScore').textContent = gameState.score;
    document.getElementById('gameOver').classList.remove('hidden');
}

// Crew Management
function initializeCrew() {
    crewMembers = [];
    const stations = ['shields', 'engineering', 'weapons', 'navigation'];
    
    // Start with 1 crew in each station (4 crew members)
    for (let i = 0; i < stations.length; i++) {
        crewMembers.push({
            id: i,
            name: `Crew ${i + 1}`,
            station: stations[i]
        });
    }
    
    // Add remaining crew as unassigned
    for (let i = stations.length; i < totalCrew; i++) {
        crewMembers.push({
            id: i,
            name: `Crew ${i + 1}`,
            station: null
        });
    }
    
    // Initialize cargo crew (empty at start)
    cargoCrewMembers = [];
    
    updateCrewAllocation();
    updateCargoCrewAllocation();
}

// Calculate crew recruitment cost (increases with each crew member)
function getCrewCost() {
    // Base cost: 50 credits
    // Each additional crew member costs 25 more credits
    // Formula: 50 + (totalCrew - 5) * 25
    // So: 5 crew = 50, 6 crew = 75, 7 crew = 100, etc.
    return 50 + (totalCrew - 5) * 25;
}

function recruitCrew() {
    const cost = getCrewCost();
    if (currency >= cost) {
        currency -= cost;
        totalCrew++;
        crewMembers.push({
            id: crewMembers.length,
            name: `Crew ${totalCrew}`,
            station: null
        });
        updateCommandModuleUI();
    }
}

function buyClusterAmmo() {
    if (currency >= 1000) {
        currency -= 1000;
        weapons.cluster.ammo++;
        updateCommandModuleUI();
        updateUI();
    }
}

function updateCrewAllocation() {
    // Clear allocations
    crewAllocation = {
        shields: [],
        engineering: [],
        weapons: [],
        navigation: []
    };
    
    // Reallocate based on crew station assignments
    crewMembers.forEach(crew => {
        if (crew.station && crewAllocation[crew.station]) {
            crewAllocation[crew.station].push(crew);
        }
    });
}

function openCommandModule() {
    gameState.paused = true;
    gameState.commandModuleOpen = true;
    document.getElementById('commandModule').classList.remove('hidden');
    updateCommandModuleUI();
}

function closeCommandModule() {
    gameState.paused = false;
    gameState.commandModuleOpen = false;
    document.getElementById('commandModule').classList.add('hidden');
}

function updateCargoCrewAllocation() {
    // Clear allocations
    cargoCrewAllocation = {
        engineering: [],
        navigation: []
    };
    
    // Reallocate based on cargo crew station assignments
    cargoCrewMembers.forEach(crew => {
        if (crew.station && cargoCrewAllocation[crew.station]) {
            cargoCrewAllocation[crew.station].push(crew);
        }
    });
}

function updateCommandModuleUI() {
    document.getElementById('totalCrew').textContent = totalCrew;
    document.getElementById('currency').textContent = currency;
    const recruitBtn = document.getElementById('recruitCrewBtn');
    if (recruitBtn) {
        const cost = getCrewCost();
        recruitBtn.disabled = currency < cost;
        recruitBtn.textContent = `Recruit Crew (${cost} credits)`;
    }
    const buyClusterBtn = document.getElementById('buyClusterBtn');
    if (buyClusterBtn) {
        buyClusterBtn.disabled = currency < 1000;
    }
    
    // Show/hide cargo ship crew section based on game mode
    const cargoCrewSection = document.getElementById('cargoShipCrew');
    if (cargoCrewSection) {
        cargoCrewSection.style.display = gameState.gameMode === 'mission' ? 'block' : 'none';
    }
    
    // Update player ship station displays
    ['shields', 'engineering', 'weapons', 'navigation'].forEach(station => {
        const count = crewAllocation[station].length;
        const countEl = document.getElementById(`${station}Crew`);
        if (countEl) countEl.textContent = count;
        
        // Update effects
        if (station === 'shields') {
            const effectEl = document.getElementById('shieldsEffect');
            if (effectEl) effectEl.textContent = (count * crewEffects.shields.regenMultiplier * 100).toFixed(0);
        } else if (station === 'engineering') {
            const effectEl = document.getElementById('engineeringEffect');
            if (effectEl) effectEl.textContent = (count * crewEffects.engineering.healthRegen).toFixed(1);
        } else if (station === 'weapons') {
            const cooldownEl = document.getElementById('weaponsEffect');
            const damageEl = document.getElementById('weaponsDamageEffect');
            if (cooldownEl) cooldownEl.textContent = (count * crewEffects.weapons.cooldownReduction * 100).toFixed(0);
            if (damageEl) damageEl.textContent = (count * crewEffects.weapons.damageBonus * 100).toFixed(0);
        } else if (station === 'navigation') {
            const effectEl = document.getElementById('navigationEffect');
            if (effectEl) effectEl.textContent = (count * crewEffects.navigation.speedBonus * 100).toFixed(0);
        }
        
        // Update crew slots
        const slots = document.getElementById(`${station}Slots`);
        if (slots) {
            slots.innerHTML = '';
            crewAllocation[station].forEach(crew => {
                const crewEl = document.createElement('div');
                crewEl.className = 'crew-member';
                crewEl.textContent = crew.id + 1;
                crewEl.draggable = true;
                crewEl.dataset.crewId = crew.id;
                crewEl.dataset.station = station;
                crewEl.dataset.ship = 'player';
                crewEl.addEventListener('dragstart', (e) => startCrewDrag(e, crew.id, station, 'player'));
                // Add touch support for mobile
                crewEl.addEventListener('touchstart', (e) => startCrewTouchDrag(e, crew.id, station, 'player'), { passive: false });
                crewEl.addEventListener('touchend', handleCrewTouchEnd, { passive: false });
                crewEl.addEventListener('touchcancel', handleCrewTouchEnd, { passive: false });
                slots.appendChild(crewEl);
            });
        }
    });
    
    // Update available player crew pool
    // Only show crew that are not assigned to a station AND not transferred to cargo
    const pool = document.getElementById('crewPool');
    if (pool) {
        pool.innerHTML = '';
        crewMembers.filter(c => {
            // Must not have a station assigned
            if (c.station) return false;
            // Must not be in cargo crew (transferred to cargo)
            const isInCargo = cargoCrewMembers.some(cargoCrew => cargoCrew.id === c.id);
            return !isInCargo;
        }).forEach(crew => {
            const crewEl = document.createElement('div');
            crewEl.className = 'crew-member';
            crewEl.textContent = crew.id + 1;
            crewEl.draggable = true;
            crewEl.dataset.crewId = crew.id;
            crewEl.dataset.ship = 'player';
            crewEl.addEventListener('dragstart', (e) => startCrewDrag(e, crew.id, null, 'player'));
            // Add touch support for mobile
            crewEl.addEventListener('touchstart', (e) => startCrewTouchDrag(e, crew.id, null, 'player'), { passive: false });
            crewEl.addEventListener('touchend', handleCrewTouchEnd, { passive: false });
            pool.appendChild(crewEl);
        });
    }
    
    // Update cargo ship crew displays (only in mission mode)
    if (gameState.gameMode === 'mission') {
        // Update cargo engineering station
        const cargoEngineeringCount = cargoCrewAllocation.engineering.length;
        const cargoEngineeringEl = document.getElementById('cargoEngineeringCrew');
        if (cargoEngineeringEl) cargoEngineeringEl.textContent = cargoEngineeringCount;
        const cargoEngineeringEffectEl = document.getElementById('cargoEngineeringEffect');
        if (cargoEngineeringEffectEl) cargoEngineeringEffectEl.textContent = (cargoEngineeringCount * 0.5).toFixed(1);
        
        const cargoEngineeringSlots = document.getElementById('cargoEngineeringSlots');
        if (cargoEngineeringSlots) {
            cargoEngineeringSlots.innerHTML = '';
            cargoCrewAllocation.engineering.forEach(crew => {
                const crewEl = document.createElement('div');
                crewEl.className = 'crew-member';
                crewEl.textContent = crew.id + 1;
                crewEl.draggable = true;
                crewEl.dataset.crewId = crew.id;
                crewEl.dataset.station = 'engineering';
                crewEl.dataset.ship = 'cargo';
                crewEl.addEventListener('dragstart', (e) => startCrewDrag(e, crew.id, 'engineering', 'cargo'));
                // Add touch support for mobile
                crewEl.addEventListener('touchstart', (e) => startCrewTouchDrag(e, crew.id, 'engineering', 'cargo'), { passive: false });
                crewEl.addEventListener('touchend', handleCrewTouchEnd, { passive: false });
                cargoEngineeringSlots.appendChild(crewEl);
            });
        }
        
        // Update cargo navigation station
        const cargoNavigationCount = cargoCrewAllocation.navigation.length;
        const cargoNavigationEl = document.getElementById('cargoNavigationCrew');
        if (cargoNavigationEl) cargoNavigationEl.textContent = cargoNavigationCount;
        const cargoNavigationEffectEl = document.getElementById('cargoNavigationEffect');
        if (cargoNavigationEffectEl) cargoNavigationEffectEl.textContent = (cargoNavigationCount * 10).toFixed(0);
        
        const cargoNavigationSlots = document.getElementById('cargoNavigationSlots');
        if (cargoNavigationSlots) {
            cargoNavigationSlots.innerHTML = '';
            cargoCrewAllocation.navigation.forEach(crew => {
                const crewEl = document.createElement('div');
                crewEl.className = 'crew-member';
                crewEl.textContent = crew.id + 1;
                crewEl.draggable = true;
                crewEl.dataset.crewId = crew.id;
                crewEl.dataset.station = 'navigation';
                crewEl.dataset.ship = 'cargo';
                crewEl.addEventListener('dragstart', (e) => startCrewDrag(e, crew.id, 'navigation', 'cargo'));
                // Add touch support for mobile
                crewEl.addEventListener('touchstart', (e) => startCrewTouchDrag(e, crew.id, 'navigation', 'cargo'), { passive: false });
                crewEl.addEventListener('touchend', handleCrewTouchEnd, { passive: false });
                cargoNavigationSlots.appendChild(crewEl);
            });
        }
        
        // Update available cargo crew pool
        // Only show cargo crew that are not assigned to a station
        const cargoPool = document.getElementById('cargoCrewPool');
        if (cargoPool) {
            cargoPool.innerHTML = '';
            cargoCrewMembers.filter(c => !c.station).forEach(crew => {
                const crewEl = document.createElement('div');
                crewEl.className = 'crew-member';
                crewEl.textContent = crew.id + 1;
                crewEl.draggable = true;
                crewEl.dataset.crewId = crew.id;
                crewEl.dataset.ship = 'cargo';
                crewEl.addEventListener('dragstart', (e) => startCrewDrag(e, crew.id, null, 'cargo'));
                // Add touch support for mobile
                crewEl.addEventListener('touchstart', (e) => startCrewTouchDrag(e, crew.id, null, 'cargo'), { passive: false });
                crewEl.addEventListener('touchend', handleCrewTouchEnd, { passive: false });
                cargoPool.appendChild(crewEl);
            });
        }
    }
}

function startCrewDrag(e, crewId, station, ship) {
    isDraggingCrew = crewId;
    dragSourceStation = station;
    if (e.dataTransfer) {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', JSON.stringify({ crewId, station, ship }));
    }
    if (e.target) {
        e.target.classList.add('dragging');
    }
}

// Touch-based drag for mobile
function startCrewTouchDrag(e, crewId, station, ship) {
    e.preventDefault();
    isDraggingCrew = crewId;
    dragSourceStation = station;
    touchDragData = { crewId, station, ship };
    touchDragElement = e.target;
    if (e.target) {
        e.target.classList.add('dragging');
    }
}

function handleCrewTouchEnd(e) {
    if (!touchDragData || !touchDragElement) return;
    
    e.preventDefault();
    const touch = e.changedTouches[0];
    const elementBelow = document.elementFromPoint(touch.clientX, touch.clientY);
    
    if (!elementBelow) {
        touchDragElement.classList.remove('dragging');
        touchDragData = null;
        touchDragElement = null;
        isDraggingCrew = null;
        dragSourceStation = null;
        return;
    }
    
    // Find the drop zone (station, pool, etc.)
    let dropTarget = elementBelow;
    let foundDropZone = false;
    
    // Walk up the DOM tree to find a drop zone
    while (dropTarget && dropTarget !== document.body) {
        // Check if it's a station
        if (dropTarget.dataset && dropTarget.dataset.station) {
            const station = dropTarget.dataset.station;
            if (station.startsWith('cargo-')) {
                const cargoStation = station.replace('cargo-', '');
                if (touchDragData.ship === 'cargo') {
                    assignCrewToStation(touchDragData.crewId, cargoStation, 'cargo');
                } else {
                    transferCrewToCargo(touchDragData.crewId, cargoStation);
                }
                foundDropZone = true;
                break;
            } else {
                if (touchDragData.ship === 'player') {
                    assignCrewToStation(touchDragData.crewId, station, 'player');
                } else {
                    transferCrewToPlayer(touchDragData.crewId, station);
                }
                foundDropZone = true;
                break;
            }
        }
        
        // Check if it's a crew pool
        if (dropTarget.id === 'crewPool') {
            if (touchDragData.ship === 'player') {
                assignCrewToStation(touchDragData.crewId, null, 'player');
            } else {
                transferCrewToPlayer(touchDragData.crewId, null);
            }
            foundDropZone = true;
            break;
        }
        
        if (dropTarget.id === 'cargoCrewPool') {
            if (touchDragData.ship === 'cargo') {
                assignCrewToStation(touchDragData.crewId, null, 'cargo');
            } else {
                transferCrewToCargo(touchDragData.crewId, null);
            }
            foundDropZone = true;
            break;
        }
        
        // Check if it's inside a station element (crew-slots)
        if (dropTarget.classList && dropTarget.classList.contains('crew-slots')) {
            const stationEl = dropTarget.closest('[data-station]');
            if (stationEl) {
                const station = stationEl.dataset.station;
                if (station.startsWith('cargo-')) {
                    const cargoStation = station.replace('cargo-', '');
                    if (touchDragData.ship === 'cargo') {
                        assignCrewToStation(touchDragData.crewId, cargoStation, 'cargo');
                    } else {
                        transferCrewToCargo(touchDragData.crewId, cargoStation);
                    }
                } else {
                    if (touchDragData.ship === 'player') {
                        assignCrewToStation(touchDragData.crewId, station, 'player');
                    } else {
                        transferCrewToPlayer(touchDragData.crewId, station);
                    }
                }
                foundDropZone = true;
                break;
            }
        }
        
        dropTarget = dropTarget.parentElement;
    }
    
    touchDragElement.classList.remove('dragging');
    touchDragData = null;
    touchDragElement = null;
    isDraggingCrew = null;
    dragSourceStation = null;
}

function setupCrewDragAndDrop() {
    // Setup drop zones for player ship stations
    ['shields', 'engineering', 'weapons', 'navigation'].forEach(station => {
        const stationEl = document.querySelector(`[data-station="${station}"]`);
        if (stationEl) {
            stationEl.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
            });
            stationEl.addEventListener('drop', (e) => {
                e.preventDefault();
                const data = e.dataTransfer.getData('text/plain');
                if (data) {
                    try {
                        const { crewId, ship } = JSON.parse(data);
                        if (ship === 'player') {
                            assignCrewToStation(crewId, station, 'player');
                        } else if (ship === 'cargo') {
                            // Transfer from cargo to player
                            transferCrewToPlayer(crewId, station);
                        }
                    } catch (err) {
                        // Fallback for old drag system
                        if (isDraggingCrew !== null) {
                            assignCrewToStation(isDraggingCrew, station, 'player');
                        }
                    }
                }
            });
        }
    });
    
    // Setup drop zones for cargo ship stations
    ['cargo-engineering', 'cargo-navigation'].forEach(station => {
        const stationEl = document.querySelector(`[data-station="${station}"]`);
        if (stationEl) {
            stationEl.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
            });
            stationEl.addEventListener('drop', (e) => {
                e.preventDefault();
                const data = e.dataTransfer.getData('text/plain');
                if (data) {
                    try {
                        const { crewId, ship } = JSON.parse(data);
                        const cargoStation = station.replace('cargo-', '');
                        if (ship === 'cargo') {
                            assignCrewToStation(crewId, cargoStation, 'cargo');
                        } else if (ship === 'player') {
                            // Transfer from player to cargo
                            transferCrewToCargo(crewId, cargoStation);
                        }
                    } catch (err) {
                        // Fallback
                        if (isDraggingCrew !== null) {
                            const cargoStation = station.replace('cargo-', '');
                            assignCrewToStation(isDraggingCrew, cargoStation, 'cargo');
                        }
                    }
                }
            });
        }
    });
    
    // Player crew pool drop zone
    const pool = document.getElementById('crewPool');
    if (pool) {
        pool.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
        });
        pool.addEventListener('drop', (e) => {
            e.preventDefault();
            const data = e.dataTransfer.getData('text/plain');
            if (data) {
                try {
                    const { crewId, ship } = JSON.parse(data);
                    if (ship === 'player') {
                        assignCrewToStation(crewId, null, 'player');
                    } else if (ship === 'cargo') {
                        transferCrewToPlayer(crewId, null);
                    }
                } catch (err) {
                    if (isDraggingCrew !== null) {
                        assignCrewToStation(isDraggingCrew, null, 'player');
                    }
                }
            }
        });
    }
    
    // Cargo crew pool drop zone
    const cargoPool = document.getElementById('cargoCrewPool');
    if (cargoPool) {
        cargoPool.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
        });
        cargoPool.addEventListener('drop', (e) => {
            e.preventDefault();
            const data = e.dataTransfer.getData('text/plain');
            if (data) {
                try {
                    const { crewId, ship } = JSON.parse(data);
                    if (ship === 'cargo') {
                        assignCrewToStation(crewId, null, 'cargo');
                    } else if (ship === 'player') {
                        transferCrewToCargo(crewId, null);
                    }
                } catch (err) {
                    if (isDraggingCrew !== null) {
                        assignCrewToStation(isDraggingCrew, null, 'cargo');
                    }
                }
            }
        });
    }
    
    // Remove dragging class on dragend
    document.addEventListener('dragend', (e) => {
        if (e.target && e.target.classList) {
            e.target.classList.remove('dragging');
        }
        isDraggingCrew = null;
        dragSourceStation = null;
    });
}

function assignCrewToStation(crewId, station, ship) {
    if (ship === 'player') {
        const crew = crewMembers.find(c => c.id === crewId);
        if (crew) {
            // Remove from cargo crew members if they were transferred there
            const cargoCrew = cargoCrewMembers.find(c => c.id === crewId);
            if (cargoCrew) {
                const cargoIndex = cargoCrewMembers.indexOf(cargoCrew);
                if (cargoIndex > -1) {
                    cargoCrewMembers.splice(cargoIndex, 1);
                }
            }
            crew.station = station;
            updateCrewAllocation();
            updateCargoCrewAllocation();
            updateCommandModuleUI();
        }
    } else if (ship === 'cargo') {
        const crew = cargoCrewMembers.find(c => c.id === crewId);
        if (crew) {
            // Make sure crew is removed from any other station first
            // (This prevents the bug where crew moves between stations)
            if (crew.station && crew.station !== station) {
                // Already handled by setting new station below
            }
            crew.station = station;
            updateCargoCrewAllocation();
            updateCommandModuleUI();
        }
    }
    isDraggingCrew = null;
    dragSourceStation = null;
}

function transferCrewToCargo(crewId, station) {
    const crew = crewMembers.find(c => c.id === crewId);
    if (!crew) return;
    
    // Remove from player ship
    crew.station = null;
    
    // Add to cargo crew if not already there
    let cargoCrew = cargoCrewMembers.find(c => c.id === crewId);
    if (!cargoCrew) {
        cargoCrew = {
            id: crew.id,
            name: crew.name,
            station: null
        };
        cargoCrewMembers.push(cargoCrew);
    }
    
    cargoCrew.station = station;
    updateCrewAllocation();
    updateCargoCrewAllocation();
    updateCommandModuleUI();
}

function transferCrewToPlayer(crewId, station) {
    const cargoCrew = cargoCrewMembers.find(c => c.id === crewId);
    if (!cargoCrew) return;
    
    // Remove from cargo crew members entirely
    const cargoIndex = cargoCrewMembers.indexOf(cargoCrew);
    if (cargoIndex > -1) {
        cargoCrewMembers.splice(cargoIndex, 1);
    }
    
    // Add to player crew
    const crew = crewMembers.find(c => c.id === crewId);
    if (crew) {
        crew.station = station;
    }
    
    updateCrewAllocation();
    updateCargoCrewAllocation();
    updateCommandModuleUI();
}

function updateUI() {
    document.getElementById('score').textContent = gameState.score;
    document.getElementById('level').textContent = gameState.level;
    document.getElementById('allies').textContent = allies.length;
    
    // Show cargo vessel health in mission mode
    const cargoStat = document.getElementById('cargoHealthStat');
    if (gameState.gameMode === 'mission' && cargoVessel) {
        cargoStat.style.display = 'flex';
        const cargoHealthPercent = (cargoVessel.health / cargoVessel.maxHealth) * 100;
        document.getElementById('cargoHealthFill').style.width = cargoHealthPercent + '%';
        document.getElementById('cargoHealthText').textContent = `${Math.ceil(cargoVessel.health)}/${cargoVessel.maxHealth}`;
    } else {
        cargoStat.style.display = 'none';
    }
    
    const healthPercent = (player.health / player.maxHealth) * 100;
    document.getElementById('healthFill').style.width = healthPercent + '%';
    document.getElementById('healthText').textContent = `${Math.ceil(player.health)}/${player.maxHealth}`;
    
    const shieldPercent = (player.shields / player.maxShields) * 100;
    document.getElementById('shieldFill').style.width = shieldPercent + '%';
    document.getElementById('shieldText').textContent = `${Math.ceil(player.shields)}/${player.maxShields}`;
    
    // Weapon cooldowns
    const primaryCooldown = (weapons.primary.cooldown / weapons.primary.maxCooldown) * 100;
    document.getElementById('primaryCooldown').style.width = primaryCooldown + '%';
    document.getElementById('primaryAmmo').textContent = '∞';
    
    const missileCooldown = (weapons.missile.cooldown / weapons.missile.maxCooldown) * 100;
    document.getElementById('missileCooldown').style.width = missileCooldown + '%';
    document.getElementById('missileAmmo').textContent = weapons.missile.ammo;
    
    const laserCooldown = (weapons.laser.cooldown / weapons.laser.maxCooldown) * 100;
    document.getElementById('laserCooldown').style.width = laserCooldown + '%';
    document.getElementById('laserAmmo').textContent = weapons.laser.ammo;
    
    const clusterCooldown = (weapons.cluster.cooldown / weapons.cluster.maxCooldown) * 100;
    document.getElementById('clusterCooldown').style.width = clusterCooldown + '%';
    document.getElementById('clusterAmmo').textContent = weapons.cluster.ammo;
    
    // Update mobile weapon displays and button states
    updateMobileWeaponUI();
}

// Update mobile weapon button displays and states
function updateMobileWeaponUI() {
    // Update mobile weapon ammo displays
    const mobileMissileAmmo = document.getElementById('mobileMissileAmmo');
    const mobileLaserAmmo = document.getElementById('mobileLaserAmmo');
    const mobileClusterAmmo = document.getElementById('mobileClusterAmmo');
    
    if (mobileMissileAmmo) mobileMissileAmmo.textContent = weapons.missile.ammo;
    if (mobileLaserAmmo) mobileLaserAmmo.textContent = weapons.laser.ammo;
    if (mobileClusterAmmo) mobileClusterAmmo.textContent = weapons.cluster.ammo;
    
    // Update mobile weapon button states (disabled/enabled)
    const mobileMissileBtn = document.getElementById('mobileMissileBtn');
    const mobileLaserBtn = document.getElementById('mobileLaserBtn');
    const mobileClusterBtn = document.getElementById('mobileClusterBtn');
    
    if (mobileMissileBtn) {
        mobileMissileBtn.disabled = weapons.missile.cooldown > 0 || weapons.missile.ammo <= 0;
    }
    if (mobileLaserBtn) {
        mobileLaserBtn.disabled = weapons.laser.cooldown > 0 || weapons.laser.ammo <= 0;
    }
    if (mobileClusterBtn) {
        mobileClusterBtn.disabled = weapons.cluster.cooldown > 0 || weapons.cluster.ammo <= 0;
    }
}

// Setup mobile control button event listeners
function setupMobileControls() {
    // Mobile weapon buttons
    const mobileMissileBtn = document.getElementById('mobileMissileBtn');
    const mobileLaserBtn = document.getElementById('mobileLaserBtn');
    const mobileClusterBtn = document.getElementById('mobileClusterBtn');
    const mobileCommandBtn = document.getElementById('mobileCommandBtn');
    
    if (mobileMissileBtn) {
        mobileMissileBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (weapons.missile.cooldown === 0 && weapons.missile.ammo > 0) {
                shoot('missile');
            }
        });
    }
    
    if (mobileLaserBtn) {
        mobileLaserBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (weapons.laser.cooldown === 0 && weapons.laser.ammo > 0) {
                shoot('laser');
            }
        });
    }
    
    if (mobileClusterBtn) {
        mobileClusterBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (weapons.cluster.cooldown === 0 && weapons.cluster.ammo > 0) {
                shoot('cluster');
            }
        });
    }
    
    if (mobileCommandBtn) {
        mobileCommandBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (gameState.commandModuleOpen) {
                closeCommandModule();
            } else if (!gameState.paused && gameState.running) {
                openCommandModule();
            }
        });
    }
}

// Game loop
let lastSpawn = 0;
let lastAsteroidSpawn = 0;
let lastNebulaSpawn = 0;

function gameLoop() {
    if (!gameState.running || !canvas || !ctx) return;

    try {
        // Draw starfield
        drawStarfield();

        // Only update game logic if not paused
        if (!gameState.paused) {
            // Update
            updatePlayer();
            updateBullets();
            updateEnemies();
            updateAsteroids();
            updateNebulas();
            updatePowerups();
            updateAllies();
            updateParticles();
            updateEnemyBullets();
            
            // Mission mode updates
            if (gameState.gameMode === 'mission') {
                updateCargoVessel();
            }
            
            updateUI();

            // Spawning
            const now = Date.now();
            // Difficulty scales with cumulative credits (every 100 credits = 1 difficulty level)
            const creditDifficulty = cumulativeCredits / 100;
            // More gradual spawn rate decrease - uses a smoother curve to prevent sudden jumps
            // Formula: baseRate - (creditDifficulty^1.5 * ratePerLevel) for smoother progression
            const enemySpawnRate = Math.max(1000, 3500 - Math.pow(creditDifficulty, 1.3) * 50);
            if (now - lastSpawn > enemySpawnRate) {
                spawnEnemy();
                lastSpawn = now;
            }

            // Spawn multiple enemies only at very high credit levels, and very gradually
            // Only spawn extra if we're well past the base spawn rate
            if (creditDifficulty >= 15 && Math.random() < 0.1) {
                spawnEnemy();
            }
            if (creditDifficulty >= 25 && Math.random() < 0.08) {
                spawnEnemy();
            }

            // More gradual asteroid spawn rate - uses smoother curve
            const asteroidSpawnRate = Math.max(1200, 4500 - Math.pow(creditDifficulty, 1.3) * 60);
            if (now - lastAsteroidSpawn > asteroidSpawnRate) {
                spawnAsteroid();
                lastAsteroidSpawn = now;
            }

            // Spawn nebulas (less frequent, but persistent) - more gradual
            const nebulaSpawnRate = Math.max(10000, 18000 - Math.pow(creditDifficulty, 1.2) * 200);
            if (now - lastNebulaSpawn > nebulaSpawnRate) {
                spawnNebula();
                lastNebulaSpawn = now;
            }

            // Level progression - faster (fewer kills needed)
            if (gameState.enemiesKilled >= gameState.level * 7) {
                gameState.level++;
                gameState.enemiesKilled = 0;
                sounds.levelUp();
                // Award bonus credits on level up in normal mode
                if (gameState.gameMode === 'normal') {
                    currency += 10;
                    cumulativeCredits += 10; // Track cumulative credits
                }
            }
        } else {
            // Still update UI when paused (for visual feedback)
            updateUI();
        }

        // Always draw game objects (even when paused)
        drawPlanets();
        drawNebulas(); // Draw nebulas behind other objects
        drawParticles();
        drawAsteroids();
        drawEnemies();
        drawPowerups();
        drawAllies();
        drawBullets();
        if (gameState.gameMode === 'mission') {
            drawCargoVessel();
        }
        drawPlayer();
    } catch (error) {
        console.error('Game loop error:', error);
        // Continue the loop even if there's an error
    }

    requestAnimationFrame(gameLoop);
}

function gameOver() {
    gameState.running = false;
    document.getElementById('finalScore').textContent = gameState.score;
    document.getElementById('gameOver').classList.remove('hidden');
}

function startNormalMode() {
    gameState.gameMode = 'normal';
    gameState.missionComplete = false;
    gameState.journeyCount = 0;
    currency = 0; // Reset currency when switching modes
    cargoVessel = null;
    startPlanet = null;
    endPlanet = null;
    document.getElementById('modeSelect').classList.add('hidden');
    restartGame();
}

function startMissionMode() {
    gameState.gameMode = 'mission';
    gameState.missionComplete = false;
    gameState.journeyCount = 0;
    currency = 0; // Start with 0 currency in mission mode
    document.getElementById('modeSelect').classList.add('hidden');
    restartGame();
    initMissionMode();
}

function restartGame() {
    // Reset game state (preserve game mode)
    const currentMode = gameState.gameMode || 'normal';
    gameState = {
        running: true,
        paused: false,
        score: 0,
        level: 1,
        enemiesKilled: 0,
        starfieldOffset: 0,
        gameMode: currentMode,
        missionComplete: false,
        commandModuleOpen: false,
        journeyCount: 0
    };

    // Reset player
    player.x = canvas.width / 2;
    player.y = canvas.height - 100;
    player.health = 100;
    player.maxHealth = 100;
    player.shields = 50;
    player.maxShields = 50;
    player.speed = 5;
    player.shieldRegen = 0.05;
    player.engineGlow = 0;

    // Reset weapons
    weapons.primary.damage = 10;
    weapons.missile.ammo = 5;
    weapons.laser.ammo = 3;
    weapons.cluster.ammo = 0;
    weapons.primary.cooldown = 0;
    weapons.missile.cooldown = 0;
    weapons.laser.cooldown = 0;
    weapons.cluster.cooldown = 0;

    // Clear arrays
    bullets = [];
    enemies = [];
    asteroids = [];
    nebulas = [];
    powerups = [];
    allies = [];
    particles = [];

    // Reset upgrades
    upgradePoints = 0;
    Object.keys(upgrades).forEach(key => {
        upgrades[key].level = 0;
    });

    // Reset crew system
    totalCrew = 5; // Reset to starting crew count
    currency = 0; // Reset currency
    cumulativeCredits = 0; // Reset cumulative credits (difficulty resets on restart)
    cargoCrewMembers = []; // Clear cargo crew

    document.getElementById('gameOver').classList.add('hidden');
    document.getElementById('upgradeMenu').classList.add('hidden');
    document.getElementById('missionComplete').classList.add('hidden');
    document.getElementById('commandModule').classList.add('hidden');
    
    // Reinitialize mission mode if needed
    if (gameState.gameMode === 'mission') {
        initMissionMode();
    } else {
        cargoVessel = null;
        startPlanet = null;
        endPlanet = null;
    }
    
    // Reinitialize crew
    initializeCrew();

    gameLoop();
}

// Mode selection function
function showModeSelect() {
    gameState.running = false;
    document.getElementById('modeSelect').classList.remove('hidden');
    document.getElementById('gameOver').classList.add('hidden');
    document.getElementById('missionComplete').classList.add('hidden');
}

// Initialize and start game
document.addEventListener('DOMContentLoaded', () => {
    canvas = document.getElementById('gameCanvas');
    ctx = canvas.getContext('2d');
    
    // Set canvas size
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    
    // Initialize player position
    player.x = canvas.width / 2;
    player.y = canvas.height - 100;
    
    // Initialize background
    initBackground();
    
    // Initialize audio
    initAudio();
    
    // Set up mouse/trackpad controls
    setupMouseControls();
    
    // Initialize crew system
    initializeCrew();
    setupCrewDragAndDrop();
    
    // Set up button event listeners
    document.getElementById('restartBtn').addEventListener('click', restartGame);
    document.getElementById('missionRestartBtn').addEventListener('click', () => {
        document.getElementById('missionComplete').classList.add('hidden');
        showModeSelect();
    });
    document.getElementById('closeUpgrade').addEventListener('click', () => {
        document.getElementById('upgradeMenu').classList.add('hidden');
        gameState.paused = false;
    });
    
    // Command module buttons
    document.getElementById('recruitCrewBtn').addEventListener('click', () => {
        recruitCrew();
    });
    document.getElementById('buyClusterBtn').addEventListener('click', () => {
        buyClusterAmmo();
    });
    document.getElementById('closeCommandModule').addEventListener('click', closeCommandModule);
    
    // Mode selection buttons
    document.getElementById('normalModeBtn').addEventListener('click', startNormalMode);
    document.getElementById('missionModeBtn').addEventListener('click', startMissionMode);
    
    // Mobile control buttons
    setupMobileControls();
    
    // Show mode selection on start
    showModeSelect();
    
    // Start game loop
    gameLoop();
});

