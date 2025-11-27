// Shader compilation and management for WebGL
export class ShaderManager {
    constructor(gl) {
        this.gl = gl;
        this.programs = new Map();
    }

    /**
     * Compile a shader
     * @param {number} type - gl.VERTEX_SHADER or gl.FRAGMENT_SHADER
     * @param {string} source - Shader source code
     * @returns {WebGLShader} Compiled shader
     */
    compileShader(type, source) {
        const shader = this.gl.createShader(type);
        this.gl.shaderSource(shader, source);
        this.gl.compileShader(shader);

        if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
            const error = this.gl.getShaderInfoLog(shader);
            this.gl.deleteShader(shader);
            throw new Error(`Shader compilation error: ${error}`);
        }

        return shader;
    }

    /**
     * Create a shader program from vertex and fragment shader sources
     * @param {string} vertexSource - Vertex shader source
     * @param {string} fragmentSource - Fragment shader source
     * @param {string} name - Optional name for caching
     * @returns {WebGLProgram} Shader program
     */
    createProgram(vertexSource, fragmentSource, name = null) {
        // Check cache
        if (name && this.programs.has(name)) {
            return this.programs.get(name);
        }

        const vertexShader = this.compileShader(this.gl.VERTEX_SHADER, vertexSource);
        const fragmentShader = this.compileShader(this.gl.FRAGMENT_SHADER, fragmentSource);

        const program = this.gl.createProgram();
        this.gl.attachShader(program, vertexShader);
        this.gl.attachShader(program, fragmentShader);
        this.gl.linkProgram(program);

        if (!this.gl.getProgramParameter(program, this.gl.LINK_STATUS)) {
            const error = this.gl.getProgramInfoLog(program);
            this.gl.deleteProgram(program);
            throw new Error(`Program linking error: ${error}`);
        }

        // Clean up shaders (they're linked into the program)
        this.gl.deleteShader(vertexShader);
        this.gl.deleteShader(fragmentShader);

        // Cache if named
        if (name) {
            this.programs.set(name, program);
        }

        return program;
    }

    /**
     * Get uniform location
     * @param {WebGLProgram} program - Shader program
     * @param {string} name - Uniform name
     * @returns {WebGLUniformLocation} Uniform location
     */
    getUniformLocation(program, name) {
        return this.gl.getUniformLocation(program, name);
    }

    /**
     * Get attribute location
     * @param {WebGLProgram} program - Shader program
     * @param {string} name - Attribute name
     * @returns {number} Attribute location
     */
    getAttribLocation(program, name) {
        return this.gl.getAttribLocation(program, name);
    }

    /**
     * Delete a program
     * @param {WebGLProgram} program - Program to delete
     */
    deleteProgram(program) {
        this.gl.deleteProgram(program);
    }

    /**
     * Clear all cached programs
     */
    clearCache() {
        this.programs.forEach(program => this.gl.deleteProgram(program));
        this.programs.clear();
    }
}



