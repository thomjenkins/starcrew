// Player Renderer
export class PlayerRenderer {
    constructor() {
        this.shipImage = null;
        this.shipImageLoaded = false;
        this.initShipImage();
    }

    initShipImage() {
        this.shipImage = new Image();
        this.shipImage.onload = () => {
            this.shipImageLoaded = true;
        };
        this.shipImage.onerror = () => {
            console.warn('Failed to load ship.png, using drawn shape');
            this.shipImageLoaded = false;
        };
        this.shipImage.src = 'ship.png';
    }

    draw(ctx, player) {
        if (!ctx || !player || isNaN(player.x) || isNaN(player.y)) return;
        
        ctx.save();
        ctx.translate(player.x, player.y);
        
        // Health bar above ship (drawn before rotation so it stays upright)
        this.drawHealthBar(ctx, player);
        
        // Now rotate for ship drawing
        ctx.rotate(player.rotation);
        
        // Shield effect
        this.drawShields(ctx, player);
        
        // Engine glow
        this.drawEngineGlow(ctx, player);
        
        // Draw ship
        this.drawShip(ctx, player);
        
        ctx.restore();
    }

    drawHealthBar(ctx, player) {
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
    }

    drawShields(ctx, player) {
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
            
            // Shield ring
            ctx.strokeStyle = `rgba(0, 200, 255, ${shieldAlpha})`;
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(0, 0, player.width / 2 + 8, 0, Math.PI * 2);
            ctx.stroke();
            
            // Shield percentage indicator
            ctx.strokeStyle = `rgba(100, 255, 255, ${shieldAlpha})`;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(0, 0, player.width / 2 + 12, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * shieldPercent);
            ctx.stroke();
        } else {
            // Broken shield indicator
            ctx.strokeStyle = 'rgba(255, 0, 0, 0.3)';
            ctx.lineWidth = 1;
            ctx.setLineDash([5, 5]);
            ctx.beginPath();
            ctx.arc(0, 0, player.width / 2 + 8, 0, Math.PI * 2);
            ctx.stroke();
            ctx.setLineDash([]);
        }
    }

    drawEngineGlow(ctx, player) {
        if (player.engineGlow > 0) {
            const backY = player.height / 2;
            const glowGradient = ctx.createLinearGradient(0, backY, 0, backY + 15);
            glowGradient.addColorStop(0, `rgba(0, 200, 255, ${player.engineGlow * 0.8})`);
            glowGradient.addColorStop(0.5, `rgba(100, 200, 255, ${player.engineGlow * 0.5})`);
            glowGradient.addColorStop(1, 'rgba(0, 200, 255, 0)');
            
            ctx.fillStyle = glowGradient;
            ctx.fillRect(-player.width / 4, backY, player.width / 2, 15);
        }
    }

    drawShip(ctx, player) {
        // Draw ship image if loaded, otherwise fall back to drawn shape
        if (this.shipImageLoaded && this.shipImage) {
            ctx.drawImage(
                this.shipImage,
                -player.width / 2,
                -player.height / 2,
                player.width,
                player.height
            );
        } else {
            // Fallback: Draw ship shape
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

            // Ship details
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
        }
    }

    createEngineParticles(player, particles) {
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
    }
}



