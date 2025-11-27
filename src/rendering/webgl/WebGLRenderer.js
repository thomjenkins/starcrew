// Main WebGL renderer class
import { ShaderManager } from './ShaderManager.js';
import { TextureManager } from './TextureManager.js';
import { BufferManager } from './BufferManager.js';
import { MatrixUtils } from './utils/MatrixUtils.js';

export class WebGLRenderer {
    constructor(canvas, options = {}) {
        this.canvas = canvas;
        this.options = {
            alpha: options.alpha !== false, // Default true for transparency
            antialias: options.antialias !== false, // Default true
            depth: options.depth !== false, // Default true
            stencil: false,
            preserveDrawingBuffer: false,
            powerPreference: 'default',
            failIfMajorPerformanceCaveat: false,
            ...options
        };

        this.gl = null;
        this.shaderManager = null;
        this.textureManager = null;
        this.bufferManager = null;
        
        this.width = 0;
        this.height = 0;
        this.dpr = 1;
        
        this.projectionMatrix = null;
        this.initialized = false;
    }

    /**
     * Initialize WebGL context
     * @returns {boolean} True if successful, false otherwise
     */
    init() {
        if (this.initialized) return true;

        // Try to get WebGL context
        this.gl = this.canvas.getContext('webgl', this.options) || 
                  this.canvas.getContext('experimental-webgl', this.options);

        if (!this.gl) {
            console.warn('WebGL not supported, falling back to Canvas 2D');
            return false;
        }

        // Initialize managers
        this.shaderManager = new ShaderManager(this.gl);
        this.textureManager = new TextureManager(this.gl);
        this.bufferManager = new BufferManager(this.gl);

        // Set up WebGL state
        this.gl.enable(this.gl.BLEND);
        this.gl.blendFunc(this.gl.SRC_ALPHA, this.gl.ONE_MINUS_SRC_ALPHA);
        this.gl.disable(this.gl.DEPTH_TEST); // 2D rendering doesn't need depth

        // Don't resize here - let the caller set the correct dimensions
        // The canvas should already be sized before init() is called
        // Set a default viewport to avoid errors
        if (this.canvas.width > 0 && this.canvas.height > 0) {
            this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
        } else {
            // Fallback to client size if canvas not sized yet
            this.gl.viewport(0, 0, this.canvas.clientWidth || 800, this.canvas.clientHeight || 600);
        }

        // Set up context loss/restore handlers
        this.contextLostHandler = (event) => {
            event.preventDefault();
            console.warn('WebGL context lost - textures will be invalid until restored');
            this.initialized = false;
            // Clear texture cache since textures are now invalid
            if (this.textureManager) {
                this.textureManager.clearCache();
            }
        };

        this.contextRestoredHandler = () => {
            console.log('WebGL context restored - reinitializing...');
            // Reinitialize WebGL state
            this.gl.enable(this.gl.BLEND);
            this.gl.blendFunc(this.gl.SRC_ALPHA, this.gl.ONE_MINUS_SRC_ALPHA);
            this.gl.disable(this.gl.DEPTH_TEST);
            
            // Update viewport
            if (this.canvas.width > 0 && this.canvas.height > 0) {
                this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
            }
            
            this.initialized = true;
            
            // Notify that textures need to be reloaded
            if (this.onContextRestored) {
                this.onContextRestored();
            }
        };

        this.canvas.addEventListener('webglcontextlost', this.contextLostHandler);
        this.canvas.addEventListener('webglcontextrestored', this.contextRestoredHandler);

        this.initialized = true;
        return true;
    }

    /**
     * Resize the canvas and update viewport
     * @param {number} width - Display width
     * @param {number} height - Display height
     */
    resize(width, height) {
        if (!this.gl) return;

        this.width = width;
        this.height = height;
        this.dpr = window.devicePixelRatio || 1;

        // Set canvas internal resolution
        const internalWidth = width * this.dpr;
        const internalHeight = height * this.dpr;

        this.canvas.width = internalWidth;
        this.canvas.height = internalHeight;
        this.canvas.style.width = width + 'px';
        this.canvas.style.height = height + 'px';

        // Update viewport (use internal resolution for crisp rendering)
        this.gl.viewport(0, 0, internalWidth, internalHeight);

        // IMPORTANT: Use display dimensions for projection matrix, not internal dimensions
        // This is because all game coordinates are in display pixel space
        // The viewport handles the internal resolution scaling
        this.projectionMatrix = MatrixUtils.projection(width, height);
    }

    /**
     * Clear the canvas
     * @param {number} r - Red (0-1)
     * @param {number} g - Green (0-1)
     * @param {number} b - Blue (0-1)
     * @param {number} a - Alpha (0-1)
     */
    clear(r = 0, g = 0, b = 0, a = 1) {
        if (!this.gl) return;
        this.gl.clearColor(r, g, b, a);
        this.gl.clear(this.gl.COLOR_BUFFER_BIT);
    }

    /**
     * Get WebGL context
     * @returns {WebGLRenderingContext|null} WebGL context
     */
    getContext() {
        return this.gl;
    }

    /**
     * Check if WebGL is supported and initialized
     * @returns {boolean} True if WebGL is available
     */
    isSupported() {
        return this.gl !== null && this.initialized;
    }

    /**
     * Get canvas width (display size)
     * @returns {number} Width in pixels
     */
    getWidth() {
        return this.width;
    }

    /**
     * Get canvas height (display size)
     * @returns {number} Height in pixels
     */
    getHeight() {
        return this.height;
    }

    /**
     * Get device pixel ratio
     * @returns {number} Device pixel ratio
     */
    getDPR() {
        return this.dpr;
    }

    /**
     * Get projection matrix
     * @returns {Float32Array} Projection matrix
     */
    getProjectionMatrix() {
        return this.projectionMatrix;
    }

    /**
     * Clean up resources
     */
    dispose() {
        // Remove event listeners
        if (this.canvas && this.contextLostHandler) {
            this.canvas.removeEventListener('webglcontextlost', this.contextLostHandler);
        }
        if (this.canvas && this.contextRestoredHandler) {
            this.canvas.removeEventListener('webglcontextrestored', this.contextRestoredHandler);
        }

        if (this.textureManager) {
            this.textureManager.clear();
        }
        if (this.bufferManager) {
            this.bufferManager.clear();
        }
        if (this.shaderManager) {
            this.shaderManager.clearCache();
        }
        if (this.gl) {
            const loseContext = this.gl.getExtension('WEBGL_lose_context');
            if (loseContext) {
                loseContext.loseContext();
            }
        }
        this.initialized = false;
    }
}

