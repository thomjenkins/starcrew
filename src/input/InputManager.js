// Input Manager - handles keyboard, mouse, and touch input
export class InputManager {
    constructor() {
        this.keys = {};
        this.mouseX = 0;
        this.mouseY = 0;
        this.mouseActive = false;
        this.mouseButtonDown = false;
        this.setupKeyboard();
    }

    setupKeyboard() {
        document.addEventListener('keydown', (e) => {
            this.keys[e.key.toLowerCase()] = true;
            if (e.key === ' ') e.preventDefault();
        });

        document.addEventListener('keyup', (e) => {
            this.keys[e.key.toLowerCase()] = false;
        });
    }

    setupMouse(canvas, syncCallback = null) {
        if (!canvas) return;
        
        const updateMousePosition = (e) => {
            const rect = canvas.getBoundingClientRect();
            this.mouseX = e.clientX - rect.left;
            this.mouseY = e.clientY - rect.top;
            this.mouseActive = true;
            if (syncCallback) syncCallback();
        };
        
        const updateTouchPosition = (e) => {
            if (e.touches.length > 0) {
                const rect = canvas.getBoundingClientRect();
                this.mouseX = e.touches[0].clientX - rect.left;
                this.mouseY = e.touches[0].clientY - rect.top;
                this.mouseActive = true;
                e.preventDefault();
                if (syncCallback) syncCallback();
            }
        };
        
        // Mouse events
        canvas.addEventListener('mousemove', updateMousePosition);
        canvas.addEventListener('mouseleave', () => {
            this.mouseActive = false;
            if (syncCallback) syncCallback();
        });
        canvas.addEventListener('mouseenter', updateMousePosition);
        
        // Mouse button events for shooting
        canvas.addEventListener('mousedown', (e) => {
            if (e.button === 0) {
                this.mouseButtonDown = true;
                e.preventDefault();
                if (syncCallback) syncCallback();
            }
        });
        
        canvas.addEventListener('mouseup', (e) => {
            if (e.button === 0) {
                this.mouseButtonDown = false;
                e.preventDefault();
                if (syncCallback) syncCallback();
            }
        });
        
        canvas.addEventListener('mouseleave', () => {
            this.mouseButtonDown = false;
            if (syncCallback) syncCallback();
        });
        
        // Touch events
        canvas.addEventListener('touchmove', (e) => {
            updateTouchPosition(e);
            this.mouseButtonDown = true;
            if (syncCallback) syncCallback();
        });
        
        canvas.addEventListener('touchstart', (e) => {
            updateTouchPosition(e);
            this.mouseButtonDown = true;
            e.preventDefault();
            if (syncCallback) syncCallback();
        });
        
        canvas.addEventListener('touchend', (e) => {
            this.mouseActive = false;
            this.mouseButtonDown = false;
            e.preventDefault();
            if (syncCallback) syncCallback();
        });
        
        canvas.addEventListener('touchcancel', (e) => {
            this.mouseActive = false;
            this.mouseButtonDown = false;
            e.preventDefault();
            if (syncCallback) syncCallback();
        });
    }

    isKeyPressed(key) {
        return !!this.keys[key.toLowerCase()];
    }

    getMousePosition() {
        return { x: this.mouseX, y: this.mouseY };
    }
}

