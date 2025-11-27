// Matrix utilities for WebGL 2D rendering
export class MatrixUtils {
    /**
     * Create a 2D translation matrix (3x3)
     * @param {number} tx - Translation X
     * @param {number} ty - Translation Y
     * @returns {Float32Array} 3x3 matrix
     */
    static translation(tx, ty) {
        return new Float32Array([
            1, 0, 0,
            0, 1, 0,
            tx, ty, 1
        ]);
    }

    /**
     * Create a 2D rotation matrix (3x3)
     * @param {number} angle - Rotation angle in radians
     * @returns {Float32Array} 3x3 matrix
     */
    static rotation(angle) {
        const c = Math.cos(angle);
        const s = Math.sin(angle);
        return new Float32Array([
            c, -s, 0,
            s, c, 0,
            0, 0, 1
        ]);
    }

    /**
     * Create a 2D scale matrix (3x3)
     * @param {number} sx - Scale X
     * @param {number} sy - Scale Y
     * @returns {Float32Array} 3x3 matrix
     */
    static scaling(sx, sy) {
        return new Float32Array([
            sx, 0, 0,
            0, sy, 0,
            0, 0, 1
        ]);
    }

    /**
     * Multiply two 3x3 matrices
     * @param {Float32Array} a - First matrix
     * @param {Float32Array} b - Second matrix
     * @returns {Float32Array} Result matrix
     */
    static multiply(a, b) {
        const result = new Float32Array(9);
        const a00 = a[0], a01 = a[1], a02 = a[2];
        const a10 = a[3], a11 = a[4], a12 = a[5];
        const a20 = a[6], a21 = a[7], a22 = a[8];
        const b00 = b[0], b01 = b[1], b02 = b[2];
        const b10 = b[3], b11 = b[4], b12 = b[5];
        const b20 = b[6], b21 = b[7], b22 = b[8];

        result[0] = a00 * b00 + a01 * b10 + a02 * b20;
        result[1] = a00 * b01 + a01 * b11 + a02 * b21;
        result[2] = a00 * b02 + a01 * b12 + a02 * b22;
        result[3] = a10 * b00 + a11 * b10 + a12 * b20;
        result[4] = a10 * b01 + a11 * b11 + a12 * b21;
        result[5] = a10 * b02 + a11 * b12 + a12 * b22;
        result[6] = a20 * b00 + a21 * b10 + a22 * b20;
        result[7] = a20 * b01 + a21 * b11 + a22 * b21;
        result[8] = a20 * b02 + a21 * b12 + a22 * b22;

        return result;
    }

    /**
     * Create an identity matrix (3x3)
     * @returns {Float32Array} Identity matrix
     */
    static identity() {
        return new Float32Array([
            1, 0, 0,
            0, 1, 0,
            0, 0, 1
        ]);
    }

    /**
     * Create a 2D projection matrix for WebGL
     * Maps pixel coordinates to clip space (-1 to 1)
     * @param {number} width - Canvas width
     * @param {number} height - Canvas height
     * @returns {Float32Array} 3x3 projection matrix
     */
    static projection(width, height) {
        // Convert from pixel coordinates to clip space
        // (0,0) at top-left to (-1,-1) at top-left, (1,1) at bottom-right
        return new Float32Array([
            2 / width, 0, 0,
            0, -2 / height, 0,
            -1, 1, 1
        ]);
    }

    /**
     * Create a transform matrix: translate, rotate, scale
     * @param {number} x - X position
     * @param {number} y - Y position
     * @param {number} rotation - Rotation in radians
     * @param {number} scaleX - Scale X
     * @param {number} scaleY - Scale Y
     * @returns {Float32Array} Combined transform matrix
     */
    static transform(x, y, rotation = 0, scaleX = 1, scaleY = 1) {
        const t = this.translation(x, y);
        const r = this.rotation(rotation);
        const s = this.scaling(scaleX, scaleY);
        
        // Multiply: T * R * S
        const rs = this.multiply(r, s);
        return this.multiply(t, rs);
    }
}



