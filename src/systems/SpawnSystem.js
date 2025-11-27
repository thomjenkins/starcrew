// Spawn System
export class SpawnSystem {
    constructor() {
        this.lastSpawn = 0;
        this.lastAsteroidSpawn = 0;
        this.lastNebulaSpawn = 0;
    }

    calculateSpawnRates(cumulativeCredits) {
        const creditDifficulty = cumulativeCredits / 100;
        
        // Maximum enemies on screen to prevent overwhelming swarms
        const maxEnemiesOnScreen = Math.min(25, 8 + Math.floor(creditDifficulty * 0.8));
        
        // More gradual spawn rate decrease
        const enemySpawnRate = Math.max(1200, 4000 - Math.pow(creditDifficulty, 1.2) * 40);
        
        // Asteroid spawn rate
        const asteroidSpawnRate = Math.max(1200, 4500 - Math.pow(creditDifficulty, 1.3) * 60);
        
        // Nebula spawn rate
        const nebulaSpawnRate = Math.max(10000, 18000 - Math.pow(creditDifficulty, 1.2) * 200);
        
        // Extra spawn chance at high difficulty
        const extraSpawnChance = creditDifficulty > 10 
            ? Math.min(0.05, (creditDifficulty - 10) / 800)
            : 0;

        return {
            maxEnemiesOnScreen,
            enemySpawnRate,
            asteroidSpawnRate,
            nebulaSpawnRate,
            extraSpawnChance,
            creditDifficulty
        };
    }

    shouldSpawnEnemy(enemies, cumulativeCredits) {
        const now = Date.now();
        const rates = this.calculateSpawnRates(cumulativeCredits);
        
        if (enemies.length >= rates.maxEnemiesOnScreen) return false;
        if (now - this.lastSpawn < rates.enemySpawnRate) return false;
        
        this.lastSpawn = now;
        return true;
    }

    shouldSpawnExtraEnemy(enemies, cumulativeCredits) {
        const now = Date.now();
        const rates = this.calculateSpawnRates(cumulativeCredits);
        
        if (enemies.length >= rates.maxEnemiesOnScreen) return false;
        if (now - this.lastSpawn < rates.enemySpawnRate * 0.5) return false;
        if (Math.random() >= rates.extraSpawnChance) return false;
        
        this.lastSpawn = now;
        return true;
    }

    shouldSpawnAsteroid(cumulativeCredits) {
        const now = Date.now();
        const rates = this.calculateSpawnRates(cumulativeCredits);
        
        if (now - this.lastAsteroidSpawn < rates.asteroidSpawnRate) return false;
        
        this.lastAsteroidSpawn = now;
        return true;
    }

    shouldSpawnNebula(cumulativeCredits) {
        const now = Date.now();
        const rates = this.calculateSpawnRates(cumulativeCredits);
        
        if (now - this.lastNebulaSpawn < rates.nebulaSpawnRate) return false;
        
        this.lastNebulaSpawn = now;
        return true;
    }

    reset() {
        this.lastSpawn = 0;
        this.lastAsteroidSpawn = 0;
        this.lastNebulaSpawn = 0;
    }
}



