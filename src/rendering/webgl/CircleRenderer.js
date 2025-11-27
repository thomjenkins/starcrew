// GPU-accelerated circle renderer
import { ShaderManager } from './ShaderManager.js';
import { BufferManager } from './BufferManager.js';
import { circleVertexShader, circleFragmentShader } from './shaders.js';

export class CircleRenderer {
    constructor(gl, shaderManager, bufferManager, projectionMatrix) {
        this.gl = gl;
        this.shaderManager = shaderManager;
        this.bufferManager = bufferManager;
        this.projectionMatrix = projectionMatrix;

        // Circle shader program
        this.program = null;
        this.uniforms = {};
        this.attributes = {};

        // Circle data (batched rendering)
        this.maxCircles = 500;
        this.circleData = new Float32Array(this.maxCircles * 7); // x, y, radius, r, g, b, a
        this.circleCount = 0;

        // Buffer
        this.circleBuffer = null;

        this.init();
    }

    init() {
        // Create shader program
        this.program = this.shaderManager.createProgram(
            circleVertexShader,
            circleFragmentShader,
            'circle'
        );

        // Get uniform locations
        this.uniforms.projection = this.shaderManager.getUniformLocation(this.program, 'u_projection');

        // Get attribute locations
        this.attributes.position = this.shaderManager.getAttribLocation(this.program, 'a_position');
        this.attributes.radius = this.shaderManager.getAttribLocation(this.program, 'a_radius');
        this.attributes.color = this.shaderManager.getAttribLocation(this.program, 'a_color');

        // Create buffer
        this.circleBuffer = this.bufferManager.createBuffer(
            this.gl.ARRAY_BUFFER,
            this.circleData,
            this.gl.DYNAMIC_DRAW,
            'circle_data'
        );
    }

    /**
     * Begin a new batch of circles
     */
    begin() {
        this.circleCount = 0;
    }

    /**
     * Add a circle to the batch
     * @param {number} x - X position
     * @param {number} y - Y position
     * @param {number} radius - Radius
     * @param {Float32Array} color - RGBA color array
     */
    drawCircle(x, y, radius, color) {
        if (this.circleCount >= this.maxCircles) {
            this.flush();
        }

        const idx = this.circleCount * 7;
        this.circleData[idx] = x;
        this.circleData[idx + 1] = y;
        this.circleData[idx + 2] = radius;
        this.circleData[idx + 3] = color[0]; // r
        this.circleData[idx + 4] = color[1]; // g
        this.circleData[idx + 5] = color[2]; // b
        this.circleData[idx + 6] = color[3]; // a

        this.circleCount++;
    }

    /**
     * Flush current batch to GPU
     */
    flush() {
        if (this.circleCount === 0) return;

        // Use shader program
        this.gl.useProgram(this.program);

        // Update buffer
        const circleSubData = this.circleData.subarray(0, this.circleCount * 7);
        this.bufferManager.updateBuffer(
            this.circleBuffer,
            this.gl.ARRAY_BUFFER,
            circleSubData,
            this.gl.DYNAMIC_DRAW
        );

        // Bind buffer
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.circleBuffer);

        // Set up attributes
        const stride = 7 * 4; // 7 floats * 4 bytes
        let offset = 0;

        // Position
        this.gl.enableVertexAttribArray(this.attributes.position);
        this.gl.vertexAttribPointer(this.attributes.position, 2, this.gl.FLOAT, false, stride, offset);
        offset += 2 * 4;

        // Radius
        this.gl.enableVertexAttribArray(this.attributes.radius);
        this.gl.vertexAttribPointer(this.attributes.radius, 1, this.gl.FLOAT, false, stride, offset);
        offset += 1 * 4;

        // Color
        this.gl.enableVertexAttribArray(this.attributes.color);
        this.gl.vertexAttribPointer(this.attributes.color, 4, this.gl.FLOAT, false, stride, offset);

        // Set uniforms
        this.gl.uniformMatrix3fv(this.uniforms.projection, false, this.projectionMatrix);

        // Enable blending - use additive blending for nebula clouds to create continuous effect
        this.gl.enable(this.gl.BLEND);
        // Check if we're drawing nebulas (we can detect this by checking if colors are very transparent)
        // For now, use screen blending for better cloud blending (additive-like but clamped)
        // We'll use a custom blend mode: SRC_ALPHA, ONE for additive, or SRC_ALPHA, ONE_MINUS_SRC_ALPHA for normal
        this.gl.blendFunc(this.gl.SRC_ALPHA, this.gl.ONE_MINUS_SRC_ALPHA);

        // Draw circles using point sprites
        this.gl.drawArrays(this.gl.POINTS, 0, this.circleCount);

        // Reset count
        this.circleCount = 0;
    }

    /**
     * End batch and render
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

