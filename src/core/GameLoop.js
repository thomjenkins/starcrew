// Game Loop
export class GameLoop {
    constructor(gameState, canvas, ctx, updateFunctions, drawFunctions) {
        this.gameState = gameState;
        this.canvas = canvas;
        this.ctx = ctx;
        this.updateFunctions = updateFunctions;
        this.drawFunctions = drawFunctions;
        this.running = false;
    }

    start() {
        if (this.running) return;
        this.running = true;
        this.loop();
    }

    stop() {
        this.running = false;
    }

    loop() {
        if (!this.running || !this.gameState.running || !this.canvas || !this.ctx) {
            this.running = false;
            return;
        }

        try {
            // Draw background first
            if (this.drawFunctions.background) {
                this.drawFunctions.background();
            }

            // Update game logic if not paused
            if (!this.gameState.paused) {
                // Run all update functions
                Object.values(this.updateFunctions).forEach(updateFn => {
                    if (updateFn && typeof updateFn === 'function') {
                        updateFn();
                    }
                });
            }

            // Draw all game objects
            Object.values(this.drawFunctions).forEach(drawFn => {
                if (drawFn && typeof drawFn === 'function' && drawFn !== this.drawFunctions.background) {
                    drawFn();
                }
            });

        } catch (error) {
            console.error('Game loop error:', error);
            // Continue the loop even if there's an error
        }

        if (this.running) {
            requestAnimationFrame(() => this.loop());
        }
    }
}



