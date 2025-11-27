// Game State Manager
export class GameState {
    constructor() {
        this.running = true;
        this.paused = false;
        this.score = 0;
        this.level = 1;
        this.enemiesKilled = 0;
        this.starfieldOffset = 0;
        this.gameMode = 'normal'; // 'normal' or 'mission'
        this.missionComplete = false;
        this.commandModuleOpen = false;
        this.journeyCount = 0; // For mission mode
    }

    reset(mode = null) {
        const currentMode = mode || this.gameMode || 'normal';
        this.running = true;
        this.paused = false;
        this.score = 0;
        this.level = 1;
        this.enemiesKilled = 0;
        this.starfieldOffset = 0;
        this.gameMode = currentMode;
        this.missionComplete = false;
        this.commandModuleOpen = false;
        this.journeyCount = 0;
    }
}



