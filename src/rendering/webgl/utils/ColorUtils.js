// Color utilities for WebGL rendering
export class ColorUtils {
    /**
     * Convert hex color to RGBA array [r, g, b, a]
     * @param {string} hex - Hex color string (#RRGGBB or #RRGGBBAA)
     * @param {number} alpha - Alpha value (0-1), overrides hex alpha if provided
     * @returns {Float32Array} RGBA array
     */
    static hexToRgba(hex, alpha = null) {
        hex = hex.replace('#', '');
        const r = parseInt(hex.substring(0, 2), 16) / 255;
        const g = parseInt(hex.substring(2, 4), 16) / 255;
        const b = parseInt(hex.substring(4, 6), 16) / 255;
        const a = alpha !== null ? alpha : (hex.length === 8 ? parseInt(hex.substring(6, 8), 16) / 255 : 1);
        return new Float32Array([r, g, b, a]);
    }

    /**
     * Convert RGB string to RGBA array
     * @param {string} rgb - RGB string like "rgb(255, 0, 0)"
     * @param {number} alpha - Alpha value (0-1)
     * @returns {Float32Array} RGBA array
     */
    static rgbToRgba(rgb, alpha = 1) {
        const match = rgb.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
        if (!match) return new Float32Array([1, 1, 1, alpha]);
        return new Float32Array([
            parseInt(match[1]) / 255,
            parseInt(match[2]) / 255,
            parseInt(match[3]) / 255,
            alpha
        ]);
    }

    /**
     * Convert RGBA string to RGBA array
     * @param {string} rgba - RGBA string like "rgba(255, 0, 0, 0.5)"
     * @returns {Float32Array} RGBA array
     */
    static rgbaStringToRgba(rgba) {
        const match = rgba.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
        if (!match) return new Float32Array([1, 1, 1, 1]);
        return new Float32Array([
            parseInt(match[1]) / 255,
            parseInt(match[2]) / 255,
            parseInt(match[3]) / 255,
            match[4] ? parseFloat(match[4]) : 1
        ]);
    }

    /**
     * Convert HSL to RGBA array
     * @param {number} h - Hue (0-360)
     * @param {number} s - Saturation (0-100)
     * @param {number} l - Lightness (0-100)
     * @param {number} alpha - Alpha value (0-1)
     * @returns {Float32Array} RGBA array
     */
    static hslToRgba(h, s, l, alpha = 1) {
        h /= 360;
        s /= 100;
        l /= 100;

        let r, g, b;
        if (s === 0) {
            r = g = b = l;
        } else {
            const hue2rgb = (p, q, t) => {
                if (t < 0) t += 1;
                if (t > 1) t -= 1;
                if (t < 1/6) return p + (q - p) * 6 * t;
                if (t < 1/2) return q;
                if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
                return p;
            };

            const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
            const p = 2 * l - q;
            r = hue2rgb(p, q, h + 1/3);
            g = hue2rgb(p, q, h);
            b = hue2rgb(p, q, h - 1/3);
        }

        return new Float32Array([r, g, b, alpha]);
    }

    /**
     * Parse color string (hex, rgb, rgba, hsl) to RGBA array
     * @param {string} color - Color string
     * @param {number} alpha - Override alpha if provided
     * @returns {Float32Array} RGBA array
     */
    static parseColor(color, alpha = null) {
        if (!color) return new Float32Array([1, 1, 1, alpha !== null ? alpha : 1]);

        // Hex color
        if (color.startsWith('#')) {
            return this.hexToRgba(color, alpha);
        }

        // RGB color
        if (color.startsWith('rgb(')) {
            return this.rgbToRgba(color, alpha !== null ? alpha : 1);
        }

        // RGBA color
        if (color.startsWith('rgba(')) {
            const rgba = this.rgbaStringToRgba(color);
            if (alpha !== null) rgba[3] = alpha;
            return rgba;
        }

        // HSL color
        if (color.startsWith('hsl(')) {
            const match = color.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/);
            if (match) {
                return this.hslToRgba(
                    parseInt(match[1]),
                    parseInt(match[2]),
                    parseInt(match[3]),
                    alpha !== null ? alpha : 1
                );
            }
        }

        // HSLA color
        if (color.startsWith('hsla(')) {
            const match = color.match(/hsla\((\d+),\s*(\d+)%,\s*(\d+)%,\s*([\d.]+)\)/);
            if (match) {
                return this.hslToRgba(
                    parseInt(match[1]),
                    parseInt(match[2]),
                    parseInt(match[3]),
                    alpha !== null ? alpha : parseFloat(match[4])
                );
            }
        }

        // Default to white
        return new Float32Array([1, 1, 1, alpha !== null ? alpha : 1]);
    }
}



