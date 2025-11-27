// Particle System
import { MAX_PARTICLES } from '../utils/Constants.js';

export class ParticleSystem {
    constructor() {
        this.particles = [];
    }

    createExplosion(x, y, size) {
        // Reduce particle count and cap it
        const particleCount = Math.min(8 + Math.floor(size / 3), 25);
        
        // Don't create more particles if we're at the limit
        if (this.particles.length >= MAX_PARTICLES) {
            return;
        }
        
        const availableSlots = MAX_PARTICLES - this.particles.length;
        const actualCount = Math.min(particleCount, availableSlots);
        
        for (let i = 0; i < actualCount; i++) {
            const angle = (i / actualCount) * Math.PI * 2;
            const speed = 2 + Math.random() * 6;
            this.particles.push({
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

    update() {
        // More efficient: use for loop and splice instead of filter for better performance
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const particle = this.particles[i];
            particle.x += particle.vx;
            particle.y += particle.vy;
            particle.vx *= 0.96;
            particle.vy *= 0.96;
            particle.life--;
            
            if (particle.life <= 0) {
                this.particles.splice(i, 1);
            }
        }
    }

    clear() {
        this.particles.length = 0; // Clear array without creating new reference
    }

    getParticles() {
        return this.particles;
    }
}

