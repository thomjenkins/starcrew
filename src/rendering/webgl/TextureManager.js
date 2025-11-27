// Texture loading and management for WebGL
export class TextureManager {
    constructor(gl) {
        this.gl = gl;
        this.textures = new Map();
        this.loadingPromises = new Map();
    }

    /**
     * Load a texture from an image URL
     * @param {string} url - Image URL
     * @param {Object} options - Texture options
     * @param {boolean} options.flipY - Flip Y axis (default: true for images)
     * @param {number} options.minFilter - Minification filter (default: gl.LINEAR)
     * @param {number} options.magFilter - Magnification filter (default: gl.LINEAR)
     * @returns {Promise<WebGLTexture>} Promise resolving to texture
     */
    async loadTexture(url, options = {}) {
        // Check cache
        if (this.textures.has(url)) {
            return this.textures.get(url);
        }

        // Check if already loading
        if (this.loadingPromises.has(url)) {
            return this.loadingPromises.get(url);
        }

        // Start loading
        const promise = new Promise((resolve, reject) => {
            const image = new Image();
            image.crossOrigin = 'anonymous';
            
            image.onload = () => {
                const texture = this.createTextureFromImage(image, options);
                this.textures.set(url, texture);
                this.loadingPromises.delete(url);
                resolve(texture);
            };

            image.onerror = () => {
                this.loadingPromises.delete(url);
                console.warn(`Failed to load texture: ${url}`);
                reject(new Error(`Failed to load texture: ${url}`));
            };

            image.src = url;
        });

        this.loadingPromises.set(url, promise);
        return promise;
    }

    /**
     * Create a texture from an Image object
     * @param {HTMLImageElement|HTMLCanvasElement|ImageBitmap} image - Image source
     * @param {Object} options - Texture options
     * @returns {WebGLTexture} WebGL texture
     */
    createTextureFromImage(image, options = {}) {
        const {
            flipY = true,
            minFilter = this.gl.LINEAR,
            magFilter = this.gl.LINEAR,
            wrapS = this.gl.CLAMP_TO_EDGE,
            wrapT = this.gl.CLAMP_TO_EDGE,
            removeWhiteBackground = false, // Option to remove white backgrounds from RGB images
            removeBlackBackground = false // Option to remove black backgrounds
        } = options;

        // If we need to remove white or black background, convert to RGBA with transparency
        let imageToUse = image;
        if (removeWhiteBackground || removeBlackBackground) {
            const canvas = document.createElement('canvas');
            canvas.width = image.width;
            canvas.height = image.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(image, 0, 0);
            
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const data = imageData.data;
            
            // Convert white/light or black/dark pixels to transparent
            for (let i = 0; i < data.length; i += 4) {
                const r = data[i];
                const g = data[i + 1];
                const b = data[i + 2];
                const a = data[i + 3]; // Original alpha
                
                // Check if pixel is white or very light (brightness > 240 and uniform)
                const brightness = (r + g + b) / 3;
                const isUniform = Math.abs(r - g) < 10 && Math.abs(g - b) < 10 && Math.abs(b - r) < 10;
                
                let shouldBeTransparent = false;
                
                if (removeWhiteBackground && brightness > 240 && isUniform) {
                    shouldBeTransparent = true; // White/light background
                } else if (removeBlackBackground && brightness < 15 && isUniform) {
                    shouldBeTransparent = true; // Black/dark background
                }
                
                if (shouldBeTransparent) {
                    data[i + 3] = 0; // Set alpha to 0 (transparent)
                } else if (a === 0) {
                    // Preserve existing transparency
                    data[i + 3] = 0;
                } else {
                    data[i + 3] = a; // Keep original alpha
                }
            }
            
            ctx.putImageData(imageData, 0, 0);
            imageToUse = canvas;
        }

        const texture = this.gl.createTexture();
        this.gl.bindTexture(this.gl.TEXTURE_2D, texture);

        // Flip Y axis for images (WebGL has Y-up, images have Y-down)
        this.gl.pixelStorei(this.gl.UNPACK_FLIP_Y_WEBGL, flipY);

        // Upload image data
        this.gl.texImage2D(
            this.gl.TEXTURE_2D,
            0,
            this.gl.RGBA,
            this.gl.RGBA,
            this.gl.UNSIGNED_BYTE,
            imageToUse
        );

        // Set texture parameters
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, minFilter);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, magFilter);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, wrapS);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, wrapT);

        // Generate mipmaps if using mipmap filter
        if (minFilter === this.gl.LINEAR_MIPMAP_LINEAR || 
            minFilter === this.gl.NEAREST_MIPMAP_NEAREST ||
            minFilter === this.gl.LINEAR_MIPMAP_NEAREST ||
            minFilter === this.gl.NEAREST_MIPMAP_LINEAR) {
            this.gl.generateMipmap(this.gl.TEXTURE_2D);
        }

        this.gl.bindTexture(this.gl.TEXTURE_2D, null);

        return texture;
    }

    /**
     * Create a solid color texture
     * @param {number} r - Red (0-255)
     * @param {number} g - Green (0-255)
     * @param {number} b - Blue (0-255)
     * @param {number} a - Alpha (0-255)
     * @returns {WebGLTexture} WebGL texture
     */
    createColorTexture(r, g, b, a = 255) {
        const canvas = document.createElement('canvas');
        canvas.width = 1;
        canvas.height = 1;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${a / 255})`;
        ctx.fillRect(0, 0, 1, 1);
        return this.createTextureFromImage(canvas, { flipY: false });
    }

    /**
     * Get a cached texture
     * @param {string} url - Texture URL
     * @returns {WebGLTexture|null} Texture or null
     */
    getTexture(url) {
        return this.textures.get(url) || null;
    }

    /**
     * Delete a texture
     * @param {WebGLTexture} texture - Texture to delete
     */
    deleteTexture(texture) {
        this.gl.deleteTexture(texture);
        
        // Remove from cache
        for (const [url, cachedTexture] of this.textures.entries()) {
            if (cachedTexture === texture) {
                this.textures.delete(url);
                break;
            }
        }
    }

    /**
     * Clear all textures
     */
    clear() {
        this.textures.forEach(texture => this.gl.deleteTexture(texture));
        this.textures.clear();
        this.loadingPromises.clear();
    }

    /**
     * Clear texture cache (for context loss - textures are already invalid)
     */
    clearCache() {
        this.textures.clear();
        this.loadingPromises.clear();
    }
}


