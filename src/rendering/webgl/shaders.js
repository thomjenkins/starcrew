// WebGL shader source code

export const spriteVertexShader = `
attribute vec2 a_position;
attribute vec2 a_texCoord;
attribute vec4 a_color;

uniform mat3 u_projection;
uniform mat3 u_transform;

varying vec2 v_texCoord;
varying vec4 v_color;

void main() {
    // Apply transform
    vec3 position = u_transform * vec3(a_position, 1.0);
    
    // Apply projection
    vec3 projected = u_projection * position;
    
    gl_Position = vec4(projected.xy, 0.0, 1.0);
    v_texCoord = a_texCoord;
    v_color = a_color;
}
`;

export const spriteFragmentShader = `
precision mediump float;

uniform sampler2D u_texture;
uniform float u_useTexture;

varying vec2 v_texCoord;
varying vec4 v_color;

void main() {
    if (u_useTexture > 0.5) {
        vec4 texColor = texture2D(u_texture, v_texCoord);
        
        // Handle RGB images (no alpha channel) by detecting white/light or black/dark backgrounds
        // When RGB images are loaded, alpha is 1.0 for all pixels
        // Check if pixel is very light/white or very dark/black and treat as transparent background
        float brightness = (texColor.r + texColor.g + texColor.b) / 3.0;
        float whiteness = 1.0 - abs(texColor.r - texColor.g) - abs(texColor.g - texColor.b) - abs(texColor.b - texColor.r);
        float blackness = 1.0 - whiteness; // Inverse of whiteness
        
        // If pixel is very bright and uniform (white/light gray), discard it
        // This handles RGB images with white backgrounds
        if (texColor.a > 0.99 && brightness > 0.92 && whiteness > 0.85) {
            discard;
        }
        
        // Also check for pure white pixels (all channels very high)
        if (texColor.a > 0.99 && texColor.r > 0.95 && texColor.g > 0.95 && texColor.b > 0.95) {
            discard;
        }
        
        // If pixel is very dark and uniform (black/dark gray), discard it
        // This handles images with black backgrounds
        if (texColor.a > 0.99 && brightness < 0.06 && whiteness > 0.85) {
            discard;
        }
        
        // Also check for pure black pixels (all channels very low)
        if (texColor.a > 0.99 && texColor.r < 0.05 && texColor.g < 0.05 && texColor.b < 0.05) {
            discard;
        }
        
        vec4 finalColor = texColor * v_color;
        // Discard transparent pixels
        if (finalColor.a < 0.01) {
            discard;
        }
        gl_FragColor = finalColor;
    } else {
        // Discard transparent pixels for non-textured sprites too
        if (v_color.a < 0.01) {
            discard;
        }
        gl_FragColor = v_color;
    }
}
`;

export const particleVertexShader = `
attribute vec2 a_position;
attribute float a_size;
attribute vec4 a_color;

uniform mat3 u_projection;

varying vec4 v_color;

void main() {
    vec3 position = u_projection * vec3(a_position, 1.0);
    gl_Position = vec4(position.xy, 0.0, 1.0);
    gl_PointSize = a_size;
    v_color = a_color;
}
`;

export const particleFragmentShader = `
precision mediump float;

varying vec4 v_color;

void main() {
    // Create circular particles with smooth edges
    vec2 coord = gl_PointCoord - vec2(0.5);
    float dist = length(coord);
    
    if (dist > 0.5) {
        discard;
    }
    
    // Smooth edge
    float alpha = 1.0 - smoothstep(0.3, 0.5, dist);
    gl_FragColor = vec4(v_color.rgb, v_color.a * alpha);
}
`;

export const trailVertexShader = `
attribute vec2 a_position;
attribute float a_distance; // Distance along trail (0-1)
attribute vec4 a_color;

uniform mat3 u_projection;
uniform float u_width;

varying float v_distance;
varying vec4 v_color;

void main() {
    vec3 position = u_projection * vec3(a_position, 1.0);
    gl_Position = vec4(position.xy, 0.0, 1.0);
    v_distance = a_distance;
    v_color = a_color;
}
`;

export const trailFragmentShader = `
precision mediump float;

varying float v_distance;
varying vec4 v_color;

void main() {
    // Fade out along the trail
    float alpha = v_color.a * (1.0 - v_distance);
    gl_FragColor = vec4(v_color.rgb, alpha);
}
`;

export const circleVertexShader = `
attribute vec2 a_position;
attribute float a_radius;
attribute vec4 a_color;

uniform mat3 u_projection;

varying vec4 v_color;
varying float v_radius;

void main() {
    vec3 position = u_projection * vec3(a_position, 1.0);
    gl_Position = vec4(position.xy, 0.0, 1.0);
    gl_PointSize = a_radius * 2.0;
    v_color = a_color;
    v_radius = a_radius;
}
`;

export const circleFragmentShader = `
precision mediump float;

varying vec4 v_color;
varying float v_radius;

void main() {
    // Create circular shape with smooth edges
    vec2 coord = gl_PointCoord - vec2(0.5);
    float dist = length(coord);
    
    if (dist > 0.5) {
        discard;
    }
    
    // Smooth edge
    float alpha = 1.0 - smoothstep(0.4, 0.5, dist);
    gl_FragColor = vec4(v_color.rgb, v_color.a * alpha);
}
`;

// Nebula-specific shader for rounded cloud edges
export const nebulaVertexShader = `
attribute vec2 a_position;
attribute vec2 a_texCoord;
attribute vec4 a_color;

uniform mat3 u_projection;
uniform mat3 u_transform;

varying vec2 v_texCoord;
varying vec4 v_color;

void main() {
    // Apply transform
    vec3 position = u_transform * vec3(a_position, 1.0);
    
    // Apply projection
    vec3 projected = u_projection * position;
    
    gl_Position = vec4(projected.xy, 0.0, 1.0);
    v_texCoord = a_texCoord;
    v_color = a_color;
}
`;

export const nebulaFragmentShader = `
precision mediump float;

varying vec2 v_texCoord;
varying vec4 v_color;

void main() {
    // Create rounded cloud edges using smooth falloff from center
    // v_texCoord is 0-1, so center is at (0.5, 0.5)
    vec2 center = vec2(0.5, 0.5);
    vec2 coord = v_texCoord - center;
    
    // Distance from center (normalized to 0-1)
    float dist = length(coord) * 2.0; // Multiply by 2 to get 0-1 range
    
    // Create smooth rounded edge using multiple falloff curves
    // This creates a soft, cloud-like appearance without hard edges
    float alpha = 1.0;
    
    // Outer edge falloff (very soft)
    alpha *= 1.0 - smoothstep(0.6, 1.0, dist);
    
    // Inner edge falloff (softer center)
    alpha *= 0.3 + 0.7 * (1.0 - smoothstep(0.0, 0.4, dist));
    
    // Add some variation for organic cloud feel
    // Use texture coordinates to create subtle noise-like variation
    float variation = sin(v_texCoord.x * 10.0) * sin(v_texCoord.y * 10.0) * 0.1 + 0.9;
    alpha *= variation;
    
    // Ensure we don't render transparent pixels
    if (alpha < 0.01) {
        discard;
    }
    
    // Preserve color and apply calculated alpha
    gl_FragColor = vec4(v_color.rgb, v_color.a * alpha);
}
`;

