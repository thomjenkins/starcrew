// Main Renderer - coordinates all rendering
export class Renderer {
    constructor(canvas, ctx) {
        this.canvas = canvas;
        this.ctx = ctx;
        this.renderers = {};
    }

    registerRenderer(name, renderer) {
        this.renderers[name] = renderer;
    }

    render(name, ...args) {
        const renderer = this.renderers[name];
        if (renderer && typeof renderer.render === 'function') {
            renderer.render(this.ctx, ...args);
        } else if (renderer && typeof renderer === 'function') {
            renderer(this.ctx, ...args);
        }
    }

    clear() {
        if (this.ctx && this.canvas) {
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        }
    }
}



