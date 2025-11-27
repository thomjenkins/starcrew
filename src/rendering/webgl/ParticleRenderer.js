// GPU-accelerated particle renderer
import { ShaderManager } from './ShaderManager.js';
import { BufferManager } from './BufferManager.js';
import { particleVertexShader, particleFragmentShader } from './shaders.js';
import { ColorUtils } from './utils/ColorUtils.js';

export class ParticleRenderer {
    constructor(gl, shaderManager, bufferManager, projectionMatrix) {
        this.gl = gl;
        this.shaderManager = shaderManager;
        this.bufferManager = bufferManager;
        this.projectionMatrix = projectionMatrix;

        // Particle shader program
        this.program = null;
        this.uniforms = {};
        this.attributes = {};

        // Particle data
        this.maxParticles = 200;
        this.particleData = new Float32Array(this.maxParticles * 7); // x, y, size, r, g, b, a
        this.particleCount = 0;

        // Buffer
        this.particleBuffer = null;

        this.init();
    }

    init() {
        // Create shader program
        this.program = this.shaderManager.createProgram(
            particleVertexShader,
            particleFragmentShader,
            'particle'
        );

        // Get uniform locations
        this.uniforms.projection = this.shaderManager.getUniformLocation(this.program, 'u_projection');

        // Get attribute locations
        this.attributes.position = this.shaderManager.getAttribLocation(this.program, 'a_position');
        this.attributes.size = this.shaderManager.getAttribLocation(this.program, 'a_size');
        this.attributes.color = this.shaderManager.getAttribLocation(this.program, 'a_color');

        // Create buffer
        this.particleBuffer = this.bufferManager.createBuffer(
            this.gl.ARRAY_BUFFER,
            this.particleData,
            this.gl.DYNAMIC_DRAW,
            'particle_data'
        );
    }

    /**
     * Update particles from particle array
     * @param {Array} particles - Array of particle objects with x, y, size, color, life, maxLife
     */
    updateParticles(particles) {
        this.particleCount = Math.min(particles.length, this.maxParticles);

        for (let i = 0; i < this.particleCount; i++) {
            const particle = particles[i];
            const alpha = particle.life / particle.maxLife;

            // Skip very transparent particles
            if (alpha < 0.1) {
                this.particleCount = i;
                break;
            }

            const idx = i * 7;
            this.particleData[idx] = particle.x;     // x
            this.particleData[idx + 1] = particle.y; // y
            this.particleData[idx + 2] = particle.size * alpha; // size (fade out)

            // Parse color and apply alpha
            const color = ColorUtils.parseColor(particle.color, alpha);
            this.particleData[idx + 3] = color[0]; // r
            this.particleData[idx + 4] = color[1]; // g
            this.particleData[idx + 5] = color[2]; // b
            this.particleData[idx + 6] = color[3]; // a
        }
    }

    /**
     * Render all particles
     */
    render() {
        if (this.particleCount === 0) return;

        // Use shader program
        this.gl.useProgram(this.program);

        // Update buffer
        const particleSubData = this.particleData.subarray(0, this.particleCount * 7);
        this.bufferManager.updateBuffer(
            this.particleBuffer,
            this.gl.ARRAY_BUFFER,
            particleSubData,
            this.gl.DYNAMIC_DRAW
        );

        // Bind buffer
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.particleBuffer);

        // Set up attributes
        const stride = 7 * 4; // 7 floats * 4 bytes
        let offset = 0;

        // Position
        this.gl.enableVertexAttribArray(this.attributes.position);
        this.gl.vertexAttribPointer(this.attributes.position, 2, this.gl.FLOAT, false, stride, offset);
        offset += 2 * 4;

        // Size
        this.gl.enableVertexAttribArray(this.attributes.size);
        this.gl.vertexAttribPointer(this.attributes.size, 1, this.gl.FLOAT, false, stride, offset);
        offset += 1 * 4;

        // Color
        this.gl.enableVertexAttribArray(this.attributes.color);
        this.gl.vertexAttribPointer(this.attributes.color, 4, this.gl.FLOAT, false, stride, offset);

        // Set uniforms
        this.gl.uniformMatrix3fv(this.uniforms.projection, false, this.projectionMatrix);

        // Enable point sprites
        this.gl.enable(this.gl.BLEND);
        this.gl.blendFunc(this.gl.SRC_ALPHA, this.gl.ONE_MINUS_SRC_ALPHA);

        // Draw particles
        this.gl.drawArrays(this.gl.POINTS, 0, this.particleCount);
    }

    /**
     * Clear particles
     */
    clear() {
        this.particleCount = 0;
    }

    /**
     * Update projection matrix
     * @param {Float32Array} projectionMatrix - New projection matrix
     */
    setProjection(projectionMatrix) {
        this.projectionMatrix = projectionMatrix;
    }
}



