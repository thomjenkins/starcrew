// WebGL imports
import { WebGLRenderer } from './src/rendering/webgl/WebGLRenderer.js';
import { SpriteRenderer } from './src/rendering/webgl/SpriteRenderer.js';
import { ParticleRenderer } from './src/rendering/webgl/ParticleRenderer.js';
import { TrailRenderer } from './src/rendering/webgl/TrailRenderer.js';
import { CircleRenderer } from './src/rendering/webgl/CircleRenderer.js';
import { NebulaRenderer } from './src/rendering/webgl/NebulaRenderer.js';
import { ColorUtils } from './src/rendering/webgl/utils/ColorUtils.js';
import { NetworkManager } from './src/networking/NetworkManager.js';

let canvas;
let ctx;
let webglRenderer = null;
let spriteRenderer = null;
let particleRenderer = null;
let trailRenderer = null;
let circleRenderer = null;
let nebulaRenderer = null;
let useWebGL = false;
let textures = {}; // Cache for loaded textures

const urlParams = new URLSearchParams(window.location.search);
const OFFLINE_MODE = urlParams.get('offline') === '1';
const HEADLESS_MODE = urlParams.get('headless') === '1';
const OBSERVER_MODE = urlParams.get('observe') === '1';
const SPEED_MULTIPLIER = OFFLINE_MODE && HEADLESS_MODE ? parseFloat(urlParams.get('speed') || '5') : 1;

// Deterministic RNG for lockstep multiplayer
class DeterministicRNG {
    constructor(seed = 12345) {
        this.seed = seed;
    }
    
    // Linear congruential generator (deterministic)
    next() {
        this.seed = (this.seed * 1664525 + 1013904223) % Math.pow(2, 32);
        return this.seed / Math.pow(2, 32);
    }
    
    // Random number between 0 and 1
    random() {
        return this.next();
    }
    
    // Random number between min and max
    randomRange(min, max) {
        return min + this.random() * (max - min);
    }
    
    // Random integer between min (inclusive) and max (exclusive)
    randomInt(min, max) {
        return Math.floor(min + this.random() * (max - min));
    }
}

// Global deterministic RNG (seeded at game start)
let deterministicRNG = new DeterministicRNG(Date.now());

// In multiplayer, use shared seed from room
let gameSeed = null;
let gameTick = 0; // Current game tick for lockstep

// Wrapper for random number generation - uses deterministic RNG in multiplayer
function getRandom() {
    if (multiplayerMode && gameSeed !== null) {
        return deterministicRNG.random();
    }
    return Math.random();
}

// Helper to get random range
function getRandomRange(min, max) {
    if (multiplayerMode && gameSeed !== null) {
        return deterministicRNG.randomRange(min, max);
    }
    return min + Math.random() * (max - min);
}

// Helper to get random int
function getRandomInt(min, max) {
    if (multiplayerMode && gameSeed !== null) {
        return deterministicRNG.randomInt(min, max);
    }
    return Math.floor(min + Math.random() * (max - min));
}

// Helper to identify the current player for multiplayer payloads
function getLocalPlayerId() {
    if (multiplayerMode && networkManager && networkManager.isConnected()) {
        return networkManager.getPlayerId();
    }
    return 'local';
}

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
    journeyCount: 0, // For mission mode
    // Mission 1 state
    mission1Active: false,
    mission1Kills: 0,
    mission1StartTime: null,
    mission1TimeLimit: 180000, // 3 minutes in milliseconds
    mission1VideoShown: false,
    mission1Completed: false
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

// Player ship image
let playerShipImage = null;
let playerShipImageLoaded = false;

function initPlayerShipImage() {
    playerShipImage = new Image();
    playerShipImage.onload = () => {
        playerShipImageLoaded = true;
    };
    playerShipImage.onerror = () => {
        console.warn('Failed to load ship.png, using drawn shape');
        playerShipImageLoaded = false;
    };
    playerShipImage.src = 'ship.png';
}

// Damaged player ship image
let damagedPlayerShipImage = null;
let damagedPlayerShipImageLoaded = false;

function initDamagedPlayerShipImage() {
    damagedPlayerShipImage = new Image();
    damagedPlayerShipImage.onload = () => {
        damagedPlayerShipImageLoaded = true;
    };
    damagedPlayerShipImage.onerror = () => {
        console.warn('Failed to load damagedShip.png, will use regular ship');
        damagedPlayerShipImageLoaded = false;
    };
    damagedPlayerShipImage.src = 'damagedShip.png';
}

// Planet images
let planet1Image = null;
let planet1ImageLoaded = false;
let planet2Image = null;
let planet2ImageLoaded = false;

function initPlanetImages() {
    // Load planet1.png (start planet)
    planet1Image = new Image();
    planet1Image.onload = () => {
        planet1ImageLoaded = true;
    };
    planet1Image.onerror = () => {
        console.warn('Failed to load planet1.png, using drawn circle');
        planet1ImageLoaded = false;
    };
    planet1Image.src = 'planet1.png';
    
    // Load planet2.png (end planet)
    planet2Image = new Image();
    planet2Image.onload = () => {
        planet2ImageLoaded = true;
    };
    planet2Image.onerror = () => {
        console.warn('Failed to load planet2.png, using drawn circle');
        planet2ImageLoaded = false;
    };
    planet2Image.src = 'planet2.png';
}

// Cargo ship image
let cargoShipImage = null;
let cargoShipImageLoaded = false;

function initCargoShipImage() {
    cargoShipImage = new Image();
    cargoShipImage.onload = () => {
        cargoShipImageLoaded = true;
    };
    cargoShipImage.onerror = () => {
        console.warn('Failed to load cargoship.png, using drawn shape');
        cargoShipImageLoaded = false;
    };
    cargoShipImage.src = 'cargoship.png';
}

// Enemy ship image
let enemyShipImage = null;
let enemyShipImageLoaded = false;

function initEnemyShipImage() {
    enemyShipImage = new Image();
    enemyShipImage.onload = () => {
        enemyShipImageLoaded = true;
    };
    enemyShipImage.onerror = () => {
        console.warn('Failed to load enemyship.png, using drawn shape');
        enemyShipImageLoaded = false;
    };
    enemyShipImage.src = 'enemyship.png';
}

// Boss ship image
let bossShipImage = null;
let bossShipImageLoaded = false;

function initBossShipImage() {
    bossShipImage = new Image();
    bossShipImage.onload = () => {
        bossShipImageLoaded = true;
    };
    bossShipImage.onerror = () => {
        console.warn('Failed to load boss.png, using drawn shape');
        bossShipImageLoaded = false;
    };
    bossShipImage.src = 'boss.png';
}

// Ally ship image
let allyShipImage = null;
let allyShipImageLoaded = false;

function initAllyShipImage() {
    allyShipImage = new Image();
    allyShipImage.onload = () => {
        allyShipImageLoaded = true;
    };
    allyShipImage.onerror = () => {
        console.warn('Failed to load ally.png, using drawn shape');
        allyShipImageLoaded = false;
    };
    allyShipImage.src = 'ally.png';
}

// Token image (for powerups)
let tokenImage = null;
let tokenImageLoaded = false;

function initTokenImage() {
    tokenImage = new Image();
    tokenImage.onload = () => {
        tokenImageLoaded = true;
    };
    tokenImage.onerror = () => {
        console.warn('Failed to load token.png, using drawn shape');
        tokenImageLoaded = false;
    };
    tokenImage.src = 'token.png';
}

// Crew images (for crew allocation UI)
let crewImage = null;
let crewImageLoaded = false;
let crew1Image = null;
let crew1ImageLoaded = false;

function initCrewImage() {
    // Load crew.png
    crewImage = new Image();
    crewImage.onload = () => {
        crewImageLoaded = true;
    };
    crewImage.onerror = () => {
        console.warn('Failed to load crew.png, using default styling');
        crewImageLoaded = false;
    };
    crewImage.src = 'crew.png';
    
    // Load crew1.png (alternate variation)
    crew1Image = new Image();
    crew1Image.onload = () => {
        crew1ImageLoaded = true;
    };
    crew1Image.onerror = () => {
        console.warn('Failed to load crew1.png, will use crew.png only');
        crew1ImageLoaded = false;
    };
    crew1Image.src = 'crew1.png';
}

// Multiplayer - Deterministic Lockstep
let networkManager = null;
let remotePlayers = new Map(); // Other players: {id: {x, y, rotation, health, shields, ...}}
let multiplayerMode = false;
let remoteCrewAllocations = new Map(); // Remote players' crew allocations: {playerId: {engineering: count, navigation: count}}
let remoteAllies = new Map(); // Remote allies: {playerId: [ally1, ally2, ...]}
let remoteBullets = new Map(); // Remote bullets: {playerId: [bullet1, bullet2, ...]}
let previousRemoteAllies = new Map(); // Track previous ally states to detect destruction
let remotePlayerWeapons = new Map(); // Track remote player weapon states: {playerId: {primary: {cooldown, ammo}, ...}}

// Input queue for deterministic lockstep
let inputQueue = []; // [{tick, playerId, input, timestamp}, ...]
let lastProcessedTick = -1;
let inputBufferSize = 3; // Process inputs 3 ticks ahead for lag compensation

// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyAous8FY2fZt22snGzuWx1eg9c68txlU1k",
    authDomain: "asteroiddroidgame.firebaseapp.com",
    databaseURL: "https://asteroiddroidgame-default-rtdb.firebaseio.com",
    projectId: "asteroiddroidgame",
    storageBucket: "asteroiddroidgame.firebasestorage.app",
    messagingSenderId: "459886890264",
    appId: "1:459886890264:web:62e706c0ae9e0fbe76626d"
};

// Player
let player = {
    x: 0,
    y: 0,
    width: 60,  // Increased from 40 for better visibility
    height: 60, // Increased from 40 for better visibility
    speed: 5,
    health: 100,
    maxHealth: 100,
    shields: 50,
    maxShields: 50,
    shieldRegen: 0.05,
    weaponLevel: 1,
    engineGlow: 0,
    rotation: 0, // Rotation angle in radians (0 = pointing up)
    rotationSpeed: 0.08 // Radians per frame for rotation
};

// Tractor Beam
let tractorBeam = {
    active: false,
    charge: 100, // Current charge (0-100)
    maxCharge: 100,
    maxDuration: 180, // Maximum duration in frames (3 seconds at 60fps)
    currentDuration: 0,
    rechargeRate: 0.5, // Charge per frame when recharging
    drainRate: 0.6, // Charge drained per frame when active
    range: 200, // Maximum range
    target: null, // Current target object
    targetType: null // 'asteroid', 'enemy', etc.
};

// Weapons
const weapons = {
    primary: {
        damage: 10,
        cooldown: 0,
        maxCooldown: 100,
        ammo: Infinity,
        color: '#ffff00'
    },
    missile: {
        damage: 50,
        cooldown: 0,
        maxCooldown: 480,
        ammo: 5,
        maxAmmo: 5,
        color: '#ff6600'
    },
    laser: {
        damage: 30,
        cooldown: 0,
        maxCooldown: 360,
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
let bosses = []; // Boss enemies
let asteroids = [];
let nebulas = [];
let powerups = [];
let allies = [];
let particles = [];
let explosions = [];
let fireworks = [];
let pendingEffects = []; // Effects to send to non-host players (explosions, sounds)

// High Score
let highScore = 0;
let newHighScore = false;

// Load high score from localStorage
function loadHighScore() {
    try {
        const saved = localStorage.getItem('asteroidDroidHighScore');
        if (saved) {
            highScore = parseInt(saved, 10) || 0;
        }
    } catch (e) {
        console.warn('Could not load high score:', e);
    }
}

// Save high score to localStorage
function saveHighScore(score) {
    try {
        localStorage.setItem('asteroidDroidHighScore', score.toString());
        highScore = score;
    } catch (e) {
        console.warn('Could not save high score:', e);
    }
}

// Mission mode objects
let cargoVessels = []; // Changed to array to support multiple cargo ships
let cargoVessel = null; // Single cargo vessel for mission mode
let cargoShipCount = 0; // Track number of cargo ships purchased
let cargoShipPrice = 1000; // Base price for cargo ships
let hasNebuclear = false; // Nebuclear device - makes nebulae disappear when shot
let startPlanet = null;
let endPlanet = null;

// Input
const keys = {};
let mouseX = 0;
let mouseY = 0;
let mouseActive = false;
let mouseButtonDown = false;

// Mobile control state
let mobileTractorBeamActive = false;
let mobileRotateLeft = false;
let mobileRotateRight = false;

// RL Agent / Autopilot System
let autopilotEnabled = false;
let rlAgent = null;  // Will hold RL agent (PPO)
let agentLoadPromise = null;

// Training statistics
let trainingStats = {
    episode: 0,
    episodeReward: 0,
    episodeLength: 0,
    totalReward: 0,
    bestScore: 0,
    episodes: [],
    rewards: [],
    scores: []
};

// Sound System
let audioContext;
let soundEnabled = true;
let musicEnabled = true;
let soundEffectsEnabled = true;
let backgroundMusic = [];
let currentMusicIndex = 0;

function initAudio() {
    try {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {
        console.warn('Web Audio API not supported');
        soundEnabled = false;
    }
    
    // Initialize background music playlist
    const playlist = ['runorhide.mp3', 'nevermind.mp3'];
    
    playlist.forEach((song, index) => {
        const audio = new Audio(song);
        audio.volume = 0.5; // Set volume to 50% so it doesn't overpower sound effects
        
        // Handle audio loading errors
        audio.onerror = () => {
            console.warn(`Failed to load background music: ${song}`);
        };
        
        // When a song ends, play the next one in the playlist
        audio.addEventListener('ended', () => {
            if (musicEnabled) {
                currentMusicIndex = (currentMusicIndex + 1) % playlist.length;
                const nextSong = backgroundMusic[currentMusicIndex];
                if (nextSong) {
                    nextSong.play().catch(err => {
                        console.warn(`Could not play next song: ${err}`);
                    });
                }
            }
        });
        
        backgroundMusic.push(audio);
    });
}

function resumeAudioContext() {
    if (audioContext && audioContext.state === 'suspended') {
        audioContext.resume().catch(() => {});
    }
    
    // Start background music on first user interaction (required for autoplay policies)
    if (backgroundMusic.length > 0 && musicEnabled) {
        const currentSong = backgroundMusic[currentMusicIndex];
        if (currentSong && currentSong.paused) {
            currentSong.play().catch(err => {
                console.warn('Could not play background music:', err);
            });
        }
    }
}

function playSound(frequency, duration, type = 'sine', volume = 0.3, startFreq = null) {
    if (!soundEnabled || !soundEffectsEnabled || !audioContext) return;
    
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

// Dubstep-style sound functions
function playWobble(baseFreq, duration, wobbleRate = 8, wobbleDepth = 0.3, volume = 0.3) {
    if (!soundEnabled || !soundEffectsEnabled || !audioContext) return;
    resumeAudioContext();
    
    try {
        const oscillator = audioContext.createOscillator();
        const lfo = audioContext.createOscillator();
        const lfoGain = audioContext.createGain();
        const gainNode = audioContext.createGain();
        const distortion = audioContext.createWaveShaper();
        
        // Create distortion curve for aggressive sound
        const distortionCurve = new Float32Array(65536);
        for (let i = 0; i < 65536; i++) {
            const x = (i - 32768) / 32768;
            distortionCurve[i] = Math.tanh(x * 3) * 0.5;
        }
        distortion.curve = distortionCurve;
        distortion.oversample = '4x';
        
        oscillator.type = 'sawtooth';
        oscillator.frequency.setValueAtTime(baseFreq, audioContext.currentTime);
        
        // LFO for wobble effect
        lfo.type = 'sine';
        lfo.frequency.setValueAtTime(wobbleRate, audioContext.currentTime);
        lfoGain.gain.setValueAtTime(baseFreq * wobbleDepth, audioContext.currentTime);
        
        // Connect LFO to modulate oscillator frequency
        lfo.connect(lfoGain);
        lfoGain.connect(oscillator.frequency);
        
        // Gain envelope
        gainNode.gain.setValueAtTime(0, audioContext.currentTime);
        gainNode.gain.linearRampToValueAtTime(volume, audioContext.currentTime + 0.01);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration);
        
        oscillator.connect(distortion);
        distortion.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.start(audioContext.currentTime);
        lfo.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + duration);
        lfo.stop(audioContext.currentTime + duration);
    } catch (e) {
        // Silently fail
    }
}

function playBassDrop(freq, duration, volume = 0.4) {
    if (!soundEnabled || !soundEffectsEnabled || !audioContext) return;
    resumeAudioContext();
    
    try {
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        const distortion = audioContext.createWaveShaper();
        
        // Heavy distortion
        const distortionCurve = new Float32Array(65536);
        for (let i = 0; i < 65536; i++) {
            const x = (i - 32768) / 32768;
            distortionCurve[i] = Math.tanh(x * 5) * 0.6;
        }
        distortion.curve = distortionCurve;
        distortion.oversample = '4x';
        
        oscillator.type = 'square';
        oscillator.frequency.setValueAtTime(freq, audioContext.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(freq * 0.3, audioContext.currentTime + duration);
        
        gainNode.gain.setValueAtTime(0, audioContext.currentTime);
        gainNode.gain.linearRampToValueAtTime(volume, audioContext.currentTime + 0.02);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration);
        
        oscillator.connect(distortion);
        distortion.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + duration);
    } catch (e) {
        // Silently fail
    }
}

function playDubstepBeep(frequency, duration, volume = 0.2) {
    if (!soundEnabled || !soundEffectsEnabled || !audioContext) return;
    resumeAudioContext();
    
    try {
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.type = 'square';
        oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
        
        gainNode.gain.setValueAtTime(0, audioContext.currentTime);
        gainNode.gain.linearRampToValueAtTime(volume, audioContext.currentTime + 0.005);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration);
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + duration);
    } catch (e) {
        // Silently fail
    }
}

