// Background Manager
export class BackgroundManager {
    constructor() {
        this.backgroundImage = null;
        this.backgroundImageLoaded = false;
    }

    init() {
        this.backgroundImage = new Image();
        this.backgroundImage.onload = () => {
            this.backgroundImageLoaded = true;
        };
        this.backgroundImage.onerror = () => {
            console.warn('Failed to load background.png, using black background');
            this.backgroundImageLoaded = false;
        };
        this.backgroundImage.src = 'background.png';
    }

    draw(ctx, canvas) {
        if (!ctx || !canvas) return;
        
        // Draw background image if loaded, otherwise black background
        if (this.backgroundImageLoaded && this.backgroundImage) {
            // Draw background image, scaled to cover the canvas
            ctx.drawImage(this.backgroundImage, 0, 0, canvas.width, canvas.height);
        } else {
            // Fallback to black background
            ctx.fillStyle = '#000';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
    }
}



