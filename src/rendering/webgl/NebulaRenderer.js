// Nebula renderer with rounded cloud edges for WebGL
import { ShaderManager } from './ShaderManager.js';
import { BufferManager } from './BufferManager.js';
import { MatrixUtils } from './utils/MatrixUtils.js';
import { nebulaVertexShader, nebulaFragmentShader } from './shaders.js';

export class NebulaRenderer {
    constructor(gl, shaderManager, bufferManager, projectionMatrix) {
        this.gl = gl;
        this.shaderManager = shaderManager;
        this.bufferManager = bufferManager;
        this.projectionMatrix = projectionMatrix;

        // Nebula shader program
        this.program = null;
        this.uniforms = {};
        this.attributes = {};

        // Batch data
        this.maxSprites = 2000; // More sprites for complex nebula clouds
        this.vertexData = new Float32Array(this.maxSprites * 4 * 8); // 4 vertices * 8 floats per vertex (x, y, u, v, r, g, b, a)
        this.indexData = new Uint16Array(this.maxSprites * 6); // 2 triangles per sprite
        this.spriteCount = 0;

        // Buffers
        this.vertexBuffer = null;
        this.indexBuffer = null;

        this.init();
    }

    init() {
        // Create shader program
        this.program = this.shaderManager.createProgram(
            nebulaVertexShader,
            nebulaFragmentShader,
            'nebula'
        );

        // Get uniform locations
        this.uniforms.projection = this.shaderManager.getUniformLocation(this.program, 'u_projection');
        this.uniforms.transform = this.shaderManager.getUniformLocation(this.program, 'u_transform');

        // Get attribute locations
        this.attributes.position = this.shaderManager.getAttribLocation(this.program, 'a_position');
        this.attributes.texCoord = this.shaderManager.getAttribLocation(this.program, 'a_texCoord');
        this.attributes.color = this.shaderManager.getAttribLocation(this.program, 'a_color');

        // Create buffers
        this.vertexBuffer = this.bufferManager.createBuffer(
            this.gl.ARRAY_BUFFER,
            this.vertexData,
            this.gl.DYNAMIC_DRAW,
            'nebula_vertices'
        );

        // Generate index data (same for all sprites)
        for (let i = 0; i < this.maxSprites; i++) {
            const base = i * 4;
            const idx = i * 6;
            this.indexData[idx] = base;
            this.indexData[idx + 1] = base + 1;
            this.indexData[idx + 2] = base + 2;
            this.indexData[idx + 3] = base;
            this.indexData[idx + 4] = base + 2;
            this.indexData[idx + 5] = base + 3;
        }

        this.indexBuffer = this.bufferManager.createBuffer(
            this.gl.ELEMENT_ARRAY_BUFFER,
            this.indexData,
            this.gl.STATIC_DRAW,
            'nebula_indices'
        );
    }

    /**
     * Begin a nebula batch
     */
    begin() {
        this.spriteCount = 0;
    }

    /**
     * Draw a nebula sprite with rounded edges
     * @param {number} x - X position
     * @param {number} y - Y position
     * @param {number} width - Width
     * @param {number} height - Height
     * @param {number} rotation - Rotation in radians
     * @param {Float32Array} color - RGBA color array
     * @param {number} originX - Origin X (0-1, default 0.5 for center)
     * @param {number} originY - Origin Y (0-1, default 0.5 for center)
     */
    drawSprite(x, y, width, height, rotation = 0, color = null, originX = 0.5, originY = 0.5) {
        if (this.spriteCount >= this.maxSprites) {
            this.flush();
        }

        // Default color (white)
        const rgba = color || new Float32Array([1, 1, 1, 1]);

        // Calculate sprite corners relative to origin
        const ox = width * originX;
        const oy = height * originY;

        const corners = [
            [-ox, -oy],      // Top-left
            [width - ox, -oy], // Top-right
            [width - ox, height - oy], // Bottom-right
            [-ox, height - oy] // Bottom-left
        ];

        // Apply rotation
        if (rotation !== 0) {
            const cos = Math.cos(rotation);
            const sin = Math.sin(rotation);
            for (let i = 0; i < 4; i++) {
                const px = corners[i][0];
                const py = corners[i][1];
                corners[i][0] = px * cos - py * sin;
                corners[i][1] = px * sin + py * cos;
            }
        }

        // Add translation
        for (let i = 0; i < 4; i++) {
            corners[i][0] += x;
            corners[i][1] += y;
        }

        // Add vertices to batch
        const base = this.spriteCount * 4;
        const texCoords = [
            [0, 0], [1, 0], [1, 1], [0, 1]
        ];

        for (let i = 0; i < 4; i++) {
            const idx = (base + i) * 8;
            this.vertexData[idx] = corners[i][0];     // x
            this.vertexData[idx + 1] = corners[i][1]; // y
            this.vertexData[idx + 2] = texCoords[i][0]; // u
            this.vertexData[idx + 3] = texCoords[i][1]; // v
            this.vertexData[idx + 4] = rgba[0];       // r
            this.vertexData[idx + 5] = rgba[1];        // g
            this.vertexData[idx + 6] = rgba[2];        // b
            this.vertexData[idx + 7] = rgba[3];        // a
        }

        this.spriteCount++;
    }

    /**
     * Flush current batch to GPU
     */
    flush() {
        if (this.spriteCount === 0) return;

        // Use shader program
        this.gl.useProgram(this.program);

        // Update buffer
        const vertexSubData = this.vertexData.subarray(0, this.spriteCount * 4 * 8);
        this.bufferManager.updateBuffer(
            this.vertexBuffer,
            this.gl.ARRAY_BUFFER,
            vertexSubData,
            this.gl.DYNAMIC_DRAW
        );

        // Bind buffers
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.vertexBuffer);
        this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);

        // Set up attributes
        const stride = 8 * 4; // 8 floats * 4 bytes
        let offset = 0;

        // Position
        this.gl.enableVertexAttribArray(this.attributes.position);
        this.gl.vertexAttribPointer(this.attributes.position, 2, this.gl.FLOAT, false, stride, offset);
        offset += 2 * 4;

        // Texture coordinates
        this.gl.enableVertexAttribArray(this.attributes.texCoord);
        this.gl.vertexAttribPointer(this.attributes.texCoord, 2, this.gl.FLOAT, false, stride, offset);
        offset += 2 * 4;

        // Color
        this.gl.enableVertexAttribArray(this.attributes.color);
        this.gl.vertexAttribPointer(this.attributes.color, 4, this.gl.FLOAT, false, stride, offset);

        // Set uniforms
        this.gl.uniformMatrix3fv(this.uniforms.projection, false, this.projectionMatrix);

        // Create identity transform matrix for each sprite (we handle transforms in JS)
        const identity = MatrixUtils.identity();
        this.gl.uniformMatrix3fv(this.uniforms.transform, false, identity);

        // Enable blending - use normal alpha blending to preserve actual colors
        this.gl.enable(this.gl.BLEND);
        // Normal blending preserves colors instead of washing them to white
        this.gl.blendFunc(this.gl.SRC_ALPHA, this.gl.ONE_MINUS_SRC_ALPHA);

        // Draw sprites
        const indexCount = this.spriteCount * 6;
        this.gl.drawElements(this.gl.TRIANGLES, indexCount, this.gl.UNSIGNED_SHORT, 0);

        // Reset count
        this.spriteCount = 0;
    }

    /**
     * End batch and flush
     */
    end() {
        this.flush();
    }
}