// Dubstep-style sound effects
const sounds = {
    primaryShot: () => {
        playDubstepBeep(200, 0.08, 0.2);
        playDubstepBeep(250, 0.05, 0.15);
    },
    missileLaunch: () => {
        playWobble(60, 0.25, 12, 0.4, 0.3);
        playBassDrop(80, 0.15, 0.25);
    },
    laserShot: () => {
        playTone(150, 0.12, 'sawtooth', 0.25);
        playWobble(100, 0.1, 15, 0.3, 0.2);
    },
    enemyExplosion: () => {
        playBassDrop(50, 0.4, 0.4);
        playWobble(40, 0.3, 10, 0.5, 0.3);
        playTone(60, 0.2, 'square', 0.25);
    },
    asteroidExplosion: () => {
        playBassDrop(45, 0.5, 0.35);
        playWobble(35, 0.4, 8, 0.6, 0.25);
    },
    playerHit: () => {
        playBassDrop(70, 0.25, 0.4);
        playTone(90, 0.15, 'square', 0.3);
    },
    powerupCollect: () => {
        playWobble(80, 0.2, 20, 0.3, 0.3);
        setTimeout(() => playWobble(100, 0.15, 25, 0.3, 0.25), 100);
        setTimeout(() => playWobble(120, 0.1, 30, 0.3, 0.2), 200);
    },
    enemyShot: () => {
        playDubstepBeep(120, 0.1, 0.2);
        playDubstepBeep(100, 0.08, 0.15);
    },
    levelUp: () => {
        playBassDrop(60, 0.3, 0.35);
        setTimeout(() => playWobble(80, 0.25, 15, 0.4, 0.3), 100);
        setTimeout(() => playBassDrop(100, 0.2, 0.3), 200);
    },
    allyShot: () => {
        playDubstepBeep(180, 0.08, 0.18);
        playDubstepBeep(200, 0.06, 0.12);
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

// Display dimensions (for game logic - these are in display pixels)
let displayWidth = window.innerWidth;
let displayHeight = window.innerHeight;

// Load textures for WebGL
async function loadTextures() {
    if (!webglRenderer || !webglRenderer.textureManager) {
        console.warn('WebGL renderer or texture manager not available');
        return;
    }
    
    const textureManager = webglRenderer.textureManager;
    
    try {
        console.log('Loading WebGL textures...');
        textures.background = await textureManager.loadTexture('background.png');
        console.log('Loaded background texture:', textures.background);
        textures.ship = await textureManager.loadTexture('ship.png');
        console.log('Loaded ship texture:', textures.ship, 'Type:', textures.ship?.constructor?.name);
        textures.damagedShip = await textureManager.loadTexture('damagedShip.png');
        console.log('Loaded damagedShip texture:', textures.damagedShip);
        textures.enemyShip = await textureManager.loadTexture('enemyship.png');
        console.log('Loaded enemyShip texture:', textures.enemyShip);
        textures.boss = await textureManager.loadTexture('boss.png');
        console.log('Loaded boss texture:', textures.boss);
        textures.ally = await textureManager.loadTexture('ally.png', { removeBlackBackground: true });
        console.log('Loaded ally texture:', textures.ally);
        textures.token = await textureManager.loadTexture('token.png', { removeWhiteBackground: true });
        console.log('Loaded token texture:', textures.token);
        console.log('Loaded enemyShip texture:', textures.enemyShip);
        textures.cargoShip = await textureManager.loadTexture('cargoship.png');
        console.log('Loaded cargoShip texture:', textures.cargoShip);
        textures.planet1 = await textureManager.loadTexture('planet1.png');
        console.log('Loaded planet1 texture:', textures.planet1);
        textures.planet2 = await textureManager.loadTexture('planet2.png');
        console.log('Loaded planet2 texture:', textures.planet2);
        textures.asteroid = await textureManager.loadTexture('asteroid.png');
        console.log('Loaded asteroid texture:', textures.asteroid);
        console.log('All textures loaded successfully');
    } catch (err) {
        console.error('Some textures failed to load:', err);
    }
}

// Function to set up canvas with proper device pixel ratio for high-DPI displays
function setupCanvas() {
    if (!canvas) return;
    
    // Get device pixel ratio (1 for normal displays, 2+ for Retina/high-DPI)
    const dpr = window.devicePixelRatio || 1;
    
    // Get display size
    displayWidth = window.innerWidth;
    displayHeight = window.innerHeight;
    
    if (useWebGL && webglRenderer) {
        // Use WebGL renderer resize
        webglRenderer.resize(displayWidth, displayHeight);
        
        // Update projection matrices for renderers
        const projectionMatrix = webglRenderer.getProjectionMatrix();
        if (spriteRenderer) spriteRenderer.setProjection(projectionMatrix);
        if (particleRenderer) particleRenderer.setProjection(projectionMatrix);
        if (trailRenderer) trailRenderer.setProjection(projectionMatrix);
        if (circleRenderer) circleRenderer.setProjection(projectionMatrix);
    } else if (ctx) {
        // Canvas 2D fallback
    canvas.width = displayWidth * dpr;
    canvas.height = displayHeight * dpr;
    canvas.style.width = displayWidth + 'px';
    canvas.style.height = displayHeight + 'px';
    
    // Scale context to match device pixel ratio
    ctx.scale(dpr, dpr);
    }
}

// Helper functions to get display dimensions (for game logic)
function getCanvasWidth() {
    return displayWidth;
}

function getCanvasHeight() {
    return displayHeight;
}

// Event listeners
    window.addEventListener('resize', () => {
        if (canvas) {
            setupCanvas();
            // Reinitialize player position after resize
            if (isNaN(player.x)) player.x = getCanvasWidth() / 2;
            if (isNaN(player.y)) player.y = getCanvasHeight() - 100;
        }
    });

document.addEventListener('keydown', (e) => {
    // Autopilot toggle (U key) - always works
    if ((e.key === 'u' || e.key === 'U') && gameState.running && !gameState.paused) {
        toggleAutopilot();
        e.preventDefault();
        return;
    }
    
    // Ignore other input if autopilot is enabled
    if (autopilotEnabled) {
        return;
    }
    
    keys[e.key.toLowerCase()] = true;
    if (e.key === ' ') e.preventDefault();
    // Resume audio context on first user interaction
    resumeAudioContext();
    
    // Tractor beam activation
    if ((e.key === 't' || e.key === 'T') && gameState.running && !gameState.paused) {
        activateTractorBeam();
    }
    
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
    // Ignore key releases if autopilot is enabled (except U for toggle)
    if (autopilotEnabled && e.key !== 'u' && e.key !== 'U') {
        return;
    }
    
    keys[e.key.toLowerCase()] = false;
    
    // Deactivate tractor beam when key is released
    if (e.key === 't' || e.key === 'T') {
        deactivateTractorBeam();
    }
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
        if (e.button === 0 && !autopilotEnabled) { // Left mouse button, only if autopilot off
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
    if (useWebGL && webglRenderer) {
        // WebGL rendering
        webglRenderer.clear(0, 0, 0, 1); // Black background
        
        if (textures.background && spriteRenderer) {
            const width = webglRenderer.getWidth() * webglRenderer.getDPR();
            const height = webglRenderer.getHeight() * webglRenderer.getDPR();
            spriteRenderer.begin();
            // Draw background centered at origin, covering full screen
            spriteRenderer.drawSprite(
                textures.background,
                width / 2, height / 2,  // Center position
                width,
                height,
                0,
                null,  // No color tint
                0.5, 0.5  // Center origin
            );
            spriteRenderer.end();
        }
    } else if (ctx && canvas) {
        // Canvas 2D fallback
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw background image if loaded, otherwise black background
    if (backgroundImageLoaded && backgroundImage) {
        ctx.drawImage(backgroundImage, 0, 0, getCanvasWidth(), getCanvasHeight());
    } else {
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, getCanvasWidth(), getCanvasHeight());
        }
    }
}

// Draw game title in background
function drawGameTitle() {
    if (!ctx || !canvas) return;
    
    ctx.save();
    
    const title = "Asteroid Droid";
    const fontSize = Math.max(60, getCanvasWidth() / 15);
    
    // Set font
    ctx.font = `bold ${fontSize}px Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    // Draw title with glow effect
    const x = getCanvasWidth() / 2;
    const y = getCanvasHeight() / 2;
    
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
    if (!canvas || !player) return;
    
    // Allow autopilot to run even when paused (for upgrade selection)
    // But skip normal player input when paused
    if (gameState.paused && !autopilotEnabled) return;
    
    // Ensure player position is valid
    if (isNaN(player.x)) player.x = getCanvasWidth() / 2;
    if (isNaN(player.y)) player.y = getCanvasHeight() - 100;
    
    // Apply navigation crew effect
    const speedMultiplier = 1 + (crewAllocation.navigation.length * crewEffects.navigation.speedBonus);
    const effectiveSpeed = player.speed * speedMultiplier;
    
    let wasMoving = false;
    
    // Autopilot control (if enabled) - must run FIRST to set keys
    // Allow autopilot to run even when paused (for upgrade selection)
    if (autopilotEnabled && gameState.running) {
        autopilotStep();
    }
    
    // Rotation logic - depends on tractor beam state
    // Check if tractor beam is active - if so, lock rotation to face target
    if (tractorBeam.active && tractorBeam.target) {
        // Calculate player's front position
        const frontX = player.x + Math.sin(player.rotation) * (player.height / 2);
        const frontY = player.y - Math.cos(player.rotation) * (player.height / 2);
        
        // Calculate direction to tractor beam target
        const dx = tractorBeam.target.x - frontX;
        const dy = tractorBeam.target.y - frontY;
        const targetAngle = Math.atan2(dx, -dy); // atan2(dx, -dy) because ship points up at rotation 0
        
        // Smoothly rotate toward target
        let angleDiff = targetAngle - player.rotation;
        // Normalize angle difference to [-PI, PI]
        while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
        while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;
        
        // Smoothly rotate toward target angle
        const maxRotationPerFrame = player.rotationSpeed * 2; // Allow faster rotation when tractor beaming
        if (Math.abs(angleDiff) > maxRotationPerFrame) {
            player.rotation += Math.sign(angleDiff) * maxRotationPerFrame;
        } else {
            player.rotation = targetAngle; // Snap to target when close
        }
    } else {
        // Normal rotation controls when tractor beam is not active
        // A/D rotation controls work regardless of movement method
        // Also support mobile rotation buttons
        if (keys['a'] || mobileRotateLeft) {
            player.rotation -= player.rotationSpeed;
        }
        if (keys['d'] || mobileRotateRight) {
            player.rotation += player.rotationSpeed;
        }
    }
    
    // Movement logic - works regardless of tractor beam state
    // Mouse/trackpad control (takes priority if active) - BUT NOT WHEN AUTOPILOT IS ON
    if (!autopilotEnabled && mouseActive && mouseX >= 0 && mouseY >= 0 && mouseX <= getCanvasWidth() && mouseY <= getCanvasHeight()) {
        const dx = mouseX - player.x;
        const dy = mouseY - player.y;
        const distance = Math.hypot(dx, dy);
        
        if (distance > 2) { // Only move if cursor is far enough away
            wasMoving = true;
            
            // Smooth movement towards mouse with speed limit
            const moveDistance = Math.min(distance, effectiveSpeed * 2);
            player.x += (dx / distance) * moveDistance;
            player.y += (dy / distance) * moveDistance;
            
            // Rotate toward movement direction when moving (only when actually moving, not at rest)
            if (!mouseButtonDown) {
                const targetAngle = Math.atan2(dx, -dy); // atan2(dx, -dy) because ship points up at rotation 0
                let angleDiff = targetAngle - player.rotation;
                
                // Normalize angle difference to [-PI, PI]
                while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
                while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;
                
                // Smoothly rotate toward target angle
                const maxRotationPerFrame = player.rotationSpeed * 2; // Allow faster rotation when following cursor
                if (Math.abs(angleDiff) > maxRotationPerFrame) {
                    player.rotation += Math.sign(angleDiff) * maxRotationPerFrame;
                } else {
                    player.rotation = targetAngle; // Snap to target when close
                }
            }
            
            // Keep player within bounds
            player.x = Math.max(player.width / 2, Math.min(getCanvasWidth() - player.width / 2, player.x));
            player.y = Math.max(player.height / 2, Math.min(getCanvasHeight() - player.height / 2, player.y));
        }
    } else {
        // Keyboard control
        // WASD: Rotation-based movement (A/D rotate, W/S move forward/backward)
        // Arrow keys: Direct directional movement (no rotation)
        
        // WASD forward/backward movement
        if (keys['w']) {
            wasMoving = true;
            player.x += Math.sin(player.rotation) * effectiveSpeed;
            player.y -= Math.cos(player.rotation) * effectiveSpeed;
        }
        if (keys['s']) {
            wasMoving = true;
            player.x -= Math.sin(player.rotation) * effectiveSpeed;
            player.y += Math.cos(player.rotation) * effectiveSpeed;
        }
        
        // Arrow keys: Direct directional movement (no rotation)
        wasMoving = wasMoving || keys['arrowup'] || keys['arrowdown'] || keys['arrowleft'] || keys['arrowright'];
        
        if (keys['arrowup']) player.y = Math.max(player.height / 2, player.y - effectiveSpeed);
        if (keys['arrowdown']) player.y = Math.min(getCanvasHeight() - player.height / 2, player.y + effectiveSpeed);
        if (keys['arrowleft']) player.x = Math.max(player.width / 2, player.x - effectiveSpeed);
        if (keys['arrowright']) player.x = Math.min(getCanvasWidth() - player.width / 2, player.x + effectiveSpeed);
        
        // Keep player within bounds (for WASD movement)
        player.x = Math.max(player.width / 2, Math.min(getCanvasWidth() - player.width / 2, player.x));
        player.y = Math.max(player.height / 2, Math.min(getCanvasHeight() - player.height / 2, player.y));
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
            // Base decrease is 1 per frame
            // With crew, cooldownMultiplier < 1, so we decrease faster
            // When no crew: cooldownMultiplier = 1, so decrease = 1
            // With crew: cooldownMultiplier < 1, so decrease = 1 / cooldownMultiplier > 1
            const decreaseAmount = 1 / cooldownMultiplier;
            const oldCooldown = weapons[weapon].cooldown;
            weapons[weapon].cooldown = Math.max(0, weapons[weapon].cooldown - decreaseAmount);
            // Debug: Log cooldown changes for primary weapon
            if (weapon === 'primary' && oldCooldown !== weapons[weapon].cooldown) {
                console.log(`Cooldown: ${oldCooldown.toFixed(2)} -> ${weapons[weapon].cooldown.toFixed(2)}, multiplier: ${cooldownMultiplier.toFixed(2)}, decrease: ${decreaseAmount.toFixed(2)}`);
            }
        }
    });

    // Shooting (deterministic lockstep - both players process their own shooting)
    // Mouse button or spacebar for primary weapon
    if ((keys[' '] || mouseButtonDown) && weapons.primary.cooldown === 0) {
        console.log('Shooting! Cooldown was:', weapons.primary.cooldown, 'maxCooldown:', weapons.primary.maxCooldown);
        // Debug: Log cooldown before shooting
        if (weapons.primary.cooldown !== 0) {
            console.log('WARNING: Shooting with non-zero cooldown!', weapons.primary.cooldown);
        }
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
    
    // Send player input for deterministic lockstep
    if (multiplayerMode && networkManager && networkManager.isConnected()) {
        networkManager.sendInput({
            tick: gameTick,
            keys: {
                space: keys[' '] || false,
                key1: keys['1'] || false,
                key2: keys['2'] || false,
                key3: keys['3'] || false,
                mouseButton: mouseButtonDown || false,
                w: keys['w'] || false,
                a: keys['a'] || false,
                s: keys['s'] || false,
                d: keys['d'] || false,
                arrowUp: keys['ArrowUp'] || false,
                arrowDown: keys['ArrowDown'] || false,
                arrowLeft: keys['ArrowLeft'] || false,
                arrowRight: keys['ArrowRight'] || false
            },
            mouseX: mouseActive ? mouseX : null,
            mouseY: mouseActive ? mouseY : null
        });
    }
    
    // Add smoke particles when damaged (in update, not draw)
    const healthPercent = player.health / player.maxHealth;
    if (healthPercent < 0.7 && Math.random() < 0.3) {
        const smokeX = player.x + (Math.random() - 0.5) * player.width * 0.8;
        const smokeY = player.y + (Math.random() - 0.5) * player.height * 0.8;
        particles.push({
            x: smokeX,
            y: smokeY,
            vx: (Math.random() - 0.5) * 0.5,
            vy: (Math.random() - 0.5) * 0.5,
            life: 30,
            maxLife: 30,
            size: 3 + Math.random() * 2,
            color: `hsl(0, 0%, ${30 + Math.random() * 20}%)`, // Gray smoke
            glow: false
        });
    }
}

// Shooting
function shoot(weaponType) {
    const weapon = weapons[weaponType];
    
    // Double-check cooldown to prevent spam (defensive programming)
    if (weapon.cooldown > 0 || weapon.ammo <= 0) return;

    // Set cooldown IMMEDIATELY to prevent rapid-fire spam
    // This must happen before any other logic to ensure rate limiting
    console.log('Setting cooldown to:', weapon.maxCooldown, 'from:', weapon.cooldown);
    weapon.cooldown = weapon.maxCooldown;
    if (weapon.ammo !== Infinity) weapon.ammo--;
    
    // Final safety check - if cooldown was somehow reset, abort
    if (weapon.cooldown !== weapon.maxCooldown) return;

    const ownerId = getLocalPlayerId();

    let damage = weapon.damage * (1 + upgrades.primaryDamage.level * 0.1);
    // Apply weapons crew damage bonus
    const weaponsCrewCount = crewAllocation.weapons.length;
    const damageBonus = 1 + (weaponsCrewCount * crewEffects.weapons.damageBonus);
    damage = damage * damageBonus;
    
    // Always shoot in the direction the ship is facing (based on rotation)
    // Ship's pointy end is at the top (rotation 0 = pointing up)
    // So we fire in the direction of rotation
    const baseSpeed = weaponType === 'primary' ? 8 : weaponType === 'missile' ? 10 : weaponType === 'laser' ? 15 : 12;
    const vx = Math.sin(player.rotation) * baseSpeed;
    const vy = -Math.cos(player.rotation) * baseSpeed;
    
    // Spawn bullet at the front of the ship (pointy end, which is at the top when rotation = 0)
    const bulletX = player.x + Math.sin(player.rotation) * (player.height / 2);
    const bulletY = player.y - Math.cos(player.rotation) * (player.height / 2);
    
    if (weaponType === 'primary') {
        sounds.primaryShot();
        bullets.push({
            x: bulletX,
            y: bulletY,
            vx: vx,
            vy: vy,
            damage: damage,
            color: weapon.color,
            size: 4,
            type: 'primary',
            glow: true,
            playerId: ownerId
        });
        
        // Upgraded primary fires multiple shots
        if (upgrades.primaryDamage.level >= 2) {
            const spreadAngle = 0.2; // 0.2 radians spread
            bullets.push({
                x: bulletX,
                y: bulletY,
                vx: Math.sin(player.rotation - spreadAngle) * baseSpeed,
                vy: -Math.cos(player.rotation - spreadAngle) * baseSpeed,
                damage: damage * 0.8,
                color: weapon.color,
                size: 4,
                type: 'primary',
                glow: true,
                playerId: ownerId
            });
            bullets.push({
                x: bulletX,
                y: bulletY,
                vx: Math.sin(player.rotation + spreadAngle) * baseSpeed,
                vy: -Math.cos(player.rotation + spreadAngle) * baseSpeed,
                damage: damage * 0.8,
                color: weapon.color,
                size: 4,
                type: 'primary',
                glow: true,
                playerId: ownerId
            });
        }
    } else if (weaponType === 'missile') {
        sounds.missileLaunch();
        bullets.push({
            x: bulletX,
            y: bulletY,
            vx: vx,
            vy: vy,
            damage: damage,
            color: weapon.color,
            size: 8,
            type: 'missile',
            homing: true,
            glow: true,
            trail: [],
            playerId: ownerId
        });
    } else if (weaponType === 'laser') {
        sounds.laserShot();
        bullets.push({
            x: bulletX,
            y: bulletY,
            vx: vx,
            vy: vy,
            damage: damage,
            color: weapon.color,
            size: 6,
            type: 'laser',
            pierce: true,
            glow: true,
            playerId: ownerId
        });
    } else if (weaponType === 'cluster') {
        sounds.missileLaunch();
        bullets.push({
            x: bulletX,
            y: bulletY,
            vx: vx,
            vy: vy,
            damage: damage,
            color: weapon.color,
            size: 10,
            type: 'cluster',
            glow: true,
            clusterSpread: true, // Mark as cluster bullet
            playerId: ownerId
        });
    }
}

// Update bullets
function updateBullets() {
    // In deterministic lockstep (gameSeed set), both players apply damage (it's deterministic)
    // In host-authoritative mode (no seed), only host applies damage
    const isLockstep = multiplayerMode && gameSeed !== null;
    const isAuthoritativeForDamage = !multiplayerMode || !networkManager || networkManager.isHostPlayer() || isLockstep;

    bullets = bullets.filter(bullet => {
        // Update position for all bullets (including enemy bullets)
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
                    if (isAuthoritativeForDamage) {
                    enemy.health -= bullet.damage;
                    }
                    
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
                                    if (isAuthoritativeForDamage) {
                                    enemies[j].health -= spreadDamage;
                                    }
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
                    if (isAuthoritativeForDamage) {
                    asteroid.health -= bullet.damage;
                    }
                    if (!bullet.pierce || bullet.type === 'cluster') {
                        createExplosion(bullet.x, bullet.y, 10);
                        shouldRemove = true;
                        break;
                    }
                }
            }
        }

        // Check collisions with nebulae (Nebuclear device makes them disappear)
        if (!shouldRemove && hasNebuclear && (bullet.type === 'primary' || bullet.type === 'missile' || bullet.type === 'laser' || bullet.type === 'ally' || bullet.type === 'cluster')) {
            for (let i = 0; i < nebulas.length; i++) {
                const nebula = nebulas[i];
                // Check if bullet is within nebula bounds
                const dist = Math.hypot(bullet.x - nebula.x, bullet.y - nebula.y);
                if (dist < nebula.width / 2) {
                    // Nebuclear makes nebula disappear
                    createExplosion(bullet.x, bullet.y, 30);
                    sounds.enemyExplosion();
                    if (isAuthoritativeForDamage) {
                        nebulas.splice(i, 1);
                    }
                    i--; // Adjust index after removal
                    if (!bullet.pierce || bullet.type === 'cluster') {
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

        return bullet.y > -20 && bullet.y < getCanvasHeight() + 20 && 
               bullet.x > -20 && bullet.x < getCanvasWidth() + 20;
    });
}

// Spawn enemies
function spawnEnemy() {
    // In deterministic lockstep, both players spawn entities (same seed = same spawns)
    
    // Difficulty scales with cumulative credits (every 100 credits = 1 difficulty level)
    const creditDifficulty = cumulativeCredits / 100;
    const difficulty = creditDifficulty * 0.05;
    const hue = getRandom() * 60;
    
    // Spawn from random edge (0=top, 1=right, 2=bottom, 3=left)
    let edge = Math.floor(getRandom() * 4);
    let x, y, vx, vy;
    let attempts = 0;
    const maxAttempts = 20; // Increased attempts
    const minDistance = 120; // Increased minimum distance from other enemies
    
    // Try to spawn enemy at a position that's not too close to existing enemies
    do {
        // Add some randomization to spawn position to avoid exact overlaps
        const edgeOffset = (getRandom() - 0.5) * 50; // Random offset along edge
        
        switch(edge) {
            case 0: // Top
                x = Math.max(30, Math.min(getCanvasWidth() - 30, getRandom() * getCanvasWidth() + edgeOffset));
                y = -30;
                vx = (getRandom() - 0.5) * 1;
                vy = 0.5 + getRandom() * 0.5;
                break;
            case 1: // Right
                x = getCanvasWidth() + 30;
                y = Math.max(30, Math.min(getCanvasHeight() - 30, getRandom() * getCanvasHeight() + edgeOffset));
                vx = -(0.5 + getRandom() * 0.5);
                vy = (getRandom() - 0.5) * 1;
                break;
            case 2: // Bottom
                x = Math.max(30, Math.min(getCanvasWidth() - 30, getRandom() * getCanvasWidth() + edgeOffset));
                y = getCanvasHeight() + 30;
                vx = (getRandom() - 0.5) * 1;
                vy = -(0.5 + getRandom() * 0.5);
                break;
            case 3: // Left
                x = -30;
                y = Math.max(30, Math.min(getCanvasHeight() - 30, getRandom() * getCanvasHeight() + edgeOffset));
                vx = 0.5 + getRandom() * 0.5;
                vy = (getRandom() - 0.5) * 1;
                break;
        }
        attempts++;
        
        // Check if position is too close to existing enemies
        let tooClose = false;
        for (let i = 0; i < enemies.length; i++) {
            const dist = Math.hypot(enemies[i].x - x, enemies[i].y - y);
            if (dist < minDistance) {
                tooClose = true;
                break;
            }
        }
        
        // If not too close, use this position
        if (!tooClose) {
            break;
        }
        
        // Try a different edge if we keep getting too close
        if (attempts % 5 === 0) {
            edge = Math.floor(Math.random() * 4);
        }
    } while (attempts < maxAttempts);
    
    enemies.push({
        id: 'enemy_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9), // Unique ID for multiplayer sync
        x: x,
        y: y,
        width: 30 + Math.random() * 20,
        height: 30 + Math.random() * 20,
        vx: vx,
        vy: vy,
        health: 20 + creditDifficulty * 8, // Reduced from 30 to 20 at start
        maxHealth: 20 + creditDifficulty * 8,
        color: `hsl(${hue}, 70%, 50%)`,
        glowColor: `hsl(${hue}, 100%, 60%)`,
        shootCooldown: Math.max(40, 150 - creditDifficulty * 2), // Increased from 90 to 150 at start
        damage: 6 + creditDifficulty * 1.5, // Reduced from 10 to 6 at start
        rotation: 0, // Will be set based on target direction
        targetRotation: 0, // Target rotation for smooth interpolation
        lastNebulaDamageTime: 0,
        pursuitSpeed: 0.4 + difficulty * 0.3, // Reduced from 0.5 to 0.4 at start
        targetType: null, // 'player', 'cargo', or 'ally'
        targetSwitchCooldown: 0, // Cooldown before switching targets
        circleDirection: Math.random() < 0.5 ? 1 : -1 // Consistent circling direction (clockwise or counter-clockwise)
    });
}

// Spawn boss (appears every 1000 points)
function spawnBoss() {
    // In multiplayer, only host spawns bosses
    // In deterministic lockstep, both players spawn entities (same seed = same spawns)
    
    // Difficulty scales with cumulative credits
    const creditDifficulty = cumulativeCredits / 100;
    const difficulty = creditDifficulty * 0.05;
    
    // Spawn from random edge
    const edge = Math.floor(getRandom() * 4);
    let x, y, vx, vy;
    
    switch(edge) {
        case 0: // Top
            x = getCanvasWidth() / 2 + (getRandom() - 0.5) * 200;
            y = -50;
            vx = (getRandom() - 0.5) * 0.5;
            vy = 0.3 + getRandom() * 0.3;
            break;
        case 1: // Right
            x = getCanvasWidth() + 50;
            y = getCanvasHeight() / 2 + (getRandom() - 0.5) * 200;
            vx = -(0.3 + getRandom() * 0.3);
            vy = (getRandom() - 0.5) * 0.5;
            break;
        case 2: // Bottom
            x = getCanvasWidth() / 2 + (getRandom() - 0.5) * 200;
            y = getCanvasHeight() + 50;
            vx = (getRandom() - 0.5) * 0.5;
            vy = -(0.3 + getRandom() * 0.3);
            break;
        case 3: // Left
            x = -50;
            y = getCanvasHeight() / 2 + (getRandom() - 0.5) * 200;
            vx = 0.3 + getRandom() * 0.3;
            vy = (getRandom() - 0.5) * 0.5;
            break;
    }
    
    // Boss is 3x stronger than average enemy
    const baseHealth = 20 + creditDifficulty * 8;
    const baseDamage = 6 + creditDifficulty * 1.5;
    const baseWidth = 30 + Math.random() * 20;
    const baseHeight = 30 + Math.random() * 20;
    
    bosses.push({
        id: 'boss_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9), // Unique ID for multiplayer sync
        x: x,
        y: y,
        width: baseWidth * 3, // 3x size (50% bigger than previous 2x)
        height: baseHeight * 3,
        vx: vx,
        vy: vy,
        health: baseHealth * 3, // 3x health
        maxHealth: baseHealth * 3,
        color: `hsl(0, 100%, 50%)`, // Red color for boss
        glowColor: `hsl(0, 100%, 70%)`,
        shootCooldown: Math.max(20, 100 - creditDifficulty * 2), // Faster shooting
        damage: baseDamage * 3, // 3x damage
        rotation: 0,
        targetRotation: 0,
        lastNebulaDamageTime: 0,
        pursuitSpeed: 0.5 + difficulty * 0.4, // Slightly faster
        targetType: 'player',
        targetSwitchCooldown: 0,
        circleDirection: Math.random() < 0.5 ? 1 : -1,
        isBoss: true // Mark as boss
    });
}

// Spawn asteroids
function spawnAsteroid() {
    // In deterministic lockstep, both players spawn entities (same seed = same spawns)
    
    const size = 20 + getRandom() * 40;
    // Difficulty scales with cumulative credits (every 100 credits = 1 difficulty level)
    const creditDifficulty = cumulativeCredits / 100;
    const difficulty = creditDifficulty * 0.05; // More gradual speed increase
    asteroids.push({
        id: 'asteroid_' + Date.now() + '_' + getRandom().toString(36).substr(2, 9), // Unique ID for multiplayer sync
        x: getRandom() * getCanvasWidth(),
        y: -size,
        width: size,
        height: size,
        vx: (getRandom() - 0.5) * 3,
        vy: 0.5 + getRandom() * 1.5 + difficulty, // Start slower
        rotation: getRandom() * Math.PI * 2,
        rotationSpeed: (getRandom() - 0.5) * 0.1,
        health: size * 2 + creditDifficulty * 2, // More gradual health increase
        maxHealth: size * 2 + creditDifficulty * 2,
        color: '#888',
        points: []
    });
    
    // Generate random asteroid shape
    const asteroid = asteroids[asteroids.length - 1];
    const pointCount = 8 + Math.floor(getRandom() * 4);
    for (let i = 0; i < pointCount; i++) {
        const angle = (i / pointCount) * Math.PI * 2;
        const radius = asteroid.width / 2 * (0.7 + getRandom() * 0.3);
        asteroid.points.push({
            angle: angle,
            radius: radius
        });
    }
}

// Spawn nebulas
function spawnNebula() {
    // In deterministic lockstep, both players spawn entities (same seed = same spawns)
    
    const size = 100 + getRandom() * 150; // Slightly larger for more impressive clouds
    
    // Colorful palette: blues, cyans, purples, magentas, reds, and pinks
    // Hue range: 0-360 (full spectrum, but focusing on cool colors and warm reds/pinks)
    const colorType = getRandom();
    let hue, saturation, lightness;
    
    if (colorType < 0.2) {
        // Light blue/cyan (180-220) - vibrant blues
        hue = 180 + getRandom() * 40;
        saturation = 80 + getRandom() * 20; // 80-100% - very saturated
        lightness = 55 + getRandom() * 20; // 55-75% - bright
    } else if (colorType < 0.4) {
        // Bright cyan/blue (200-240) - very vibrant
        hue = 200 + getRandom() * 40;
        saturation = 85 + getRandom() * 15; // 85-100% - very saturated
        lightness = 60 + getRandom() * 20; // 60-80% - bright
    } else if (colorType < 0.6) {
        // Purple/indigo (240-280) - vibrant purples
        hue = 240 + getRandom() * 40;
        saturation = 80 + getRandom() * 20; // 80-100% - very saturated
        lightness = 55 + getRandom() * 20; // 55-75% - bright
    } else if (colorType < 0.75) {
        // Magenta/pink (280-320) - vibrant magentas and pinks
        hue = 280 + getRandom() * 40;
        saturation = 85 + getRandom() * 15; // 85-100% - very saturated
        lightness = 60 + getRandom() * 20; // 60-80% - bright
    } else if (colorType < 0.9) {
        // Light red/pink (0-30 and 330-360) - warm reds and pinks
        // Wrap around the hue circle for reds
        hue = getRandom() < 0.5 ? getRandom() * 30 : 330 + getRandom() * 30;
        saturation = 75 + getRandom() * 20; // 75-95% - very saturated
        lightness = 60 + getRandom() * 20; // 60-80% - bright
    } else {
        // Light purple (270-300) - soft purples
        hue = 270 + getRandom() * 30;
        saturation = 70 + getRandom() * 25; // 70-95% - saturated
        lightness = 65 + getRandom() * 15; // 65-80% - very light
    }
    
    // Spawn from a random edge of the screen
    const edge = Math.floor(getRandom() * 4); // 0=top, 1=right, 2=bottom, 3=left
    let x, y, vx, vy;
    
    switch(edge) {
        case 0: // Top
            x = getRandom() * getCanvasWidth();
            y = -size / 2;
            vx = (getRandom() - 0.5) * 0.5;
            vy = 0.3 + getRandom() * 0.3; // Move downward
            break;
        case 1: // Right
            x = getCanvasWidth() + size / 2;
            y = getRandom() * getCanvasHeight();
            vx = -(0.3 + getRandom() * 0.3); // Move leftward
            vy = (getRandom() - 0.5) * 0.5;
            break;
        case 2: // Bottom
            x = getRandom() * getCanvasWidth();
            y = getCanvasHeight() + size / 2;
            vx = (getRandom() - 0.5) * 0.5;
            vy = -(0.3 + getRandom() * 0.3); // Move upward
            break;
        case 3: // Left
            x = -size / 2;
            y = getRandom() * getCanvasHeight();
            vx = 0.3 + getRandom() * 0.3; // Move rightward
            vy = (getRandom() - 0.5) * 0.5;
            break;
    }
    
    // Generate many cloud blobs with noise-like distribution for organic cloud appearance
    const cloudBlobs = [];
    const blobCount = 20 + Math.floor(getRandom() * 15); // 20-34 blobs for dense, continuous clouds
    
    // Create a more organic distribution using multiple layers
    for (let i = 0; i < blobCount; i++) {
        // Use a noise-like distribution pattern for more organic appearance
        const layer = Math.floor(i / (blobCount / 3)); // 3 layers: core, mid, outer
        const layerProgress = (i % (blobCount / 3)) / (blobCount / 3);
        
        let angle, dist, baseRadius;
        if (layer === 0) {
            // Core layer - dense center
            angle = layerProgress * Math.PI * 2 + getRandom() * 0.5;
            dist = (getRandom() * 0.3 + 0.05) * size / 2; // Close to center
            baseRadius = size * (0.15 + getRandom() * 0.2); // Larger core blobs
        } else if (layer === 1) {
            // Mid layer - medium density
            angle = layerProgress * Math.PI * 2 + getRandom() * 0.8;
            dist = (getRandom() * 0.4 + 0.2) * size / 2; // Medium distance
            baseRadius = size * (0.1 + getRandom() * 0.25); // Medium blobs
        } else {
            // Outer layer - sparse edges
            angle = layerProgress * Math.PI * 2 + getRandom() * 1.2;
            dist = (getRandom() * 0.5 + 0.4) * size / 2; // Far from center
            baseRadius = size * (0.08 + getRandom() * 0.2); // Smaller edge blobs
        }
        
        // Add some randomness for organic feel
        angle += (getRandom() - 0.5) * 0.3;
        dist += (getRandom() - 0.5) * size * 0.1;
        
        cloudBlobs.push({
            x: Math.cos(angle) * dist,
            y: Math.sin(angle) * dist,
            radius: baseRadius,
            baseRadius: baseRadius,
            vx: (getRandom() - 0.5) * 0.4,
            vy: (getRandom() - 0.5) * 0.4,
            phase: getRandom() * Math.PI * 2,
            morphSpeed: 0.3 + getRandom() * 0.4,
            sizeVariation: 0.15 + getRandom() * 0.25,
            density: 0.6 + getRandom() * 0.4 // Varying density for more organic look
        });
    }
    
    nebulas.push({
        x: x,
        y: y,
        width: size,
        height: size,
        vx: vx,
        vy: vy,
        rotation: getRandom() * Math.PI * 2,
        rotationSpeed: (getRandom() - 0.5) * 0.02,
        color: `hsl(${hue}, ${saturation}%, ${lightness}%)`,
        glowColor: `hsl(${hue}, ${Math.min(100, saturation + 20)}%, ${Math.min(80, lightness + 20)}%)`, // Brighter glow
        damagePerSecond: 2 + (cumulativeCredits / 100) * 0.5, // Scale with cumulative credits
        lastPlayerDamageTime: 0,
        lastCargoDamageTime: 0,
        cloudBlobs: cloudBlobs,
        morphTime: getRandom() * Math.PI * 2, // Starting phase for morphing
        morphSpeed: 0.015 + getRandom() * 0.01 // Overall morph speed (0.015-0.025)
    });
}

// Update nebulas
function updateNebulas() {
    // In deterministic lockstep, both players update positions
    // Both players run the same deterministic simulation, so positions stay in sync
    const now = Date.now();
    
    nebulas = nebulas.filter(nebula => {
        // Move nebula slowly
        nebula.x += nebula.vx;
        nebula.y += nebula.vy;
        nebula.rotation += nebula.rotationSpeed;
        
        // Morph cloud blobs over time - more dramatic morphing
        if (nebula.morphTime !== undefined) {
            nebula.morphSpeed = nebula.morphSpeed || 0.02;
            nebula.morphTime += nebula.morphSpeed; // Variable morphing speed
        } else {
            nebula.morphTime = getRandom() * Math.PI * 2; // Initialize if missing
            nebula.morphSpeed = 0.015 + getRandom() * 0.01;
        }
        
        if (nebula.cloudBlobs) {
            nebula.cloudBlobs.forEach(blob => {
                // Update blob position with slow drift
                blob.x += blob.vx * 0.15;
                blob.y += blob.vy * 0.15;
                
                // More dramatic morphing motion using multiple sine waves for organic cloud movement
                const morphSpeed = blob.morphSpeed || 1.0;
                const morphX1 = Math.sin(nebula.morphTime * morphSpeed + blob.phase) * 4;
                const morphY1 = Math.cos(nebula.morphTime * morphSpeed * 0.7 + blob.phase) * 4;
                const morphX2 = Math.sin(nebula.morphTime * morphSpeed * 0.5 + blob.phase * 1.3) * 3;
                const morphY2 = Math.cos(nebula.morphTime * morphSpeed * 0.8 + blob.phase * 1.7) * 3;
                
                blob.x += (morphX1 + morphX2) * 0.15; // More pronounced movement
                blob.y += (morphY1 + morphY2) * 0.15;
                
                // Keep blobs within reasonable bounds (soft constraint with more flexibility)
                const distFromCenter = Math.sqrt(blob.x * blob.x + blob.y * blob.y);
                const maxDist = nebula.width / 2 * 1.5; // Allow more spread
                if (distFromCenter > maxDist) {
                    // Gently pull back toward center
                    const pullFactor = 0.97;
                    blob.x *= pullFactor;
                    blob.y *= pullFactor;
                }
                
                // More dramatic size variation for shifting cloud appearance
                const sizeVariation = blob.sizeVariation || 0.2;
                const sizeWave1 = Math.sin(nebula.morphTime * morphSpeed * 0.6 + blob.phase);
                const sizeWave2 = Math.cos(nebula.morphTime * morphSpeed * 0.4 + blob.phase * 1.5);
                const sizeChange = (sizeWave1 + sizeWave2 * 0.5) * sizeVariation;
                
                blob.radius = blob.baseRadius * (1 + sizeChange);
                blob.radius = Math.max(nebula.width * 0.08, Math.min(nebula.width * 0.45, blob.radius));
            });
        }
        
        // Remove nebula if it goes completely off screen (opposite side from where it entered)
        const margin = nebula.width;
        if (nebula.x < -margin || nebula.x > getCanvasWidth() + margin ||
            nebula.y < -margin || nebula.y > getCanvasHeight() + margin) {
            return false; // Remove this nebula
        }
        
        // Keep nebula in bounds (but allow it to drift off screen)
        // Only constrain if it's trying to go back the way it came
        if (nebula.vx > 0 && nebula.x > getCanvasWidth() - nebula.width / 2) {
            nebula.vx *= -0.5; // Slow down and reverse slightly
        }
        if (nebula.vx < 0 && nebula.x < nebula.width / 2) {
            nebula.vx *= -0.5;
        }
        if (nebula.vy > 0 && nebula.y > getCanvasHeight() - nebula.height / 2) {
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
    // Limit nebulas on screen for performance (reduced from 5 to 3)
    if (nebulas.length > 3) {
        nebulas.shift(); // Remove oldest
    }
}

// Helper function to convert HSL to RGBA
function hslToRgba(hsl, alpha) {
    if (hsl && hsl.startsWith('hsl')) {
        const match = hsl.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/);
        if (match) {
            const h = parseInt(match[1]) / 360;
            const s = parseInt(match[2]) / 100;
            const l = parseInt(match[3]) / 100;
            const c = (1 - Math.abs(2 * l - 1)) * s;
            const x = c * (1 - Math.abs((h * 6) % 2 - 1));
            const m = l - c / 2;
            let r, g, b;
            if (h < 1/6) { r = c; g = x; b = 0; }
            else if (h < 2/6) { r = x; g = c; b = 0; }
            else if (h < 3/6) { r = 0; g = c; b = x; }
            else if (h < 4/6) { r = 0; g = x; b = c; }
            else if (h < 5/6) { r = x; g = 0; b = c; }
            else { r = c; g = 0; b = x; }
            return `rgba(${Math.round((r + m) * 255)}, ${Math.round((g + m) * 255)}, ${Math.round((b + m) * 255)}, ${alpha})`;
        }
    }
    return hsl || `rgba(255, 255, 255, ${alpha})`; // Fallback
}

// Draw nebulas
function drawNebulas() {
    if (useWebGL && nebulaRenderer) {
        // WebGL rendering - draw nebulas as organic gas clouds with rounded edges
        nebulaRenderer.begin();
        
        // Debug: Log nebula count
        if (nebulas.length > 0 && nebulas.length % 10 === 0) {
            console.log(`Drawing ${nebulas.length} nebulae`);
        }
        
        nebulas.forEach((nebula, nebulaIndex) => {
            // Parse the HSL values directly to ensure we get vibrant colors
            // Match decimal numbers: (\d+\.?\d*) instead of just (\d+)
            const baseColorMatch = nebula.color.match(/hsl\(([\d.]+),\s*([\d.]+)%,\s*([\d.]+)%\)/);
            const glowColorMatch = nebula.glowColor.match(/hsl\(([\d.]+),\s*([\d.]+)%,\s*([\d.]+)%\)/);
            
            let baseColorParsed, glowColorParsed;
            
            if (baseColorMatch && glowColorMatch) {
                // Boost saturation and lightness significantly for vibrant colors
                const baseH = parseFloat(baseColorMatch[1]);
                const baseS = Math.min(100, parseFloat(baseColorMatch[2]) + 30); // +30% saturation
                const baseL = Math.min(75, parseFloat(baseColorMatch[3]) + 15); // +15% lightness
                
                const glowH = parseFloat(glowColorMatch[1]);
                const glowS = Math.min(100, parseFloat(glowColorMatch[2]) + 30);
                const glowL = Math.min(80, parseFloat(glowColorMatch[3]) + 20);
                
                // Parse with boosted values - ColorUtils.hslToRgba expects h in 0-360, s and l in 0-100
                baseColorParsed = ColorUtils.hslToRgba(baseH, baseS, baseL, 1.0);
                glowColorParsed = ColorUtils.hslToRgba(glowH, glowS, glowL, 1.0);
                
                // Debug: Verify the conversion worked (only first nebula to avoid spam)
                if (nebulaIndex === 0) {
                    console.log('✅ HSL parsed successfully:', {
                        original: nebula.color,
                        boosted: `hsl(${baseH.toFixed(1)}, ${baseS.toFixed(1)}%, ${baseL.toFixed(1)}%)`,
                        baseRGB: `rgb(${Math.round(baseColorParsed[0]*255)}, ${Math.round(baseColorParsed[1]*255)}, ${Math.round(baseColorParsed[2]*255)})`,
                        glowRGB: `rgb(${Math.round(glowColorParsed[0]*255)}, ${Math.round(glowColorParsed[1]*255)}, ${Math.round(glowColorParsed[2]*255)})`
                    });
                }
            } else {
                // Fallback parsing - this shouldn't happen now, but keep as safety
                console.warn('⚠️ Failed to match HSL pattern:', nebula.color, nebula.glowColor);
                baseColorParsed = ColorUtils.parseColor(nebula.color, 1.0);
                glowColorParsed = ColorUtils.parseColor(nebula.glowColor, 1.0);
            }
            
            if (nebula.cloudBlobs && nebula.cloudBlobs.length > 0) {
                // Draw each cloud blob as many overlapping organic-shaped sprites
                nebula.cloudBlobs.forEach((blob, index) => {
                    const distFromCenter = Math.sqrt(blob.x * blob.x + blob.y * blob.y);
                    const normalizedDist = distFromCenter / (nebula.width / 2);
                    const baseOpacity = (1 - normalizedDist * 0.2) * 1.0; // Full opacity for vibrant colors
                    
                    // Convert blob position to world coordinates
                    const cos = Math.cos(nebula.rotation);
                    const sin = Math.sin(nebula.rotation);
                    const worldX = nebula.x + blob.x * cos - blob.y * sin;
                    const worldY = nebula.y + blob.x * sin + blob.y * cos;
                    
                    // Create smooth gradient effect with many overlapping organic shapes
                    const sizeFactor = blob.radius / (nebula.width * 0.3);
                    const depthOpacity = Math.min(1.0, baseOpacity * (0.8 + sizeFactor * 0.4));
                    const density = blob.density || 1.0;
                    
                    // Draw fewer, larger sprites with higher opacity to preserve colors
                    // Too many overlapping sprites wash out colors even with normal blending
                    const numSprites = Math.floor(6 * density); // Much fewer sprites
                    
                    for (let s = 0; s < numSprites; s++) {
                        const spriteProgress = s / Math.max(1, numSprites - 1);
                        
                        // Vary sprite size and position for organic cloud shape
                        const spriteSize = blob.radius * (0.5 + (1 - spriteProgress) * 0.5);
                        const spriteWidth = spriteSize * (0.7 + Math.random() * 0.6);
                        const spriteHeight = spriteSize * (0.7 + Math.random() * 0.6);
                        
                        // Random offset within blob area for organic distribution
                        const offsetAngle = (s / numSprites) * Math.PI * 2 + blob.phase;
                        const offsetDist = blob.radius * (0.1 + spriteProgress * 0.6);
                        const offsetX = worldX + Math.cos(offsetAngle) * offsetDist;
                        const offsetY = worldY + Math.sin(offsetAngle) * offsetDist;
                        
                        // Vary rotation for more organic appearance
                        const spriteRotation = offsetAngle + (Math.random() - 0.5) * 0.8;
                        
                        // Higher opacity per sprite to make colors more visible
                        // With fewer sprites, each one needs to be more opaque
                        const spriteOpacity = Math.min(1.0, depthOpacity * density * (0.8 + spriteProgress * 0.2));
                        
                        // Blend from outer color to inner glow color - use actual parsed colors
                        // Ensure colors are vibrant and not washed out
                        let spriteColor;
                        if (spriteProgress < 0.3) {
                            // Outer sprites use base color - ensure full color intensity
                            spriteColor = new Float32Array([
                                baseColorParsed[0], 
                                baseColorParsed[1], 
                                baseColorParsed[2], 
                                spriteOpacity
                            ]);
                        } else if (spriteProgress < 0.7) {
                            // Middle sprites blend between color and glow
                            const blend = (spriteProgress - 0.3) / 0.4;
                            spriteColor = new Float32Array([
                                baseColorParsed[0] * (1 - blend) + glowColorParsed[0] * blend,
                                baseColorParsed[1] * (1 - blend) + glowColorParsed[1] * blend,
                                baseColorParsed[2] * (1 - blend) + glowColorParsed[2] * blend,
                                spriteOpacity
                            ]);
                        } else {
                            // Inner sprites use glow color - ensure full color intensity
                            spriteColor = new Float32Array([
                                glowColorParsed[0], 
                                glowColorParsed[1], 
                                glowColorParsed[2], 
                                spriteOpacity
                            ]);
                        }
                        
                        // Draw organic-shaped sprite (rectangle at angle) with rounded edges
                        nebulaRenderer.drawSprite(
                            offsetX, offsetY,
                            spriteWidth, spriteHeight,
                            spriteRotation,
                            spriteColor,
                            0.5, 0.5 // Center origin
                        );
                    }
                    
                    // Add flowing wisps using elongated sprites
                    const wispCount = Math.floor(blob.radius / 10) + 3;
                    for (let w = 0; w < wispCount; w++) {
                        const wispPhase = blob.phase + (w / wispCount) * Math.PI * 2;
                        const morphSpeed = blob.morphSpeed || 1.0;
                        const wispAngle = nebula.morphTime * morphSpeed * 0.3 + wispPhase;
                        const wispDist = blob.radius * (0.2 + (w / wispCount) * 0.7);
                        const wispX = worldX + Math.cos(wispAngle) * wispDist;
                        const wispY = worldY + Math.sin(wispAngle) * wispDist;
                        
                        // Elongated sprites for wispy tendrils
                        const wispLength = blob.radius * (0.5 + Math.random() * 0.5);
                        const wispWidth = blob.radius * (0.2 + Math.random() * 0.2);
                        const wispOpacity = Math.min(1.0, depthOpacity * density * (0.7 + Math.random() * 0.3));
                        const wispColor = new Float32Array([
                            glowColorParsed[0], glowColorParsed[1], glowColorParsed[2], wispOpacity
                        ]);
                        
                        nebulaRenderer.drawSprite(
                            wispX, wispY,
                            wispLength, wispWidth,
                            wispAngle,
                            wispColor,
                            0.5, 0.5
                        );
                    }
                });
                
                // Draw bright core in center with multiple overlapping sprites
                const coreSize = nebula.width / 4;
                
                // Draw core as multiple overlapping sprites for bright center
                for (let c = 0; c < 6; c++) {
                    const coreProgress = c / 5;
                    const coreSpriteSize = coreSize * (1 - coreProgress * 0.65);
                    const coreOpacity = 1.0; // Full opacity for vibrant core colors
                    const coreSpriteColor = new Float32Array([
                        glowColorParsed[0], glowColorParsed[1], glowColorParsed[2], coreOpacity
                    ]);
                    nebulaRenderer.drawSprite(
                        nebula.x, nebula.y,
                        coreSpriteSize, coreSpriteSize,
                        c * 0.4, // Slight rotation variation
                        coreSpriteColor,
                        0.5, 0.5
                    );
                }
            } else {
                // Fallback for old nebulas without cloud blobs
                const nebulaColor = ColorUtils.parseColor(nebula.color, 0.8);
                nebulaRenderer.drawSprite(
                    nebula.x, nebula.y,
                    nebula.width, nebula.height,
                    0,
                    nebulaColor,
                    0.5, 0.5
                );
            }
        });
        
        nebulaRenderer.end();
    } else if (ctx) {
        // Canvas 2D fallback
    nebulas.forEach(nebula => {
        ctx.save();
        ctx.translate(nebula.x, nebula.y);
        ctx.rotate(nebula.rotation);
        
        // Draw morphing cloud shape using multiple overlapping blobs
        if (nebula.cloudBlobs && nebula.cloudBlobs.length > 0) {
            ctx.globalCompositeOperation = 'screen';
            
            nebula.cloudBlobs.forEach((blob, index) => {
                const blobGradient = ctx.createRadialGradient(
                    blob.x, blob.y, 0,
                    blob.x, blob.y, blob.radius
                );
                
                const distFromCenter = Math.sqrt(blob.x * blob.x + blob.y * blob.y);
                const normalizedDist = distFromCenter / (nebula.width / 2);
                    const opacity = (1 - normalizedDist * 0.5) * 0.8;
                
                blobGradient.addColorStop(0, hslToRgba(nebula.glowColor, opacity * 0.9));
                    blobGradient.addColorStop(0.5, hslToRgba(nebula.color, opacity * 0.5));
                blobGradient.addColorStop(1, hslToRgba(nebula.color, 0));
                
                ctx.fillStyle = blobGradient;
                    ctx.shadowBlur = 10;
        ctx.shadowColor = nebula.glowColor;
                
        ctx.beginPath();
                ctx.arc(blob.x, blob.y, blob.radius, 0, Math.PI * 2);
        ctx.fill();
            });
            
            ctx.globalAlpha = 0.3;
            nebula.cloudBlobs.forEach(blob => {
                const wispAngle = nebula.morphTime * 0.3 + blob.phase;
                const wispDist = blob.radius * 0.6;
                const wispX = blob.x + Math.cos(wispAngle) * wispDist;
                const wispY = blob.y + Math.sin(wispAngle) * wispDist;
                const wispRadius = blob.radius * 0.4;
                
                const wispGradient = ctx.createRadialGradient(
                    wispX, wispY, 0,
                    wispX, wispY, wispRadius
                );
                wispGradient.addColorStop(0, hslToRgba(nebula.color, 0.4));
                wispGradient.addColorStop(1, hslToRgba(nebula.color, 0));
                
                ctx.fillStyle = wispGradient;
                ctx.beginPath();
                ctx.arc(wispX, wispY, wispRadius, 0, Math.PI * 2);
                ctx.fill();
            });
            
            // Draw bright core in center
            ctx.globalAlpha = 1;
            ctx.globalCompositeOperation = 'source-over';
            ctx.shadowBlur = 15; // Reduced from 30 for performance
            ctx.shadowColor = nebula.glowColor;
            const coreGradient = ctx.createRadialGradient(0, 0, 0, 0, 0, nebula.width / 6);
        coreGradient.addColorStop(0, '#ffffff');
            coreGradient.addColorStop(0.4, nebula.glowColor);
        coreGradient.addColorStop(1, 'transparent');
        ctx.fillStyle = coreGradient;
        ctx.beginPath();
            ctx.arc(0, 0, nebula.width / 6, 0, Math.PI * 2);
        ctx.fill();
        } else {
            // Fallback for old nebulas without cloud blobs (backward compatibility)
            const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, nebula.width / 2);
            gradient.addColorStop(0, nebula.glowColor);
            gradient.addColorStop(0.3, nebula.color);
            gradient.addColorStop(0.7, hexToRgba(nebula.color, 0.5));
            gradient.addColorStop(1, hexToRgba(nebula.color, 0));
            
            ctx.shadowBlur = 15; // Reduced from 30 for performance
            ctx.shadowColor = nebula.glowColor;
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.ellipse(0, 0, nebula.width / 2, nebula.height / 2, 0, 0, Math.PI * 2);
            ctx.fill();
        }
        
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
        ctx.shadowBlur = 0;
        ctx.restore();
    });
}
}

// Update enemies
function updateEnemies() {
    // In deterministic lockstep, both players update positions and check collisions
    // Both players run the same deterministic simulation, so positions stay in sync
    // Track which enemies have been counted for mission kills (prevent double counting)
    const missionKillsTracked = new Set();
    
    enemies = enemies.filter(enemy => {
        // Decrease target switch cooldown
        if (enemy.targetSwitchCooldown > 0) {
            enemy.targetSwitchCooldown--;
        }
        
        // Determine target (player, nearest cargo vessel, or nearest ally)
        // Only switch targets if cooldown is 0 and we find a better target
            let targetX = player.x;
            let targetY = player.y;
        let newTargetType = 'player';
        
        // Check for nearest ally
        let nearestAlly = null;
        let nearestAllyDist = Infinity;
        allies.forEach(ally => {
            const dist = Math.hypot(ally.x - enemy.x, ally.y - enemy.y);
            if (dist < nearestAllyDist) {
                nearestAllyDist = dist;
                nearestAlly = ally;
            }
        });
        
        // Check for nearest cargo vessel
        let nearestCargo = null;
        let nearestCargoDist = Infinity;
        if (gameState.gameMode === 'mission' && cargoVessel) {
            const dist = Math.hypot(cargoVessel.x - enemy.x, cargoVessel.y - enemy.y);
            if (dist < nearestCargoDist) {
                nearestCargoDist = dist;
                nearestCargo = cargoVessel;
            }
        }
        
        // Choose target: only switch if cooldown is 0
        if (enemy.targetSwitchCooldown === 0) {
            // Choose target: cargo vessel (40% chance in mission mode), ally (30% chance if nearby), or player
            if (gameState.gameMode === 'mission' && nearestCargo && getRandom() < 0.4) {
                targetX = nearestCargo.x;
                targetY = nearestCargo.y;
                newTargetType = 'cargo';
                enemy.targetSwitchCooldown = 120; // 2 seconds at 60fps
            } else if (nearestAlly && nearestAllyDist < 200 && getRandom() < 0.3) {
                // 30% chance to target nearby ally
                targetX = nearestAlly.x;
                targetY = nearestAlly.y;
                newTargetType = 'ally';
                enemy.targetSwitchCooldown = 120;
            } else {
                newTargetType = 'player';
                enemy.targetSwitchCooldown = 60; // Shorter cooldown for player target
            }
            enemy.targetType = newTargetType;
        } else {
            // Keep current target based on targetType
            if (enemy.targetType === 'cargo' && nearestCargo) {
                targetX = nearestCargo.x;
                targetY = nearestCargo.y;
            } else if (enemy.targetType === 'ally' && nearestAlly && nearestAllyDist < 300) {
                targetX = nearestAlly.x;
                targetY = nearestAlly.y;
            } else {
                // Fallback to player if target is invalid
                targetX = player.x;
                targetY = player.y;
                enemy.targetType = 'player';
            }
        }
        
        // Separation force to prevent overlapping with other enemies
        let separationX = 0;
        let separationY = 0;
        const separationRadius = 60; // Distance to maintain from other enemies
        const separationForce = 0.3;
        
        enemies.forEach(other => {
            if (other === enemy) return;
            const dx = enemy.x - other.x;
            const dy = enemy.y - other.y;
            const dist = Math.hypot(dx, dy);
            if (dist > 0 && dist < separationRadius) {
                const force = (separationRadius - dist) / separationRadius;
                separationX += (dx / dist) * force * separationForce;
                separationY += (dy / dist) * force * separationForce;
            }
        });
        
        // Pursue target with circling behavior (avoid ramming)
            const dx = targetX - enemy.x;
            const dy = targetY - enemy.y;
            const dist = Math.hypot(dx, dy);
        
        if (dist > 0) {
            const pursuitForce = enemy.pursuitSpeed || 0.8;
            const minDistance = 80; // Minimum distance to maintain from target
            const maxDistance = 150; // Preferred distance for circling
            const repulsionForce = 0.4; // Force to push away when too close
            const circlingForce = 0.3; // Force to circle around target
            
            let pursuitX = 0;
            let pursuitY = 0;
            let repulsionX = 0;
            let repulsionY = 0;
            let circlingX = 0;
            let circlingY = 0;
            
            if (dist < minDistance) {
                // Too close - push away from target
                repulsionX = -(dx / dist) * repulsionForce * ((minDistance - dist) / minDistance);
                repulsionY = -(dy / dist) * repulsionForce * ((minDistance - dist) / minDistance);
            } else if (dist > maxDistance) {
                // Too far - move toward target
                pursuitX = (dx / dist) * pursuitForce;
                pursuitY = (dy / dist) * pursuitForce;
            } else {
                // At preferred distance - circle around target
                // Calculate tangential direction (perpendicular to direction to target)
                // Rotate 90 degrees: (dx, dy) -> (-dy, dx) for clockwise, (dy, -dx) for counter-clockwise
                const tangentX = -dy / dist; // Perpendicular vector (normalized)
                const tangentY = dx / dist;
                
                // Use consistent circling direction for this enemy
                circlingX = tangentX * circlingForce * enemy.circleDirection;
                circlingY = tangentY * circlingForce * enemy.circleDirection;
                
                // Slight pull toward preferred distance
                const distanceError = dist - (minDistance + maxDistance) / 2;
                pursuitX = (dx / dist) * pursuitForce * 0.3 * (distanceError / maxDistance);
                pursuitY = (dy / dist) * pursuitForce * 0.3 * (distanceError / maxDistance);
            }
            
            // Combine all forces
            enemy.vx = pursuitX + repulsionX + circlingX + separationX;
            enemy.vy = pursuitY + repulsionY + circlingY + separationY;
        } else {
            // Apply separation even if at target
            enemy.vx = separationX;
            enemy.vy = separationY;
        }
        
        // Update position
        enemy.x += enemy.vx;
        enemy.y += enemy.vy;
        
        // Orient enemy toward target (ship faces target)
        // Enemy ship image points up when rotation = 0 (like player ship)
        // Use same rotation calculation as player: Math.atan2(dx, -dy)
        enemy.targetRotation = Math.atan2(dx, -dy);
        
        // Smoothly interpolate rotation to prevent flickering
        let angleDiff = enemy.targetRotation - enemy.rotation;
        // Normalize angle difference to [-PI, PI]
        while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
        while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;
        
        // Smooth rotation with max rotation speed
        const maxRotationSpeed = 0.1; // Radians per frame
        if (Math.abs(angleDiff) > maxRotationSpeed) {
            enemy.rotation += Math.sign(angleDiff) * maxRotationSpeed;
        } else {
            enemy.rotation = enemy.targetRotation;
        }
        
        // Keep enemy on screen (bounce off edges or wrap around)
        const margin = 20;
        if (enemy.x < margin) {
            enemy.x = margin;
            enemy.vx = Math.abs(enemy.vx) * 0.5; // Bounce
        } else if (enemy.x > getCanvasWidth() - margin) {
            enemy.x = getCanvasWidth() - margin;
            enemy.vx = -Math.abs(enemy.vx) * 0.5; // Bounce
        }
        if (enemy.y < margin) {
            enemy.y = margin;
            enemy.vy = Math.abs(enemy.vy) * 0.5; // Bounce
        } else if (enemy.y > getCanvasHeight() - margin) {
            enemy.y = getCanvasHeight() - margin;
            enemy.vy = -Math.abs(enemy.vy) * 0.5; // Bounce
        }
        
        enemy.shootCooldown--;

        // Enemy shooting (can shoot from anywhere on screen)
        if (enemy.shootCooldown <= 0 && dist > 0) {
            enemy.shootCooldown = 60 + getRandom() * 60;
            sounds.enemyShot();
            
            // Shoot at target from the front of the enemy (pointy end)
            // Enemy's pointy end is at the bottom in rotated coords: (0, enemy.height/2)
            // Transform to world coordinates
            const frontX = enemy.x + Math.sin(enemy.rotation) * (enemy.height / 2);
            const frontY = enemy.y - Math.cos(enemy.rotation) * (enemy.height / 2);
            
            bullets.push({
                x: frontX,
                y: frontY,
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
            
            // Track mission 1 kills (only once per enemy)
            if (gameState.mission1Active && !missionKillsTracked.has(enemy.id)) {
                missionKillsTracked.add(enemy.id);
                gameState.mission1Kills++;
                if (gameState.mission1Kills >= 5) {
                    completeMission1();
                }
            }
            
            // Award credits in normal mode
            if (gameState.gameMode === 'normal') {
                currency += 5;
                cumulativeCredits += 5; // Track cumulative credits
            }
            
            // No powerups from enemies - only from asteroids
            return false;
        }
        
        
        // Check collision with allies
        for (let i = 0; i < allies.length; i++) {
            const ally = allies[i];
            if (checkCollision(enemy, ally)) {
                ally.health -= enemy.damage * 2;
                sounds.enemyExplosion();
                createExplosion(enemy.x, enemy.y, 30);
                gameState.score += 50;
                gameState.enemiesKilled++;
                
                // Track mission 1 kills (only once per enemy)
                if (gameState.mission1Active && !missionKillsTracked.has(enemy.id)) {
                    missionKillsTracked.add(enemy.id);
                    gameState.mission1Kills++;
                    if (gameState.mission1Kills >= 5) {
                        completeMission1();
                    }
                }
                
                // Check if ally is destroyed
                if (ally.health <= 0) {
                    createExplosion(ally.x, ally.y, 25);
                    
                    // No powerups from destroyed allies - remove ally
                    allies.splice(i, 1);
                }
                
                // Award credits in normal mode
                if (gameState.gameMode === 'normal') {
                    currency += 5;
                    cumulativeCredits += 5;
                }
                return false;
            }
        }
        
        // Check collision with cargo vessel in mission mode
        if (gameState.gameMode === 'mission' && cargoVessel && checkCollision(enemy, cargoVessel)) {
            cargoVessel.health -= enemy.damage * 2;
            sounds.enemyExplosion();
            createExplosion(enemy.x, enemy.y, 30);
            gameState.score += 50;
            gameState.enemiesKilled++;
            
            // Track mission 1 kills (only once per enemy)
            if (gameState.mission1Active && !missionKillsTracked.has(enemy.id)) {
                missionKillsTracked.add(enemy.id);
                gameState.mission1Kills++;
                if (gameState.mission1Kills >= 5) {
                    completeMission1();
                }
            }
            
            return false;
        }

        if (enemy.health <= 0) {
            sounds.enemyExplosion();
            createExplosion(enemy.x, enemy.y, 30);
            gameState.score += 50;
            gameState.enemiesKilled++;
            
            // Track mission 1 kills (only once per enemy)
            if (gameState.mission1Active && !missionKillsTracked.has(enemy.id)) {
                missionKillsTracked.add(enemy.id);
                gameState.mission1Kills++;
                if (gameState.mission1Kills >= 5) {
                    completeMission1();
                }
            }
            
            // Award credits in normal mode
            if (gameState.gameMode === 'normal') {
                currency += 5;
                cumulativeCredits += 5; // Track cumulative credits
            }
            
            // Track if enemy was destroyed while being tractored
            if (tractorBeam.active && tractorBeam.target === enemy) {
                targetsDestroyedWhileTractored++;
            }
            
            // No powerups from enemies - only from asteroids
            return false;
        }

        // Add smoke particles when damaged (in update, not draw)
        const enemyHealthPercent = enemy.health / enemy.maxHealth;
        if (enemyHealthPercent < 0.7 && Math.random() < 0.3) {
            const smokeX = enemy.x + (Math.random() - 0.5) * enemy.width * 0.8;
            const smokeY = enemy.y + (Math.random() - 0.5) * enemy.height * 0.8;
            particles.push({
                x: smokeX,
                y: smokeY,
                vx: (Math.random() - 0.5) * 0.5,
                vy: (Math.random() - 0.5) * 0.5,
                life: 30,
                maxLife: 30,
                size: 3 + Math.random() * 2,
                color: `hsl(0, 0%, ${30 + Math.random() * 20}%)`, // Gray smoke
                glow: false
            });
        }

        // Keep enemy on screen - only remove if destroyed
        return true;
    });
}

// Update bosses (similar to enemies but stronger)
function updateBosses() {
    // For non-host players, positions come from host - don't update
    if (multiplayerMode && networkManager && !networkManager.isHostPlayer()) {
        return;
    }
    
    bosses = bosses.filter(boss => {
        // Similar AI to enemies but always targets player
        const targetX = player.x;
        const targetY = player.y;
        
        // Pursue player with circling behavior
        const dx = targetX - boss.x;
        const dy = targetY - boss.y;
        const dist = Math.hypot(dx, dy);
        
        if (dist > 0) {
            const pursuitForce = boss.pursuitSpeed || 0.8;
            const minDistance = 100; // Slightly larger for boss
            const maxDistance = 180;
            const repulsionForce = 0.4;
            const circlingForce = 0.3;
            
            let pursuitX = 0;
            let pursuitY = 0;
            let repulsionX = 0;
            let repulsionY = 0;
            let circlingX = 0;
            let circlingY = 0;
            
            if (dist < minDistance) {
                repulsionX = -(dx / dist) * repulsionForce * ((minDistance - dist) / minDistance);
                repulsionY = -(dy / dist) * repulsionForce * ((minDistance - dist) / minDistance);
            } else if (dist > maxDistance) {
                pursuitX = (dx / dist) * pursuitForce;
                pursuitY = (dy / dist) * pursuitForce;
            } else {
                const tangentX = -dy / dist;
                const tangentY = dx / dist;
                circlingX = tangentX * circlingForce * boss.circleDirection;
                circlingY = tangentY * circlingForce * boss.circleDirection;
                const distanceError = dist - (minDistance + maxDistance) / 2;
                pursuitX = (dx / dist) * pursuitForce * 0.3 * (distanceError / maxDistance);
                pursuitY = (dy / dist) * pursuitForce * 0.3 * (distanceError / maxDistance);
            }
            
            boss.vx = pursuitX + repulsionX + circlingX;
            boss.vy = pursuitY + repulsionY + circlingY;
        }
        
        // Update position
        boss.x += boss.vx;
        boss.y += boss.vy;
        
        // Orient boss toward player
        boss.targetRotation = Math.atan2(dx, -dy);
        let angleDiff = boss.targetRotation - boss.rotation;
        while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
        while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;
        
        const maxRotationSpeed = 0.08; // Slightly slower rotation for boss
        if (Math.abs(angleDiff) > maxRotationSpeed) {
            boss.rotation += Math.sign(angleDiff) * maxRotationSpeed;
        } else {
            boss.rotation = boss.targetRotation;
        }
        
        // Keep boss on screen
        const margin = 30;
        if (boss.x < margin) {
            boss.x = margin;
            boss.vx = Math.abs(boss.vx) * 0.5;
        } else if (boss.x > getCanvasWidth() - margin) {
            boss.x = getCanvasWidth() - margin;
            boss.vx = -Math.abs(boss.vx) * 0.5;
        }
        if (boss.y < margin) {
            boss.y = margin;
            boss.vy = Math.abs(boss.vy) * 0.5;
        } else if (boss.y > getCanvasHeight() - margin) {
            boss.y = getCanvasHeight() - margin;
            boss.vy = -Math.abs(boss.vy) * 0.5;
        }
        
        // Boss shooting
        boss.shootCooldown--;
        if (boss.shootCooldown <= 0 && dist > 0) {
            boss.shootCooldown = 40 + Math.random() * 40; // Faster shooting
            sounds.enemyShot();
            
            const frontX = boss.x + Math.sin(boss.rotation) * (boss.height / 2);
            const frontY = boss.y - Math.cos(boss.rotation) * (boss.height / 2);
            
            bullets.push({
                x: frontX,
                y: frontY,
                vx: (dx / dist) * 4, // Faster bullets
                vy: (dy / dist) * 4,
                damage: boss.damage,
                color: '#ff0000',
                size: 6, // Larger bullets
                type: 'enemy',
                glow: true
            });
        }
        
        // Check collision with player bullets
        for (let i = 0; i < bullets.length; i++) {
            const bullet = bullets[i];
            if (bullet.type !== 'enemy' && checkCollision(boss, bullet)) {
                boss.health -= bullet.damage;
                bullets.splice(i, 1);
                i--;
            }
        }
        
        // Check collision with player - ramming boss kills player instantly
        if (checkCollision(boss, player)) {
            player.health = 0; // Instant kill
            gameOver();
            sounds.enemyExplosion();
            createExplosion(boss.x, boss.y, 50);
            return false;
        }
        
        // Check collision with cargo vessel
        if (gameState.gameMode === 'mission' && cargoVessel && checkCollision(boss, cargoVessel)) {
            cargoVessel.health -= boss.damage * 2;
            sounds.enemyExplosion();
            createExplosion(boss.x, boss.y, 50);
            return false;
        }
        
        // Check collision with allies
        for (let i = 0; i < allies.length; i++) {
            const ally = allies[i];
            if (checkCollision(boss, ally)) {
                ally.health -= boss.damage * 2; // Boss does more damage
                sounds.enemyExplosion();
                createExplosion(boss.x, boss.y, 50);
                
                // Check if ally is destroyed
                if (ally.health <= 0) {
                    createExplosion(ally.x, ally.y, 25);
                    allies.splice(i, 1);
                }
            }
        }
        
        // Boss defeated - drop token and award points
        if (boss.health <= 0) {
            sounds.enemyExplosion();
            createBigExplosion(boss.x, boss.y, 80); // Bigger explosion
            gameState.score += 500; // More points for boss
            gameState.enemiesKilled++;
            
            // Award credits in normal mode
            if (gameState.gameMode === 'normal') {
                currency += 50; // More credits for boss
                cumulativeCredits += 50;
            }
            
            // Drop token (powerup) when defeated
            spawnPowerup(boss.x, boss.y);
            
            return false;
        }
        
        // Add smoke particles when damaged
        const bossHealthPercent = boss.health / boss.maxHealth;
        if (bossHealthPercent < 0.7 && Math.random() < 0.3) {
            const smokeX = boss.x + (Math.random() - 0.5) * boss.width * 0.8;
            const smokeY = boss.y + (Math.random() - 0.5) * boss.height * 0.8;
            particles.push({
                x: smokeX,
                y: smokeY,
                vx: (Math.random() - 0.5) * 0.5,
                vy: (Math.random() - 0.5) * 0.5,
                life: 30,
                maxLife: 30,
                size: 5 + Math.random() * 3, // Larger smoke
                color: `hsl(0, 0%, ${30 + Math.random() * 20}%)`,
                glow: false
            });
        }
        
        return true;
    });
}

// Update asteroids
function updateAsteroids() {
    // In deterministic lockstep, both players update positions and check collisions
    // Positions are deterministic (same seed = same positions), so both players can update
    asteroids = asteroids.filter(asteroid => {
        // Apply tractor beam force if this asteroid is the target
        if (tractorBeam.active && tractorBeam.target === asteroid && tractorBeam.targetType === 'asteroid') {
            // Force is already applied in updateTractorBeam, just update position
        }
        
        // Update position (deterministic - both players do this)
        asteroid.x += asteroid.vx;
        asteroid.y += asteroid.vy;
        asteroid.rotation += asteroid.rotationSpeed;

        // Check collision with player (both players detect collisions in lockstep)
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
            
            // Track asteroid destruction for RL rewards
            asteroidsDestroyedThisStep++;
            
            // Track if asteroid was destroyed while being tractored
            if (tractorBeam.active && tractorBeam.target === asteroid) {
                targetsDestroyedWhileTractored++;
            }
            
            // Drop upgrade powerup from destroyed asteroids (incentive to mine them)
            if (Math.random() < 0.4) { // 40% chance to drop upgrade
                spawnPowerup(asteroid.x, asteroid.y);
            }
            return false;
        }

        return asteroid.y < getCanvasHeight() + 50;
    });
}

// Powerups
function spawnPowerup(x, y) {
    // Always spawn upgrade type - opens upgrade menu when collected
    powerups.push({
        x: x,
        y: y,
        width: 20,
        height: 20,
        vy: 0, // Stay in place
        type: 'upgrade', // Always upgrade type
        rotation: 0,
        rotationSpeed: 0.05,
        pulse: 0,
        spawnTime: Date.now() // Track when powerup was spawned
    });
}

function updatePowerups() {
    const now = Date.now();
    const lifetime = 3000; // 3 seconds in milliseconds
    
    powerups = powerups.filter(powerup => {
        // Powerups stay in place (no movement)
        // powerup.y += powerup.vy; // Removed - powerups don't move
        powerup.rotation += powerup.rotationSpeed;
        powerup.pulse += 0.1;

        // Check if powerup has expired (3 seconds)
        if (now - powerup.spawnTime > lifetime) {
            return false; // Remove expired powerup
        }

        if (checkCollision(powerup, player)) {
            collectPowerup(powerup.type);
            return false;
        }

        return true; // Keep powerup if not expired and not collected
    });
}

// Tractor Beam Functions
function findNearestTractorTarget() {
    let nearestTarget = null;
    let nearestDist = tractorBeam.range;
    let targetType = null;
    
    // Calculate player's front position (where tractor beam emits from)
    const frontX = player.x + Math.sin(player.rotation) * (player.height / 2);
    const frontY = player.y - Math.cos(player.rotation) * (player.height / 2);
    
    // Check asteroids first (primary target for mining)
    asteroids.forEach(asteroid => {
        const dx = asteroid.x - frontX;
        const dy = asteroid.y - frontY;
        const dist = Math.hypot(dx, dy);
        if (dist < nearestDist) {
            nearestDist = dist;
            nearestTarget = asteroid;
            targetType = 'asteroid';
        }
    });
    
    // Check enemies (secondary target)
    enemies.forEach(enemy => {
        const dx = enemy.x - frontX;
        const dy = enemy.y - frontY;
        const dist = Math.hypot(dx, dy);
        if (dist < nearestDist) {
            nearestDist = dist;
            nearestTarget = enemy;
            targetType = 'enemy';
        }
    });
    
    // Check bosses (can be tractored)
    bosses.forEach(boss => {
        const dx = boss.x - frontX;
        const dy = boss.y - frontY;
        const dist = Math.hypot(dx, dy);
        if (dist < nearestDist) {
            nearestDist = dist;
            nearestTarget = boss;
            targetType = 'boss';
        }
    });
    
    return { target: nearestTarget, type: targetType };
}

function activateTractorBeam() {
    if (tractorBeam.charge <= 0 || tractorBeam.active) return;
    
    const result = findNearestTractorTarget();
    if (result.target) {
        tractorBeam.active = true;
        tractorBeam.target = result.target;
        tractorBeam.targetType = result.type;
        tractorBeam.currentDuration = 0;
        tractorBeamActivatedThisStep = true;  // Track activation for rewards
    }
}

function deactivateTractorBeam() {
    tractorBeam.active = false;
    tractorBeam.target = null;
    tractorBeam.targetType = null;
    tractorBeam.currentDuration = 0;
    mobileTractorBeamActive = false;
    const mobileTractorBeamBtn = document.getElementById('mobileTractorBeamBtn');
    if (mobileTractorBeamBtn) {
        mobileTractorBeamBtn.classList.remove('active');
    }
}

// RL Agent / Autopilot Functions

// Observation and action dimensions
// Updated: 6 (player) + 15 (enemies) + 10 (asteroids) + 10 (enemy bullets) + 5 (weapons) + 2 (tractor) + 2 (score/level) + 4 (cargo) + 4 (crew) + 1 (upgrade pending) + 4 (powerups) = 63
const OBS_DIM = 63;
const NUM_ACTIONS = 20;  // 0-19 actions (11 movement/combat + 5 crew management + 4 upgrade selection)

// Action space: 16 discrete actions
const ACTIONS = {
    NO_OP: 0,
    MOVE_UP: 1,          // W or Arrow Up
    MOVE_DOWN: 2,        // S or Arrow Down
    MOVE_LEFT: 3,        // A or Arrow Left
    MOVE_RIGHT: 4,       // D or Arrow Right
    ROTATE_LEFT: 5,      // A (rotation)
    ROTATE_RIGHT: 6,     // D (rotation)
    SHOOT_PRIMARY: 7,    // Space or Mouse Click
    SHOOT_MISSILE: 8,    // 1 key
    SHOOT_LASER: 9,      // 2 key
    ACTIVATE_TRACTOR: 10, // T key
    // Crew management actions
    ASSIGN_CREW_SHIELDS: 11,      // Assign crew to shields station
    ASSIGN_CREW_ENGINEERING: 12,   // Assign crew to engineering station
    ASSIGN_CREW_WEAPONS: 13,       // Assign crew to weapons station
    ASSIGN_CREW_NAVIGATION: 14,    // Assign crew to navigation station
    UNASSIGN_CREW: 15,             // Unassign crew (move to pool)
    // Upgrade selection actions
    SELECT_UPGRADE_HEALTH: 16,     // Select health upgrade
    SELECT_UPGRADE_SHIELDS: 17,    // Select shields upgrade
    SELECT_UPGRADE_ALLY: 18,       // Select player ally upgrade
    SELECT_UPGRADE_CARGO_ALLY: 19  // Select cargo ally upgrade
};

// Extract game observation (normalized to [-1, 1] range)
function getGameObservation() {
    const obs = [];
    
    // Player state (normalized)
    obs.push((player.x / getCanvasWidth()) * 2 - 1);  // x position [-1, 1]
    obs.push((player.y / getCanvasHeight()) * 2 - 1); // y position [-1, 1]
    obs.push(player.rotation / (2 * Math.PI));        // rotation [0, 1]
    obs.push(player.health / player.maxHealth);       // health [0, 1]
    obs.push(player.shields / player.maxShields);     // shields [0, 1]
    obs.push(player.rotationSpeed);                   // rotation speed
    
    // Nearest enemies (top 5)
    const nearestEnemies = getNearestObjects(enemies, 5);
    for (let i = 0; i < 5; i++) {
        if (nearestEnemies[i]) {
            const enemy = nearestEnemies[i];
            const dx = enemy.x - player.x;
            const dy = enemy.y - player.y;
            const dist = Math.hypot(dx, dy);
            const angle = Math.atan2(dy, dx) / (2 * Math.PI); // normalized angle
            obs.push(Math.tanh(dist / 500));  // distance (tanh for normalization)
            obs.push(angle);
            obs.push(enemy.health / 20);  // normalized enemy health
        } else {
            obs.push(1.0);  // no enemy (far away)
            obs.push(0.0);
            obs.push(0.0);
        }
    }
    
    // Nearest asteroids (top 5)
    const nearestAsteroids = getNearestObjects(asteroids, 5);
    for (let i = 0; i < 5; i++) {
        if (nearestAsteroids[i]) {
            const asteroid = nearestAsteroids[i];
            const dx = asteroid.x - player.x;
            const dy = asteroid.y - player.y;
            const dist = Math.hypot(dx, dy);
            const angle = Math.atan2(dy, dx) / (2 * Math.PI);
            obs.push(Math.tanh(dist / 500));
            obs.push(angle);
        } else {
            obs.push(1.0);
            obs.push(0.0);
        }
    }
    
    // Weapon states
    obs.push(weapons.primary.cooldown / weapons.primary.maxCooldown);
    obs.push(weapons.missile.cooldown / weapons.missile.maxCooldown);
    obs.push(weapons.missile.ammo / weapons.missile.maxAmmo);
    obs.push(weapons.laser.cooldown / weapons.laser.maxCooldown);
    obs.push(weapons.laser.ammo / weapons.laser.maxAmmo);
    
    // Tractor beam state
    obs.push(tractorBeam.charge / tractorBeam.maxCharge);
    obs.push(tractorBeam.active ? 1.0 : 0.0);
    
    // Score and level (normalized)
    obs.push(Math.tanh(gameState.score / 1000));
    obs.push(gameState.level / 10);
    
    // Nearest enemy bullets (top 5) - critical for avoiding damage
    const enemyBullets = bullets.filter(b => b.type === 'enemy');
    const nearestEnemyBullets = getNearestObjects(enemyBullets, 5);
    for (let i = 0; i < 5; i++) {
        if (nearestEnemyBullets[i]) {
            const bullet = nearestEnemyBullets[i];
            const dx = bullet.x - player.x;
            const dy = bullet.y - player.y;
            const dist = Math.hypot(dx, dy);
            const angle = Math.atan2(dy, dx) / (2 * Math.PI);
            obs.push(Math.tanh(dist / 500));  // distance
            obs.push(angle);  // angle to bullet
        } else {
            obs.push(1.0);  // no bullet (far away)
            obs.push(0.0);
        }
    }
    
    // Cargo vessel state (mission mode)
    if (gameState.gameMode === 'mission' && cargoVessel) {
        const dx = cargoVessel.x - player.x;
        const dy = cargoVessel.y - player.y;
        const dist = Math.hypot(dx, dy);
        const angle = Math.atan2(dy, dx) / (2 * Math.PI);
        obs.push(Math.tanh(dist / 500));  // distance to cargo vessel
        obs.push(angle);  // angle to cargo vessel
        obs.push(cargoVessel.health ? (cargoVessel.health / cargoVessel.maxHealth) : 1.0);  // cargo health (if exists)
        obs.push(cargoVessel.direction || 0);  // cargo direction (-1 or 1)
    } else {
        obs.push(1.0);  // no cargo vessel
        obs.push(0.0);
        obs.push(0.0);
        obs.push(0.0);
    }
    
    // Crew allocation (normalized counts)
    obs.push(crewAllocation.shields.length / 5);  // max 5 crew per station
    obs.push(crewAllocation.engineering.length / 5);
    obs.push(crewAllocation.weapons.length / 5);
    obs.push(crewAllocation.navigation.length / 5);
    
    // Upgrade menu state (1.0 if upgrade menu is open, 0.0 otherwise)
    const upgradeMenuOpen = !document.getElementById('upgradeMenu').classList.contains('hidden');
    obs.push(upgradeMenuOpen ? 1.0 : 0.0);
    
    // Nearest powerups (top 2) - for collecting upgrade tokens
    const nearestPowerups = getNearestObjects(powerups, 2);
    for (let i = 0; i < 2; i++) {
        if (nearestPowerups[i]) {
            const powerup = nearestPowerups[i];
            const dx = powerup.x - player.x;
            const dy = powerup.y - player.y;
            const dist = Math.hypot(dx, dy);
            const angle = Math.atan2(dy, dx) / (2 * Math.PI);
            obs.push(Math.tanh(dist / 500));  // distance
            obs.push(angle);  // angle to powerup
        } else {
            obs.push(1.0);  // no powerup (far away)
            obs.push(0.0);
        }
    }
    
    return obs;
}

// Helper: Get nearest objects sorted by distance
function getNearestObjects(objects, count) {
    if (!objects || objects.length === 0) {
        return new Array(count).fill(null);
    }
    
    const withDistances = objects.map(obj => ({
        obj: obj,
        dist: Math.hypot(obj.x - player.x, obj.y - player.y)
    }));
    
    withDistances.sort((a, b) => a.dist - b.dist);
    
    const result = [];
    for (let i = 0; i < count; i++) {
        result.push(withDistances[i] ? withDistances[i].obj : null);
    }
    
    return result;
}


// Apply agent action to game
function applyAgentAction(action) {
    console.log('applyAgentAction called with action:', action);
    // Clear previous input state
    const prevKeys = {...keys};
    const prevMouseButton = mouseButtonDown;
    
    // Reset action-specific keys
    keys[' '] = false;
    keys['1'] = false;
    keys['2'] = false;
    keys['t'] = false;
    keys['T'] = false;
    keys['w'] = false;
    keys['s'] = false;
    keys['a'] = false;
    keys['d'] = false;
    keys['arrowup'] = false;
    keys['arrowdown'] = false;
    keys['arrowleft'] = false;
    keys['arrowright'] = false;
    mouseButtonDown = false;
    
    // Apply action
    switch(action) {
        case ACTIONS.NO_OP:
            // Do nothing
            break;
        case ACTIONS.MOVE_UP:
            keys['w'] = true;
            keys['arrowup'] = true;
            break;
        case ACTIONS.MOVE_DOWN:
            keys['s'] = true;
            keys['arrowdown'] = true;
            break;
        case ACTIONS.MOVE_LEFT:
            keys['arrowleft'] = true;
            break;
        case ACTIONS.MOVE_RIGHT:
            keys['arrowright'] = true;
            break;
        case ACTIONS.ROTATE_LEFT:
            keys['a'] = true;
            break;
        case ACTIONS.ROTATE_RIGHT:
            keys['d'] = true;
            break;
        case ACTIONS.SHOOT_PRIMARY:
            keys[' '] = true;
            mouseButtonDown = true;
            break;
        case ACTIONS.SHOOT_MISSILE:
            keys['1'] = true;
            break;
        case ACTIONS.SHOOT_LASER:
            keys['2'] = true;
            break;
        case ACTIONS.ACTIVATE_TRACTOR:
            // Tractor beam is activated via function call, not key press
            if (gameState.running && !gameState.paused) {
                activateTractorBeam();
            }
            break;
        case ACTIONS.ASSIGN_CREW_SHIELDS:
            assignCrewToStationAgent('shields');
            break;
        case ACTIONS.ASSIGN_CREW_ENGINEERING:
            assignCrewToStationAgent('engineering');
            break;
        case ACTIONS.ASSIGN_CREW_WEAPONS:
            assignCrewToStationAgent('weapons');
            break;
        case ACTIONS.ASSIGN_CREW_NAVIGATION:
            assignCrewToStationAgent('navigation');
            break;
        case ACTIONS.UNASSIGN_CREW:
            unassignCrewAgent();
            break;
        case ACTIONS.SELECT_UPGRADE_HEALTH:
            selectUpgradeAgent('health');
            break;
        case ACTIONS.SELECT_UPGRADE_SHIELDS:
            selectUpgradeAgent('shields');
            break;
        case ACTIONS.SELECT_UPGRADE_ALLY:
            selectUpgradeAgent('ally');
            break;
        case ACTIONS.SELECT_UPGRADE_CARGO_ALLY:
            selectUpgradeAgent('cargoAlly');
            break;
        default:
            console.warn('Unknown action:', action);
            break;
    }
    console.log('Keys after applyAgentAction:', {
        w: keys['w'],
        a: keys['a'],
        s: keys['s'],
        d: keys['d'],
        space: keys[' '],
        arrowup: keys['arrowup'],
        arrowdown: keys['arrowdown'],
        arrowleft: keys['arrowleft'],
        arrowright: keys['arrowright']
    });
}

// Agent upgrade selection function
function selectUpgradeAgent(upgradeKey) {
    // Check if upgrade menu is open
    const menu = document.getElementById('upgradeMenu');
    if (menu && !menu.classList.contains('hidden')) {
        // Apply the upgrade directly
        applyUpgrade(upgradeKey);
        menu.classList.add('hidden');
        gameState.paused = false;
    }
}

// Agent crew management functions
function assignCrewToStationAgent(station) {
    // Find an unassigned crew member (in pool)
    const unassignedCrew = crewMembers.find(c => !c.station);
    
    if (unassignedCrew) {
        // Assign unassigned crew to the station
        assignCrewToStation(unassignedCrew.id, station, 'player');
        return;
    }
    
    // If no unassigned crew, find the station with most crew and move one
    const stationCounts = {
        shields: crewAllocation.shields.length,
        engineering: crewAllocation.engineering.length,
        weapons: crewAllocation.weapons.length,
        navigation: crewAllocation.navigation.length
    };
    
    // Find station with most crew (excluding target station)
    let maxStation = null;
    let maxCount = 0;
    for (const [stat, count] of Object.entries(stationCounts)) {
        if (stat !== station && count > maxCount) {
            maxCount = count;
            maxStation = stat;
        }
    }
    
    // Move one crew from max station to target station
    if (maxStation && crewAllocation[maxStation].length > 0) {
        const crewToMove = crewAllocation[maxStation][0];
        assignCrewToStation(crewToMove.id, station, 'player');
    }
}

function unassignCrewAgent() {
    // Find the station with most crew and unassign one
    const stationCounts = {
        shields: crewAllocation.shields.length,
        engineering: crewAllocation.engineering.length,
        weapons: crewAllocation.weapons.length,
        navigation: crewAllocation.navigation.length
    };
    
    // Find station with most crew
    let maxStation = null;
    let maxCount = 0;
    for (const [stat, count] of Object.entries(stationCounts)) {
        if (count > maxCount) {
            maxCount = count;
            maxStation = stat;
        }
    }
    
    // Unassign one crew from that station
    if (maxStation && crewAllocation[maxStation].length > 0) {
        const crewToUnassign = crewAllocation[maxStation][0];
        assignCrewToStation(crewToUnassign.id, null, 'player');
    }
}

// Training state
let lastObservation = null;
let lastAction = null;
let lastValue = null;
let lastLogProb = null;
let episodeStartScore = 0;
let episodeStartTime = 0;
let trainingUpdateCounter = 0;
const TRAINING_UPDATE_FREQUENCY = 3;  // Update every 3 episodes (more frequent training for faster learning)

// Reward tracking for asteroid mining chain
let asteroidsDestroyedThisStep = 0;
let powerupsCollectedThisStep = 0;
let upgradesSelectedThisStep = 0;
let prevAsteroidsDestroyed = 0;
let prevPowerupsCollected = 0;
let prevUpgradesSelected = 0;

// Tractor beam tracking
let tractorBeamActivatedThisStep = false;
let prevTractorBeamActive = false;
let targetsDestroyedWhileTractored = 0;
let prevTargetsDestroyedWhileTractored = 0;

// Reward function
function calculateReward(prevScore, prevHealth, prevShields, prevCargoHealth) {
    let reward = 0;
    
    // Primary signal: direct score gain
    const scoreDiff = gameState.score - prevScore;
    reward += scoreDiff;
    
    // Survival bonus (staying alive per frame)
    reward += 0.05;
    
    // Penalize taking hull or shield damage
    const healthDiff = (player.health - prevHealth) / player.maxHealth;
    reward += healthDiff * 25;  // Negative when damage taken
    
    const shieldDiff = (player.shields - prevShields) / player.maxShields;
    reward += shieldDiff * 10;
    
    // Death penalty
    if (player.health <= 0) {
        reward -= 300;
    }
    
    // Cargo ship protection rewards (mission mode only)
    if (gameState.gameMode === 'mission' && cargoVessel) {
        const currentCargoHealth = cargoVessel.health || cargoVessel.maxHealth;
        
        // Penalty for cargo ship taking damage
        const cargoHealthDiff = (currentCargoHealth - prevCargoHealth) / cargoVessel.maxHealth;
        reward += cargoHealthDiff * 30;  // Strong penalty for damage, reward for healing
        
        // Large penalty if cargo ship is destroyed
        if (currentCargoHealth <= 0) {
            reward -= 300;  // Very large penalty for cargo destruction
        }
        
        // Proximity reward: small bonus for staying near cargo ship (within 300 pixels)
        const distToCargo = Math.hypot(cargoVessel.x - player.x, cargoVessel.y - player.y);
        if (distToCargo < 300) {
            const proximityBonus = (1 - distToCargo / 300) * 0.5;  // Max 0.5 reward when very close
            reward += proximityBonus;
        }
        
        // Bonus for killing enemies near cargo ship
        const enemiesKilled = gameState.enemiesKilled - (prevEnemiesKilled || 0);
        if (enemiesKilled > 0 && distToCargo < 400) {
            reward += enemiesKilled * 5;
        }
    }
    
    return reward;
}

// Autopilot step - get action from agent and apply it
let autopilotInferencePending = false;
let prevScore = 0;
let prevHealth = 100;
let prevShields = 50;
let prevCargoHealth = 100;
let prevEnemiesKilled = 0;

async function autopilotStep() {
    if (!rlAgent) {
        // No agent loaded yet - autopilot disabled
        console.warn('Autopilot: rlAgent is null, disabling autopilot');
        autopilotEnabled = false;
        updateAutopilotUI();
        return;
    }
    
    // Prevent multiple simultaneous inferences
    if (autopilotInferencePending) {
        return;
    }
    
    // Allow autopilot to work even when paused (for upgrade selection)
    // But skip if not running at all
    if (!gameState.running) {
        return;
    }
    
    autopilotInferencePending = true;
    
    try {
        // Get current observation
        const observation = getGameObservation();
        
        // Get action from agent
        let result;
        if (rlAgent instanceof PPOAgent) {
            // Small exploration chance keeps training progressing while mostly deterministic for a smooth autopilot
            const exploreChance = 0.05;
            const deterministic = !(Math.random() < exploreChance);
            result = await rlAgent.getAction(observation, deterministic);
            console.log('Autopilot action:', result.action, 'Observation (first 5):', observation.slice(0, 5), 'deterministic:', deterministic);
            applyAgentAction(result.action);
        } else if (rlAgent.getAction && typeof rlAgent.getAction === 'function') {
            result = await rlAgent.getAction(observation, true);
            console.log('Autopilot action (non-PPO):', result.action, 'Observation (first 5):', observation.slice(0, 5));
            applyAgentAction(result.action);
        } else {
            console.warn('Autopilot: rlAgent does not have getAction method or is not PPOAgent');
            autopilotInferencePending = false;
            return;
        }
        
        // Store for training (always train when autopilot is on, but not when paused for upgrades)
        // The model learns from the heuristic actions (behavioral cloning in real-time)
        if (autopilotEnabled && lastObservation !== null && !gameState.paused) {
            // Get current cargo health for reward calculation
            const currentCargoHealth = (gameState.gameMode === 'mission' && cargoVessel) 
                ? (cargoVessel.health || cargoVessel.maxHealth) 
                : 100;
            const reward = calculateReward(prevScore, prevHealth, prevShields, prevCargoHealth);
            const done = player.health <= 0;
            
            // Store experience for training (only if agent supports it)
            // Note: We're using heuristic actions, so the model learns from expert demonstrations
            // This is behavioral cloning in real-time - the model learns that heuristic actions are good
            if (rlAgent instanceof PPOAgent && typeof rlAgent.storeExperience === 'function') {
                rlAgent.storeExperience(
                    lastObservation,
                    lastAction,
                    reward,
                    lastValue,
                    lastLogProb,
                    done
                );
            }
        }
        
        // Update previous state (only if not paused, or if it's an upgrade action)
        const isUpgradeAction = result.action >= ACTIONS.SELECT_UPGRADE_HEALTH && 
                                result.action <= ACTIONS.SELECT_UPGRADE_CARGO_ALLY;
        
        if (!gameState.paused || isUpgradeAction) {
            lastObservation = observation;
            lastAction = result.action;
            lastValue = result.value;
            lastLogProb = result.logProb;
            prevScore = gameState.score;
            prevHealth = player.health;
            prevShields = player.shields;
            
            // Update cargo health tracking
            if (gameState.gameMode === 'mission' && cargoVessel) {
                prevCargoHealth = cargoVessel.health || cargoVessel.maxHealth;
            } else {
                prevCargoHealth = 100;
            }
            
            // Update previous reward tracking counters
            prevAsteroidsDestroyed = asteroidsDestroyedThisStep;
            prevPowerupsCollected = powerupsCollectedThisStep;
            prevUpgradesSelected = upgradesSelectedThisStep;
            prevEnemiesKilled = gameState.enemiesKilled;
            prevTractorBeamActive = tractorBeam.active;
            prevTargetsDestroyedWhileTractored = targetsDestroyedWhileTractored;
        }
        
    } catch (error) {
        console.error('Error in autopilot step:', error);
    } finally {
        autopilotInferencePending = false;
    }
}

// Toggle autopilot
async function toggleAutopilot() {
    // Allow toggling even if paused (but not if game hasn't started)
    if (!gameState.running) {
        console.log('Cannot toggle autopilot: game not running');
        return;
    }
    
    console.log('Toggling autopilot, current state:', autopilotEnabled);
    
    autopilotEnabled = !autopilotEnabled;
    
    if (autopilotEnabled) {
        // Try to load agent if not loaded (should already be loaded from init)
        if (!rlAgent) {
            console.log('Loading RL agent...');
            await loadRLAgent();
            // Load training stats if model was loaded
            await loadTrainingStats();
        }
        
        // Only start new episode if this is the first time enabling autopilot in this game session
        // (i.e., if we don't have a previous observation, meaning we haven't started tracking yet)
        if (rlAgent instanceof PPOAgent && lastObservation === null) {
            startNewEpisode();
        }
        
        // Disable player input
        console.log('Autopilot: ON (Training enabled)');
    } else {
        // Re-enable player input
        console.log('Autopilot: OFF');
    }
    
    updateAutopilotUI();
    updateTrainingUI();
}

// PPO Agent using TensorFlow.js
class PPOAgent {
    constructor(obsDim, actionDim, lr = 3e-4, gamma = 0.99, epsClip = 0.2) {
        this.obsDim = obsDim;
        this.actionDim = actionDim;
        this.initialLr = lr;
        this.currentLr = lr;
        this.lrDecay = 0.9995;  // Exponential decay factor
        this.minLr = 1e-5;  // Minimum learning rate
        this.gamma = gamma;
        this.epsClip = epsClip;
        
        // Create policy network
        this.policyNet = this.createPolicyNetwork();
        this.optimizer = tf.train.adam(this.currentLr);
        
        // Experience buffer
        this.buffer = {
            observations: [],
            actions: [],
            rewards: [],
            values: [],
            logProbs: [],
            dones: []
        };
        
        this.maxBufferSize = 4096;  // Larger buffer for better sample diversity
    }
    
    createPolicyNetwork() {
        // Create shared layers
        const input = tf.input({shape: [this.obsDim]});
        
        let x = tf.layers.dense({
            units: 256,  // Larger network for better learning
            activation: 'relu',
            kernelInitializer: 'glorotUniform'
        }).apply(input);
        x = tf.layers.layerNormalization().apply(x);
        
        x = tf.layers.dense({
            units: 256,  // Larger network for better learning
            activation: 'relu',
            kernelInitializer: 'glorotUniform'
        }).apply(x);
        x = tf.layers.layerNormalization().apply(x);
        
        // Policy head (action logits)
        const policyOut = tf.layers.dense({
            units: this.actionDim,
            activation: 'linear',
            kernelInitializer: 'glorotUniform',
            name: 'policy_head'
        }).apply(x);
        
        // Value head
        const valueOut = tf.layers.dense({
            units: 1,
            activation: 'linear',
            kernelInitializer: 'glorotUniform',
            name: 'value_head'
        }).apply(x);
        
        return tf.model({inputs: input, outputs: [policyOut, valueOut]});
    }
    
    // Heuristic policy: maps observations to reasonable actions
    // This gives the agent a base understanding before RL training
    getHeuristicAction(obs) {
        // Observation indices (from getGameObservation):
        // 0-5: Player state (x, y, rotation, health, shields, rotationSpeed)
        // 6-20: Nearest enemies (5 enemies * 3 values: dist, angle, health)
        // 21-30: Nearest asteroids (5 asteroids * 2 values: dist, angle)
        // 31-35: Weapon states (primary cooldown, missile cooldown/ammo, laser cooldown/ammo)
        // 36-37: Tractor beam (charge, active)
        // 38-39: Score and level
        // 40-49: Enemy bullets (5 bullets * 2 values: dist, angle)
        // 50-53: Cargo vessel (dist, angle, health, direction) - only in mission mode
        // 54-57: Crew allocation (4 stations)
        // 58: Upgrade menu open
        // 59-62: Nearest powerups (2 powerups * 2 values: dist, angle)
        
        const playerHealth = obs[3];
        const playerShields = obs[4];
        const playerXNorm = obs[0]; // [-1, 1]
        const playerYNorm = obs[1]; // [-1, 1]
        
        // Extract nearest enemy info
        const nearestEnemyDist = obs[6];  // Normalized distance (0-1, where 1 = far)
        const nearestEnemyAngle = obs[7] * (2 * Math.PI);
        const nearestEnemyHealth = obs[8];
        const hasEnemy = nearestEnemyDist < 0.99;  // Enemy exists (not placeholder)
        
        // Extract nearest enemy bullet
        const nearestBulletDist = obs[40];
        const nearestBulletAngle = obs[41] * (2 * Math.PI);
        
        // Extract nearest asteroid
        const nearestAsteroidDist = obs[21];
        const nearestAsteroidAngle = obs[22] * (2 * Math.PI);
        const hasAsteroid = nearestAsteroidDist < 0.99;  // Asteroid exists (not placeholder)
        
        // Extract nearest powerup (upgrade token)
        const nearestPowerupDist = obs[59];
        const nearestPowerupAngle = obs[60] * (2 * Math.PI);
        const hasPowerup = nearestPowerupDist < 0.99;  // Powerup exists (not placeholder)
        
        // Weapon states
        const primaryReady = obs[31] < 0.1;  // Cooldown normalized, < 0.1 = ready
        const missileReady = obs[32] < 0.1 && obs[33] > 0;  // Cooldown ready and has ammo
        const laserReady = obs[34] < 0.1 && obs[35] > 0;  // Cooldown ready and has ammo
        
        // Tractor beam state
        const tractorCharge = obs[36];  // Normalized charge [0, 1]
        const tractorActive = obs[37] > 0.5;  // Active or not
        const tractorReady = tractorCharge > 0.3 && !tractorActive;  // Has charge and not active
        
        // Cargo vessel info (if in mission mode)
        const cargoDist = obs[50];
        const cargoAngle = obs[51] * (2 * Math.PI);
        const cargoHealth = obs[52];
        const hasCargo = cargoDist < 0.99;  // Not the "no cargo" placeholder value
        
        // Crew allocation (even spread across all systems)
        const shieldsCrew = obs[54];
        const engineeringCrew = obs[55];
        const weaponsCrew = obs[56];
        const navigationCrew = obs[57];
        const totalCrew = shieldsCrew + engineeringCrew + weaponsCrew + navigationCrew;
        const targetCrewPerStation = totalCrew / 4;  // Even distribution

        // Upgrade menu state
        const upgradeMenuOpen = obs[58] > 0.5;
        
        // Action priorities based on simple base rules
        const actionScores = new Array(this.actionDim).fill(0);
        
        const hasImmediateThreat = nearestBulletDist < 0.3 || (hasAsteroid && nearestAsteroidDist < 0.15);
        const hasTarget = (hasEnemy && nearestEnemyDist < 0.6) || (hasAsteroid && nearestAsteroidDist < 0.5) || (hasPowerup && nearestPowerupDist < 0.5);
        
        // Light patrol drift only when absolutely nothing is happening
        if (!hasImmediateThreat && !hasTarget) {
            actionScores[ACTIONS.MOVE_UP] += 0.2;
        }
        
        // Boundary avoidance: steer back toward center when near edges
        if (playerXNorm < -0.75) {
            actionScores[ACTIONS.MOVE_RIGHT] += 4;
        } else if (playerXNorm > 0.75) {
            actionScores[ACTIONS.MOVE_LEFT] += 4;
        }
        if (playerYNorm < -0.75) {
            actionScores[ACTIONS.MOVE_DOWN] += 4;
        } else if (playerYNorm > 0.75) {
            actionScores[ACTIONS.MOVE_UP] += 4;
        }
        
        // RULE 1: Avoid enemy bullets (CRITICAL - highest priority)
        if (nearestBulletDist < 0.3) {
            const urgency = 1.0 - (nearestBulletDist / 0.3);
            // Move perpendicular to bullet
            if (Math.abs(nearestBulletAngle) < 0.3) {
                actionScores[ACTIONS.MOVE_LEFT] += 8 * urgency;
                actionScores[ACTIONS.MOVE_RIGHT] += 8 * urgency;
            }
            if (nearestBulletAngle > 0.2 && nearestBulletAngle < 0.8) {
                actionScores[ACTIONS.MOVE_DOWN] += 8 * urgency;
            }
            if (nearestBulletAngle < -0.2 && nearestBulletAngle > -0.8) {
                actionScores[ACTIONS.MOVE_UP] += 8 * urgency;
            }
        }
        
        // RULE 2: Avoid asteroid collisions (CRITICAL)
        if (hasAsteroid && nearestAsteroidDist < 0.15) {
            // Too close - move away
            if (nearestAsteroidAngle > 0) {
                actionScores[ACTIONS.MOVE_LEFT] += 10;
            } else {
                actionScores[ACTIONS.MOVE_RIGHT] += 10;
            }
            if (Math.abs(nearestAsteroidAngle) < 0.6) {
                actionScores[ACTIONS.MOVE_UP] += 8;
            }
        }
        
        // RULE 3: Navigate and orientate toward enemies, then fire/tractor
        if (hasEnemy && nearestEnemyDist < 0.6) {
            const enemyAngleAbs = Math.abs(nearestEnemyAngle);
            
            // Rotate toward enemy (very high priority)
            if (enemyAngleAbs > 0.05) {
                const rotateScore = enemyAngleAbs > 0.3 ? 8 : 5;
                if (nearestEnemyAngle > 0) {
                    actionScores[ACTIONS.ROTATE_RIGHT] += rotateScore;
                } else {
                    actionScores[ACTIONS.ROTATE_LEFT] += rotateScore;
                }
            }
            
            // Move toward enemy only if too far away or drifting
            if (nearestEnemyDist > 0.35) {
                if (nearestEnemyAngle > 0.15) {
                    actionScores[ACTIONS.MOVE_RIGHT] += 1.5;
                } else if (nearestEnemyAngle < -0.15) {
                    actionScores[ACTIONS.MOVE_LEFT] += 1.5;
                }
                // Nudge forward/back based on vertical angle
                if (nearestEnemyAngle > 0.35) {
                    actionScores[ACTIONS.MOVE_DOWN] += 1;
                } else if (nearestEnemyAngle < -0.35) {
                    actionScores[ACTIONS.MOVE_UP] += 1;
                }
            }
            
            // Fire only when tightly aligned
            if (enemyAngleAbs < 0.12 && primaryReady) {
                actionScores[ACTIONS.SHOOT_PRIMARY] += 7;
            }
            
            // Tractor when ready and aligned
            if (tractorReady && enemyAngleAbs < 0.15 && nearestEnemyDist > 0.3 && nearestEnemyDist < 0.5) {
                actionScores[ACTIONS.ACTIVATE_TRACTOR] += 4;
            }
        }
        
        // RULE 4: Navigate and orientate toward asteroids, then tractor/fire
        if (hasAsteroid && nearestAsteroidDist > 0.15 && nearestAsteroidDist < 0.5) {
            const asteroidAngleAbs = Math.abs(nearestAsteroidAngle);
            
            // Move toward asteroid to get in range (always do this when asteroid is present and safe)
            if (nearestAsteroidDist > 0.25) {  // Safe distance
                if (nearestAsteroidAngle > 0.1) {
                    actionScores[ACTIONS.MOVE_RIGHT] += 2;  // Move toward asteroid
                } else if (nearestAsteroidAngle < -0.1) {
                    actionScores[ACTIONS.MOVE_LEFT] += 2;
                }
                if (Math.abs(nearestAsteroidAngle) < 0.5) {
                    if (nearestAsteroidAngle > 0.25) {
                        actionScores[ACTIONS.MOVE_DOWN] += 2;
                    } else if (nearestAsteroidAngle < -0.25) {
                        actionScores[ACTIONS.MOVE_UP] += 2;
                    }
                }
            }
            
            // Rotate toward asteroid
            if (asteroidAngleAbs > 0.1) {
                if (nearestAsteroidAngle > 0) {
                    actionScores[ACTIONS.ROTATE_RIGHT] += 2;
                } else {
                    actionScores[ACTIONS.ROTATE_LEFT] += 2;
                }
            }
            
            // Tractor when ready and aligned (preferred for asteroids)
            if (tractorReady && asteroidAngleAbs < 0.2 && nearestAsteroidDist > 0.2 && nearestAsteroidDist < 0.4) {
                actionScores[ACTIONS.ACTIVATE_TRACTOR] += 5;
            }
            
            // Fire when aligned (if tractor not ready)
            if (!tractorActive && asteroidAngleAbs < 0.2 && primaryReady) {
                actionScores[ACTIONS.SHOOT_PRIMARY] += 3;
            }
        }
        
        // RULE 5: Collect powerups
        if (hasPowerup && nearestPowerupDist < 0.5) {
            // Move toward powerup
            if (nearestPowerupAngle > 0.1) {
                actionScores[ACTIONS.MOVE_RIGHT] += 4;
            } else if (nearestPowerupAngle < -0.1) {
                actionScores[ACTIONS.MOVE_LEFT] += 4;
            }
            if (Math.abs(nearestPowerupAngle) < 0.5) {
                if (nearestPowerupAngle > 0.25) {
                    actionScores[ACTIONS.MOVE_DOWN] += 3;
                } else if (nearestPowerupAngle < -0.25) {
                    actionScores[ACTIONS.MOVE_UP] += 3;
                }
            }
        }
        
        // RULE 6: Crew allocation - even spread across all systems
        if (totalCrew > 0) {
            // Assign crew to stations that are below the target (even distribution)
            if (shieldsCrew < targetCrewPerStation - 0.1) {
                actionScores[ACTIONS.ASSIGN_CREW_SHIELDS] += 1;
            }
            if (engineeringCrew < targetCrewPerStation - 0.1) {
                actionScores[ACTIONS.ASSIGN_CREW_ENGINEERING] += 1;
            }
            if (weaponsCrew < targetCrewPerStation - 0.1) {
                actionScores[ACTIONS.ASSIGN_CREW_WEAPONS] += 1;
            }
            if (navigationCrew < targetCrewPerStation - 0.1) {
                actionScores[ACTIONS.ASSIGN_CREW_NAVIGATION] += 1;
            }
        }
        
        // RULE 7: Select upgrade when menu opens
        if (upgradeMenuOpen) {
            // Simple default: always pick health (RL can learn better choices)
            actionScores[ACTIONS.SELECT_UPGRADE_HEALTH] += 5;
            
            // Suppress other actions when upgrade menu is open
            for (let i = 0; i < actionScores.length; i++) {
                if (i < ACTIONS.SELECT_UPGRADE_HEALTH || i > ACTIONS.SELECT_UPGRADE_CARGO_ALLY) {
                    actionScores[i] *= 0.1;
                }
            }
        }
        
        // Add minimal random noise (very small for consistent behavior)
        for (let i = 0; i < actionScores.length; i++) {
            actionScores[i] += (Math.random() - 0.5) * 0.02;  // Very small noise for consistency
        }
        
        // Return action with highest score
        let bestAction = 0;
        let bestScore = actionScores[0];
        for (let i = 1; i < actionScores.length; i++) {
            if (actionScores[i] > bestScore) {
                bestScore = actionScores[i];
                bestAction = i;
            }
        }
        
        // Debug: Log action selection occasionally
        if (Math.random() < 0.05) {  // 5% of the time
            console.log(`Heuristic: bestAction=${bestAction}, bestScore=${bestScore.toFixed(2)}, MOVE_UP=${actionScores[ACTIONS.MOVE_UP].toFixed(2)}, MOVE_RIGHT=${actionScores[ACTIONS.MOVE_RIGHT].toFixed(2)}, ROTATE_LEFT=${actionScores[ACTIONS.ROTATE_LEFT].toFixed(2)}`);
        }
        
        return bestAction;
    }
    
    // Pre-train the network using heuristic policy (behavioral cloning)
    async preTrainWithHeuristic(numSamples = 500) {
        console.log(`Pre-training agent with heuristic policy (${numSamples} samples)...`);
        
        const observations = [];
        const actions = [];
        
        // Generate synthetic observations and corresponding heuristic actions
        for (let i = 0; i < numSamples; i++) {
            // Generate random but realistic observations
            const obs = this.generateSyntheticObservation();
            const action = this.getHeuristicAction(obs);
            
            observations.push(obs);
            actions.push(action);
        }
        
        // Convert to tensors
        const obsTensor = tf.tensor2d(observations);
        const actionTensor = tf.tensor1d(actions, 'int32');
        
        // Create one-hot encoded actions for supervised learning
        const actionOneHot = tf.oneHot(actionTensor, this.actionDim);
        
        // Train policy head using supervised learning
        const optimizer = tf.train.adam(0.001);  // Higher learning rate for pre-training
        
        for (let epoch = 0; epoch < 10; epoch++) {
            let totalLoss = 0;
            
            // Mini-batch training
            const batchSize = 32;
            for (let i = 0; i < numSamples; i += batchSize) {
                const batchObs = obsTensor.slice([i, 0], [Math.min(batchSize, numSamples - i), this.obsDim]);
                const batchActions = actionOneHot.slice([i, 0], [Math.min(batchSize, numSamples - i), this.actionDim]);
                
                const loss = optimizer.minimize(() => {
                    const [predLogits, _] = this.policyNet.apply(batchObs);
                    // Use logits directly - softmaxCrossEntropy expects logits, not probabilities
                    const loss = tf.losses.softmaxCrossEntropy(batchActions, predLogits);
                    return loss;
                }, true);
                
                if (loss) {
                    const lossValue = await loss.data();
                    totalLoss += lossValue[0];  // loss.data() returns an array
                    loss.dispose();
                }
                
                batchObs.dispose();
                batchActions.dispose();
            }
            
            if (epoch % 2 === 0) {
                const batchCount = Math.ceil(numSamples / batchSize);
                const avgLoss = totalLoss / batchCount;
                console.log(`  Pre-training epoch ${epoch + 1}/10, loss: ${avgLoss.toFixed(4)}`);
            }
        }
        
        // Cleanup
        obsTensor.dispose();
        actionTensor.dispose();
        actionOneHot.dispose();
        
        // Test that the network learned something
        const testObs = this.generateSyntheticObservation();
        const testObsTensor = tf.tensor2d([testObs]);
        const [testLogits, _] = this.policyNet.predict(testObsTensor);
        const testLogitsData = await testLogits.data();
        const heuristicAction = this.getHeuristicAction(testObs);
        const networkAction = argmax(Array.from(testLogitsData));
        
        console.log(`  Test: Heuristic action=${heuristicAction}, Network action=${networkAction}, Match=${heuristicAction === networkAction}`);
        
        testObsTensor.dispose();
        testLogits.dispose();
        
        console.log('Pre-training complete! Agent now has base understanding of game mechanics.');
    }
    
    // Generate synthetic but realistic observations for pre-training
    generateSyntheticObservation() {
        const obs = new Array(this.obsDim).fill(0);
        
        // Player state (0-5)
        obs[0] = (Math.random() - 0.5) * 0.8;  // x position
        obs[1] = (Math.random() - 0.5) * 0.8;  // y position
        obs[2] = Math.random();  // rotation
        obs[3] = Math.random();  // health
        obs[4] = Math.random();  // shields
        obs[5] = 0.1 + Math.random() * 0.1;  // rotation speed
        
        // Enemies (6-20): Sometimes have enemies, sometimes not
        for (let i = 0; i < 5; i++) {
            if (Math.random() < 0.7) {  // 70% chance of enemy
                obs[6 + i * 3] = Math.random() * 0.8;  // distance
                obs[7 + i * 3] = (Math.random() - 0.5) * 2;  // angle
                obs[8 + i * 3] = Math.random();  // health
            } else {
                obs[6 + i * 3] = 1.0;  // far away
                obs[7 + i * 3] = 0.0;
                obs[8 + i * 3] = 0.0;
            }
        }
        
        // Asteroids (21-30)
        for (let i = 0; i < 5; i++) {
            if (Math.random() < 0.5) {
                obs[21 + i * 2] = Math.random() * 0.7;
                obs[22 + i * 2] = (Math.random() - 0.5) * 2;
            } else {
                obs[21 + i * 2] = 1.0;
                obs[22 + i * 2] = 0.0;
            }
        }
        
        // Weapons (31-35)
        obs[31] = Math.random();  // primary cooldown
        obs[32] = Math.random();  // missile cooldown
        obs[33] = Math.random();  // missile ammo
        obs[34] = Math.random();  // laser cooldown
        obs[35] = Math.random();  // laser ammo
        
        // Tractor beam (36-37)
        obs[36] = Math.random();  // charge
        obs[37] = Math.random() < 0.1 ? 1.0 : 0.0;  // active
        
        // Score and level (38-39)
        obs[38] = Math.random() * 0.5;
        obs[39] = Math.random() * 0.3;
        
        // Enemy bullets (40-49)
        for (let i = 0; i < 5; i++) {
            if (Math.random() < 0.3) {  // 30% chance of bullet
                obs[40 + i * 2] = Math.random() * 0.5;
                obs[41 + i * 2] = (Math.random() - 0.5) * 2;
            } else {
                obs[40 + i * 2] = 1.0;
                obs[41 + i * 2] = 0.0;
            }
        }
        
        // Cargo vessel (50-53): Sometimes in mission mode
        if (Math.random() < 0.5) {  // 50% chance of cargo
            obs[50] = Math.random() * 0.6;
            obs[51] = (Math.random() - 0.5) * 2;
            obs[52] = 0.5 + Math.random() * 0.5;  // health usually good
            obs[53] = Math.random() < 0.5 ? -1 : 1;
        } else {
            obs[50] = 1.0;
            obs[51] = 0.0;
            obs[52] = 0.0;
            obs[53] = 0.0;
        }
        
        // Crew allocation (54-57)
        obs[54] = Math.random();
        obs[55] = Math.random();
        obs[56] = Math.random();
        obs[57] = Math.random();
        
        // Upgrade menu (58)
        obs[58] = Math.random() < 0.1 ? 1.0 : 0.0;  // 10% chance open
        
        return obs;
    }
    
    async getAction(obs, deterministic = false) {
        const obsTensor = tf.tensor2d([obs]);
        
        const [actionLogits, value] = this.policyNet.predict(obsTensor);
        const logits = await actionLogits.data();
        const val = await value.data();
        
        obsTensor.dispose();
        actionLogits.dispose();
        value.dispose();
        
        let action;
        let logProb;
        
        if (deterministic) {
            // Greedy action
            action = argmax(logits);
            logProb = Math.log(softmaxSingle(logits, action));
        } else {
            // Sample from policy
            const probs = softmax(Array.from(logits));
            action = sampleFromDistribution(probs);
            logProb = Math.log(probs[action]);
        }
        
        return {
            action: action,
            logProb: logProb,
            value: val[0]
        };
    }
    
    storeExperience(obs, action, reward, value, logProb, done) {
        this.buffer.observations.push(obs);
        this.buffer.actions.push(action);
        this.buffer.rewards.push(reward);
        this.buffer.values.push(value);
        this.buffer.logProbs.push(logProb);
        this.buffer.dones.push(done);
        
        // Limit buffer size
        if (this.buffer.observations.length > this.maxBufferSize) {
            this.buffer.observations.shift();
            this.buffer.actions.shift();
            this.buffer.rewards.shift();
            this.buffer.values.shift();
            this.buffer.logProbs.shift();
            this.buffer.dones.shift();
        }
    }
    
    async loadModel(savedData) {
        try {
            // Reconstruct weights from saved data
            const weights = savedData.weights.map(w => {
                return tf.tensor(w.data, w.shape, w.dtype);
            });
            
            // Verify weight count matches
            const modelWeights = this.policyNet.getWeights();
            if (weights.length !== modelWeights.length) {
                console.error(`Weight count mismatch: loaded ${weights.length}, model expects ${modelWeights.length}`);
                modelWeights.forEach(w => w.dispose());
                weights.forEach(w => w.dispose());
                return;
            }
            
            // Set weights on the model
            this.policyNet.setWeights(weights);
            
            // Dispose temporary tensors
            weights.forEach(w => w.dispose());
            modelWeights.forEach(w => w.dispose());
            
            const source = savedData.pretrained ? 'pre-trained model' : 'saved model';
            console.log(`✅ Model weights loaded successfully from ${source} (${weights.length} layers)`);
            
            // Test the loaded model with a sample observation to verify it's working
            if (savedData.pretrained) {
                const testObs = new Array(this.obsDim).fill(0);
                testObs[3] = 0.8; // health
                testObs[4] = 0.7; // shields
                testObs[6] = 0.3; // enemy nearby
                testObs[31] = 0.0; // primary ready
                const testResult = await this.getAction(testObs, true);
                const heuristicAction = this.getHeuristicAction(testObs);
                const match = testResult.action === heuristicAction ? '✓' : '✗';
                console.log(`   Model test: Action=${testResult.action}, Heuristic=${heuristicAction} ${match}`);
            }
        } catch (error) {
            console.error('Failed to load model weights:', error);
            throw error;
        }
    }
    
    async update(epochs = 10) {  // More epochs for better learning
        if (this.buffer.observations.length < 32) {
            return { policyLoss: 0, valueLoss: 0, entropy: 0 };
        }
        
        // Compute returns and advantages
        const returns = this.computeReturns();
        const advantages = this.computeAdvantages(returns);
        
        // Normalize advantages
        const advMean = advantages.reduce((a, b) => a + b, 0) / advantages.length;
        const advStd = Math.sqrt(advantages.reduce((sum, a) => sum + Math.pow(a - advMean, 2), 0) / advantages.length);
        const normalizedAdvantages = advantages.map(a => (a - advMean) / (advStd + 1e-8));
        
        // Convert to tensors
        const obsTensor = tf.tensor2d(this.buffer.observations);
        const actionTensor = tf.tensor1d(this.buffer.actions, 'int32');
        const returnTensor = tf.tensor1d(returns);
        const advantageTensor = tf.tensor1d(clippedAdvantages);  // Use clipped advantages
        const oldLogProbTensor = tf.tensor1d(this.buffer.logProbs);
        const oldValueTensor = tf.tensor1d(this.buffer.values);  // Store old values for clipping
        
        let totalPolicyLoss = 0;
        let totalValueLoss = 0;
        let totalEntropy = 0;
        
        // Training epochs
        for (let epoch = 0; epoch < epochs; epoch++) {
            const [actionLogits, values] = this.policyNet.predict(obsTensor);
            
            // Compute new log probabilities
            const logProbs = tf.log(tf.softmax(actionLogits));
            const actionLogProbs = tf.sum(tf.mul(logProbs, tf.oneHot(actionTensor, this.actionDim)), 1);
            
            // Compute entropy
            const probs = tf.softmax(actionLogits);
            const entropy = tf.neg(tf.sum(tf.mul(logProbs, probs), 1));
            const avgEntropy = await entropy.mean().data();
            totalEntropy += avgEntropy[0];
            
            // Compute policy loss (PPO clipped objective)
            const ratio = tf.exp(tf.sub(actionLogProbs, oldLogProbTensor));
            const surr1 = tf.mul(ratio, advantageTensor);
            const surr2 = tf.mul(tf.clipByValue(ratio, 1 - this.epsClip, 1 + this.epsClip), advantageTensor);
            const policyLoss = tf.neg(tf.minimum(surr1, surr2));
            const avgPolicyLoss = await policyLoss.mean().data();
            totalPolicyLoss += avgPolicyLoss[0];
            
            // Compute value loss
            const valueLoss = tf.losses.meanSquaredError(returnTensor, tf.squeeze(values));
            const avgValueLoss = await valueLoss.data();
            totalValueLoss += avgValueLoss[0];
            
            // Total loss
            const totalLoss = tf.add(policyLoss, tf.mul(valueLoss, 0.5));
            
            // Update
            const loss = await totalLoss.mean().data();
            this.optimizer.minimize(() => totalLoss.mean());
            
            // Cleanup
            actionLogits.dispose();
            values.dispose();
            logProbs.dispose();
            actionLogProbs.dispose();
            entropy.dispose();
            ratio.dispose();
            surr1.dispose();
            surr2.dispose();
            policyLoss.dispose();
            valueLoss.dispose();
            totalLoss.dispose();
            if (epoch === epochs - 1) {
                // Cleanup value clipping tensors on last epoch
                valueLoss1.dispose();
                valuePredClipped.dispose();
                valueLoss2.dispose();
            }
        }
        
        // Update learning rate (exponential decay)
        this.currentLr = Math.max(this.minLr, this.currentLr * this.lrDecay);
        this.optimizer = tf.train.adam(this.currentLr);
        
        // Cleanup
        obsTensor.dispose();
        actionTensor.dispose();
        returnTensor.dispose();
        advantageTensor.dispose();
        oldLogProbTensor.dispose();
        oldValueTensor.dispose();
        
        // Clear buffer
        this.buffer = {
            observations: [],
            actions: [],
            rewards: [],
            values: [],
            logProbs: [],
            dones: []
        };
        
        return {
            policyLoss: totalPolicyLoss / epochs,
            valueLoss: totalValueLoss / epochs,
            entropy: totalEntropy / epochs
        };
    }
    
    computeReturns() {
        const returns = [];
        let nextValue = 0;
        
        for (let i = this.buffer.rewards.length - 1; i >= 0; i--) {
            if (this.buffer.dones[i]) {
                nextValue = 0;
            }
            nextValue = this.buffer.rewards[i] + this.gamma * nextValue;
            returns.unshift(nextValue);
        }
        
        return returns;
    }
    
    computeAdvantages(returns) {
        const advantages = [];
        for (let i = 0; i < returns.length; i++) {
            advantages.push(returns[i] - this.buffer.values[i]);
        }
        return advantages;
    }
}

// Helper functions
function argmax(arr) {
    let maxIdx = 0;
    let maxVal = arr[0];
    for (let i = 1; i < arr.length; i++) {
        if (arr[i] > maxVal) {
            maxVal = arr[i];
            maxIdx = i;
        }
    }
    return maxIdx;
}

function softmaxSingle(logits, idx) {
    const max = Math.max(...logits);
    const exp = logits.map(x => Math.exp(x - max));
    const sum = exp.reduce((a, b) => a + b, 0);
    return exp[idx] / sum;
}

// Load pre-trained model from JSON file (deployed with game)
async function loadPretrainedModel() {
    try {
        const response = await fetch('pretrained_model.json');
        if (!response.ok) {
            console.warn('Pre-trained model file not found');
            return null;
        }
        const data = await response.json();
        console.log('✅ Pre-trained model loaded from file');
        return data;
    } catch (error) {
        console.warn('Could not load pre-trained model:', error);
        return null;
    }
}

// Load RL agent (TensorFlow.js PPO)
async function loadRLAgent() {
    try {
        // Check if TensorFlow.js is available
        if (typeof tf === 'undefined') {
            console.warn('TensorFlow.js not loaded, using placeholder agent');
            loadPlaceholderAgent();
            return;
        }
        
        // 1. First, try to load pre-trained model (deployed with game)
        console.log('Attempting to load pre-trained model...');
        const pretrainedModel = await loadPretrainedModel();
        if (pretrainedModel) {
            console.log(`Pre-trained model found! Weights: ${pretrainedModel.weights.length} layers`);
            rlAgent = new PPOAgent(OBS_DIM, NUM_ACTIONS);
            await rlAgent.loadModel(pretrainedModel);
            console.log('✅ Agent starting with pre-trained base knowledge');
            return;
        } else {
            console.warn('⚠️ Pre-trained model not found - will try IndexedDB or create new model');
        }
        
        // 2. If pre-trained not found, try saved model from IndexedDB (user's learned model)
        const savedModel = await loadModelFromStorage();
        if (savedModel) {
            rlAgent = new PPOAgent(OBS_DIM, NUM_ACTIONS);
            await rlAgent.loadModel(savedModel);
            console.log(`PPO Agent loaded from saved model (episode ${savedModel.episode || 0})`);
            return;
        }
        
        // 3. Fallback: Create new agent (no pre-training - we expect pretrained_model.json to be available)
        rlAgent = new PPOAgent(OBS_DIM, NUM_ACTIONS);
        console.warn('⚠️ No pre-trained or saved model found - agent will start with random weights');
        console.warn('⚠️ This should not happen if pretrained_model.json is deployed with the game');
        // Removed in-browser pre-training since we expect pretrained_model.json to always be available
        // If the file is missing, the agent will start with random weights (poor performance)
    } catch (error) {
        console.error('Failed to initialize PPO agent:', error);
        console.log('Falling back to placeholder agent');
        loadPlaceholderAgent();
    }
}

// Save model to IndexedDB
async function exportModelWeights(extraMetadata = {}) {
    if (!rlAgent || !(rlAgent instanceof PPOAgent)) {
        throw new Error('RL agent not initialized');
    }
    
    const weights = await rlAgent.policyNet.getWeights();
    const weightsData = await Promise.all(weights.map(async (w) => {
        const data = await w.data();
        const payload = {
            shape: w.shape,
            dtype: w.dtype,
            data: Array.from(data)
        };
        w.dispose();
        return payload;
    }));
    
    return {
        weights: weightsData,
        episode: trainingStats.episode,
        bestScore: trainingStats.bestScore,
        exportedAt: Date.now(),
        ...extraMetadata
    };
}

async function saveModelToStorage() {
    if (!rlAgent || !(rlAgent instanceof PPOAgent)) return;
    
    try {
        const payload = await exportModelWeights();
        
        // Save to IndexedDB
        const db = await openDB();
        const tx = db.transaction(['models'], 'readwrite');
        const store = tx.objectStore('models');
        
        await store.put({
            id: 'asteroid_droid_agent',
            ...payload
        });
        
        await tx.complete;
        console.log('Model saved to IndexedDB');
    } catch (error) {
        console.error('Failed to save model:', error);
    }
}

// Load model from IndexedDB
async function loadModelFromStorage() {
    try {
        const db = await openDB();
        const tx = db.transaction(['models'], 'readonly');
        const store = tx.objectStore('models');
        const saved = await store.get('asteroid_droid_agent');
        
        if (saved && saved.weights) {
            console.log(`Loading saved model (episode ${saved.episode || 0}, best score: ${saved.bestScore || 0})`);
            return saved;
        }
        return null;
    } catch (error) {
        console.error('Failed to load model:', error);
        return null;
    }
}

// Open IndexedDB database
function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('AsteroidDroidRL', 1);
        
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
        
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains('models')) {
                db.createObjectStore('models', { keyPath: 'id' });
            }
        };
    });
}

// Load training stats from saved model
async function loadTrainingStats() {
    try {
        const saved = await loadModelFromStorage();
        if (saved) {
            trainingStats.episode = saved.episode || 0;
            trainingStats.bestScore = saved.bestScore || 0;
            updateTrainingUI();
        }
    } catch (error) {
        console.error('Failed to load training stats:', error);
    }
}

// Handle episode end for RL training
async function handleEpisodeEnd() {
    // Store final experience
    if (lastObservation !== null) {
        // Get current cargo health for reward calculation
        const currentCargoHealth = (gameState.gameMode === 'mission' && cargoVessel) 
            ? (cargoVessel.health || cargoVessel.maxHealth) 
            : 100;
        const reward = calculateReward(prevScore, prevHealth, prevShields, prevCargoHealth);
        rlAgent.storeExperience(
            lastObservation,
            lastAction,
            reward,
            lastValue,
            lastLogProb,
            true  // Episode done
        );
    }
    
    // Update training stats
    trainingStats.episode++;
    trainingStats.episodeReward = gameState.score - episodeStartScore;
    trainingStats.episodeLength = Date.now() - episodeStartTime;
    trainingStats.totalReward += trainingStats.episodeReward;
    
    if (gameState.score > trainingStats.bestScore) {
        trainingStats.bestScore = gameState.score;
    }
    
    trainingStats.episodes.push(trainingStats.episode);
    trainingStats.rewards.push(trainingStats.episodeReward);
    trainingStats.scores.push(gameState.score);
    
    // Keep only last 100 episodes for display
    if (trainingStats.episodes.length > 100) {
        trainingStats.episodes.shift();
        trainingStats.rewards.shift();
        trainingStats.scores.shift();
    }
    
    // Update training UI
    updateTrainingUI();
    
    // Periodic training update
    trainingUpdateCounter++;
    if (trainingUpdateCounter >= TRAINING_UPDATE_FREQUENCY) {
        await performTrainingUpdate();
        trainingUpdateCounter = 0;
    }
    
    // Auto-restart if autopilot is on (continuous training)
    if (autopilotEnabled) {
        setTimeout(() => {
            restartGame();
            startNewEpisode();
        }, 1000);
    }
}

// Start new episode
function startNewEpisode() {
    episodeStartScore = gameState.score;
    episodeStartTime = Date.now();
    lastObservation = null;
    prevScore = gameState.score;
    prevHealth = player.health;
    prevShields = player.shields;
    
    // Initialize cargo health tracking
    if (gameState.gameMode === 'mission' && cargoVessel) {
        prevCargoHealth = cargoVessel.health || cargoVessel.maxHealth;
    } else {
        prevCargoHealth = 100;
    }
    
    // Reset reward tracking counters
    asteroidsDestroyedThisStep = 0;
    powerupsCollectedThisStep = 0;
    upgradesSelectedThisStep = 0;
    prevAsteroidsDestroyed = 0;
    prevPowerupsCollected = 0;
    prevUpgradesSelected = 0;
    prevEnemiesKilled = gameState.enemiesKilled;
    tractorBeamActivatedThisStep = false;
    prevTractorBeamActive = false;
    targetsDestroyedWhileTractored = 0;
    prevTargetsDestroyedWhileTractored = 0;
}

// Perform training update
async function performTrainingUpdate() {
    if (!rlAgent || !(rlAgent instanceof PPOAgent)) return;
    
    console.log(`Training update at episode ${trainingStats.episode}...`);
    
    try {
        const losses = await rlAgent.update();
        if (losses) {
            console.log(`Training losses: policy=${(losses.policyLoss || 0).toFixed(4)}, value=${(losses.valueLoss || 0).toFixed(4)}, entropy=${(losses.entropy || 0).toFixed(4)}`);
        }
        
        // Save model after training update
        await saveModelToStorage();
        
        // Update UI with training info
        updateTrainingUI();
    } catch (error) {
        console.error('Error during training update:', error);
    }
}

// Update training UI (shows when autopilot is on)
function updateTrainingUI() {
    const trainingStatsDiv = document.getElementById('trainingStats');
    
    if (trainingStatsDiv) {
        if (autopilotEnabled && rlAgent instanceof PPOAgent) {
            trainingStatsDiv.classList.remove('hidden');
            
            // Update stats
            const episodeEl = document.getElementById('trainingEpisode');
            const bestScoreEl = document.getElementById('trainingBestScore');
            const avgRewardEl = document.getElementById('trainingAvgReward');
            const totalRewardEl = document.getElementById('trainingTotalReward');
            
            if (episodeEl) episodeEl.textContent = trainingStats.episode;
            if (bestScoreEl) bestScoreEl.textContent = trainingStats.bestScore;
            
            if (trainingStats.rewards.length > 0) {
                const avgReward = trainingStats.rewards.slice(-10).reduce((a, b) => a + b, 0) / Math.min(10, trainingStats.rewards.length);
                if (avgRewardEl) avgRewardEl.textContent = Math.round(avgReward);
            }
            
            if (totalRewardEl) totalRewardEl.textContent = Math.round(trainingStats.totalReward);
        } else {
            trainingStatsDiv.classList.add('hidden');
        }
    }
}

function getTrainingStatsSnapshot() {
    const recentRewards = trainingStats.rewards.slice(-10);
    const avgReward = recentRewards.length ? recentRewards.reduce((a, b) => a + b, 0) / recentRewards.length : 0;
    const lastScore = trainingStats.scores.length ? trainingStats.scores[trainingStats.scores.length - 1] : 0;
    
    return {
        episode: trainingStats.episode,
        bestScore: trainingStats.bestScore,
        avgReward,
        totalReward: trainingStats.totalReward,
        lastScore
    };
}

function setupOfflineAPI() {
    if (!OFFLINE_MODE || window.offlineAPIReady) return;
    
    window.offlineAPI = {
        ensureAutopilot: () => {
            if (!autopilotEnabled) {
                autopilotEnabled = true;
                updateAutopilotUI();
                startNewEpisode();
            }
        },
        getTrainingStats: () => getTrainingStatsSnapshot(),
        exportModel: async () => {
            const data = await exportModelWeights({ pretrained: true });
            return data;
        },
        restartEpisode: () => restartGame(),
        setHeadless: (headless) => {
            // This can be called to toggle headless mode dynamically
            if (headless) {
                urlParams.set('headless', '1');
            } else {
                urlParams.delete('headless');
            }
        }
    };
    
    window.offlineAPIReady = true;
}

// Placeholder agent (random actions)
function loadPlaceholderAgent() {
    rlAgent = {
        getAction: function(obs, deterministic=false) {
            // Simple heuristic: move toward nearest enemy if health > 50%, otherwise avoid
            const playerHealth = obs[3]; // health normalized [0, 1]
            
            let action;
            if (playerHealth > 0.5) {
                // Aggressive: try to shoot or move toward enemies
                const nearestEnemyDist = obs[9]; // First enemy distance
                if (nearestEnemyDist < 0.5) {
                    action = Math.random() < 0.7 ? ACTIONS.SHOOT_PRIMARY : ACTIONS.MOVE_UP;
                } else {
                    action = ACTIONS.MOVE_UP;
                }
            } else {
                // Defensive: avoid and shoot
                action = Math.random() < 0.5 ? ACTIONS.MOVE_DOWN : ACTIONS.SHOOT_PRIMARY;
            }
            
            // Return in same format as PPOAgent
            return {
                action: action,
                logProb: 0,
                value: 0
            };
        }
    };
    
    console.log('Placeholder agent loaded (heuristic-based)');
}

// Helper: Softmax function
function softmax(logits) {
    const max = Math.max(...logits);
    const exp = logits.map(x => Math.exp(x - max));
    const sum = exp.reduce((a, b) => a + b, 0);
    return exp.map(x => x / sum);
}

// Helper: Sample from probability distribution
function sampleFromDistribution(probs) {
    const rand = Math.random();
    let cumsum = 0;
    for (let i = 0; i < probs.length; i++) {
        cumsum += probs[i];
        if (rand < cumsum) {
            return i;
        }
    }
    return probs.length - 1;
}

// Save demo data to file (for training)
// Update autopilot UI
function updateAutopilotUI() {
    const autopilotBtn = document.getElementById('autopilotToggle');
    const autopilotStatus = document.getElementById('autopilotStatus');
    
    if (autopilotBtn && autopilotStatus) {
        if (autopilotEnabled) {
            autopilotBtn.classList.add('active');
            autopilotStatus.textContent = 'Autopilot: ON';
            autopilotStatus.style.color = '#00ff00';
        } else {
            autopilotBtn.classList.remove('active');
            autopilotStatus.textContent = 'Autopilot: OFF';
            autopilotStatus.style.color = '#66aaff';
        }
    }
}

// Toggle training mode

function updateTractorBeam() {
    if (!tractorBeam.active) {
        // Recharge when not active
        if (tractorBeam.charge < tractorBeam.maxCharge) {
            tractorBeam.charge = Math.min(tractorBeam.maxCharge, tractorBeam.charge + tractorBeam.rechargeRate);
        }
        return;
    }
    
    // Drain charge while active
    tractorBeam.charge = Math.max(0, tractorBeam.charge - tractorBeam.drainRate);
    tractorBeam.currentDuration++;
    
    // Deactivate if charge depleted or max duration reached
    if (tractorBeam.charge <= 0 || tractorBeam.currentDuration >= tractorBeam.maxDuration) {
        deactivateTractorBeam();
        return;
    }
    
    // Check if target still exists and is in range
    if (!tractorBeam.target) {
        deactivateTractorBeam();
        return;
    }
    
    // Calculate player's front position
    const frontX = player.x + Math.sin(player.rotation) * (player.height / 2);
    const frontY = player.y - Math.cos(player.rotation) * (player.height / 2);
    
    const dx = tractorBeam.target.x - frontX;
    const dy = tractorBeam.target.y - frontY;
    const dist = Math.hypot(dx, dy);
    
    // Deactivate if target is out of range
    if (dist > tractorBeam.range) {
        deactivateTractorBeam();
        mobileTractorBeamActive = false;
        return;
    }
    
    // Apply pull force toward player (slowly)
    // dx and dy point FROM player TO target, so we need to NEGATE them to pull TOWARD player
    if (tractorBeam.targetType === 'asteroid') {
        // Slow, gentle pull force for asteroids
        const pullForce = 0.05; // Reduced from 0.15 - slower pull
        const pullX = -(dx / dist) * pullForce; // Negate to pull toward player
        const pullY = -(dy / dist) * pullForce; // Negate to pull toward player
        
        // Apply pull force (adds to existing velocity, maintaining momentum)
        tractorBeam.target.vx += pullX;
        tractorBeam.target.vy += pullY;
        
        // More damping to slow down movement and make it more controlled
        const damping = 0.95; // Increased damping for slower, smoother movement
        tractorBeam.target.vx *= damping;
        tractorBeam.target.vy *= damping;
    } else if (tractorBeam.targetType === 'enemy') {
        // Pull force for enemies (similar to asteroids but slightly stronger)
        const pullForce = 0.08;
        const pullX = -(dx / dist) * pullForce;
        const pullY = -(dy / dist) * pullForce;
        
        tractorBeam.target.vx += pullX;
        tractorBeam.target.vy += pullY;
        
        const damping = 0.96;
        tractorBeam.target.vx *= damping;
        tractorBeam.target.vy *= damping;
    } else if (tractorBeam.targetType === 'boss') {
        // Pull force for bosses (stronger pull since they're bigger)
        const bossPullForce = 0.1;
        const pullX = -(dx / dist) * bossPullForce;
        const pullY = -(dy / dist) * bossPullForce;
        
        tractorBeam.target.vx += pullX;
        tractorBeam.target.vy += pullY;
        
        const bossDamping = 0.97;
        tractorBeam.target.vx *= bossDamping;
        tractorBeam.target.vy *= bossDamping;
    }
}

// Process remote players' shooting input and create bullets on host (host only)
function processRemotePlayerShooting() {
    if (!multiplayerMode || !networkManager || !networkManager.isHostPlayer()) {
        return;
    }
    
    remotePlayers.forEach((remotePlayer, playerId) => {
        // Initialize weapon state for this player if not exists
        if (!remotePlayerWeapons.has(playerId)) {
            remotePlayerWeapons.set(playerId, {
                primary: { cooldown: 0, ammo: Infinity },
                missile: { cooldown: 0, ammo: 5 },
                laser: { cooldown: 0, ammo: 3 },
                cluster: { cooldown: 0, ammo: 0 }
            });
        }
        
        const playerWeapons = remotePlayerWeapons.get(playerId);
        
        // Update weapon cooldowns
        Object.keys(playerWeapons).forEach(weaponType => {
            if (playerWeapons[weaponType].cooldown > 0) {
                playerWeapons[weaponType].cooldown--;
            }
        });
        
        // Process shooting input from remote player
        if (remotePlayer.keys) {
            const keys = remotePlayer.keys;
            const playerX = remotePlayer.x;
            const playerY = remotePlayer.y;
            const playerRotation = remotePlayer.rotation;
            
            // Primary weapon (space or mouse button)
            if ((keys.space || keys.mouseButton) && playerWeapons.primary.cooldown === 0) {
                playerWeapons.primary.cooldown = weapons.primary.maxCooldown;
                
                const baseSpeed = 8;
                const vx = Math.sin(playerRotation) * baseSpeed;
                const vy = -Math.cos(playerRotation) * baseSpeed;
                const bulletX = playerX + Math.sin(playerRotation) * (player.height / 2);
                const bulletY = playerY - Math.cos(playerRotation) * (player.height / 2);
                
                let damage = weapons.primary.damage;
                // Apply upgrades (assume same upgrades for all players for simplicity)
                damage = damage * (1 + upgrades.primaryDamage.level * 0.1);
                
                bullets.push({
                    x: bulletX,
                    y: bulletY,
                    vx: vx,
                    vy: vy,
                    damage: damage,
                    color: weapons.primary.color,
                    size: 4,
                    type: 'primary',
                    glow: true,
                    playerId: playerId // Mark which player shot this
                });
                
                // Upgraded primary fires multiple shots
                if (upgrades.primaryDamage.level >= 2) {
                    const spreadAngle = 0.2;
                    bullets.push({
                        x: bulletX,
                        y: bulletY,
                        vx: Math.sin(playerRotation - spreadAngle) * baseSpeed,
                        vy: -Math.cos(playerRotation - spreadAngle) * baseSpeed,
                        damage: damage * 0.8,
                        color: weapons.primary.color,
                        size: 4,
                        type: 'primary',
                        glow: true,
                        playerId: playerId
                    });
                    bullets.push({
                        x: bulletX,
                        y: bulletY,
                        vx: Math.sin(playerRotation + spreadAngle) * baseSpeed,
                        vy: -Math.cos(playerRotation + spreadAngle) * baseSpeed,
                        damage: damage * 0.8,
                        color: weapons.primary.color,
                        size: 4,
                        type: 'primary',
                        glow: true,
                        playerId: playerId
                    });
                }
            }
            
            // Missile (key 1)
            if (keys.key1 && playerWeapons.missile.cooldown === 0 && playerWeapons.missile.ammo > 0) {
                playerWeapons.missile.cooldown = weapons.missile.maxCooldown;
                playerWeapons.missile.ammo--;
                
                const baseSpeed = 10;
                const vx = Math.sin(playerRotation) * baseSpeed;
                const vy = -Math.cos(playerRotation) * baseSpeed;
                const bulletX = playerX + Math.sin(playerRotation) * (player.height / 2);
                const bulletY = playerY - Math.cos(playerRotation) * (player.height / 2);
                
                let damage = weapons.missile.damage;
                damage = damage * (1 + upgrades.primaryDamage.level * 0.1);
                
                bullets.push({
                    x: bulletX,
                    y: bulletY,
                    vx: vx,
                    vy: vy,
                    damage: damage,
                    color: weapons.missile.color,
                    size: 8,
                    type: 'missile',
                    homing: true,
                    glow: true,
                    trail: [],
                    playerId: playerId
                });
            }
            
            // Laser (key 2)
            if (keys.key2 && playerWeapons.laser.cooldown === 0 && playerWeapons.laser.ammo > 0) {
                playerWeapons.laser.cooldown = weapons.laser.maxCooldown;
                playerWeapons.laser.ammo--;
                
                const baseSpeed = 15;
                const vx = Math.sin(playerRotation) * baseSpeed;
                const vy = -Math.cos(playerRotation) * baseSpeed;
                const bulletX = playerX + Math.sin(playerRotation) * (player.height / 2);
                const bulletY = playerY - Math.cos(playerRotation) * (player.height / 2);
                
                let damage = weapons.laser.damage;
                damage = damage * (1 + upgrades.primaryDamage.level * 0.1);
                
                bullets.push({
                    x: bulletX,
                    y: bulletY,
                    vx: vx,
                    vy: vy,
                    damage: damage,
                    color: weapons.laser.color,
                    size: 6,
                    type: 'laser',
                    pierce: true,
                    glow: true,
                    playerId: playerId
                });
            }
            
            // Cluster (key 3)
            if (keys.key3 && playerWeapons.cluster.cooldown === 0 && playerWeapons.cluster.ammo > 0) {
                playerWeapons.cluster.cooldown = weapons.cluster.maxCooldown;
                playerWeapons.cluster.ammo--;
                
                const baseSpeed = 12;
                const vx = Math.sin(playerRotation) * baseSpeed;
                const vy = -Math.cos(playerRotation) * baseSpeed;
                const bulletX = playerX + Math.sin(playerRotation) * (player.height / 2);
                const bulletY = playerY - Math.cos(playerRotation) * (player.height / 2);
                
                let damage = weapons.cluster.damage;
                damage = damage * (1 + upgrades.primaryDamage.level * 0.1);
                
                bullets.push({
                    x: bulletX,
                    y: bulletY,
                    vx: vx,
                    vy: vy,
                    damage: damage,
                    color: weapons.cluster.color,
                    size: 10,
                    type: 'cluster',
                    glow: true,
                    clusterSpread: true,
                    playerId: playerId
                });
            }
        }
    });
}

// Process remote players' bullets for damage (host only)
// Note: Bullet positions are updated by the owner and synced via network
// This function only processes collisions for damage
// Deploy: 1933e8d - Multiplayer enabled
function processRemoteBullets() {
    if (!multiplayerMode || !networkManager || !networkManager.isHostPlayer()) {
        return;
    }
    
    // Process bullets from all remote players
    remoteBullets.forEach((remoteBulletsList, playerId) => {
        remoteBulletsList.forEach(bullet => {
            // Check collisions with enemies
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
                            const spreadRadius = weapons.cluster.spreadRadius || 80;
                            const spreadDamage = bullet.damage * 0.7;
                            const hitEnemies = new Set([i]);
                            
                            function spreadCluster(centerX, centerY, depth) {
                                if (depth > 3) return;
                                
                                for (let j = 0; j < enemies.length; j++) {
                                    if (hitEnemies.has(j)) continue;
                                    
                                    const dist = Math.hypot(enemies[j].x - centerX, enemies[j].y - centerY);
                                    if (dist < spreadRadius) {
                                        enemies[j].health -= spreadDamage;
                                        hitEnemies.add(j);
                                        createExplosion(enemies[j].x, enemies[j].y, 20);
                                        spreadCluster(enemies[j].x, enemies[j].y, depth + 1);
                                    }
                                }
                            }
                            
                            spreadCluster(bullet.x, bullet.y, 0);
                        } else if (!bullet.pierce && bullet.type !== 'cluster') {
                            createExplosion(bullet.x, bullet.y, 10);
                        } else if (bullet.type === 'cluster') {
                            createExplosion(bullet.x, bullet.y, 30);
                        }
                    }
                }
                
                // Check collisions with bosses
                for (let i = 0; i < bosses.length; i++) {
                    const boss = bosses[i];
                    if (checkCollision(bullet, boss)) {
                        boss.health -= bullet.damage;
                        
                        if (!bullet.pierce && bullet.type !== 'cluster') {
                            createExplosion(bullet.x, bullet.y, 10);
                        } else if (bullet.type === 'cluster') {
                            createExplosion(bullet.x, bullet.y, 30);
                        }
                    }
                }
            }
            
            // Check collisions with asteroids
            if (bullet.type === 'primary' || bullet.type === 'missile' || bullet.type === 'laser' || bullet.type === 'ally' || bullet.type === 'cluster') {
                for (let i = 0; i < asteroids.length; i++) {
                    const asteroid = asteroids[i];
                    if (checkCollision(bullet, asteroid)) {
                        asteroid.health -= bullet.damage;
                        
                        if (!bullet.pierce && bullet.type !== 'cluster') {
                            createExplosion(bullet.x, bullet.y, 10);
                        } else if (bullet.type === 'cluster') {
                            createExplosion(bullet.x, bullet.y, 30);
                        }
                    }
                }
            }
        });
    });
}

// Track recent collisions to prevent duplicates (collision ID -> timestamp)
let recentCollisions = new Map();

// Process collisions for remote players (host only)
function processRemotePlayerCollisions() {
    if (!multiplayerMode || !networkManager || !networkManager.isHostPlayer()) {
        return;
    }
    
    const now = Date.now();
    const COLLISION_COOLDOWN = 500; // 500ms cooldown between same collision
    
    // Clean up old collision records
    recentCollisions.forEach((timestamp, key) => {
        if (now - timestamp > COLLISION_COOLDOWN) {
            recentCollisions.delete(key);
        }
    });
    
    // Check collisions between entities and remote players
    remotePlayers.forEach((remotePlayer, playerId) => {
        const remotePlayerBounds = {
            x: remotePlayer.x,
            y: remotePlayer.y,
            width: player.width,
            height: player.height
        };
        
        // Check enemy collisions
        enemies.forEach(enemy => {
            const collisionKey = `${playerId}_enemy_${enemy.id}`;
            if (checkCollision(enemy, remotePlayerBounds) && !recentCollisions.has(collisionKey)) {
                recentCollisions.set(collisionKey, now);
                
                // Send damage event to remote player
                networkManager.sendEvent('playerDamaged', {
                    damage: enemy.damage,
                    source: 'enemy',
                    enemyId: enemy.id
                }, playerId);
                
                // Queue effects for non-host
                pendingEffects.push({ type: 'explosion', x: enemy.x, y: enemy.y, size: 30 });
                pendingEffects.push({ type: 'sound', name: 'enemyExplosion' });
                
                // Play locally on host too
                sounds.enemyExplosion();
                createExplosion(enemy.x, enemy.y, 30);
                
                gameState.score += 50;
                gameState.enemiesKilled++;
                if (gameState.gameMode === 'normal') {
                    currency += 5;
                    cumulativeCredits += 5;
                }
            }
        });
        
        // Check asteroid collisions
        asteroids.forEach(asteroid => {
            const collisionKey = `${playerId}_asteroid_${asteroid.id}`;
            if (checkCollision(asteroid, remotePlayerBounds) && !recentCollisions.has(collisionKey)) {
                recentCollisions.set(collisionKey, now);
                
                // Send damage event to remote player
                networkManager.sendEvent('playerDamaged', {
                    damage: asteroid.width * 0.5,
                    source: 'asteroid',
                    asteroidId: asteroid.id
                }, playerId);
                
                // Queue effects for non-host
                pendingEffects.push({ type: 'explosion', x: asteroid.x, y: asteroid.y, size: asteroid.width });
                pendingEffects.push({ type: 'sound', name: 'asteroidExplosion' });
                
                // Play locally on host too
                sounds.asteroidExplosion();
                createExplosion(asteroid.x, asteroid.y, asteroid.width);
                
                gameState.score += 20;
                if (gameState.gameMode === 'normal') {
                    currency += 2;
                    cumulativeCredits += 2;
                }
            }
        });
        
        // Check boss collisions
        bosses.forEach(boss => {
            const collisionKey = `${playerId}_boss_${boss.id}`;
            if (checkCollision(boss, remotePlayerBounds) && !recentCollisions.has(collisionKey)) {
                recentCollisions.set(collisionKey, now);
                
                // Boss is instant kill
                networkManager.sendEvent('playerDamaged', {
                    damage: 9999,
                    source: 'boss',
                    bossId: boss.id
                }, playerId);
                
                // Queue effects for non-host
                pendingEffects.push({ type: 'explosion', x: boss.x, y: boss.y, size: 50 });
                pendingEffects.push({ type: 'sound', name: 'enemyExplosion' });
                
                // Play locally on host too
                sounds.enemyExplosion();
                createExplosion(boss.x, boss.y, 50);
            }
        });
        
        // Check enemy bullet collisions
        const enemyBullets = bullets.filter(b => b.type === 'enemy');
        enemyBullets.forEach(bullet => {
            if (checkCollision(bullet, remotePlayerBounds)) {
                // Send damage event to remote player
                networkManager.sendEvent('playerDamaged', {
                    damage: bullet.damage,
                    source: 'enemyBullet'
                }, playerId);
                // Remove bullet
                const index = bullets.indexOf(bullet);
                if (index > -1) {
                    bullets.splice(index, 1);
                }
            }
        });
    });
}

// Process remote players' tractor beams (host only)
function processRemoteTractorBeams() {
    if (!multiplayerMode || !networkManager || !networkManager.isHostPlayer()) {
        return;
    }
    
    // Process tractor beams from all remote players
    remotePlayers.forEach((remotePlayer, playerId) => {
        if (!remotePlayer.tractorBeam || !remotePlayer.tractorBeam.active) {
            return;
        }
        
        const tb = remotePlayer.tractorBeam;
        if (!tb.targetId || !tb.targetType) {
            return;
        }
        
        // Find the target entity by ID
        let target = null;
        if (tb.targetType === 'enemy') {
            target = enemies.find(e => e.id === tb.targetId);
        } else if (tb.targetType === 'asteroid') {
            target = asteroids.find(a => a.id === tb.targetId);
        } else if (tb.targetType === 'boss') {
            target = bosses.find(b => b.id === tb.targetId);
        }
        
        if (!target) {
            return; // Target not found or destroyed
        }
        
        // Calculate remote player's front position
        const frontX = remotePlayer.x + Math.sin(remotePlayer.rotation) * (player.height / 2);
        const frontY = remotePlayer.y - Math.cos(remotePlayer.rotation) * (player.height / 2);
        
        const dx = target.x - frontX;
        const dy = target.y - frontY;
        const dist = Math.hypot(dx, dy);
        
        // Check if target is in range
        if (dist > tractorBeam.range) {
            return;
        }
        
        // Apply pull force based on target type
        if (tb.targetType === 'asteroid') {
            const pullForce = 0.05;
            const pullX = -(dx / dist) * pullForce;
            const pullY = -(dy / dist) * pullForce;
            
            target.vx += pullX;
            target.vy += pullY;
            
            const damping = 0.95;
            target.vx *= damping;
            target.vy *= damping;
        } else if (tb.targetType === 'enemy') {
            const pullForce = 0.08;
            const pullX = -(dx / dist) * pullForce;
            const pullY = -(dy / dist) * pullForce;
            
            target.vx += pullX;
            target.vy += pullY;
            
            const damping = 0.96;
            target.vx *= damping;
            target.vy *= damping;
        } else if (tb.targetType === 'boss') {
            const pullForce = 0.1;
            const pullX = -(dx / dist) * pullForce;
            const pullY = -(dy / dist) * pullForce;
            
            target.vx += pullX;
            target.vy += pullY;
            
            const damping = 0.97;
            target.vx *= damping;
            target.vy *= damping;
        }
    });
}

function collectPowerup(type) {
    sounds.powerupCollect();
    // All powerups are now upgrade type - opens upgrade menu
    if (type === 'upgrade') {
        upgradePoints++;
        // Track powerup collection for RL rewards
        powerupsCollectedThisStep++;
        showUpgradeMenu();
    }
}

// Allies
function spawnAlly() {
    allies.push({
        x: player.x + (Math.random() - 0.5) * 100,
        y: player.y + (Math.random() - 0.5) * 100,
        width: 44, // 75% bigger: 25 * 1.75 = 43.75, rounded to 44
        height: 44, // 75% bigger: 25 * 1.75 = 43.75, rounded to 44
        speed: 3,
        shootCooldown: 0,
        maxShootCooldown: 30,
        damage: 15,
        health: 50, // Ally health - can be destroyed
        maxHealth: 50,
        offsetAngle: Math.random() * Math.PI * 2,
        orbitRadius: 80 + Math.random() * 40,
        rotation: 0 // Initialize rotation
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

        // Set rotation to face nearest enemy or movement direction
        if (!ally.rotation) ally.rotation = 0;
        
        if (enemies.length > 0) {
            const nearest = enemies.reduce((closest, enemy) => {
                const dist = Math.hypot(enemy.x - ally.x, enemy.y - ally.y);
                const closestDist = Math.hypot(closest.x - ally.x, closest.y - ally.y);
                return dist < closestDist ? enemy : closest;
            });

            const dx = nearest.x - ally.x;
            const dy = nearest.y - ally.y;
            const dist = Math.hypot(dx, dy);

            // Face nearest enemy
            ally.rotation = Math.atan2(dx, -dy); // Same rotation system as player
            
            if (dist < 400 && ally.shootCooldown <= 0) {
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
                    glow: true,
                    playerId: getLocalPlayerId()
                });
            }
        } else {
            // Face direction of orbit movement if no enemies
            ally.rotation = angle + Math.PI / 2;
        }
        
        ally.shootCooldown--;
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

function createBigExplosion(x, y, size) {
    // Special function for big explosions that bypasses normal particle limits
    // Temporarily increase particle limit for dramatic effect (reduced for performance)
    const particleCount = Math.min(40 + Math.floor(size / 3), 75); // Reduced from 50-100 to 40-75
    
    // Clear some space if needed, but allow more particles for big explosions
    const tempMaxParticles = Math.floor(MAX_PARTICLES * 1.5); // Reduced from 2x to 1.5x (300 instead of 400)
    const availableSlots = tempMaxParticles - particles.length;
    const actualCount = Math.min(particleCount, availableSlots);
    
    for (let i = 0; i < actualCount; i++) {
        const angle = (i / actualCount) * Math.PI * 2;
        const speed = 3 + Math.random() * 10; // Faster particles for big explosion
        particles.push({
            x: x,
            y: y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            life: 30 + Math.random() * 20, // Longer life for visibility
            maxLife: 30 + Math.random() * 20,
            size: Math.min(size * 0.2 + Math.random() * size * 0.3, 12), // Larger particles
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

// Fireworks System
function createFireworks() {
    // Create multiple fireworks bursts across the screen
    const fireworkCount = 5 + Math.floor(Math.random() * 5); // 5-9 fireworks
    
    for (let i = 0; i < fireworkCount; i++) {
        setTimeout(() => {
            const x = Math.random() * getCanvasWidth();
            const y = Math.random() * (getCanvasHeight() * 0.6); // Upper 60% of screen
            launchFirework(x, y);
        }, i * 200); // Stagger fireworks
    }
}

function launchFirework(x, y) {
    // Create a rocket that travels upward
    const rocket = {
        x: x,
        y: getCanvasHeight(),
        targetY: y,
        speed: 3 + Math.random() * 2,
        color: `hsl(${Math.random() * 360}, 100%, 50%)`,
        life: 60
    };
    
    // Animate rocket
    const rocketInterval = setInterval(() => {
        rocket.y -= rocket.speed;
        
        // Create trail
        particles.push({
            x: rocket.x,
            y: rocket.y,
            vx: (Math.random() - 0.5) * 0.5,
            vy: 1 + Math.random() * 0.5,
            life: 10,
            maxLife: 10,
            size: 2,
            color: rocket.color,
            glow: true
        });
        
        if (rocket.y <= rocket.targetY || rocket.life-- <= 0) {
            clearInterval(rocketInterval);
            explodeFirework(rocket.x, rocket.y, rocket.color);
        }
    }, 16); // ~60fps
}

function explodeFirework(x, y, baseColor) {
    // Extract hue from color
    const hueMatch = baseColor.match(/hsl\((\d+)/);
    const baseHue = hueMatch ? parseInt(hueMatch[1]) : Math.random() * 360;
    
    // Create burst of particles
    const particleCount = 30 + Math.floor(Math.random() * 20); // 30-50 particles
    
    for (let i = 0; i < particleCount; i++) {
        const angle = (i / particleCount) * Math.PI * 2;
        const speed = 2 + Math.random() * 4;
        const hue = (baseHue + (Math.random() - 0.5) * 60) % 360;
        
        fireworks.push({
            x: x,
            y: y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            life: 40 + Math.random() * 20,
            maxLife: 40 + Math.random() * 20,
            size: 3 + Math.random() * 3,
            color: `hsl(${hue}, 100%, ${50 + Math.random() * 50}%)`,
            glow: true
        });
    }
}

function updateFireworks() {
    for (let i = fireworks.length - 1; i >= 0; i--) {
        const firework = fireworks[i];
        firework.x += firework.vx;
        firework.y += firework.vy;
        firework.vy += 0.15; // Gravity
        firework.vx *= 0.98; // Air resistance
        firework.vy *= 0.98;
        firework.life--;
        
        if (firework.life <= 0) {
            fireworks.splice(i, 1);
        }
    }
}

function drawFireworks() {
    if (fireworks.length === 0) return;
    
    if (useWebGL && particleRenderer) {
        // WebGL rendering - use particle renderer for fireworks
        fireworks.forEach(firework => {
            const alpha = firework.life / firework.maxLife;
            if (alpha < 0.1) return;
            
            const color = ColorUtils.parseColor(firework.color, alpha);
            particleRenderer.addParticle(
                firework.x, firework.y,
                firework.size * alpha,
                color[0], color[1], color[2], color[3]
            );
        });
        particleRenderer.render();
    } else if (ctx) {
        // Canvas 2D fallback
    ctx.save();
    
    for (let i = 0; i < fireworks.length; i++) {
        const firework = fireworks[i];
        const alpha = firework.life / firework.maxLife;
        
        if (alpha < 0.1) continue;
        
        // Glow effect
        if (firework.glow && alpha > 0.3) {
            ctx.shadowBlur = firework.size * 3 * alpha;
            ctx.shadowColor = firework.color;
        } else {
            ctx.shadowBlur = 0;
        }
        
        // Convert HSL to RGBA
        const hslMatch = firework.color.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/);
        if (hslMatch) {
            const h = hslMatch[1];
            const s = hslMatch[2];
            const l = hslMatch[3];
            ctx.fillStyle = `hsla(${h}, ${s}%, ${l}%, ${alpha})`;
        } else {
            ctx.fillStyle = firework.color;
        }
        
        ctx.beginPath();
        ctx.arc(firework.x, firework.y, firework.size * alpha, 0, Math.PI * 2);
        ctx.fill();
    }
    
    ctx.restore();
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
    
    // Track upgrade selection for RL rewards
    upgradesSelectedThisStep++;

    if (key === 'health') {
        player.maxHealth += 20;
        player.health += 20;
    } else if (key === 'shields') {
        player.maxShields += 15;
        player.shields += 15;
    } else if (key === 'ally') {
        spawnAlly();
    } else if (key === 'cargoAlly') {
        spawnCargoAlly();
    }
}

function spawnCargoAlly() {
    if (!cargoVessel) return;
    allies.push({
        x: cargoVessel.x + (Math.random() - 0.5) * 100,
        y: cargoVessel.y + (Math.random() - 0.5) * 100,
        width: 44, // 75% bigger: 25 * 1.75 = 43.75, rounded to 44
        height: 44, // 75% bigger: 25 * 1.75 = 43.75, rounded to 44
        speed: 3,
        shootCooldown: 0,
        maxShootCooldown: 30,
        damage: 15,
        offsetAngle: Math.random() * Math.PI * 2,
        orbitRadius: 80 + Math.random() * 40,
        isCargoAlly: true,
        target: cargoVessel,
        health: 50,
        maxHealth: 50,
        rotation: 0 // Initialize rotation
    });
}

// Enemy bullets collision
function updateEnemyBullets() {
    const enemyBullets = bullets.filter(b => b.type === 'enemy');
    const isNonHost = multiplayerMode && networkManager && !networkManager.isHostPlayer();
    
    enemyBullets.forEach(bullet => {
        if (checkCollision(bullet, player)) {
            // For non-host players, host is authoritative for damage
            // We only apply damage locally if we're the host or in single-player
            if (!isNonHost) {
            takeDamage(bullet.damage);
            }
            // Visual feedback for all players
            createExplosion(bullet.x, bullet.y, 10);
            // Remove the bullet from the array
            const index = bullets.indexOf(bullet);
            if (index > -1) {
                bullets.splice(index, 1);
            }
            return; // Skip other checks if hit player
        }
        
        // Check collision with cargo vessel in mission mode
        if (gameState.gameMode === 'mission' && cargoVessel && checkCollision(bullet, cargoVessel)) {
            cargoVessel.health -= bullet.damage;
            createExplosion(bullet.x, bullet.y, 10);
            const index = bullets.indexOf(bullet);
            if (index > -1) {
                bullets.splice(index, 1);
            }
            return; // Skip other checks if hit cargo vessel
        }
        
        // Check collision with allies
        for (let i = 0; i < allies.length; i++) {
            const ally = allies[i];
            if (checkCollision(bullet, ally)) {
                ally.health -= bullet.damage;
                createExplosion(bullet.x, bullet.y, 10);
                
                // Check if ally is destroyed
                if (ally.health <= 0) {
                    createExplosion(ally.x, ally.y, 25);
                    allies.splice(i, 1);
                }
                
                // Remove the bullet
                const index = bullets.indexOf(bullet);
                if (index > -1) {
                    bullets.splice(index, 1);
                }
                return; // Exit loop and skip other checks
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
    if (!player || isNaN(player.x) || isNaN(player.y)) return;
    
    if (useWebGL && spriteRenderer) {
        // WebGL rendering
        spriteRenderer.begin();
        
        // Health bar above ship
        const healthPercent = player.health / player.maxHealth;
        const barWidth = player.width + 10;
        const barHeight = 4;
        const barY = player.y - player.height / 2 - 15;
        
        // Health bar background
        spriteRenderer.drawRect(
            player.x - barWidth / 2, barY,
            barWidth, barHeight,
            new Float32Array([0, 0, 0, 0.6])
        );
        
        // Health bar fill (green to red)
        const healthR = healthPercent > 0.5 ? (1 - (healthPercent - 0.5) * 2) : 1;
        const healthG = healthPercent > 0.5 ? 1 : healthPercent * 2;
        const healthB = 0;
        spriteRenderer.drawRect(
            player.x - barWidth / 2, barY,
            barWidth * healthPercent, barHeight,
            new Float32Array([healthR, healthG, healthB, 1])
        );
        
        // Shield effect - two complete circular rings around player ship
        if (player.shields > 0) {
            const shieldPercent = player.shields / player.maxShields;
            const shieldRadius = player.width / 2 + 18;
            
            // Draw two complete circles (inner and outer rings)
            circleRenderer.begin();
            
            // Outer ring - thicker, softer glow
            const outerRingColor = new Float32Array([0, 0.8, 1, shieldPercent * 0.6]);
            circleRenderer.drawCircle(player.x, player.y, shieldRadius + 2, outerRingColor);
            
            // Inner ring - thinner, brighter
            const innerRingColor = new Float32Array([0, 1, 1, shieldPercent * 0.9]);
            circleRenderer.drawCircle(player.x, player.y, shieldRadius - 1, innerRingColor);
            
            circleRenderer.end();
        }
        
        // Engine particles (handled by particle system)
        if (player.engineGlow > 0) {
            const backY = player.height / 2;
            for (let i = 0; i < 3; i++) {
                const offset = (i - 1) * 8;
                const backWorldX = player.x + offset * Math.cos(player.rotation) - backY * Math.sin(player.rotation);
                const backWorldY = player.y + offset * Math.sin(player.rotation) + backY * Math.cos(player.rotation);
                const particleSpeed = 2 + Math.random() * 2;
                const particleVx = -Math.sin(player.rotation) * particleSpeed;
                const particleVy = Math.cos(player.rotation) * particleSpeed;
                
                particles.push({
                    x: backWorldX,
                    y: backWorldY,
                    vx: particleVx + (Math.random() - 0.5) * 1,
                    vy: particleVy + (Math.random() - 0.5) * 1,
                    life: 10,
                    maxLife: 10,
                    size: 2,
                    color: `hsl(200, 100%, ${60 + Math.random() * 40}%)`,
                    glow: true
                });
            }
        }
        
        // Draw ship sprite with damage effects
        // healthPercent already declared above for health bar
        
        // Use damaged ship texture when health is critical (below 30%)
        const isCriticalDamage = healthPercent < 0.3;
        const shipTexture = isCriticalDamage 
            ? (textures.damagedShip || textures.ship || null)
            : (textures.ship || null);
        
        // Damage effect: darken ship color based on health
        const damageFactor = 1.0 - (1.0 - healthPercent) * 0.5; // Darken up to 50% when heavily damaged
        const shipColor = new Float32Array([damageFactor, damageFactor, damageFactor, 1.0]);
        
        if (!shipTexture) {
            console.warn('Ship texture not loaded, using colored rectangle. Textures object:', textures);
            // Draw a colored rectangle as fallback
            spriteRenderer.drawRect(
                player.x - player.width / 2,
                player.y - player.height / 2,
                player.width,
                player.height,
                new Float32Array([0.2 * damageFactor, 0.6 * damageFactor, 1.0 * damageFactor, 1.0]) // Blue color with damage
            );
        } else {
            // Draw with texture - darken based on damage
            spriteRenderer.drawSprite(
                shipTexture,
                player.x, player.y,
                player.width, player.height,
                player.rotation + Math.PI, // Add 180 degrees to fix orientation
                shipColor, // Darkened color to show damage
                0.5, 0.5
            );
        }
        
        spriteRenderer.end();
    } else if (ctx) {
        // Canvas 2D fallback
    ctx.save();
    ctx.translate(player.x, player.y);
    
    // Health bar above ship (drawn before rotation so it stays upright)
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
    
    // Now rotate for ship drawing
    ctx.rotate(player.rotation);
    
    // Shield effect - two complete circular rings
    if (player.shields > 0) {
        const shieldPercent = player.shields / player.maxShields;
        const shieldRadius = player.width / 2 + 18;
        
        // Outer ring - thicker, softer glow
        ctx.strokeStyle = `rgba(0, 200, 255, ${shieldPercent * 0.6})`;
        ctx.lineWidth = 4;
        ctx.shadowBlur = 8;
        ctx.shadowColor = 'rgba(0, 200, 255, 0.5)';
        ctx.beginPath();
        ctx.arc(0, 0, shieldRadius + 2, 0, Math.PI * 2);
        ctx.stroke();
        
        // Inner ring - thinner, brighter
        ctx.strokeStyle = `rgba(0, 255, 255, ${shieldPercent * 0.9})`;
        ctx.lineWidth = 2;
        ctx.shadowBlur = 4;
        ctx.shadowColor = 'rgba(0, 255, 255, 0.3)';
        ctx.beginPath();
        ctx.arc(0, 0, shieldRadius - 1, 0, Math.PI * 2);
        ctx.stroke();
        
        // Reset shadow
        ctx.shadowBlur = 0;
    } else {
        // Show broken shield indicator when shields are down
        ctx.strokeStyle = 'rgba(255, 0, 0, 0.3)';
        ctx.lineWidth = 1;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.arc(0, 0, player.width / 2 + 18, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
    }

    // Engine glow (drawn at back of ship, relative to rotation)
    if (player.engineGlow > 0) {
            const backY = player.height / 2;
        const glowGradient = ctx.createLinearGradient(0, backY, 0, backY + 15);
        glowGradient.addColorStop(0, `rgba(0, 200, 255, ${player.engineGlow * 0.8})`);
        glowGradient.addColorStop(0.5, `rgba(100, 200, 255, ${player.engineGlow * 0.5})`);
        glowGradient.addColorStop(1, 'rgba(0, 200, 255, 0)');
        
        ctx.fillStyle = glowGradient;
        ctx.fillRect(-player.width / 4, backY, player.width / 2, 15);
        
            // Engine particles
        for (let i = 0; i < 3; i++) {
            const offset = (i - 1) * 8;
            const backWorldX = player.x + offset * Math.cos(player.rotation) - backY * Math.sin(player.rotation);
            const backWorldY = player.y + offset * Math.sin(player.rotation) + backY * Math.cos(player.rotation);
            const particleSpeed = 2 + Math.random() * 2;
            const particleVx = -Math.sin(player.rotation) * particleSpeed;
            const particleVy = Math.cos(player.rotation) * particleSpeed;
            
            particles.push({
                x: backWorldX,
                y: backWorldY,
                vx: particleVx + (Math.random() - 0.5) * 1,
                vy: particleVy + (Math.random() - 0.5) * 1,
                life: 10,
                maxLife: 10,
                size: 2,
                color: `hsl(200, 100%, ${60 + Math.random() * 40}%)`,
                glow: true
            });
        }
    }

    // Draw ship image if loaded, otherwise fall back to drawn shape
    // Use damaged ship texture when health is critical (below 30%)
    const isCriticalDamage = healthPercent < 0.3;
    const shipImageToUse = isCriticalDamage && damagedPlayerShipImageLoaded && damagedPlayerShipImage
        ? damagedPlayerShipImage
        : (playerShipImageLoaded && playerShipImage ? playerShipImage : null);
    
    if (shipImageToUse) {
        ctx.drawImage(
            shipImageToUse,
                -player.width / 2,
                -player.height / 2,
                player.width,
                player.height
        );
    } else {
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

    ctx.fillStyle = '#00ccff';
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#00ccff';
    ctx.fillRect(-player.width / 4, -player.height / 4, player.width / 2, player.height / 4);
    ctx.shadowBlur = 0;
    
    ctx.strokeStyle = '#00ffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -player.height / 2);
    ctx.lineTo(-player.width / 2, player.height / 2);
    ctx.lineTo(0, player.height / 2 - 5);
    ctx.lineTo(player.width / 2, player.height / 2);
    ctx.closePath();
    ctx.stroke();
    }
    
    ctx.restore();
    }
}

// Draw remote players in multiplayer mode
function drawRemotePlayers() {
    if (!multiplayerMode || !networkManager) return;
    
    const remotePlayersList = networkManager.getPlayers();
    if (remotePlayersList.length === 0) return;
    
    if (useWebGL && spriteRenderer) {
        remotePlayersList.forEach(remotePlayer => {
            if (!remotePlayer || isNaN(remotePlayer.x) || isNaN(remotePlayer.y)) {
                console.warn('Invalid remote player data:', remotePlayer);
                return;
            }
            
            // Health bar - draw in separate batch to ensure it's visible
            spriteRenderer.begin();
            
            const healthPercent = (remotePlayer.health || 100) / (remotePlayer.maxHealth || 100);
            const barWidth = player.width + 10;
            const barHeight = 4;
            const barY = remotePlayer.y - player.height / 2 - 15;
            
            // Health bar background
            spriteRenderer.drawRect(
                remotePlayer.x - barWidth / 2, barY,
                barWidth, barHeight,
                new Float32Array([0, 0, 0, 0.6])
            );
            
            // Health bar fill (green to red)
            const healthR = healthPercent > 0.5 ? (1 - (healthPercent - 0.5) * 2) : 1;
            const healthG = healthPercent > 0.5 ? 1 : healthPercent * 2;
            spriteRenderer.drawRect(
                remotePlayer.x - barWidth / 2, barY,
                barWidth * healthPercent, barHeight,
                new Float32Array([healthR, healthG, 0, 1])
            );
            
            spriteRenderer.end();
            
            // Draw orange circle indicator (like shield)
            const indicatorRadius = player.width / 2 + 18; // Same size as shield
            
            circleRenderer.begin();
            
            // Outer ring - thicker, softer glow
            const outerRingColor = new Float32Array([1.0, 0.6, 0.2, 0.6]); // Orange
            circleRenderer.drawCircle(remotePlayer.x, remotePlayer.y, indicatorRadius + 2, outerRingColor);
            
            // Inner ring - thinner, brighter
            const innerRingColor = new Float32Array([1.0, 0.7, 0.3, 0.9]); // Brighter orange
            circleRenderer.drawCircle(remotePlayer.x, remotePlayer.y, indicatorRadius - 1, innerRingColor);
            
            circleRenderer.end();
            
            // Draw the ship texture on top if available
            const remoteColor = new Float32Array([1.0, 0.6, 0.2, 1.0]); // Orange tint
            if (textures.ship && spriteRenderer.gl && spriteRenderer.gl.isTexture(textures.ship)) {
                spriteRenderer.begin();
                spriteRenderer.drawSprite(
                    textures.ship,  // texture first!
                    remotePlayer.x, remotePlayer.y,
                    player.width, player.height,
                    (remotePlayer.rotation || 0) + Math.PI, // Add 180 degrees to match local player orientation
                    remoteColor,  // color
                    0.5, 0.5  // origin
                );
                spriteRenderer.end();
            }
        });
    } else if (ctx) {
        // Canvas 2D rendering for remote players
        remotePlayersList.forEach(remotePlayer => {
            if (!remotePlayer || isNaN(remotePlayer.x) || isNaN(remotePlayer.y)) {
                return;
            }
            
            ctx.save();
            ctx.translate(remotePlayer.x, remotePlayer.y);
            ctx.rotate((remotePlayer.rotation || 0) + Math.PI); // Add 180 degrees to match local player orientation
            
            // Health bar
            const healthPercent = (remotePlayer.health || 100) / (remotePlayer.maxHealth || 100);
            const barWidth = player.width + 10;
            const barHeight = 4;
            const barY = -player.height / 2 - 15;
            
            ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
            ctx.fillRect(-barWidth / 2, barY, barWidth, barHeight);
            
            const healthR = healthPercent > 0.5 ? (1 - (healthPercent - 0.5) * 2) : 1;
            const healthG = healthPercent > 0.5 ? 1 : healthPercent * 2;
            ctx.fillStyle = `rgb(${Math.floor(healthR * 255)}, ${Math.floor(healthG * 255)}, 0)`;
            ctx.fillRect(-barWidth / 2, barY, barWidth * healthPercent, barHeight);
            
            // Draw orange circle indicator (like shield) before ship
            const indicatorRadius = player.width / 2 + 18; // Same size as shield
            
            // Outer ring - thicker, softer glow
            ctx.strokeStyle = 'rgba(255, 180, 80, 0.6)'; // Orange
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.arc(0, 0, indicatorRadius + 2, 0, Math.PI * 2);
            ctx.stroke();
            
            // Inner ring - thinner, brighter
            ctx.strokeStyle = 'rgba(255, 200, 100, 0.9)'; // Brighter orange
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(0, 0, indicatorRadius - 1, 0, Math.PI * 2);
            ctx.stroke();
            
            // Draw the ship image on top if available
            ctx.globalCompositeOperation = 'source-over';
            ctx.globalAlpha = 1;
            
            if (playerShipImageLoaded && playerShipImage) {
                // Draw the ship image with orange tint
                ctx.globalCompositeOperation = 'multiply';
                ctx.fillStyle = 'rgba(255, 180, 80, 0.5)'; // Orange tint
                ctx.fillRect(-player.width / 2, -player.height / 2, player.width, player.height);
                ctx.drawImage(
                    playerShipImage,
                    -player.width / 2,
                    -player.height / 2,
                    player.width,
                    player.height
                );
                ctx.globalCompositeOperation = 'source-over';
            }
            
            ctx.restore();
        });
    }
}

// Multiplayer UI setup
function setupMultiplayerUI() {
    const createRoomBtn = document.getElementById('createRoomBtn');
    const joinRoomBtn = document.getElementById('joinRoomBtn');
    const roomIdInput = document.getElementById('roomIdInput');
    const leaveRoomBtn = document.getElementById('leaveRoomBtn');
    const roomInfo = document.getElementById('roomInfo');
    const displayRoomId = document.getElementById('displayRoomId');
    
    if (createRoomBtn) {
        createRoomBtn.addEventListener('click', async () => {
            const roomId = await networkManager.createRoom();
            if (roomId) {
                multiplayerMode = true;
                displayRoomId.textContent = roomId;
                roomInfo.classList.remove('hidden');
                createRoomBtn.disabled = true;
                joinRoomBtn.disabled = true;
                roomIdInput.disabled = true;
                console.log('Room created:', roomId);
            }
        });
    }
    
    if (joinRoomBtn && roomIdInput) {
        joinRoomBtn.addEventListener('click', async () => {
            const roomId = roomIdInput.value.trim();
            if (roomId) {
                const success = await networkManager.joinRoom(roomId);
                if (success) {
                    multiplayerMode = true;
                    displayRoomId.textContent = roomId;
                    roomInfo.classList.remove('hidden');
                    createRoomBtn.disabled = true;
                    joinRoomBtn.disabled = true;
                    roomIdInput.disabled = true;
                    console.log('Joined room:', roomId);
                } else {
                    alert('Failed to join room. Please check the room ID.');
                }
            }
        });
    }
    
    if (leaveRoomBtn) {
        leaveRoomBtn.addEventListener('click', async () => {
            await networkManager.leaveRoom();
            multiplayerMode = false;
            roomInfo.classList.add('hidden');
            if (createRoomBtn) createRoomBtn.disabled = false;
            if (joinRoomBtn) joinRoomBtn.disabled = false;
            if (roomIdInput) roomIdInput.disabled = false;
            remotePlayers.clear();
        });
    }
}

// Update player count in UI
function updatePlayerCountUI() {
    const playerCountEl = document.getElementById('playerCount');
    if (playerCountEl && networkManager) {
        const players = networkManager.getPlayers();
        playerCountEl.textContent = players.length + 1; // +1 for local player
    }
}

function drawBullets() {
    if (useWebGL && circleRenderer && trailRenderer) {
        // WebGL rendering - use circles for bullets to match Canvas 2D
        trailRenderer.begin();
        circleRenderer.begin();
        
        // Draw local bullets
        bullets.forEach(bullet => {
            // Draw missile trail
            if (bullet.trail && bullet.trail.length > 1) {
                trailRenderer.drawTrail(bullet.trail, bullet.color, 2, 0.5);
            }
            
            // Draw bullet as circle with glow effect (matching Canvas 2D)
            const color = ColorUtils.parseColor(bullet.color);
            
            if (bullet.glow) {
                // Outer glow (larger, more transparent)
                const glowColor = ColorUtils.parseColor(bullet.color, 0.3);
                circleRenderer.drawCircle(bullet.x, bullet.y, bullet.size * 2.5, glowColor);
                
                // Mid glow
                const midGlowColor = ColorUtils.parseColor(bullet.color, 0.6);
                circleRenderer.drawCircle(bullet.x, bullet.y, bullet.size * 1.8, midGlowColor);
            }
            
            // Bullet core (bright center)
            circleRenderer.drawCircle(bullet.x, bullet.y, bullet.size, color);
            
            // Laser beam effect
            if (bullet.type === 'laser') {
                const laserColor = ColorUtils.parseColor(bullet.color, 0.8);
                const laserPoints = [
                    { x: bullet.x, y: bullet.y },
                    { x: bullet.x, y: bullet.y + 30 }
                ];
                trailRenderer.drawTrail(laserPoints, laserColor, 3, 0.8);
            }
        });
        
        // Draw remote bullets
        remoteBullets.forEach((remoteBulletsList, playerId) => {
            remoteBulletsList.forEach(bullet => {
                if (bullet.trail && bullet.trail.length > 1) {
                    trailRenderer.drawTrail(bullet.trail, bullet.color, 2, 0.5);
                }
                
                const color = ColorUtils.parseColor(bullet.color);
                
                if (bullet.glow) {
                    const glowColor = ColorUtils.parseColor(bullet.color, 0.3);
                    circleRenderer.drawCircle(bullet.x, bullet.y, bullet.size * 2.5, glowColor);
                    
                    const midGlowColor = ColorUtils.parseColor(bullet.color, 0.6);
                    circleRenderer.drawCircle(bullet.x, bullet.y, bullet.size * 1.8, midGlowColor);
                }
                
                circleRenderer.drawCircle(bullet.x, bullet.y, bullet.size, color);
                
                if (bullet.type === 'laser') {
                    const laserColor = ColorUtils.parseColor(bullet.color, 0.8);
                    const laserPoints = [
                        { x: bullet.x, y: bullet.y },
                        { x: bullet.x, y: bullet.y + 30 }
                    ];
                    trailRenderer.drawTrail(laserPoints, laserColor, 3, 0.8);
                }
            });
        });
        
        trailRenderer.end();
        circleRenderer.end();
    } else if (ctx) {
        // Canvas 2D fallback
        // Draw local bullets
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
        
        // Draw remote bullets
        remoteBullets.forEach((remoteBulletsList, playerId) => {
            remoteBulletsList.forEach(bullet => {
                ctx.save();
                
                if (bullet.glow) {
                    ctx.shadowBlur = bullet.size * 3;
                    ctx.shadowColor = bullet.color;
                }
                
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
                
                if (bullet.glow) {
                    try {
                        const gradient = ctx.createRadialGradient(bullet.x, bullet.y, 0, bullet.x, bullet.y, bullet.size * 2);
                        gradient.addColorStop(0, bullet.color);
                        
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
                        ctx.fillStyle = bullet.color;
                        ctx.beginPath();
                        ctx.arc(bullet.x, bullet.y, bullet.size, 0, Math.PI * 2);
                        ctx.fill();
                    }
                }
                
                ctx.fillStyle = bullet.color;
                ctx.beginPath();
                ctx.arc(bullet.x, bullet.y, bullet.size, 0, Math.PI * 2);
                ctx.fill();
                
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
        });
    }
}

// Draw bosses
function drawBosses() {
    if (useWebGL && spriteRenderer) {
        // WebGL rendering
        spriteRenderer.begin();
        
        bosses.forEach(boss => {
            // Health bar (larger for boss)
            const healthPercent = boss.health / boss.maxHealth;
            const barY = boss.y - boss.height / 2 - 20;
            
            // Health bar background
            spriteRenderer.drawRect(
                boss.x - boss.width / 2 - 5, barY,
                boss.width + 10, 8,
                new Float32Array([0, 0, 0, 0.7])
            );
            
            // Health bar red background
            spriteRenderer.drawRect(
                boss.x - boss.width / 2, barY + 2,
                boss.width, 6,
                new Float32Array([1, 0, 0, 1])
            );
            
            // Health bar fill
            spriteRenderer.drawRect(
                boss.x - boss.width / 2, barY + 2,
                boss.width * healthPercent, 6,
                new Float32Array([0, 1, 0, 1])
            );
            
            // Draw boss ship
            const bossTexture = textures.boss || null;
            const bossHealthPercent = boss.health / boss.maxHealth;
            const bossDamageFactor = 1.0 - (1.0 - bossHealthPercent) * 0.5;
            const bossColor = bossTexture 
                ? new Float32Array([bossDamageFactor, bossDamageFactor, bossDamageFactor, 1.0])
                : new Float32Array([1, 0, 0, 1]); // Red fallback
            
            spriteRenderer.drawSprite(
                bossTexture,
                boss.x, boss.y,
                boss.width, boss.height,
                boss.rotation + Math.PI, // Same rotation offset as player ship
                bossColor,
                0.5, 0.5
            );
        });
        
        spriteRenderer.end();
    } else if (ctx) {
        // Canvas 2D fallback
        bosses.forEach(boss => {
            ctx.save();
            ctx.translate(boss.x, boss.y);
            
            // Health bar
            const healthPercent = boss.health / boss.maxHealth;
            ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            ctx.fillRect(-boss.width / 2 - 5, -boss.height / 2 - 20, boss.width + 10, 8);
            ctx.fillStyle = 'red';
            ctx.fillRect(-boss.width / 2, -boss.height / 2 - 18, boss.width, 6);
            ctx.fillStyle = 'green';
            ctx.fillRect(-boss.width / 2, -boss.height / 2 - 18, boss.width * healthPercent, 6);
            
            // Rotate for ship drawing
            ctx.rotate(boss.rotation);
            
            // Boss glow
            ctx.shadowBlur = 25;
            ctx.shadowColor = boss.glowColor;
            
            // Draw boss ship image if loaded
            if (bossShipImageLoaded && bossShipImage) {
                ctx.drawImage(
                    bossShipImage,
                    -boss.width / 2,
                    -boss.height / 2,
                    boss.width,
                    boss.height
                );
            } else {
                // Fallback drawn shape
                const bossGradient = ctx.createLinearGradient(-boss.width / 2, -boss.height / 2, 0, boss.height / 2);
                bossGradient.addColorStop(0, boss.color);
                bossGradient.addColorStop(1, boss.color.replace('50%)', '30%)'));
                
                ctx.fillStyle = bossGradient;
                ctx.beginPath();
                ctx.moveTo(0, boss.height / 2);
                ctx.lineTo(-boss.width / 2, -boss.height / 2);
                ctx.lineTo(0, -boss.height / 2 + 5);
                ctx.lineTo(boss.width / 2, -boss.height / 2);
                ctx.closePath();
                ctx.fill();
                
                ctx.fillStyle = boss.glowColor;
                ctx.fillRect(-boss.width / 4, -boss.height / 4, boss.width / 2, boss.height / 4);
                
                ctx.strokeStyle = boss.glowColor;
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.moveTo(0, boss.height / 2);
                ctx.lineTo(-boss.width / 2, -boss.height / 2);
                ctx.lineTo(0, -boss.height / 2 + 5);
                ctx.lineTo(boss.width / 2, -boss.height / 2);
                ctx.closePath();
                ctx.stroke();
            }
            
            ctx.restore();
        });
    }
}

function drawEnemies() {
    if (useWebGL && spriteRenderer) {
        // WebGL rendering
        spriteRenderer.begin();
        
        enemies.forEach(enemy => {
            // Health bar
            const healthPercent = enemy.health / enemy.maxHealth;
            const barY = enemy.y - enemy.height / 2 - 12;
            
            // Health bar background
            spriteRenderer.drawRect(
                enemy.x - enemy.width / 2 - 2, barY,
                enemy.width + 4, 6,
                new Float32Array([0, 0, 0, 0.5])
            );
            
            // Health bar red background
            spriteRenderer.drawRect(
                enemy.x - enemy.width / 2, barY + 2,
                enemy.width, 4,
                new Float32Array([1, 0, 0, 1])
            );
            
            // Health bar green fill
            spriteRenderer.drawRect(
                enemy.x - enemy.width / 2, barY + 2,
                enemy.width * healthPercent, 4,
                new Float32Array([0, 1, 0, 1])
            );
            
            // Draw enemy ship with damage effects
            const enemyTexture = textures.enemyShip || null;
            const enemyColor = ColorUtils.parseColor(enemy.color);
            const enemyHealthPercent = enemy.health / enemy.maxHealth;
            
            // Damage effect: darken ship color based on health
            const enemyDamageFactor = 1.0 - (1.0 - enemyHealthPercent) * 0.5; // Darken up to 50% when heavily damaged
            const finalEnemyColor = enemyTexture 
                ? new Float32Array([enemyDamageFactor, enemyDamageFactor, enemyDamageFactor, 1.0])
                : new Float32Array([
                    enemyColor[0] * enemyDamageFactor,
                    enemyColor[1] * enemyDamageFactor,
                    enemyColor[2] * enemyDamageFactor,
                    enemyColor[3]
                ]);
            
            spriteRenderer.drawSprite(
                enemyTexture,
                enemy.x, enemy.y,
                enemy.width, enemy.height,
                enemy.rotation + Math.PI, // Same rotation offset as player ship (180 degrees)
                finalEnemyColor,
                0.5, 0.5
            );
        });
        
        spriteRenderer.end();
    } else if (ctx) {
        // Canvas 2D fallback
    enemies.forEach(enemy => {
        ctx.save();
        ctx.translate(enemy.x, enemy.y);
        
        // Health bar (drawn before rotation so it stays upright)
        const healthPercent = enemy.health / enemy.maxHealth;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(-enemy.width / 2 - 2, -enemy.height / 2 - 12, enemy.width + 4, 6);
        ctx.fillStyle = 'red';
        ctx.fillRect(-enemy.width / 2, -enemy.height / 2 - 10, enemy.width, 4);
        ctx.fillStyle = 'green';
        ctx.fillRect(-enemy.width / 2, -enemy.height / 2 - 10, enemy.width * healthPercent, 4);
        
        // Now rotate for ship drawing
        ctx.rotate(enemy.rotation);
        
        // Enemy glow
        ctx.shadowBlur = 15;
        ctx.shadowColor = enemy.glowColor;
        
        // Draw enemy ship image if loaded, otherwise fall back to drawn shape
        if (enemyShipImageLoaded && enemyShipImage) {
            ctx.drawImage(
                enemyShipImage,
                    -enemy.width / 2,
                    -enemy.height / 2,
                    enemy.width,
                    enemy.height
            );
        } else {
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
        }
        
        ctx.restore();
    });
    }
}

function drawTractorBeam() {
    if (!tractorBeam.active || !tractorBeam.target) return;
    
    // Calculate player's front position (where tractor beam emits from)
    const frontX = player.x + Math.sin(player.rotation) * (player.height / 2);
    const frontY = player.y - Math.cos(player.rotation) * (player.height / 2);
    
    // Target position
    const targetX = tractorBeam.target.x;
    const targetY = tractorBeam.target.y;
    
    if (useWebGL && spriteRenderer) {
        // WebGL rendering - draw solid continuous beam from front of ship to target
        spriteRenderer.begin();
        
        // Calculate beam properties
        const dx = targetX - frontX;
        const dy = targetY - frontY;
        const length = Math.hypot(dx, dy);
        const angle = Math.atan2(dy, dx);
        const centerX = (frontX + targetX) / 2;
        const centerY = (frontY + targetY) / 2;
        
        // Pulsing effect
        const pulse = Math.sin(Date.now() / 100) * 0.2 + 0.8;
        
        // Draw continuous beam as rotated rectangle
        // Rectangle is drawn with width=length (along beam) and height=beamWidth (thickness)
        // Rotated by angle to align from front of ship to target
        
        // Outer glow (wider, more transparent)
        const outerGlowColor = new Float32Array([0, 1, 1, 0.3 * pulse]);
        spriteRenderer.drawSprite(
            null,
            centerX, centerY,
            length, 12, // width=length (beam length), height=12 (beam thickness)
            angle, // Rotate by angle to align with beam direction
            outerGlowColor,
            0.5, 0.5
        );
        
        // Mid glow
        const midGlowColor = new Float32Array([0, 1, 1, 0.5 * pulse]);
        spriteRenderer.drawSprite(
            null,
            centerX, centerY,
            length, 8,
            angle,
            midGlowColor,
            0.5, 0.5
        );
        
        // Main solid beam (bright center)
        const mainBeamColor = new Float32Array([1, 1, 1, 0.9 * pulse]);
        spriteRenderer.drawSprite(
            null,
            centerX, centerY,
            length, 4,
            angle,
            mainBeamColor,
            0.5, 0.5
        );
        
        // Inner bright core
        const coreColor = new Float32Array([0, 1, 1, 1.0 * pulse]);
        spriteRenderer.drawSprite(
            null,
            centerX, centerY,
            length, 2,
            angle,
            coreColor,
            0.5, 0.5
        );
        
        // Draw particles along beam
        for (let i = 0; i < 5; i++) {
            const t = (Date.now() / 50 + i * 0.2) % 1;
            const x = frontX + (targetX - frontX) * t;
            const y = frontY + (targetY - frontY) * t;
            const particleColor = new Float32Array([0, 1, 1, 0.8]);
            spriteRenderer.drawSprite(null, x, y, 4, 4, 0, particleColor, 0.5, 0.5);
        }
        
        spriteRenderer.end();
    } else if (ctx) {
        // Canvas 2D fallback
    ctx.save();
    
    // Outer glow
    ctx.strokeStyle = '#00ffff';
    ctx.shadowBlur = 20;
    ctx.shadowColor = '#00ffff';
    ctx.lineWidth = 4;
    ctx.globalAlpha = 0.6;
    ctx.beginPath();
    ctx.moveTo(frontX, frontY);
    ctx.lineTo(targetX, targetY);
    ctx.stroke();
    
    // Inner bright line
    ctx.strokeStyle = '#ffffff';
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#ffffff';
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.9;
    ctx.beginPath();
    ctx.moveTo(frontX, frontY);
    ctx.lineTo(targetX, targetY);
    ctx.stroke();
    
    // Pulsing effect
    const pulse = Math.sin(Date.now() / 100) * 0.3 + 0.7;
    ctx.strokeStyle = `rgba(0, 255, 255, ${pulse * 0.5})`;
    ctx.shadowBlur = 15;
    ctx.lineWidth = 3;
    ctx.globalAlpha = pulse * 0.4;
    ctx.beginPath();
    ctx.moveTo(frontX, frontY);
    ctx.lineTo(targetX, targetY);
    ctx.stroke();
    
    // Draw particles along the beam
    for (let i = 0; i < 5; i++) {
        const t = (Date.now() / 50 + i * 0.2) % 1;
        const x = frontX + (targetX - frontX) * t;
        const y = frontY + (targetY - frontY) * t;
        
        ctx.fillStyle = '#00ffff';
        ctx.shadowBlur = 8;
        ctx.shadowColor = '#00ffff';
        ctx.globalAlpha = 0.8;
        ctx.beginPath();
        ctx.arc(x, y, 2, 0, Math.PI * 2);
        ctx.fill();
    }
    
    ctx.restore();
    }
}

function drawAsteroids() {
    if (useWebGL && spriteRenderer) {
        // WebGL rendering - draw asteroids using sprite
        spriteRenderer.begin();
        
        asteroids.forEach(asteroid => {
            const asteroidTexture = textures.asteroid || null;
            if (!asteroidTexture) return; // Skip drawing if texture not loaded
            
            const asteroidColor = new Float32Array([1, 1, 1, 1]); // White to show texture properly
            
            spriteRenderer.drawSprite(
                asteroidTexture,
                asteroid.x, asteroid.y,
                asteroid.width, asteroid.height,
                asteroid.rotation, // Use asteroid's rotation
                asteroidColor,
                0.5, 0.5 // Center origin
            );
        });
        
        spriteRenderer.end();
    } else if (ctx) {
        // Canvas 2D fallback
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
        
            ctx.globalAlpha = 1.0; // Reset alpha
        ctx.restore();
    });
    }
}

function drawPowerups() {
    if (useWebGL && spriteRenderer && circleRenderer) {
        // WebGL rendering
        spriteRenderer.begin();
        circleRenderer.begin();
        
        powerups.forEach(powerup => {
            // Use token texture if available - only draw if texture is loaded
            const tokenTexture = textures.token || null;
            if (!tokenTexture) return; // Skip drawing if texture not loaded
            
            const pulseSize = powerup.width / 2 * (1 + Math.sin(powerup.pulse) * 0.3);
            
            // Glimmer effect: brightness pulse
            const glimmer = Math.sin(powerup.pulse * 2) * 0.3 + 0.7; // 0.4 to 1.0
            const tokenColor = new Float32Array([glimmer, glimmer, glimmer, 1]); // Brightness pulse
            
            // Draw outer glow (sparkle effect)
            const sparkleTime = powerup.pulse * 3;
            const sparkleAlpha = (Math.sin(sparkleTime) * 0.5 + 0.5) * 0.4;
            const sparkleColor = new Float32Array([1, 1, 1, sparkleAlpha]);
            
            // Draw sparkles around token
            for (let i = 0; i < 8; i++) {
                const angle = (i / 8) * Math.PI * 2 + powerup.rotation * 2;
                const dist = powerup.width * 0.7;
                const sparkleX = powerup.x + Math.cos(angle) * dist;
                const sparkleY = powerup.y + Math.sin(angle) * dist;
                const sparkleSize = (Math.sin(sparkleTime + i) * 0.5 + 0.5) * 3;
                circleRenderer.drawCircle(sparkleX, sparkleY, sparkleSize, sparkleColor);
            }
            
            // Draw token sprite with pulsing and glimmer effect
            spriteRenderer.drawSprite(
                tokenTexture,
                powerup.x, powerup.y,
                powerup.width + pulseSize, powerup.width + pulseSize, // Pulsing size
                powerup.rotation,
                tokenColor,
                0.5, 0.5
            );
            
            // Draw rotating shine/glint effect (bright highlight)
            const shineAngle = powerup.rotation * 2 + powerup.pulse;
            const shineX = powerup.x + Math.cos(shineAngle) * (powerup.width * 0.3);
            const shineY = powerup.y + Math.sin(shineAngle) * (powerup.width * 0.3);
            const shineSize = powerup.width * 0.4;
            const shineAlpha = (Math.sin(powerup.pulse * 4) * 0.5 + 0.5) * 0.6;
            const shineColor = new Float32Array([1, 1, 1, shineAlpha]);
            circleRenderer.drawCircle(shineX, shineY, shineSize, shineColor);
        });
        
        circleRenderer.end();
        spriteRenderer.end();
    } else if (ctx) {
        // Canvas 2D fallback
    powerups.forEach(powerup => {
        ctx.save();
        ctx.translate(powerup.x, powerup.y);
        ctx.rotate(powerup.rotation);
        
        const pulseSize = powerup.width / 2 * (1 + Math.sin(powerup.pulse) * 0.3);
        
            // Glimmer effect: brightness pulse
            const glimmer = Math.sin(powerup.pulse * 2) * 0.3 + 0.7; // 0.4 to 1.0
            ctx.globalAlpha = glimmer;
            
            // Draw sparkles around token
            const sparkleTime = powerup.pulse * 3;
            for (let i = 0; i < 8; i++) {
                const angle = (i / 8) * Math.PI * 2 + powerup.rotation * 2;
                const dist = powerup.width * 0.7;
                const sparkleX = Math.cos(angle) * dist;
                const sparkleY = Math.sin(angle) * dist;
                const sparkleSize = (Math.sin(sparkleTime + i) * 0.5 + 0.5) * 3;
                const sparkleAlpha = (Math.sin(sparkleTime) * 0.5 + 0.5) * 0.4;
                
                ctx.fillStyle = `rgba(255, 255, 255, ${sparkleAlpha})`;
                ctx.shadowBlur = 5;
                ctx.shadowColor = 'rgba(255, 255, 255, 0.8)';
                ctx.beginPath();
                ctx.arc(sparkleX, sparkleY, sparkleSize, 0, Math.PI * 2);
                ctx.fill();
            }
            
            // Draw rotating shine/glint effect (bright highlight)
            const shineAngle = powerup.rotation * 2 + powerup.pulse;
            const shineX = Math.cos(shineAngle) * (powerup.width * 0.3);
            const shineY = Math.sin(shineAngle) * (powerup.width * 0.3);
            const shineSize = powerup.width * 0.4;
            const shineAlpha = (Math.sin(powerup.pulse * 4) * 0.5 + 0.5) * 0.6;
            
            ctx.fillStyle = `rgba(255, 255, 255, ${shineAlpha})`;
            ctx.shadowBlur = 10;
            ctx.shadowColor = 'rgba(255, 255, 255, 0.8)';
            ctx.beginPath();
            ctx.arc(shineX, shineY, shineSize, 0, Math.PI * 2);
            ctx.fill();
            
            // Draw token image if loaded
            if (tokenImageLoaded && tokenImage) {
                ctx.shadowBlur = 20;
                ctx.shadowColor = '#ff66ff';
                ctx.drawImage(
                    tokenImage,
                    -(powerup.width + pulseSize) / 2,
                    -(powerup.width + pulseSize) / 2,
                    powerup.width + pulseSize,
                    powerup.width + pulseSize
                );
            } else {
                // Fallback drawn shape
                const color = '#ff00ff';
                const glowColor = '#ff66ff';
                
        ctx.shadowBlur = 20;
        ctx.shadowColor = glowColor;
        
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
        
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(0, 0, powerup.width / 2, 0, Math.PI * 2);
        ctx.fill();
        
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
            }
        
        ctx.restore();
    });
    }
}

function drawAllies() {
    if (useWebGL && spriteRenderer) {
        // WebGL rendering
        spriteRenderer.begin();
        
        // Draw local allies
        allies.forEach(ally => {
            // Draw ally ship using sprite - only if texture is loaded
            const allyTexture = textures.ally || null;
            if (!allyTexture) return; // Skip drawing if texture not loaded
            
            const allyColor = new Float32Array([1, 1, 1, 1]); // White to show texture properly
            
            spriteRenderer.drawSprite(
                allyTexture,
                ally.x, ally.y,
                ally.width, ally.height,
                ally.rotation + Math.PI, // Same rotation offset as player ship
                allyColor,
                0.5, 0.5
            );
        });
        
        // Draw remote allies
        remoteAllies.forEach((remoteAlliesList, playerId) => {
            remoteAlliesList.forEach(ally => {
                const allyTexture = textures.ally || null;
                if (!allyTexture) return;
                
                const allyColor = new Float32Array([1, 1, 1, 1]);
                
                spriteRenderer.drawSprite(
                    allyTexture,
                    ally.x, ally.y,
                    ally.width, ally.height,
                    (ally.rotation || 0) + Math.PI,
                    allyColor,
                    0.5, 0.5
                );
            });
        });
        
        spriteRenderer.end();
    } else if (ctx) {
        // Canvas 2D fallback
        // Draw local allies
    allies.forEach(ally => {
        ctx.save();
        ctx.translate(ally.x, ally.y);
            ctx.rotate(ally.rotation);
            
            // Draw ally ship image if loaded
            if (allyShipImageLoaded && allyShipImage) {
                ctx.drawImage(
                    allyShipImage,
                    -ally.width / 2,
                    -ally.height / 2,
                    ally.width,
                    ally.height
                );
            } else {
                // Fallback drawn shape
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#00ff00';
        
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
            }
        
        ctx.restore();
    });
    }
}

function drawParticles() {
    if (useWebGL && particleRenderer) {
        // WebGL particle rendering (GPU-accelerated)
        particleRenderer.updateParticles(particles);
        particleRenderer.render();
    } else if (ctx) {
        // Canvas 2D fallback
    ctx.save();
    
    for (let i = 0; i < particles.length; i++) {
        const particle = particles[i];
        const alpha = particle.life / particle.maxLife;
        
        // Skip very transparent particles
        if (alpha < 0.1) continue;
        
        // Only set shadow if needed (expensive operation) - reduced blur for performance
        if (particle.glow && alpha > 0.4) {
                ctx.shadowBlur = particle.size * 1.5 * alpha;
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
}

// Mission Mode Functions
function initMissionMode() {
    if (!canvas) return;
    
    // Create start planet (left side) - moved in 10% from edge
    const canvasWidth = getCanvasWidth();
    const offsetFromEdge = canvasWidth * 0.1; // 10% of canvas width
    startPlanet = {
        x: 50 + offsetFromEdge,
        y: getCanvasHeight() / 2,
        radius: 80,  // Doubled from 40
        color: '#4a90e2'
    };
    
    // Create end planet (right side) - moved in 10% from edge
    endPlanet = {
        x: canvasWidth - 50 - offsetFromEdge,
        y: getCanvasHeight() / 2,
        radius: 80,  // Doubled from 40
        color: '#e24a4a'
    };
    
    // Calculate distance between planets
    const distance = Math.hypot(endPlanet.x - startPlanet.x, endPlanet.y - startPlanet.y);
    
    // Fixed journey time in seconds (30 seconds base)
    const baseJourneyTimeSeconds = 30;
    const baseJourneyTimeFrames = baseJourneyTimeSeconds * 60; // 60 fps
    
    // Create cargo vessel with calculated speed for fixed journey time
    cargoVessel = {
        x: startPlanet.x + 80, // Start slightly to the right of start planet (adjusted for larger planet)
        y: startPlanet.y,
        width: 60,
        height: 40,
        speed: 0, // Will be calculated based on fixed journey time
        health: 200,
        maxHealth: 200,
        progress: 0,
        targetX: endPlanet.x - 80, // Target slightly to the left of end planet (adjusted for larger planet)
        targetY: endPlanet.y,
        direction: 1, // 1 = going right, -1 = going left
        journeyComplete: false,
        journeyTime: 0,
        maxJourneyTime: baseJourneyTimeFrames, // Fixed journey time in frames
        distance: distance - 160 // Distance to travel (minus planet radii, adjusted for larger planets)
    };
    
    // Calculate base speed to complete journey in fixed time
    // Speed = distance / time (in pixels per frame)
    cargoVessel.baseSpeed = cargoVessel.distance / baseJourneyTimeFrames;
    cargoVessel.speed = cargoVessel.baseSpeed;
}

function updateCargoVessel() {
    if (!cargoVessel || gameState.gameMode !== 'mission') return;
    
    // In multiplayer, only host updates cargo vessel
    if (multiplayerMode && networkManager && !networkManager.isHostPlayer()) {
        return;
    }
    
    // Apply navigation crew effect - reduces journey time proportionally
    // More crew = faster journey (reduced journey time, not increased speed)
    const navigationCrewCount = cargoCrewAllocation.navigation.length;
    const journeyTimeReduction = navigationCrewCount * 0.1; // 10% time reduction per crew
    const effectiveJourneyTime = cargoVessel.maxJourneyTime * (1 - journeyTimeReduction);
    
    // Recalculate speed based on effective journey time
    // Speed = distance / time (in pixels per frame)
    cargoVessel.speed = cargoVessel.distance / effectiveJourneyTime;
    
    // Move cargo vessel towards destination
    const dx = cargoVessel.targetX - cargoVessel.x;
    const dy = cargoVessel.targetY - cargoVessel.y;
    const distance = Math.hypot(dx, dy);
    
    if (distance > 5) {
        // Move towards target
        cargoVessel.x += (dx / distance) * cargoVessel.speed;
        cargoVessel.y += (dy / distance) * cargoVessel.speed;
        
        // Update journey time
        cargoVessel.journeyTime++;
    } else {
        // Reached destination - reverse direction
        cargoVessel.direction *= -1;
        if (cargoVessel.direction === 1) {
            // Going right (towards end planet)
            cargoVessel.targetX = endPlanet.x - 80;
            cargoVessel.targetY = endPlanet.y;
            cargoVessel.x = startPlanet.x + 80;
            cargoVessel.y = startPlanet.y;
        } else {
            // Going left (towards start planet)
            cargoVessel.targetX = startPlanet.x + 80;
            cargoVessel.targetY = startPlanet.y;
            cargoVessel.x = endPlanet.x - 80;
            cargoVessel.y = endPlanet.y;
        }
        cargoVessel.journeyComplete = true;
        cargoVessel.journeyTime = 0; // Reset journey time
    }
    
    // Update progress based on journey time
    cargoVessel.progress = Math.min(100, (cargoVessel.journeyTime / effectiveJourneyTime) * 100);
    
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
    
    // Add smoke particles when damaged (in update, not draw)
    const cargoHealthPercent = cargoVessel.health / cargoVessel.maxHealth;
    if (cargoHealthPercent < 0.7 && Math.random() < 0.3) {
        const smokeX = cargoVessel.x + (Math.random() - 0.5) * cargoVessel.width * 0.8;
        const smokeY = cargoVessel.y + (Math.random() - 0.5) * cargoVessel.height * 0.8;
        particles.push({
            x: smokeX,
            y: smokeY,
            vx: (Math.random() - 0.5) * 0.5,
            vy: (Math.random() - 0.5) * 0.5,
            life: 30,
            maxLife: 30,
            size: 4 + Math.random() * 3,
            color: `hsl(0, 0%, ${30 + Math.random() * 20}%)`, // Gray smoke
            glow: false
        });
    }
}

function drawCargoVessel() {
    if (!cargoVessel || gameState.gameMode !== 'mission') return;
    
    if (useWebGL && spriteRenderer) {
        // WebGL rendering
        spriteRenderer.begin();
        
        // Health bar
        const healthPercent = cargoVessel.health / cargoVessel.maxHealth;
        const barY = cargoVessel.y - cargoVessel.height / 2 - 15;
        
        spriteRenderer.drawRect(
            cargoVessel.x - cargoVessel.width / 2 - 5, barY,
            cargoVessel.width + 10, 8,
            new Float32Array([0, 0, 0, 0.5])
        );
        
        spriteRenderer.drawRect(
            cargoVessel.x - cargoVessel.width / 2 - 3, barY + 2,
            cargoVessel.width + 6, 4,
            new Float32Array([1, 0, 0, 1])
        );
        
        spriteRenderer.drawRect(
            cargoVessel.x - cargoVessel.width / 2 - 3, barY + 2,
            (cargoVessel.width + 6) * healthPercent, 4,
            new Float32Array([0, 1, 0, 1])
        );
        
        // Calculate rotation based on direction
        // Cargo ship should face the direction it's traveling
        // Same rotation offset as player ship (180 degrees)
        let baseRotation = cargoVessel.direction === 1 ? Math.PI / 2 : -Math.PI / 2;
        const rotation = baseRotation + Math.PI; // Add 180 degrees to fix orientation
        
        // Draw cargo ship with damage effects
        const cargoTexture = textures.cargoShip || null;
        const cargoColor = new Float32Array([0.55, 0.45, 0.33, 1]); // Brown
        const cargoHealthPercent = cargoVessel.health / cargoVessel.maxHealth;
        
        // Damage effect: darken ship color based on health
        const cargoDamageFactor = 1.0 - (1.0 - cargoHealthPercent) * 0.5; // Darken up to 50% when heavily damaged
        const finalCargoColor = cargoTexture
            ? new Float32Array([cargoDamageFactor, cargoDamageFactor, cargoDamageFactor, 1.0])
            : new Float32Array([
                cargoColor[0] * cargoDamageFactor,
                cargoColor[1] * cargoDamageFactor,
                cargoColor[2] * cargoDamageFactor,
                cargoColor[3]
            ]);
        
        spriteRenderer.drawSprite(
            cargoTexture,
            cargoVessel.x, cargoVessel.y,
            cargoVessel.width, cargoVessel.height,
            rotation,
            finalCargoColor,
            0.5, 0.5
        );
        
        spriteRenderer.end();
    } else if (ctx) {
        // Canvas 2D fallback
    ctx.save();
    ctx.translate(cargoVessel.x, cargoVessel.y);
    
    const healthPercent = cargoVessel.health / cargoVessel.maxHealth;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(-cargoVessel.width / 2 - 5, -cargoVessel.height / 2 - 15, cargoVessel.width + 10, 8);
    ctx.fillStyle = 'red';
    ctx.fillRect(-cargoVessel.width / 2 - 3, -cargoVessel.height / 2 - 13, cargoVessel.width + 6, 4);
    ctx.fillStyle = 'green';
    ctx.fillRect(-cargoVessel.width / 2 - 3, -cargoVessel.height / 2 - 13, (cargoVessel.width + 6) * healthPercent, 4);
    
    if (cargoVessel.direction === 1) {
            ctx.rotate(Math.PI / 2);
    } else {
            ctx.rotate(-Math.PI / 2);
    }
    
    if (cargoShipImageLoaded && cargoShipImage) {
        ctx.drawImage(
            cargoShipImage,
                -cargoVessel.width / 2,
                -cargoVessel.height / 2,
                cargoVessel.width,
                cargoVessel.height
        );
    } else {
    ctx.fillStyle = '#8b7355';
    ctx.fillRect(-cargoVessel.width / 2, -cargoVessel.height / 2, cargoVessel.width, cargoVessel.height);
    ctx.fillStyle = '#6b5b45';
    ctx.fillRect(-cargoVessel.width / 2 + 5, -cargoVessel.height / 2 + 5, cargoVessel.width - 10, cargoVessel.height - 10);
    ctx.fillStyle = '#4a90e2';
    ctx.fillRect(-cargoVessel.width / 2 + 10, -5, 8, 8);
    ctx.fillRect(cargoVessel.width / 2 - 18, -5, 8, 8);
    }
    
    ctx.restore();
    }
}

// Mission 1: Alien Transmission and Enemy Elimination
let mission1VideoElement = null;
let mission1VideoOverlay = null;

function checkMission1Trigger() {
    // Check if score reached 350 and video hasn't been shown
    if (gameState.score >= 350 && !gameState.mission1VideoShown && !gameState.mission1Active && !gameState.mission1Completed) {
        gameState.mission1VideoShown = true;
        playMission1Video();
    }
}

function playMission1Video() {
    // Pause the game
    gameState.paused = true;
    
    // Create video overlay (non-clickable, non-skippable)
    mission1VideoOverlay = document.createElement('div');
    mission1VideoOverlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.95);
        z-index: 10000;
        display: flex;
        justify-content: center;
        align-items: center;
        pointer-events: auto;
    `;
    
    // Prevent clicks from closing video
    mission1VideoOverlay.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
    });
    mission1VideoOverlay.addEventListener('contextmenu', (e) => {
        e.preventDefault();
    });
    
    // Create video element
    mission1VideoElement = document.createElement('video');
    // Use simple relative path like other assets (background.png, ship.png, etc.)
    mission1VideoElement.src = 'mission1.mp4';
    mission1VideoElement.style.cssText = `
        max-width: 90%;
        max-height: 90%;
        pointer-events: none;
    `;
    mission1VideoElement.controls = false;
    mission1VideoElement.playsInline = true; // Important for mobile
    mission1VideoElement.muted = false;
    mission1VideoElement.preload = 'auto';
    
    // Prevent video from being skipped
    mission1VideoElement.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
    });
    
    let videoPlayed = false;
    let errorHandled = false;
    
    // When video ends, start mission
    mission1VideoElement.addEventListener('ended', () => {
        console.log('[VIDEO] Ended');
        if (!videoPlayed) return; // Prevent multiple calls
        videoPlayed = true;
        startMission1();
    });
    
    // Handle video errors - try alternative formats
    const handleError = (attempt = 1) => {
        if (errorHandled) return;
        const error = mission1VideoElement.error;
        console.error(`[VIDEO] Error loading video (attempt ${attempt}):`, {
            code: error?.code,
            message: error?.message,
            networkState: mission1VideoElement.networkState,
            readyState: mission1VideoElement.readyState,
            src: mission1VideoElement.src
        });
        
        if (attempt === 1) {
            // Try .mov as fallback
            console.log('[VIDEO] Trying .mov format as fallback');
            errorHandled = true;
            mission1VideoElement.src = 'mission1.mov';
            mission1VideoElement.load();
            mission1VideoElement.addEventListener('error', () => handleError(2), { once: true });
        } else {
            // Both formats failed, start mission anyway
            console.warn('[VIDEO] Failed to load video in any format, starting mission anyway');
            errorHandled = true;
            startMission1();
        }
    };
    
    mission1VideoElement.addEventListener('error', () => handleError(1), { once: true });
    
    // Wait for video to be ready before playing
    const tryPlay = () => {
        console.log('[VIDEO] Attempting to play video');
        mission1VideoElement.play().then(() => {
            console.log('[VIDEO] Playback started successfully');
            videoPlayed = true;
        }).catch(err => {
            console.warn('[VIDEO] Failed to play video:', err);
            // Try again after a short delay
            setTimeout(() => {
                mission1VideoElement.play().then(() => {
                    console.log('[VIDEO] Playback started on retry');
                    videoPlayed = true;
                }).catch(err2 => {
                    console.warn('[VIDEO] Failed to play video on retry:', err2);
                    // If autoplay fails, start mission anyway
                    if (!videoPlayed) {
                        startMission1();
                    }
                });
            }, 500);
        });
    };
    
    // Try to play when video can play through
    mission1VideoElement.addEventListener('canplaythrough', tryPlay, { once: true });
    
    // Also try when data is loaded (fallback)
    mission1VideoElement.addEventListener('loadeddata', () => {
        if (mission1VideoElement.readyState >= 3) {
            tryPlay();
        }
    }, { once: true });
    
    mission1VideoOverlay.appendChild(mission1VideoElement);
    document.body.appendChild(mission1VideoOverlay);
    
    // Load the video
    console.log('[VIDEO] Loading video from:', mission1VideoElement.src);
    mission1VideoElement.load();
}

