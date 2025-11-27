// Trail/line renderer for missile trails
import { ShaderManager } from './ShaderManager.js';
import { BufferManager } from './BufferManager.js';
import { trailVertexShader, trailFragmentShader } from './shaders.js';
import { ColorUtils } from './utils/ColorUtils.js';

export class TrailRenderer {
    constructor(gl, shaderManager, bufferManager, projectionMatrix) {
        this.gl = gl;
        this.shaderManager = shaderManager;
        this.bufferManager = bufferManager;
        this.projectionMatrix = projectionMatrix;

        // Trail shader program
        this.program = null;
        this.uniforms = {};
        this.attributes = {};

        // Trail data
        this.maxVertices = 1000;
        this.vertexData = new Float32Array(this.maxVertices * 7); // x, y, distance, r, g, b, a
        this.vertexCount = 0;

        // Buffer
        this.vertexBuffer = null;

        this.init();
    }

    init() {
        // Create shader program
        this.program = this.shaderManager.createProgram(
            trailVertexShader,
            trailFragmentShader,
            'trail'
        );

        // Get uniform locations
        this.uniforms.projection = this.shaderManager.getUniformLocation(this.program, 'u_projection');
        this.uniforms.width = this.shaderManager.getUniformLocation(this.program, 'u_width');

        // Get attribute locations
        this.attributes.position = this.shaderManager.getAttribLocation(this.program, 'a_position');
        this.attributes.distance = this.shaderManager.getAttribLocation(this.program, 'a_distance');
        this.attributes.color = this.shaderManager.getAttribLocation(this.program, 'a_color');

        // Create buffer
        this.vertexBuffer = this.bufferManager.createBuffer(
            this.gl.ARRAY_BUFFER,
            this.vertexData,
            this.gl.DYNAMIC_DRAW,
            'trail_vertices'
        );
    }

    /**
     * Draw a trail from points
     * @param {Array} points - Array of {x, y} points
     * @param {string|Float32Array} color - Color string or RGBA array
     * @param {number} width - Line width
     * @param {number} alpha - Alpha value (0-1)
     */
    drawTrail(points, color, width = 2, alpha = 0.5) {
        if (points.length < 2) return;

        // Parse color
        const rgba = typeof color === 'string' ? ColorUtils.parseColor(color, alpha) : color;

        // Calculate total distance for fade effect
        let totalDistance = 0;
        const distances = [0];
        for (let i = 1; i < points.length; i++) {
            const dx = points[i].x - points[i - 1].x;
            const dy = points[i].y - points[i - 1].y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            totalDistance += dist;
            distances.push(totalDistance);
        }

        // Add vertices
        for (let i = 0; i < points.length; i++) {
            if (this.vertexCount >= this.maxVertices) {
                this.flush();
            }

            const idx = this.vertexCount * 7;
            const normalizedDistance = totalDistance > 0 ? distances[i] / totalDistance : 0;

            this.vertexData[idx] = points[i].x;     // x
            this.vertexData[idx + 1] = points[i].y; // y
            this.vertexData[idx + 2] = normalizedDistance; // distance (0-1)
            this.vertexData[idx + 3] = rgba[0]; // r
            this.vertexData[idx + 4] = rgba[1]; // g
            this.vertexData[idx + 5] = rgba[2]; // b
            this.vertexData[idx + 6] = rgba[3]; // a

            this.vertexCount++;
        }
    }

    /**
     * Begin trail batch
     */
    begin() {
        this.vertexCount = 0;
    }

    /**
     * Flush current trails to GPU
     */
    flush() {
        if (this.vertexCount < 2) {
            this.vertexCount = 0;
            return;
        }

        // Use shader program
        this.gl.useProgram(this.program);

        // Update buffer
        const vertexSubData = this.vertexData.subarray(0, this.vertexCount * 7);
        this.bufferManager.updateBuffer(
            this.vertexBuffer,
            this.gl.ARRAY_BUFFER,
            vertexSubData,
            this.gl.DYNAMIC_DRAW
        );

        // Bind buffer
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.vertexBuffer);

        // Set up attributes
        const stride = 7 * 4; // 7 floats * 4 bytes (x, y, distance, r, g, b, a)
        let offset = 0;

        // Position
        this.gl.enableVertexAttribArray(this.attributes.position);
        this.gl.vertexAttribPointer(this.attributes.position, 2, this.gl.FLOAT, false, stride, offset);
        offset += 2 * 4;

        // Distance
        this.gl.enableVertexAttribArray(this.attributes.distance);
        this.gl.vertexAttribPointer(this.attributes.distance, 1, this.gl.FLOAT, false, stride, offset);
        offset += 1 * 4;

        // Color
        this.gl.enableVertexAttribArray(this.attributes.color);
        this.gl.vertexAttribPointer(this.attributes.color, 4, this.gl.FLOAT, false, stride, offset);

        // Set uniforms
        this.gl.uniformMatrix3fv(this.uniforms.projection, false, this.projectionMatrix);
        this.gl.uniform1f(this.uniforms.width, 2.0); // Line width

        // Enable blending
        this.gl.enable(this.gl.BLEND);
        this.gl.blendFunc(this.gl.SRC_ALPHA, this.gl.ONE_MINUS_SRC_ALPHA);

        // Draw line strip
        this.gl.drawArrays(this.gl.LINE_STRIP, 0, this.vertexCount);

        // Reset
        this.vertexCount = 0;
    }

    /**
     * End batch and flush
     */
    end() {
        this.flush();
    }

    /**
     * Update projection matrix
     * @param {Float32Array} projectionMatrix - New projection matrix
     */
    setProjection(projectionMatrix) {
        this.projectionMatrix = projectionMatrix;
    }
}

