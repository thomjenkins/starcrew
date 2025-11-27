// Math utility functions

/**
 * Check collision between two objects
 * Handles objects with 'size' or 'width'/'height' properties
 */
export function checkCollision(obj1, obj2) {
    const w1 = obj1.width || obj1.size || 0;
    const h1 = obj1.height || obj1.size || 0;
    const w2 = obj2.width || obj2.size || 0;
    const h2 = obj2.height || obj2.size || 0;
    
    return obj1.x - w1 / 2 < obj2.x + w2 / 2 &&
           obj1.x + w1 / 2 > obj2.x - w2 / 2 &&
           obj1.y - h1 / 2 < obj2.y + h2 / 2 &&
           obj1.y + h1 / 2 > obj2.y - h2 / 2;
}

/**
 * Convert hex color to rgba string
 */
export function hexToRgba(hex, alpha) {
    if (!hex || typeof hex !== 'string') {
        return `rgba(255, 255, 255, ${alpha})`;
    }
    // Remove # if present
    hex = hex.replace('#', '');
    // Ensure we have 6 characters
    if (hex.length !== 6) {
        return `rgba(255, 255, 255, ${alpha})`;
    }
    // Parse hex to RGB
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    // Validate parsed values
    if (isNaN(r) || isNaN(g) || isNaN(b)) {
        return `rgba(255, 255, 255, ${alpha})`;
    }
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Normalize angle to [-PI, PI] range
 */
export function normalizeAngle(angle) {
    while (angle > Math.PI) angle -= 2 * Math.PI;
    while (angle < -Math.PI) angle += 2 * Math.PI;
    return angle;
}

/**
 * Calculate distance between two points
 */
export function distance(x1, y1, x2, y2) {
    return Math.hypot(x2 - x1, y2 - y1);
}