function startMission1() {
    // Remove video overlay
    if (mission1VideoOverlay) {
        mission1VideoOverlay.remove();
        mission1VideoOverlay = null;
    }
    mission1VideoElement = null;
    
    // Initialize mission state
    gameState.mission1Active = true;
    gameState.mission1Kills = 0;
    gameState.mission1StartTime = Date.now();
    
    // Spawn 7 enemies around cargo ship
    spawnMission1Enemies();
    
    // Resume game
    gameState.paused = false;
    
    // Show mission UI
    showMission1UI();
}

function spawnMission1Enemies() {
    // Clear all existing enemies first
    enemies = [];
    
    // Get cargo ship position (use center of canvas if cargo ship doesn't exist)
    let centerX, centerY;
    if (cargoVessel) {
        centerX = cargoVessel.x;
        centerY = cargoVessel.y;
    } else {
        centerX = getCanvasWidth() / 2;
        centerY = getCanvasHeight() / 2;
    }
    
    const spawnRadius = 200; // Distance from cargo ship
    const angleStep = (Math.PI * 2) / 7; // 7 enemies evenly spaced
    
    // Spawn exactly 7 enemies
    for (let i = 0; i < 7; i++) {
        const angle = i * angleStep;
        const x = centerX + Math.cos(angle) * spawnRadius;
        const y = centerY + Math.sin(angle) * spawnRadius;
        
        // Spawn enemy at this position
        const creditDifficulty = cumulativeCredits / 100;
        const difficulty = creditDifficulty * 0.05;
        const hue = getRandom() * 60;
        
        enemies.push({
            id: 'mission1_enemy_' + i + '_' + Date.now(),
            x: x,
            y: y,
            width: 30 + getRandom() * 20,
            height: 30 + getRandom() * 20,
            vx: (getRandom() - 0.5) * 0.5,
            vy: (getRandom() - 0.5) * 0.5,
            health: 20 + creditDifficulty * 8,
            maxHealth: 20 + creditDifficulty * 8,
            color: `hsl(${hue}, 70%, 50%)`,
            glowColor: `hsl(${hue}, 100%, 60%)`,
            shootCooldown: Math.max(40, 150 - creditDifficulty * 2),
            damage: 6 + creditDifficulty * 1.5,
            rotation: 0,
            targetRotation: 0,
            lastNebulaDamageTime: 0,
            pursuitSpeed: 0.4 + difficulty * 0.3,
            targetType: null,
            targetSwitchCooldown: 0,
            circleDirection: getRandom() < 0.5 ? 1 : -1
        });
    }
}

