// Buffer management for WebGL
export class BufferManager {
    constructor(gl) {
        this.gl = gl;
        this.buffers = new Map();
    }

    /**
     * Create a buffer
     * @param {number} type - gl.ARRAY_BUFFER or gl.ELEMENT_ARRAY_BUFFER
     * @param {ArrayBuffer|ArrayBufferView} data - Buffer data
     * @param {number} usage - gl.STATIC_DRAW, gl.DYNAMIC_DRAW, etc.
     * @param {string} name - Optional name for tracking
     * @returns {WebGLBuffer} WebGL buffer
     */
    createBuffer(type, data, usage = this.gl.STATIC_DRAW, name = null) {
        const buffer = this.gl.createBuffer();
        this.gl.bindBuffer(type, buffer);
        this.gl.bufferData(type, data, usage);

        if (name) {
            this.buffers.set(name, { buffer, type, usage });
        }

        return buffer;
    }

    /**
     * Update buffer data
     * @param {WebGLBuffer} buffer - Buffer to update
     * @param {number} type - gl.ARRAY_BUFFER or gl.ELEMENT_ARRAY_BUFFER
     * @param {ArrayBuffer|ArrayBufferView} data - New buffer data
     * @param {number} usage - Usage hint
     */
    updateBuffer(buffer, type, data, usage = this.gl.DYNAMIC_DRAW) {
        this.gl.bindBuffer(type, buffer);
        this.gl.bufferData(type, data, usage);
    }

    /**
     * Delete a buffer
     * @param {WebGLBuffer} buffer - Buffer to delete
     */
    deleteBuffer(buffer) {
        this.gl.deleteBuffer(buffer);
        
        // Remove from cache if tracked
        for (const [name, info] of this.buffers.entries()) {
            if (info.buffer === buffer) {
                this.buffers.delete(name);
                break;
            }
        }
    }

    /**
     * Get a tracked buffer by name
     * @param {string} name - Buffer name
     * @returns {WebGLBuffer|null} Buffer or null
     */
    getBuffer(name) {
        const info = this.buffers.get(name);
        return info ? info.buffer : null;
    }

    /**
     * Clear all tracked buffers
     */
    clear() {
        this.buffers.forEach(info => this.gl.deleteBuffer(info.buffer));
        this.buffers.clear();
    }
}



