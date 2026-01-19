/**
 * Coordinate Transformation Utility
 * 
 * Transforms canvas pixel coordinates to G-code machine coordinates.
 * 
 * Your table coordinate system:
 * - Screen vertical (top→bottom) maps to X-axis (0→500)
 * - Screen horizontal (left→right) maps to Y-axis (50→560)
 * 
 * Canvas coordinate system (HTML canvas):
 * - Origin at top-left
 * - X increases to the right
 * - Y increases downward
 * 
 * G-code output:
 * - Top-Left corner: X0 Y50
 * - Top-Right corner: X0 Y560
 * - Bottom-Left corner: X500 Y50
 * - Bottom-Right corner: X500 Y560
 */

/**
 * Transform canvas pixel coordinates to G-code coordinates
 * @param {number} canvasX - X position on canvas (0 = left, canvasWidth = right)
 * @param {number} canvasY - Y position on canvas (0 = top, canvasHeight = bottom)
 * @param {number} canvasWidth - Width of the canvas in pixels
 * @param {number} canvasHeight - Height of the canvas in pixels
 * @param {Object} config - Table config from getTableConfig()
 * @returns {{x: number, y: number}} G-code coordinates
 */
export function canvasToGcode(canvasX, canvasY, canvasWidth, canvasHeight, config) {
    const { drawWidth, drawHeight, offsetX, offsetY, rotation } = config;

    // Normalize canvas coordinates to 0-1 range
    // canvasX: 0 (left) to 1 (right) on screen → maps to Y-axis on table
    // canvasY: 0 (top) to 1 (bottom) on screen → maps to X-axis on table
    let normX = canvasX / canvasWidth;   // Horizontal position on screen
    let normY = canvasY / canvasHeight;  // Vertical position on screen

    // Apply rotation transformation
    // At rotation=0: screen-vertical→X, screen-horizontal→Y
    let gcodeX, gcodeY;

    switch (rotation) {
        case 90:
            // 90° CW rotation
            gcodeX = normX;              // Screen horizontal → X
            gcodeY = 1 - normY;          // Screen vertical (inverted) → Y
            break;
        case 180:
            // 180° rotation
            gcodeX = 1 - normY;          // Screen vertical (inverted) → X
            gcodeY = 1 - normX;          // Screen horizontal (inverted) → Y
            break;
        case 270:
            // 270° CW (or 90° CCW)
            gcodeX = 1 - normX;          // Screen horizontal (inverted) → X
            gcodeY = normY;              // Screen vertical → Y
            break;
        default: // 0 - Your default orientation
            // Screen vertical (top→bottom) = X (0→max)
            // Screen horizontal (left→right) = Y (min→max)
            gcodeX = normY;              // Screen vertical → G-code X
            gcodeY = normX;              // Screen horizontal → G-code Y
            break;
    }

    // Scale to drawing area dimensions and add offsets
    // X: multiply by drawWidth (500), add offsetX (0)
    // Y: multiply by drawHeight (510), add offsetY (50)
    const x = gcodeX * drawWidth + offsetX;
    const y = gcodeY * drawHeight + offsetY;

    return { x, y };
}

/**
 * Transform center-normalized coordinates (-1 to 1) to G-code coordinates
 * Used by Kaleidoscope and Spirograph which generate patterns centered at origin
 * @param {number} normX - X position, -1 (left) to 1 (right)
 * @param {number} normY - Y position, -1 (bottom) to 1 (top) - note: Y is up in math coords
 * @param {Object} config - Table config from getTableConfig()
 * @returns {{x: number, y: number}} G-code coordinates
 */
export function centerNormalizedToGcode(normX, normY, config) {
    // Convert from -1,1 (centered, Y-up) to 0,1 (canvas-style, Y-down)
    // normX: -1 (left) → 0, +1 (right) → 1
    // normY: -1 (bottom) → 1, +1 (top) → 0 (flip Y because math Y is up, canvas Y is down)
    const canvasNormX = (normX + 1) / 2;
    const canvasNormY = (1 - normY) / 2;

    // Use full canvas transform
    return canvasToGcode(canvasNormX, canvasNormY, 1, 1, config);
}

/**
 * Get the internal canvas resolution needed for a given display size
 * Higher resolution = smoother lines when drawing
 * @param {Object} displaySize - {width, height} from getCanvasDisplaySize()
 * @param {number} scaleFactor - Multiplier for resolution (default 2 for retina)
 * @returns {{width: number, height: number}} Internal canvas resolution
 */
export function getInternalResolution(displaySize, scaleFactor = 2) {
    return {
        width: Math.round(displaySize.width * scaleFactor),
        height: Math.round(displaySize.height * scaleFactor)
    };
}

/**
 * Clamp a value to the drawing area bounds
 * @param {number} x - G-code X coordinate
 * @param {number} y - G-code Y coordinate
 * @param {Object} config - Table config
 * @returns {{x: number, y: number}} Clamped coordinates
 */
export function clampToDrawingArea(x, y, config) {
    const { drawWidth, drawHeight, offsetX, offsetY } = config;

    return {
        x: Math.max(offsetX, Math.min(offsetX + drawWidth, x)),
        y: Math.max(offsetY, Math.min(offsetY + drawHeight, y))
    };
}