function updateMission1() {
    if (!gameState.mission1Active) return;
    
    const elapsed = Date.now() - gameState.mission1StartTime;
    
    // Check if time limit exceeded
    if (elapsed >= gameState.mission1TimeLimit) {
        failMission1();
    }
    
    // Update mission UI
    updateMission1UI();
}

function completeMission1() {
    if (!gameState.mission1Active || gameState.mission1Completed) return;
    
    gameState.mission1Active = false;
    gameState.mission1Completed = true;
    
    // Show success message
    showMission1Complete();
    
    // Hide mission UI after delay
    setTimeout(() => {
        hideMission1UI();
    }, 5000);
}

function failMission1() {
    if (!gameState.mission1Active || gameState.mission1Completed) return;
    
    gameState.mission1Active = false;
    
    // Show failure message
    showMission1Failed();
    
    // Hide mission UI after delay
    setTimeout(() => {
        hideMission1UI();
    }, 5000);
}

function showMission1UI() {
    let missionUI = document.getElementById('mission1UI');
    if (!missionUI) {
        missionUI = document.createElement('div');
        missionUI.id = 'mission1UI';
        missionUI.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(0, 0, 0, 0.8);
            border: 2px solid #ffaa00;
            border-radius: 10px;
            padding: 15px 25px;
            color: #ffaa00;
            font-family: 'Courier New', monospace;
            font-size: 18px;
            z-index: 1000;
            text-align: center;
        `;
        document.body.appendChild(missionUI);
    }
    missionUI.style.display = 'block';
    updateMission1UI();
}

function updateMission1UI() {
    const missionUI = document.getElementById('mission1UI');
    if (!missionUI || !gameState.mission1Active) return;
    
    // Ensure startTime is set (fix NaN issue)
    if (!gameState.mission1StartTime) {
        gameState.mission1StartTime = Date.now();
    }
    
    const elapsed = Date.now() - gameState.mission1StartTime;
    const remaining = Math.max(0, gameState.mission1TimeLimit - elapsed);
    const minutes = Math.floor(remaining / 60000);
    const seconds = Math.floor((remaining % 60000) / 1000);
    
    missionUI.innerHTML = `
        <div style="font-weight: bold; margin-bottom: 5px;">MISSION: ELIMINATE ALIEN THREAT</div>
        <div>Kills: ${gameState.mission1Kills || 0}/5</div>
        <div>Time: ${minutes}:${seconds.toString().padStart(2, '0')}</div>
    `;
}

function hideMission1UI() {
    const missionUI = document.getElementById('mission1UI');
    if (missionUI) {
        missionUI.style.display = 'none';
    }
}

function showMission1Complete() {
    const message = document.createElement('div');
    message.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: rgba(0, 0, 0, 0.9);
        border: 3px solid #00ff00;
        border-radius: 15px;
        padding: 30px 50px;
        color: #00ff00;
        font-family: 'Courier New', monospace;
        font-size: 24px;
        z-index: 10001;
        text-align: center;
    `;
    message.textContent = 'MISSION COMPLETE!';
    document.body.appendChild(message);
    
    setTimeout(() => {
        message.remove();
    }, 5000);
}

function showMission1Failed() {
    const message = document.createElement('div');
    message.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: rgba(0, 0, 0, 0.9);
        border: 3px solid #ff0000;
        border-radius: 15px;
        padding: 30px 50px;
        color: #ff0000;
        font-family: 'Courier New', monospace;
        font-size: 24px;
        z-index: 10001;
        text-align: center;
    `;
    message.textContent = 'MISSION FAILED - TIME EXPIRED';
    document.body.appendChild(message);
    
    setTimeout(() => {
        message.remove();
    }, 5000);
}

function drawPlanets() {
    if (gameState.gameMode !== 'mission') return;
    
    if (useWebGL && spriteRenderer) {
        // WebGL rendering
        spriteRenderer.begin();
        
        // Draw start planet
        if (startPlanet) {
            const size = startPlanet.radius * 2;
            const planetTexture = textures.planet1 || null;
            const planetColor = ColorUtils.parseColor(startPlanet.color);
            spriteRenderer.drawSprite(
                planetTexture,
                startPlanet.x, startPlanet.y,
                size, size,
                0,
                planetTexture ? null : planetColor,
                0.5, 0.5
            );
        }
        
        // Draw end planet
        if (endPlanet) {
            const size = endPlanet.radius * 2;
            const planetTexture = textures.planet2 || null;
            const planetColor = ColorUtils.parseColor(endPlanet.color);
            spriteRenderer.drawSprite(
                planetTexture,
                endPlanet.x, endPlanet.y,
                size, size,
                0,
                planetTexture ? null : planetColor,
                0.5, 0.5
            );
        }
        
        spriteRenderer.end();
    } else if (ctx) {
        // Canvas 2D fallback
    if (startPlanet) {
        ctx.save();
        ctx.translate(startPlanet.x, startPlanet.y);
        
        if (planet1ImageLoaded && planet1Image) {
            const size = startPlanet.radius * 2;
                ctx.drawImage(planet1Image, -startPlanet.radius, -startPlanet.radius, size, size);
        } else {
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
        }
        
        ctx.restore();
    }
    
    if (endPlanet) {
        ctx.save();
        ctx.translate(endPlanet.x, endPlanet.y);
        
        if (planet2ImageLoaded && planet2Image) {
            const size = endPlanet.radius * 2;
                ctx.drawImage(planet2Image, -endPlanet.radius, -endPlanet.radius, size, size);
        } else {
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
        }
        
        ctx.restore();
        }
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
    
    // Handle episode end for training (when autopilot is on)
    if (autopilotEnabled && rlAgent instanceof PPOAgent) {
        handleEpisodeEnd();
    }
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
    // Don't pause the game in multiplayer - it should continue running for both players
    if (!multiplayerMode || !networkManager || !networkManager.isConnected()) {
    gameState.paused = true;
    }
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

// Get combined crew allocation counts (local + all remote players)
function getCombinedCargoCrewAllocation() {
    let combined = {
        engineering: cargoCrewAllocation.engineering.length,
        navigation: cargoCrewAllocation.navigation.length
    };
    
    // Add remote players' crew allocations
    if (multiplayerMode && networkManager) {
        remoteCrewAllocations.forEach((allocation, playerId) => {
            if (allocation.engineering) {
                combined.engineering += allocation.engineering;
            }
            if (allocation.navigation) {
                combined.navigation += allocation.navigation;
            }
        });
    }
    
    return combined;
}

function updateCommandModuleUI() {
    document.getElementById('totalCrew').textContent = totalCrew;
    // Update currency in both tabs
    const currencyCrewEl = document.getElementById('currencyCrew');
    const currencyStoreEl = document.getElementById('currencyStore');
    if (currencyCrewEl) currencyCrewEl.textContent = currency;
    if (currencyStoreEl) currencyStoreEl.textContent = currency;
    const recruitBtn = document.getElementById('recruitCrewBtn');
    if (recruitBtn) {
        const cost = getCrewCost();
        recruitBtn.disabled = currency < cost;
        recruitBtn.textContent = `Recruit Crew (${cost} credits)`;
    }
    // Update store items
    const buyMissileBtn = document.getElementById('buyMissileBtn');
    if (buyMissileBtn) {
        buyMissileBtn.disabled = currency < 200;
    }
    
    const buyLaserBtn = document.getElementById('buyLaserBtn');
    if (buyLaserBtn) {
        buyLaserBtn.disabled = currency < 300;
    }
    
    // Update cargo ship store item (only in mission mode)
    const cargoShipStoreItem = document.getElementById('cargoShipStoreItem');
    if (cargoShipStoreItem) {
        cargoShipStoreItem.style.display = gameState.gameMode === 'mission' ? 'block' : 'none';
    }
    
    const cargoShipCountEl = document.getElementById('cargoShipCount');
    if (cargoShipCountEl) {
        cargoShipCountEl.textContent = cargoShipCount;
    }
    
    const cargoShipPriceEl = document.getElementById('cargoShipPrice');
    if (cargoShipPriceEl) {
        cargoShipPriceEl.textContent = cargoShipPrice;
    }
    
    const buyCargoShipBtn = document.getElementById('buyCargoShipBtn');
    if (buyCargoShipBtn) {
        buyCargoShipBtn.disabled = currency < cargoShipPrice;
    }
    
    // Update Nebuclear device
    const nebuclearStoreItem = document.getElementById('nebuclearStoreItem');
    if (nebuclearStoreItem) {
        nebuclearStoreItem.style.display = hasNebuclear ? 'none' : 'block'; // Hide if already purchased
    }
    
    const buyNebuclearBtn = document.getElementById('buyNebuclearBtn');
    if (buyNebuclearBtn) {
        buyNebuclearBtn.disabled = currency < 400 || hasNebuclear;
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
                crewEl.draggable = true;
                crewEl.dataset.crewId = crew.id;
                crewEl.dataset.station = station;
                crewEl.dataset.ship = 'player';
                
                // Use crew.png or crew1.png image if loaded, otherwise fall back to text
                // Alternate between crew.png (even IDs) and crew1.png (odd IDs)
                const useCrew1 = crew.id % 2 === 1;
                const imageToUse = useCrew1 ? (crew1ImageLoaded && crew1Image ? 'crew1.png' : null) : (crewImageLoaded && crewImage ? 'crew.png' : null);
                
                if (imageToUse) {
                    const img = document.createElement('img');
                    img.src = imageToUse;
                    img.style.width = '100%';
                    img.style.height = '100%';
                    img.style.objectFit = 'contain';
                    crewEl.appendChild(img);
                } else {
                    crewEl.textContent = crew.id + 1;
                }
                
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
            crewEl.draggable = true;
            crewEl.dataset.crewId = crew.id;
            crewEl.dataset.ship = 'player';
            
            // Use crew.png image if loaded, otherwise fall back to text
            if (crewImageLoaded && crewImage) {
                const img = document.createElement('img');
                img.src = 'crew.png';
                img.style.width = '100%';
                img.style.height = '100%';
                img.style.objectFit = 'contain';
                crewEl.appendChild(img);
            } else {
                crewEl.textContent = crew.id + 1;
            }
            
            crewEl.addEventListener('dragstart', (e) => startCrewDrag(e, crew.id, null, 'player'));
            // Add touch support for mobile
            crewEl.addEventListener('touchstart', (e) => startCrewTouchDrag(e, crew.id, null, 'player'), { passive: false });
            crewEl.addEventListener('touchend', handleCrewTouchEnd, { passive: false });
            pool.appendChild(crewEl);
        });
    }
    
    // Update cargo ship crew displays (only in mission mode)
    if (gameState.gameMode === 'mission') {
        // Get combined crew counts (local + remote players)
        const combinedCrew = getCombinedCargoCrewAllocation();
        
        // Update cargo engineering station
        const cargoEngineeringCount = combinedCrew.engineering;
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
                crewEl.draggable = true;
                crewEl.dataset.crewId = crew.id;
                crewEl.dataset.station = 'engineering';
                crewEl.dataset.ship = 'cargo';
                
                // Use crew.png or crew1.png image if loaded, otherwise fall back to text
                // Alternate between crew.png (even IDs) and crew1.png (odd IDs)
                const useCrew1 = crew.id % 2 === 1;
                const imageToUse = useCrew1 ? (crew1ImageLoaded && crew1Image ? 'crew1.png' : null) : (crewImageLoaded && crewImage ? 'crew.png' : null);
                
                if (imageToUse) {
                    const img = document.createElement('img');
                    img.src = imageToUse;
                    img.style.width = '100%';
                    img.style.height = '100%';
                    img.style.objectFit = 'contain';
                    crewEl.appendChild(img);
                } else {
                    crewEl.textContent = crew.id + 1;
                }
                
                crewEl.addEventListener('dragstart', (e) => startCrewDrag(e, crew.id, 'engineering', 'cargo'));
                // Add touch support for mobile
                crewEl.addEventListener('touchstart', (e) => startCrewTouchDrag(e, crew.id, 'engineering', 'cargo'), { passive: false });
                crewEl.addEventListener('touchend', handleCrewTouchEnd, { passive: false });
                cargoEngineeringSlots.appendChild(crewEl);
            });
        }
        
        // Update cargo navigation station
        const cargoNavigationCount = combinedCrew.navigation;
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
                crewEl.draggable = true;
                crewEl.dataset.crewId = crew.id;
                crewEl.dataset.station = 'navigation';
                crewEl.dataset.ship = 'cargo';
                
                // Use crew.png or crew1.png image if loaded, otherwise fall back to text
                // Alternate between crew.png (even IDs) and crew1.png (odd IDs)
                const useCrew1 = crew.id % 2 === 1;
                const imageToUse = useCrew1 ? (crew1ImageLoaded && crew1Image ? 'crew1.png' : null) : (crewImageLoaded && crewImage ? 'crew.png' : null);
                
                if (imageToUse) {
                    const img = document.createElement('img');
                    img.src = imageToUse;
                    img.style.width = '100%';
                    img.style.height = '100%';
                    img.style.objectFit = 'contain';
                    crewEl.appendChild(img);
                } else {
                    crewEl.textContent = crew.id + 1;
                }
                
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
                crewEl.draggable = true;
                crewEl.dataset.crewId = crew.id;
                crewEl.dataset.ship = 'cargo';
                
                // Use crew.png or crew1.png image if loaded, otherwise fall back to text
                // Alternate between crew.png (even IDs) and crew1.png (odd IDs)
                const useCrew1 = crew.id % 2 === 1;
                const imageToUse = useCrew1 ? (crew1ImageLoaded && crew1Image ? 'crew1.png' : null) : (crewImageLoaded && crewImage ? 'crew.png' : null);
                
                if (imageToUse) {
                    const img = document.createElement('img');
                    img.src = imageToUse;
                    img.style.width = '100%';
                    img.style.height = '100%';
                    img.style.objectFit = 'contain';
                    crewEl.appendChild(img);
                } else {
                    crewEl.textContent = crew.id + 1;
                }
                
                crewEl.addEventListener('dragstart', (e) => startCrewDrag(e, crew.id, null, 'cargo'));
                // Add touch support for mobile
                crewEl.addEventListener('touchstart', (e) => startCrewTouchDrag(e, crew.id, null, 'cargo'), { passive: false });
                crewEl.addEventListener('touchend', handleCrewTouchEnd, { passive: false });
                cargoPool.appendChild(crewEl);
            });
        }
    }
}

// Store functions
function buyMissileAmmo() {
    if (currency >= 200) {
        currency -= 200;
        weapons.missile.ammo = Math.min(weapons.missile.maxAmmo, weapons.missile.ammo + 2);
        updateCommandModuleUI();
        updateUI();
    }
}

function buyLaserAmmo() {
    if (currency >= 300) {
        currency -= 300;
        weapons.laser.ammo = Math.min(weapons.laser.maxAmmo, weapons.laser.ammo + 1);
        updateCommandModuleUI();
        updateUI();
    }
}

function buyCargoShip() {
    if (currency >= cargoShipPrice && gameState.gameMode === 'mission') {
        currency -= cargoShipPrice;
        cargoShipCount++;
        // Calculate next price (2.5x the current price)
        cargoShipPrice = Math.floor(cargoShipPrice * 2.5);
        
        // Spawn new cargo vessel
        spawnCargoVessel();
        
        updateCommandModuleUI();
        updateUI();
    }
}

function buyNebuclear() {
    if (currency >= 400 && !hasNebuclear) {
        currency -= 400;
        hasNebuclear = true;
        updateCommandModuleUI();
        updateUI();
    }
}

function spawnCargoVessel() {
    // Create a new cargo vessel at the start planet
    if (!startPlanet || !endPlanet || !canvas) return;
    
    // Calculate distance between planets
    const distance = Math.hypot(endPlanet.x - startPlanet.x, endPlanet.y - startPlanet.y);
    
    // Fixed journey time in seconds (30 seconds base)
    const baseJourneyTimeSeconds = 30;
    const baseJourneyTimeFrames = baseJourneyTimeSeconds * 60; // 60 fps
    const travelDistance = distance - 160; // Distance to travel (minus planet radii, adjusted for larger planets)
    
    // Calculate base speed to complete journey in fixed time
    const baseSpeed = travelDistance / baseJourneyTimeFrames;
    
    cargoVessels.push({
        x: startPlanet.x + 80,
        y: startPlanet.y,
        width: 60,
        height: 60,
        health: 200,
        maxHealth: 200,
        speed: baseSpeed,
        baseSpeed: baseSpeed,
        targetX: endPlanet.x - 80,
        targetY: endPlanet.y,
        progress: 0,
        journeyTime: 0,
        maxJourneyTime: baseJourneyTimeFrames,
        distance: travelDistance,
        direction: 1,
        journeyComplete: false
    });
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
            const slotsEl = stationEl.querySelector('.crew-slots');
            stationEl.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                stationEl.classList.add('drag-over');
                if (slotsEl) slotsEl.classList.add('drag-over');
            });
            stationEl.addEventListener('dragleave', (e) => {
                stationEl.classList.remove('drag-over');
                if (slotsEl) slotsEl.classList.remove('drag-over');
            });
            stationEl.addEventListener('drop', (e) => {
                e.preventDefault();
                stationEl.classList.remove('drag-over');
                if (slotsEl) slotsEl.classList.remove('drag-over');
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
            
            // Trigger immediate network update for crew allocation change
            if (multiplayerMode && networkManager && networkManager.isConnected()) {
                // Force immediate update by sending player state
                networkManager.sendPlayerState({
                    x: player.x,
                    y: player.y,
                    rotation: player.rotation,
                    health: player.health,
                    maxHealth: player.maxHealth,
                    shields: player.shields,
                    maxShields: player.maxShields,
                    score: gameState.score,
                    cargoCrewAllocation: {
                        engineering: cargoCrewAllocation.engineering.length,
                        navigation: cargoCrewAllocation.navigation.length
                    }
                });
            }
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
    
    // Check for new high score
    if (gameState.score > highScore) {
        const wasNewHighScore = newHighScore;
        newHighScore = true;
        saveHighScore(gameState.score);
        
        // Show fireworks if this is the first time reaching this high score
        if (!wasNewHighScore) {
            createFireworks();
        }
    }
    
    // Update high score display
    const highScoreEl = document.getElementById('highScore');
    if (highScoreEl) {
        highScoreEl.textContent = highScore;
    }
    
    // Update final high score in game over screen
    const finalHighScoreEl = document.getElementById('finalHighScore');
    if (finalHighScoreEl) {
        finalHighScoreEl.textContent = highScore;
    }
    
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
    
    // Update tractor beam charge display (if element exists)
    const tractorBeamChargeEl = document.getElementById('tractorBeamCharge');
    if (tractorBeamChargeEl) {
        const chargePercent = (tractorBeam.charge / tractorBeam.maxCharge) * 100;
        tractorBeamChargeEl.style.width = chargePercent + '%';
        tractorBeamChargeEl.parentElement.title = `Tractor Beam: ${Math.ceil(tractorBeam.charge)}% (Press T)`;
    }
    
    // Update mobile weapon displays and button states
    updateMobileWeaponUI();
}

// Update mobile weapon button displays and states
function updateMobileWeaponUI() {
    // Update mobile weapon ammo displays
    const mobileMissileAmmo = document.getElementById('mobileMissileAmmo');
    const mobileLaserAmmo = document.getElementById('mobileLaserAmmo');
    
    if (mobileMissileAmmo) mobileMissileAmmo.textContent = weapons.missile.ammo;
    if (mobileLaserAmmo) mobileLaserAmmo.textContent = weapons.laser.ammo;
    
    // Update mobile weapon button states (disabled/enabled)
    const mobileMissileBtn = document.getElementById('mobileMissileBtn');
    const mobileLaserBtn = document.getElementById('mobileLaserBtn');
    
    if (mobileMissileBtn) {
        mobileMissileBtn.disabled = weapons.missile.cooldown > 0 || weapons.missile.ammo <= 0;
    }
    if (mobileLaserBtn) {
        mobileLaserBtn.disabled = weapons.laser.cooldown > 0 || weapons.laser.ammo <= 0;
    }
}

// Setup mobile control button event listeners
function setupMobileControls() {
    // Mobile weapon buttons
    const mobileMissileBtn = document.getElementById('mobileMissileBtn');
    const mobileLaserBtn = document.getElementById('mobileLaserBtn');
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
    
    // Mobile Tractor Beam Toggle
    const mobileTractorBeamBtn = document.getElementById('mobileTractorBeamBtn');
    if (mobileTractorBeamBtn) {
        mobileTractorBeamBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (!gameState.paused && gameState.running) {
                if (mobileTractorBeamActive) {
                    // Deactivate
                    deactivateTractorBeam();
                    mobileTractorBeamActive = false;
                } else {
                    // Activate
                    if (tractorBeam.charge > 0 && !tractorBeam.active) {
                        activateTractorBeam();
                        if (tractorBeam.active) {
                            mobileTractorBeamActive = true;
                            mobileTractorBeamBtn.classList.add('active');
                        }
                    }
                }
            }
        });
    }
    
    // Mobile Rotation Controls
    const mobileRotateLeftBtn = document.getElementById('mobileRotateLeftBtn');
    const mobileRotateRightBtn = document.getElementById('mobileRotateRightBtn');
    
    if (mobileRotateLeftBtn) {
        mobileRotateLeftBtn.addEventListener('touchstart', (e) => {
            e.preventDefault();
            e.stopPropagation();
            mobileRotateLeft = true;
        });
        mobileRotateLeftBtn.addEventListener('touchend', (e) => {
            e.preventDefault();
            e.stopPropagation();
            mobileRotateLeft = false;
        });
        mobileRotateLeftBtn.addEventListener('touchcancel', (e) => {
            e.preventDefault();
            e.stopPropagation();
            mobileRotateLeft = false;
        });
        mobileRotateLeftBtn.addEventListener('mousedown', (e) => {
            e.preventDefault();
            e.stopPropagation();
            mobileRotateLeft = true;
        });
        mobileRotateLeftBtn.addEventListener('mouseup', (e) => {
            e.preventDefault();
            e.stopPropagation();
            mobileRotateLeft = false;
        });
        mobileRotateLeftBtn.addEventListener('mouseleave', () => {
            mobileRotateLeft = false;
        });
    }
    
    if (mobileRotateRightBtn) {
        mobileRotateRightBtn.addEventListener('touchstart', (e) => {
            e.preventDefault();
            e.stopPropagation();
            mobileRotateRight = true;
        });
        mobileRotateRightBtn.addEventListener('touchend', (e) => {
            e.preventDefault();
            e.stopPropagation();
            mobileRotateRight = false;
        });
        mobileRotateRightBtn.addEventListener('touchcancel', (e) => {
            e.preventDefault();
            e.stopPropagation();
            mobileRotateRight = false;
        });
        mobileRotateRightBtn.addEventListener('mousedown', (e) => {
            e.preventDefault();
            e.stopPropagation();
            mobileRotateRight = true;
        });
        mobileRotateRightBtn.addEventListener('mouseup', (e) => {
            e.preventDefault();
            e.stopPropagation();
            mobileRotateRight = false;
        });
        mobileRotateRightBtn.addEventListener('mouseleave', () => {
            mobileRotateRight = false;
        });
    }
}

// Game loop
// Spawn timers based on gameTick for deterministic lockstep
let lastSpawnTick = 0;
let lastAsteroidSpawnTick = 0;
let lastNebulaSpawnTick = 0;
let lastBossSpawnScore = 0; // Track score when last boss was spawned
let lastFrameTime = performance.now();
const TARGET_FPS = 60; // Target frames per second
const FRAME_TIME_MS = 1000 / TARGET_FPS; // ~16.67ms per frame at 60fps
let accumulatedTime = 0;

// Host-authoritative sync: broadcast full game state to keep clients aligned
function broadcastCompleteGameState() {
    if (!multiplayerMode || !networkManager || !networkManager.isConnected() || !networkManager.isHostPlayer()) {
        return;
    }

    // Capture and clear pending effects so they are only played once per broadcast
    const effectsToSend = pendingEffects.splice(0, pendingEffects.length);

    // Include basic player state for reconciliation on clients
    const playersState = {};
    playersState[networkManager.getPlayerId()] = {
        x: player.x,
        y: player.y,
        rotation: player.rotation,
        health: player.health,
        shields: player.shields
    };

    remotePlayers.forEach((remotePlayer, playerId) => {
        playersState[playerId] = {
            x: remotePlayer.x,
            y: remotePlayer.y,
            rotation: remotePlayer.rotation,
            health: remotePlayer.health,
            shields: remotePlayer.shields
        };
    });

    networkManager.sendCompleteGameState({
        enemies,
        asteroids,
        bosses,
        bullets,
        allies,
        particles,
        powerups,
        nebulas,
        cargoVessel: gameState.gameMode === 'mission' ? cargoVessel : null,
        score: gameState.score,
        level: gameState.level,
        enemiesKilled: gameState.enemiesKilled,
        players: playersState,
        effects: effectsToSend
    });
}

function gameLoop(currentTime = performance.now()) {
    if (!canvas) {
        console.error('Canvas not available in gameLoop');
        return;
    }
    
    // Calculate delta time
    const deltaTime = currentTime - lastFrameTime;
    lastFrameTime = currentTime;
    
    // Allow loop to run even if gameState.running is false (for rendering UI/briefing)
    // But skip updates if not running
    if (!gameState.running) {
        // Still render the briefing/UI, but don't update game logic
        requestAnimationFrame(gameLoop);
        return;
    }
    
    // Check rendering context (WebGL or Canvas 2D)
    if (!useWebGL && !ctx) {
        console.warn('No rendering context available');
        requestAnimationFrame(gameLoop);
        return;
    }

    // Reset per-frame tracking variables
    asteroidsDestroyedThisStep = 0;
    powerupsCollectedThisStep = 0;
    upgradesSelectedThisStep = 0;
    tractorBeamActivatedThisStep = false;

    try {
        // Skip rendering in headless mode for speed (but allow observer mode)
        if (!HEADLESS_MODE || OBSERVER_MODE) {
            // Draw starfield
            drawStarfield();
        }

        // Only update game logic if not paused
        if (!gameState.paused) {
            // Accumulate time for fixed timestep updates
            // In headless mode, run multiple steps per frame for speed
            // In normal mode, use fixed timestep to maintain consistent game speed
            if (HEADLESS_MODE && !OBSERVER_MODE) {
                // Headless mode: run multiple steps per frame
                const steps = Math.floor(SPEED_MULTIPLIER);
            for (let step = 0; step < steps; step++) {
                    updateGameStep();
                }
            } else {
                // Normal mode: use fixed timestep to maintain consistent speed
                accumulatedTime += deltaTime;
                
                // Cap accumulated time to prevent spiral of death
                const maxFrameTime = FRAME_TIME_MS * 5; // Max 5 frames worth
                if (accumulatedTime > maxFrameTime) {
                    accumulatedTime = maxFrameTime;
                }
                
                // Run updates in fixed timestep chunks
                while (accumulatedTime >= FRAME_TIME_MS) {
                    updateGameStep();
                    accumulatedTime -= FRAME_TIME_MS;
                }
            }
            
            // Spawning (tick-based for deterministic lockstep)
            // Only spawn if we have the seed in multiplayer (ensures determinism)
            if (!multiplayerMode || (multiplayerMode && gameSeed !== null)) {
            // Difficulty scales with cumulative credits (every 100 credits = 1 difficulty level)
            const creditDifficulty = cumulativeCredits / 100;
            
            // Maximum enemies on screen to prevent overwhelming swarms
            const maxEnemiesOnScreen = Math.min(25, 4 + Math.floor(creditDifficulty * 0.8)); // Reduced from 8 to 4 at start, gradual increase to 25 max
            
            // More gradual spawn rate decrease - uses a smoother curve to prevent sudden jumps
            // Formula: baseRate - (creditDifficulty^1.2 * ratePerLevel) for even smoother progression
                // Convert to ticks: 60 ticks per second (assuming 60fps fixed timestep)
                const enemySpawnRateTicks = Math.max(72, 480 - Math.floor(Math.pow(creditDifficulty, 1.2) * 2.4)); // ~8 seconds = 480 ticks at 60fps
            
            // Only spawn if we're under the enemy cap
                if (enemies.length < maxEnemiesOnScreen && gameTick - lastSpawnTick >= enemySpawnRateTicks) {
                spawnEnemy();
                    lastSpawnTick = gameTick;
            }

            // Very gradual chance for extra spawn at high difficulty (only if under cap)
            // This replaces the sudden threshold-based spawns with a smooth probability curve
            if (enemies.length < maxEnemiesOnScreen && creditDifficulty > 10) {
                // Probability increases very gradually: 0% at difficulty 10, up to 5% at difficulty 50
                const extraSpawnChance = Math.min(0.05, (creditDifficulty - 10) / 800);
                    if (getRandom() < extraSpawnChance && gameTick - lastSpawnTick >= enemySpawnRateTicks * 0.5) {
                spawnEnemy();
                        lastSpawnTick = gameTick;
            }
            }

            // More gradual asteroid spawn rate - uses smoother curve
                const asteroidSpawnRateTicks = Math.max(72, 270 - Math.floor(Math.pow(creditDifficulty, 1.3) * 3.6)); // ~4.5 seconds = 270 ticks
                if (gameTick - lastAsteroidSpawnTick >= asteroidSpawnRateTicks) {
                spawnAsteroid();
                    lastAsteroidSpawnTick = gameTick;
            }

            // Spawn nebulas (less frequent, but persistent) - more gradual
                const nebulaSpawnRateTicks = Math.max(600, 1080 - Math.floor(Math.pow(creditDifficulty, 1.2) * 12)); // ~18 seconds = 1080 ticks
                if (gameTick - lastNebulaSpawnTick >= nebulaSpawnRateTicks) {
                spawnNebula();
                    lastNebulaSpawnTick = gameTick;
                }
            }

            // Spawn boss every 1000 points (only one boss at a time)
            if (bosses.length === 0 && gameState.score >= lastBossSpawnScore + 1000) {
                spawnBoss();
                lastBossSpawnScore = gameState.score;
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
            
            // In deterministic lockstep, we don't send game state - only inputs are synced
            // Both players run the same simulation, so state stays in sync automatically
        } else {
            // Still update UI when paused (for visual feedback)
            if (!HEADLESS_MODE || OBSERVER_MODE) {
                updateUI();
            }
        }

        // Skip all rendering in headless mode for maximum speed (but allow observer mode)
        if (!HEADLESS_MODE || OBSERVER_MODE) {
            // Always draw game objects (even when paused)
            drawPlanets();
            drawNebulas(); // Draw nebulas behind other objects
            drawParticles();
            drawFireworks(); // Draw fireworks (for high score celebration)
            drawAsteroids();
            drawEnemies();
            drawBosses();
            drawTractorBeam(); // Draw tractor beam
            drawPowerups();
            drawAllies();
            drawBullets();
            if (gameState.gameMode === 'mission') {
                drawCargoVessel();
            }
            drawPlayer();
            // Draw remote players in multiplayer mode
            if (multiplayerMode) {
                drawRemotePlayers();
            }
        }
    } catch (error) {
        console.error('Game loop error:', error);
        // Continue the loop even if there's an error
    }

    requestAnimationFrame(gameLoop);
}

// Helper function to update game logic in one step
function updateGameStep() {
    // ============================================================
    // DETERMINISTIC LOCKSTEP: Both players run identical game loop
    // ============================================================

    // Host handles authoritative processing of remote player actions
    if (multiplayerMode && networkManager && networkManager.isHostPlayer()) {
        // Spawn bullets for remote players based on their inputs
        processRemotePlayerShooting();

        // Apply tractor beam effects from remote players to shared entities
        processRemoteTractorBeams();
    }

    // Process inputs from queue for this tick (deterministic lockstep)
    // In lockstep, both players process all inputs in the same order
    if (multiplayerMode && networkManager) {
        const currentTick = gameTick;
        const inputsForTick = inputQueue.filter(i => i.tick === currentTick);
        
        // Sort inputs by playerId for deterministic order
        inputsForTick.sort((a, b) => a.playerId.localeCompare(b.playerId));
        
        // Process all inputs for this tick (both local and remote)
        // Note: Local player input is already captured in updatePlayer() via keys
        // Remote player inputs are stored for potential future use
        // For now, we still sync player positions separately for rendering
        
        // Remove processed inputs (keep last 10 ticks for safety)
        inputQueue = inputQueue.filter(i => i.tick > currentTick - 10);
    }
    
    // Both players run full game loop (deterministic)
    updatePlayer();
    updateTractorBeam();
    updateBullets();
    updateEnemies();
    updateBosses();
    updateAsteroids();
    updateNebulas();
    updatePowerups();
    updateAllies();
    updateParticles();
    updateEnemyBullets();
    updateFireworks();
    
    // Check for mission 1 trigger (score 350)
    checkMission1Trigger();
    
    // Update mission 1 timer and check for failure
    if (gameState.mission1Active) {
        updateMission1();
    }

    // In deterministic lockstep, both players process damage locally (it's deterministic)
    // Only use host-authoritative processing in non-lockstep mode
    if (multiplayerMode && networkManager && networkManager.isHostPlayer() && gameSeed === null) {
        processRemoteBullets();
        processRemotePlayerCollisions();
    }

    // Increment game tick
    gameTick++;
    
    // In multiplayer, sync player positions for rendering (lockstep handles entities)
    if (multiplayerMode && networkManager && networkManager.isConnected()) {
        // Send our position for other players to render
        networkManager.sendPlayerState({
            x: player.x,
            y: player.y,
            rotation: player.rotation,
            health: player.health,
            shields: player.shields,
            keys: {
                space: keys[' '] || false,
                key1: keys['1'] || false,
                key2: keys['2'] || false,
                key3: keys['3'] || false,
                mouseButton: mouseButtonDown || false,
                w: keys['w'] || false,
                a: keys['a'] || false,
                s: keys['s'] || false,
                d: keys['d'] || false,
                arrowUp: keys['ArrowUp'] || false,
                arrowDown: keys['ArrowDown'] || false,
                arrowLeft: keys['ArrowLeft'] || false,
                arrowRight: keys['ArrowRight'] || false
            },
            mouseX: mouseActive ? mouseX : null,
            mouseY: mouseActive ? mouseY : null,
            commandModuleOpen: gameState.commandModuleOpen,
            tractorBeam: {
                active: tractorBeam.active,
                targetId: tractorBeam.target ? tractorBeam.target.id || null : null,
                targetType: tractorBeam.targetType || null,
                charge: tractorBeam.charge
            },
            allies: allies.map(ally => ({
                x: ally.x,
                y: ally.y,
                rotation: ally.rotation,
                width: ally.width,
                height: ally.height,
                health: ally.health,
                maxHealth: ally.maxHealth,
                id: ally.id || null,
                offsetAngle: ally.offsetAngle,
                orbitRadius: ally.orbitRadius,
                isCargoAlly: ally.isCargoAlly || false
            })),
            bullets: bullets
                .filter(b => (b.playerId || 'local') === getLocalPlayerId())
                .map(b => ({
                    x: b.x,
                    y: b.y,
                    vx: b.vx,
                    vy: b.vy,
                    damage: b.damage,
                    color: b.color,
                    size: b.size,
                    type: b.type,
                    glow: b.glow,
                    trail: b.trail || [],
                    pierce: b.pierce || false,
                    homing: b.homing || false,
                    clusterSpread: b.clusterSpread || false
                }))
        });
    }

    // Mission mode updates
    if (gameState.gameMode === 'mission') {
        updateCargoVessel();
    }

    // Host broadcasts authoritative state so all players see the same world
    broadcastCompleteGameState();

    // Update UI (skip in headless mode, but allow observer mode)
    if (!HEADLESS_MODE || OBSERVER_MODE) {
        updateUI();
    }
}

function gameOver() {
    // Prevent duplicate game over calls
    if (!gameState.running) {
        return;
    }
    
    gameState.running = false;
    
    // In multiplayer, send event to notify all players
    if (multiplayerMode && networkManager && networkManager.isConnected()) {
        networkManager.sendEvent('playerDied', {
            playerId: networkManager.getPlayerId(),
            score: gameState.score
        });
    }
    
    // Check for new high score
    if (gameState.score > highScore) {
        newHighScore = true;
        saveHighScore(gameState.score);
    }
    
    // Create a big explosion at the player's position
    if (player && !isNaN(player.x) && !isNaN(player.y)) {
        // Create a massive central explosion
        const explosionSize = 200; // Very large explosion
        createBigExplosion(player.x, player.y, explosionSize);
        
        // Create additional smaller explosions around the player for more impact
        for (let i = 0; i < 8; i++) {
            const angle = (i / 8) * Math.PI * 2;
            const distance = 40 + Math.random() * 60;
            const offsetX = Math.cos(angle) * distance;
            const offsetY = Math.sin(angle) * distance;
            setTimeout(() => {
                createBigExplosion(player.x + offsetX, player.y + offsetY, 100 + Math.random() * 60);
            }, i * 80); // Stagger the explosions for dramatic effect
        }
        
        // Play multiple big explosion sounds for impact
        sounds.enemyExplosion();
        setTimeout(() => sounds.enemyExplosion(), 100);
        setTimeout(() => sounds.enemyExplosion(), 200);
        setTimeout(() => sounds.enemyExplosion(), 300);
    }
    
    document.getElementById('finalScore').textContent = gameState.score;
    const highScoreDisplay = document.getElementById('finalHighScore');
    if (highScoreDisplay) {
        highScoreDisplay.textContent = highScore;
        if (newHighScore) {
            highScoreDisplay.parentElement.classList.add('new-high-score');
        } else {
            highScoreDisplay.parentElement.classList.remove('new-high-score');
        }
    }
    document.getElementById('gameOver').classList.remove('hidden');
    
    // Auto-restart if autopilot is enabled (after 5 seconds)
    if (autopilotEnabled) {
        setTimeout(() => {
            document.getElementById('gameOver').classList.add('hidden');
    restartGame();
            if (rlAgent instanceof PPOAgent) {
                startNewEpisode();
            }
        }, 5000); // 5 seconds
    }
}

function startMissionMode() {
    gameState.gameMode = 'mission';
    gameState.missionComplete = false;
    gameState.journeyCount = 0;
    currency = 0; // Start with 0 currency in mission mode
    const briefing = document.getElementById('missionBriefing');
    if (briefing) {
        briefing.classList.add('hidden');
    }
    restartGame();
    initMissionMode();
}

function restartGame() {
    // Reset game state (preserve game mode)
    const currentMode = gameState.gameMode || 'mission';
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
    
    // Reset game tick and input queue for lockstep
    gameTick = 0;
    inputQueue = [];
    
    // Reset spawn timers for deterministic lockstep
    lastSpawnTick = 0;
    lastAsteroidSpawnTick = 0;
    lastNebulaSpawnTick = 0;
    
    // Reset high score flag and clear fireworks
    newHighScore = false;
    fireworks = [];
    
    // Ensure background music is playing when game starts
    if (backgroundMusic.length > 0 && musicEnabled && audioContext && audioContext.state === 'running') {
        const currentSong = backgroundMusic[currentMusicIndex];
        if (currentSong && currentSong.paused) {
            currentSong.play().catch(err => {
                console.warn('Could not play background music:', err);
            });
        }
    }

    // Reset player
    player.x = getCanvasWidth() / 2;
    player.y = getCanvasHeight() - 100;
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

// Mission briefing overlay
function showMissionBriefing() {
    gameState.running = false;
    const briefing = document.getElementById('missionBriefing');
    if (briefing) {
        briefing.classList.remove('hidden');
    }
    document.getElementById('gameOver').classList.add('hidden');
    document.getElementById('missionComplete').classList.add('hidden');
}

// Initialize and start game
document.addEventListener('DOMContentLoaded', async () => {
    try {
        console.log('Game initializing...');
    canvas = document.getElementById('gameCanvas');
    
    if (!canvas) {
        console.error('Canvas element not found!');
        return;
    }
    
    // Set up canvas with proper device pixel ratio FIRST (before WebGL init)
    // This ensures canvas has proper dimensions
    displayWidth = window.innerWidth;
    displayHeight = window.innerHeight;
    if (canvas) {
        const dpr = window.devicePixelRatio || 1;
        canvas.width = displayWidth * dpr;
        canvas.height = displayHeight * dpr;
        canvas.style.width = displayWidth + 'px';
        canvas.style.height = displayHeight + 'px';
    }
    
    // Try to initialize WebGL (skip in headless mode unless observer mode)
    if (!HEADLESS_MODE || OBSERVER_MODE) {
        try {
            webglRenderer = new WebGLRenderer(canvas);
            if (webglRenderer.init()) {
                useWebGL = true;
                console.log('WebGL initialized successfully');
                
                // IMPORTANT: Resize WebGL renderer to match canvas BEFORE creating renderers
                // This ensures the projection matrix is correct from the start
                webglRenderer.resize(displayWidth, displayHeight);
                
                // Initialize renderers with the correct projection matrix
                try {
                    const gl = webglRenderer.getContext();
                    const shaderManager = webglRenderer.shaderManager;
                    const bufferManager = webglRenderer.bufferManager;
                    const projectionMatrix = webglRenderer.getProjectionMatrix();
                    
                    console.log('Creating renderers with projection matrix for', displayWidth, 'x', displayHeight);
                    console.log('Projection matrix:', projectionMatrix);
                    
                    spriteRenderer = new SpriteRenderer(gl, shaderManager, bufferManager, projectionMatrix);
                    spriteRenderer.textureManager = webglRenderer.textureManager; // Set texture manager reference
                    particleRenderer = new ParticleRenderer(gl, shaderManager, bufferManager, projectionMatrix);
                    trailRenderer = new TrailRenderer(gl, shaderManager, bufferManager, projectionMatrix);
                    circleRenderer = new CircleRenderer(gl, shaderManager, bufferManager, projectionMatrix);
                    nebulaRenderer = new NebulaRenderer(gl, shaderManager, bufferManager, projectionMatrix);
                    
                // Load textures
                await loadTextures();
                
                // Set up context restore handler to reload textures
                webglRenderer.onContextRestored = async () => {
                    console.log('Reloading textures after context restore...');
                    await loadTextures();
                };
                } catch (rendererError) {
                    console.error('Error initializing WebGL renderers:', rendererError);
                    useWebGL = false;
    ctx = canvas.getContext('2d');
                }
            } else {
                console.warn('WebGL not available, falling back to Canvas 2D');
                ctx = canvas.getContext('2d');
            }
        } catch (webglError) {
            console.error('Error initializing WebGL:', webglError);
            useWebGL = false;
            ctx = canvas.getContext('2d');
        }
    } else {
        // Headless mode - no rendering needed
        ctx = null;
    }
    
    // Fallback to Canvas 2D if WebGL not available
    if (!useWebGL && !HEADLESS_MODE) {
        if (!ctx) {
            ctx = canvas.getContext('2d');
        }
        if (ctx) {
            const dpr = window.devicePixelRatio || 1;
            ctx.scale(dpr, dpr);
        }
    }
    
    // Initialize Network Manager for multiplayer
    networkManager = new NetworkManager();
    await networkManager.initialize(firebaseConfig);
    
    // Set up multiplayer event listeners
    networkManager.on('playersUpdated', (data) => {
        updatePlayerCountUI();
    });
    
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
    
    networkManager.on('playerLeft', (data) => {
        remotePlayers.delete(data.playerId);
        remoteCrewAllocations.delete(data.playerId);
        remoteAllies.delete(data.playerId);
        remoteBullets.delete(data.playerId);
        previousRemoteAllies.delete(data.playerId); // Clean up tracking
        remotePlayerWeapons.delete(data.playerId); // Clean up weapon state
        updatePlayerCountUI();
        
        // Update UI if command module is open
        if (gameState.commandModuleOpen) {
            updateCommandModuleUI();
        }
    });
    
    // Listen for player death events - game over for one player means game over for all
    networkManager.on('playerDied', (data) => {
        // Trigger game over for all players when any player dies
        if (gameState.running) {
            gameOver();
        }
    });
    
    // Listen for game seed (deterministic lockstep)
    networkManager.on('gameSeedUpdated', (data) => {
        if (data.seed) {
            const wasNull = gameSeed === null;
            gameSeed = data.seed;
            deterministicRNG = new DeterministicRNG(gameSeed);
            console.log('[LOCKSTEP] Game seed received:', gameSeed);
            
            // Reset game tick when seed is first received to ensure sync
            // This ensures non-host players start at the same tick as host
            if (wasNull) {
                console.log('[LOCKSTEP] Initializing with seed, resetting game state for sync');
                gameTick = 0;
                lastSpawnTick = 0;
                lastAsteroidSpawnTick = 0;
                lastNebulaSpawnTick = 0;
                
                // Clear all entities to start fresh
                enemies = [];
                asteroids = [];
                nebulas = [];
                bosses = [];
                bullets = [];
                allies = [];
                powerups = [];
                
                // Reset game state
                gameState.score = 0;
                gameState.level = 1;
                gameState.enemiesKilled = 0;
                cumulativeCredits = 0;
            }
        }
    });
    
    // Listen for inputs from other players (deterministic lockstep)
    networkManager.on('inputReceived', (data) => {
        if (data.input) {
            // Add input to queue for processing at the correct tick
            inputQueue.push({
                tick: data.input.tick,
                playerId: data.input.playerId,
                keys: data.input.keys,
                mouseX: data.input.mouseX,
                mouseY: data.input.mouseY,
                timestamp: data.input.timestamp
            });
            
            // Sort queue by tick
            inputQueue.sort((a, b) => a.tick - b.tick);
        }
    });
    
    // Listen for damage events (still needed for some edge cases)
    networkManager.on('playerDamaged', (data) => {
        console.log('[DAMAGE] Received damage event:', data);
        if (data.damage) {
            takeDamage(data.damage);
        }
    });
    
    // Listen for game entity updates (DISABLED in deterministic lockstep)
    // In lockstep, both players generate entities themselves, so no entity sync needed
    /*
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
    }); // END OF DISABLED gameEntitiesUpdated listener
    
    // Listen for complete game state updates (DISABLED in deterministic lockstep)
    // In lockstep, both players generate entities themselves, so no state sync needed
    /*
    networkManager.on('completeGameStateUpdated', (data) => {
        if (data.completeState && !networkManager.isHostPlayer()) {
            // Debug: log state sync
            console.log('[SYNC] Received state:', {
                enemies: data.completeState.enemies?.length || 0,
                asteroids: data.completeState.asteroids?.length || 0,
                bullets: data.completeState.bullets?.length || 0,
                effects: data.completeState.effects?.length || 0
            });
            
            // Replace all game state with host's authoritative state
            if (data.completeState.enemies) enemies = data.completeState.enemies;
            if (data.completeState.asteroids) asteroids = data.completeState.asteroids;
            if (data.completeState.bosses) bosses = data.completeState.bosses;
            if (data.completeState.bullets) bullets = data.completeState.bullets;
            if (data.completeState.allies) allies = data.completeState.allies;
            if (data.completeState.particles) particles = data.completeState.particles;
            if (data.completeState.powerups) powerups = data.completeState.powerups;
            if (data.completeState.nebulas) nebulas = data.completeState.nebulas;
            if (data.completeState.cargoVessel && gameState.gameMode === 'mission') {
                cargoVessel = data.completeState.cargoVessel;
            }
            
            // Sync shared score
            if (data.completeState.score !== undefined) {
                gameState.score = data.completeState.score;
            }
            if (data.completeState.level !== undefined) {
                gameState.level = data.completeState.level;
            }
            if (data.completeState.enemiesKilled !== undefined) {
                gameState.enemiesKilled = data.completeState.enemiesKilled;
            }
            
            // Process effects from host (explosions, sounds)
            if (data.completeState.effects && Array.isArray(data.completeState.effects)) {
                data.completeState.effects.forEach(effect => {
                    if (effect.type === 'explosion') {
                        createExplosion(effect.x, effect.y, effect.size || 30);
                    } else if (effect.type === 'sound') {
                        if (effect.name === 'enemyExplosion' && sounds.enemyExplosion) {
                            sounds.enemyExplosion();
                        } else if (effect.name === 'asteroidExplosion' && sounds.asteroidExplosion) {
                            sounds.asteroidExplosion();
                        } else if (effect.name === 'primaryShot' && sounds.primaryShot) {
                            sounds.primaryShot();
                        }
                    }
                });
            }
            
            // Reconcile local player position with host (for responsiveness)
            if (data.completeState.players) {
                const hostPlayerState = data.completeState.players[networkManager.getPlayerId()];
                if (hostPlayerState) {
                    // Smoothly interpolate to host position
                    const dx = hostPlayerState.x - player.x;
                    const dy = hostPlayerState.y - player.y;
                    const dist = Math.hypot(dx, dy);
                    
                    if (dist > 10) { // Only correct if difference is significant
                        player.x += dx * 0.5;
                        player.y += dy * 0.5;
                        player.rotation += (hostPlayerState.rotation - player.rotation) * 0.5;
                    }
                    
                    // Sync health/shields from host (host is authoritative)
                    if (hostPlayerState.health !== undefined) player.health = hostPlayerState.health;
                    if (hostPlayerState.shields !== undefined) player.shields = hostPlayerState.shields;
                }
            }
        }
    });
    */ // END OF DISABLED completeGameStateUpdated listener
    
    // Preload RL agent in background so it's ready when autopilot is toggled
    // This prevents delay on first autopilot click
    agentLoadPromise = loadRLAgent().catch(err => {
        console.warn('Failed to preload RL agent (will load on autopilot toggle):', err);
    });
    
    // Set up canvas with proper device pixel ratio (update projection matrices)
    // This ensures projection matrices are updated if window was resized
    setupCanvas();
    
    // Initialize player position (use display size, not internal canvas size)
    player.x = getCanvasWidth() / 2;
    player.y = getCanvasHeight() - 100;
    
    // Initialize background
    initBackground();
    
    // Initialize player ship image
    initPlayerShipImage();
    initDamagedPlayerShipImage();
    
    // Initialize planet images
    initPlanetImages();
    
    // Initialize cargo ship image
    initCargoShipImage();
    
    // Initialize enemy ship image
    initEnemyShipImage();
    initBossShipImage();
    initAllyShipImage();
    initTokenImage();
    initCrewImage();
    
    // Load high score
    loadHighScore();
    
    // Initialize audio
    initAudio();
    
    // Set up mouse/trackpad controls
    setupMouseControls();
    
    // Initialize crew system
    initializeCrew();
    setupCrewDragAndDrop();
    
    // Set up HUD toggle
    const hudToggle = document.getElementById('hudToggle');
    const hudContent = document.getElementById('hudContent');
    if (hudToggle && hudContent) {
        hudToggle.addEventListener('click', () => {
            hudContent.classList.toggle('collapsed');
            hudToggle.textContent = hudContent.classList.contains('collapsed') ? '▲' : '▼';
        });
    }
    
    // Set up audio controls
    const musicToggle = document.getElementById('musicToggle');
    if (musicToggle) {
        musicToggle.addEventListener('click', () => {
            musicEnabled = !musicEnabled;
            if (backgroundMusic.length > 0) {
                if (musicEnabled) {
                    const currentSong = backgroundMusic[currentMusicIndex];
                    if (currentSong) {
                        currentSong.play().catch(err => {
                            console.warn('Could not play background music:', err);
                        });
                    }
                    musicToggle.textContent = '🎵';
                    musicToggle.title = 'Toggle Music (On)';
                } else {
                    // Pause all songs in the playlist
                    backgroundMusic.forEach(song => {
                        if (song && !song.paused) {
                            song.pause();
                        }
                    });
                    musicToggle.textContent = '🔇';
                    musicToggle.title = 'Toggle Music (Off)';
                }
            }
        });
    }
    
    const soundToggle = document.getElementById('soundToggle');
    if (soundToggle) {
        // Initialize button state
        soundToggle.textContent = soundEffectsEnabled ? '🔊' : '🔇';
        soundToggle.title = soundEffectsEnabled ? 'Toggle Sound Effects (On)' : 'Toggle Sound Effects (Off)';
        
        soundToggle.addEventListener('click', () => {
            soundEffectsEnabled = !soundEffectsEnabled;
            if (soundEffectsEnabled) {
                soundToggle.textContent = '🔊';
                soundToggle.title = 'Toggle Sound Effects (On)';
            } else {
                soundToggle.textContent = '🔇';
                soundToggle.title = 'Toggle Sound Effects (Off)';
            }
        });
    }
    
    // Initialize music toggle button state
    if (musicToggle) {
        musicToggle.textContent = musicEnabled ? '🎵' : '🔇';
        musicToggle.title = musicEnabled ? 'Toggle Music (On)' : 'Toggle Music (Off)';
    }
    
    // Set up autopilot toggle button
    const autopilotToggle = document.getElementById('autopilotToggle');
    if (autopilotToggle) {
        let lastToggleTime = 0;
        autopilotToggle.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            // Prevent rapid clicking (debounce)
            const now = Date.now();
            if (now - lastToggleTime < 300) {
                console.log('Click ignored - too soon after last toggle');
                return;
            }
            lastToggleTime = now;
            
            console.log('Autopilot button clicked, current state:', autopilotEnabled);
            
            try {
                await toggleAutopilot();
                console.log('Autopilot toggled successfully, new state:', autopilotEnabled);
            } catch (error) {
                console.error('Error toggling autopilot:', error);
                // Reset on error
                lastToggleTime = 0;
            }
        });
        updateAutopilotUI();
        console.log('Autopilot toggle button set up successfully');
    } else {
        console.error('Autopilot toggle button not found in DOM!');
    }
    
    
    // Set up button event listeners
    const restartBtn = document.getElementById('restartBtn');
    if (restartBtn) {
        restartBtn.addEventListener('click', restartGame);
    }
    
    const missionRestartBtn = document.getElementById('missionRestartBtn');
    if (missionRestartBtn) {
        missionRestartBtn.addEventListener('click', () => {
        document.getElementById('missionComplete').classList.add('hidden');
            startMissionMode();
        });
    }
    
    const closeUpgradeBtn = document.getElementById('closeUpgrade');
    if (closeUpgradeBtn) {
        closeUpgradeBtn.addEventListener('click', () => {
        document.getElementById('upgradeMenu').classList.add('hidden');
        gameState.paused = false;
    });
    }
    
    // Command module buttons
    const recruitCrewBtn = document.getElementById('recruitCrewBtn');
    if (recruitCrewBtn) {
        recruitCrewBtn.addEventListener('click', () => {
        recruitCrew();
    });
    }
    
    const buyClusterBtn = document.getElementById('buyClusterBtn');
    if (buyClusterBtn) {
        buyClusterBtn.addEventListener('click', () => {
        buyClusterAmmo();
    });
    }
    
    const closeCommandModuleBtn = document.getElementById('closeCommandModule');
    if (closeCommandModuleBtn) {
        closeCommandModuleBtn.addEventListener('click', closeCommandModule);
    }
    
    // Tab switching
    const crewTab = document.getElementById('crewTab');
    const storeTab = document.getElementById('storeTab');
    const crewTabContent = document.getElementById('crewTabContent');
    const storeTabContent = document.getElementById('storeTabContent');
    
    if (crewTab && storeTab && crewTabContent && storeTabContent) {
        crewTab.addEventListener('click', () => {
            crewTab.classList.add('active');
            storeTab.classList.remove('active');
            crewTabContent.classList.remove('hidden');
            storeTabContent.classList.add('hidden');
        });
        
        storeTab.addEventListener('click', () => {
            storeTab.classList.add('active');
            crewTab.classList.remove('active');
            storeTabContent.classList.remove('hidden');
            crewTabContent.classList.add('hidden');
        });
    }
    
    // Store buy buttons
    const buyMissileBtn = document.getElementById('buyMissileBtn');
    if (buyMissileBtn) {
        buyMissileBtn.addEventListener('click', buyMissileAmmo);
    }
    
    const buyLaserBtn = document.getElementById('buyLaserBtn');
    if (buyLaserBtn) {
        buyLaserBtn.addEventListener('click', buyLaserAmmo);
    }
    
    const buyCargoShipBtn = document.getElementById('buyCargoShipBtn');
    if (buyCargoShipBtn) {
        buyCargoShipBtn.addEventListener('click', buyCargoShip);
    }
    
    const buyNebuclearBtn = document.getElementById('buyNebuclearBtn');
    if (buyNebuclearBtn) {
        buyNebuclearBtn.addEventListener('click', buyNebuclear);
    }
    
    // Mission briefing start button
    const startMissionBtn = document.getElementById('startMissionBtn');
    if (startMissionBtn) {
        startMissionBtn.addEventListener('click', startMissionMode);
    }
    
    // Multiplayer UI handlers
    setupMultiplayerUI();
    
    // Mobile control buttons
    setupMobileControls();
    
    // Load high score
    loadHighScore();
    const highScoreEl = document.getElementById('highScore');
    if (highScoreEl) {
        highScoreEl.textContent = highScore;
    }
    const finalHighScoreEl = document.getElementById('finalHighScore');
    if (finalHighScoreEl) {
        finalHighScoreEl.textContent = highScore;
    }
    
    // Handle agent loading
    if (agentLoadPromise) {
    agentLoadPromise.finally(() => {
            console.log('RL agent loaded, starting game...');
        if (OFFLINE_MODE) {
            startMissionMode();
            autopilotEnabled = true;
            updateAutopilotUI();
            startNewEpisode();
            setupOfflineAPI();
        } else {
            showMissionBriefing();
        }
        }).catch(error => {
            console.error('Error in agent load promise:', error);
        });
    } else {
        // No agent promise, just show briefing
        if (!OFFLINE_MODE) {
            showMissionBriefing();
        }
    }
    
    // Start game loop
        console.log('Starting game loop...');
    gameLoop();
    } catch (error) {
        console.error('Fatal error during game initialization:', error);
        alert('Game failed to initialize. Check console for details.');
    }
});
