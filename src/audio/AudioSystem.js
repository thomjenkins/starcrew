// Audio System
class AudioSystem {
    constructor() {
        this.audioContext = null;
        this.soundEnabled = true;
        this.init();
    }

    init() {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        } catch (e) {
            console.warn('Web Audio API not supported');
            this.soundEnabled = false;
        }
    }

    resumeAudioContext() {
        if (this.audioContext && this.audioContext.state === 'suspended') {
            this.audioContext.resume().catch(() => {});
        }
    }

    playSound(frequency, duration, type = 'sine', volume = 0.3, startFreq = null) {
        if (!this.soundEnabled || !this.audioContext) return;
        
        // Resume audio context if suspended (browsers require user interaction)
        this.resumeAudioContext();
        
        try {
            const oscillator = this.audioContext.createOscillator();
            const gainNode = this.audioContext.createGain();
            
            oscillator.type = type;
            oscillator.frequency.setValueAtTime(startFreq || frequency, this.audioContext.currentTime);
            if (startFreq && startFreq !== frequency) {
                oscillator.frequency.exponentialRampToValueAtTime(frequency, this.audioContext.currentTime + duration);
            }
            
            gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
            gainNode.gain.linearRampToValueAtTime(volume, this.audioContext.currentTime + 0.01);
            gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + duration);
            
            oscillator.connect(gainNode);
            gainNode.connect(this.audioContext.destination);
            
            oscillator.start(this.audioContext.currentTime);
            oscillator.stop(this.audioContext.currentTime + duration);
        } catch (e) {
            // Silently fail if audio context is not available
        }
    }

    playBeep(frequency, duration, volume = 0.2) {
        this.playSound(frequency, duration, 'sine', volume);
    }

    playTone(frequency, duration, type = 'square', volume = 0.2) {
        this.playSound(frequency, duration, type, volume);
    }

    playSweep(startFreq, endFreq, duration, volume = 0.2) {
        this.playSound(endFreq, duration, 'sine', volume, startFreq);
    }

    // Sound effects
    primaryShot() {
        this.playBeep(800, 0.05, 0.15);
        this.playBeep(1000, 0.03, 0.1);
    }

    missileLaunch() {
        this.playSweep(200, 400, 0.2, 0.25);
        this.playBeep(300, 0.1, 0.15);
    }

    laserShot() {
        this.playTone(1200, 0.15, 'sawtooth', 0.2);
        this.playBeep(1500, 0.1, 0.15);
    }

    enemyExplosion() {
        this.playTone(100, 0.3, 'sawtooth', 0.3);
        this.playSweep(200, 50, 0.2, 0.2);
        this.playBeep(150, 0.1, 0.15);
    }

    asteroidExplosion() {
        this.playTone(80, 0.4, 'sawtooth', 0.25);
        this.playSweep(150, 40, 0.3, 0.15);
    }

    playerHit() {
        this.playTone(200, 0.2, 'square', 0.4);
        this.playBeep(150, 0.15, 0.3);
    }

    powerupCollect() {
        this.playSweep(400, 800, 0.3, 0.25);
        this.playBeep(600, 0.1, 0.2);
        this.playBeep(800, 0.1, 0.15);
    }

    enemyShot() {
        this.playBeep(400, 0.08, 0.15);
        this.playBeep(350, 0.05, 0.1);
    }

    levelUp() {
        this.playSweep(300, 600, 0.2, 0.3);
        setTimeout(() => this.playSweep(400, 800, 0.2, 0.3), 100);
        setTimeout(() => this.playSweep(500, 1000, 0.2, 0.3), 200);
    }

    allyShot() {
        this.playBeep(600, 0.06, 0.12);
        this.playBeep(700, 0.04, 0.08);
    }
}

// Export singleton instance
export const audioSystem = new AudioSystem();



