/**
 * Table Configuration Utility
 * 
 * Central source of truth for table dimensions, offsets, and orientation.
 * All canvas pages should use this to ensure consistent sizing and coordinate mapping.
 * 
 * Coordinate System (for your table):
 * - Physical table: X: 0→514, Y: 0→620
 * - Drawing area: X: 0→500, Y: 50→560
 * - Screen mapping: 
 *   - Screen vertical (top→bottom) = X-axis (0→500)
 *   - Screen horizontal (left→right) = Y-axis (50→560)
 * 
 * Screen corners to G-code:
 *   Top-Left: X0 Y50
 *   Top-Right: X0 Y560
 *   Bottom-Left: X500 Y50
 *   Bottom-Right: X500 Y560
 */

/**
 * Extract table configuration from Redux settings
 * @param {Object} settings - Redux settings state
 * @returns {Object} Table configuration
 */
export function getTableConfig(settings) {
    const device = settings?.device || {};

    return {
        // Drawing area dimensions (the safe area to draw in)
        drawWidth: parseFloat(device.width?.value) || 500,    // X-axis range (maps to screen vertical)
        drawHeight: parseFloat(device.height?.value) || 510,  // Y-axis range (maps to screen horizontal)

        // Offsets from physical origin to drawing area origin
        offsetX: parseFloat(device.offset_x?.value) || 0,
        offsetY: parseFloat(device.offset_y?.value) || 50,

        // Physical table bounds (for visualization/reference)
        physicalWidth: parseFloat(device.physical_width?.value) || 514,
        physicalHeight: parseFloat(device.physical_height?.value) || 620,

        // Rotation setting (0, 90, 180, 270 degrees)
        // This allows users to adjust if they view their table from a different angle
        rotation: parseInt(device.canvas_rotation?.value) || 0,
    };
}

/**
 * Calculate the best display size for canvas while maintaining aspect ratio
 * @param {Object} config - Table config from getTableConfig()
 * @param {Object} options - Display options
 * @param {number} options.maxWidth - Maximum width in pixels
 * @param {number} options.maxHeight - Maximum height in pixels
 * @returns {{width: number, height: number}} Display dimensions in pixels
 */
export function getCanvasDisplaySize(config, options = {}) {
    const { maxWidth = 800, maxHeight = 800 } = options;
    const { drawWidth, drawHeight, rotation } = config;

    // For YOUR table: 
    //   drawWidth=500 (X-axis range, maps to screen VERTICAL)
    //   drawHeight=510 (Y-axis range, maps to screen HORIZONTAL)
    // 
    // Canvas should show: width = Y range (horizontal), height = X range (vertical)
    // Aspect ratio = 510:500 = 1.02 (slightly wider than tall)

    // If rotation is 90 or 270, the screen axes swap
    const swapped = rotation === 90 || rotation === 270;

    // Normal: screen width = Y range, screen height = X range
    // Swapped: screen width = X range, screen height = Y range
    const displayAspectWidth = swapped ? drawWidth : drawHeight;   // Normal: Y (510)
    const displayAspectHeight = swapped ? drawHeight : drawWidth;  // Normal: X (500)

    const aspectRatio = displayAspectWidth / displayAspectHeight;

    let width, height;

    if (aspectRatio >= 1) {
        // Wider than tall
        width = Math.min(maxWidth, maxHeight * aspectRatio);
        height = width / aspectRatio;
    } else {
        // Taller than wide
        height = Math.min(maxHeight, maxWidth / aspectRatio);
        width = height * aspectRatio;
    }

    return {
        width: Math.round(width),
        height: Math.round(height),
        aspectRatio
    };
}

/**
 * Get the G-code coordinates for each corner of the canvas
 * Used to display coordinate labels on the canvas
 * @param {Object} config - Table config from getTableConfig()
 * @returns {Object} Corner coordinates in G-code space
 */
export function getCornerCoordinates(config) {
    const { drawWidth, drawHeight, offsetX, offsetY, rotation } = config;

    // The canvas is rendered with:
    //   - Canvas WIDTH (horizontal) representing the Y-axis range (drawHeight, 510 units)
    //   - Canvas HEIGHT (vertical) representing the X-axis range (drawWidth, 500 units)
    //
    // User's requirement:
    //   Screen vertical (top→bottom) = G-code X-axis (0→500)
    //   Screen horizontal (left→right) = G-code Y-axis (50→560)
    //
    // So for G-code coordinates at each screen corner:
    //   - X value is based on VERTICAL position (top=min, bottom=max)
    //   - Y value is based on HORIZONTAL position (left=min, right=max)

    // X-axis bounds (vertical on screen): 0 to drawWidth (500)
    const xMin = offsetX;                    // 0 (top of screen)
    const xMax = offsetX + drawWidth;        // 500 (bottom of screen)

    // Y-axis bounds (horizontal on screen): 50 to drawHeight + offset (560)
    const yMin = offsetY;                    // 50 (left of screen)
    const yMax = offsetY + drawHeight;       // 560 (right of screen)

    const baseCorners = {
        // User's desired display:
        //   Top-Left (screen): X=0, Y=50
        //   Top-Right (screen): X=0, Y=560
        //   Bottom-Left (screen): X=500, Y=50
        //   Bottom-Right (screen): X=500, Y=560
        topLeft: { x: xMin, y: yMin },      // (X0, Y50)
        topRight: { x: xMin, y: yMax },     // (X0, Y560)
        bottomLeft: { x: xMax, y: yMin },   // (X500, Y50)
        bottomRight: { x: xMax, y: yMax }   // (X500, Y560)
    };

    // Apply rotation (rotates which corner maps to which screen position)
    switch (rotation) {
        case 90:
            return {
                topLeft: baseCorners.bottomLeft,
                topRight: baseCorners.topLeft,
                bottomLeft: baseCorners.bottomRight,
                bottomRight: baseCorners.topRight
            };
        case 180:
            return {
                topLeft: baseCorners.bottomRight,
                topRight: baseCorners.bottomLeft,
                bottomLeft: baseCorners.topRight,
                bottomRight: baseCorners.topLeft
            };
        case 270:
            return {
                topLeft: baseCorners.topRight,
                topRight: baseCorners.bottomRight,
                bottomLeft: baseCorners.topLeft,
                bottomRight: baseCorners.bottomLeft
            };
        default: // 0
            return baseCorners;
    }
}

/**
 * Format coordinate for display
 * @param {Object} coord - {x, y} coordinate
 * @returns {string} Formatted string like "(X0, Y50)"
 */
export function formatCoordinate(coord) {
    if (!coord || isNaN(coord.x) || isNaN(coord.y)) {
        return "(Error)";
    }
    return `(X${coord.x.toFixed(0)}, Y${coord.y.toFixed(0)})`;
}
