// Collision System
import { checkCollision } from '../utils/MathUtils.js';

export class CollisionSystem {
    /**
     * Check collision between two objects
     * Handles objects with 'size' or 'width'/'height' properties
     */
    static checkCollision(obj1, obj2) {
        return checkCollision(obj1, obj2);
    }

    /**
     * Check if point is within bounds
     */
    static pointInBounds(x, y, obj) {
        const w = obj.width || obj.size || 0;
        const h = obj.height || obj.size || 0;
        return x >= obj.x - w / 2 && x <= obj.x + w / 2 &&
               y >= obj.y - h / 2 && y <= obj.y + h / 2;
    }

    /**
     * Check if object is on screen
     */
    static isOnScreen(x, y, size, canvasWidth, canvasHeight) {
        return x > -size && x < canvasWidth + size &&
               y > -size && y < canvasHeight + size;
    }
}



