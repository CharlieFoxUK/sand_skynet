/**
 * Pattern Builder - GCode Generator
 * 
 * Converts pattern points to GCode for the sand table.
 */

/**
 * Generate GCode from layers
 * @param {Array} layers - Array of layer objects
 * @param {Object} settings - Settings object with tableWidth, tableHeight, offsetX, offsetY, feedrate
 * @returns {string} - GCode string
 */
export function generateGCode(layers, settings) {
    const {
        tableWidth = 300,
        tableHeight = 300,
        offsetX = 0,
        offsetY = 0,
        feedrate = 2000
    } = settings;

    // Use the smaller dimension to maintain aspect ratio within a centered circle/square
    const tableSize = Math.min(tableWidth, tableHeight);
    const centerX = tableWidth / 2 + offsetX;
    const centerY = tableHeight / 2 + offsetY;

    let gcode = "";
    let firstMove = true;
    let firstCut = true;

    // Filter visible layers and generate points
    const visibleLayers = layers.filter(layer => layer.visible !== false);

    visibleLayers.forEach((layer, layerIndex) => {
        const points = layer.points || [];
        if (points.length === 0) return;

        // Convert normalized points (-1 to 1) to table coordinates
        // Also handle NaN points (stroke breaks)
        const tablePoints = points.map(p => {
            if (isNaN(p.x) || isNaN(p.y) || p.isBreak) {
                return { isBreak: true };
            }
            return {
                x: (p.x * tableSize / 2) + centerX,
                y: (p.y * tableSize / 2) + centerY
            };
        });

        let needsRapidMove = true;

        for (let i = 0; i < tablePoints.length; i++) {
            const p = tablePoints[i];

            if (p.isBreak) {
                // Next point will need a rapid move
                needsRapidMove = true;
                continue;
            }

            if (needsRapidMove) {
                // Rapid move to this position
                gcode += `G0 X${p.x.toFixed(3)} Y${p.y.toFixed(3)}`;
                if (firstMove) {
                    gcode += " ; TYPE: PRE-TRANSFORMED";
                    firstMove = false;
                }
                gcode += "\n";
                needsRapidMove = false;
            } else {
                // Linear move (drawing)
                gcode += `G1 X${p.x.toFixed(3)} Y${p.y.toFixed(3)}`;
                if (firstCut) {
                    gcode += ` F${feedrate}`;
                    firstCut = false;
                }
                gcode += "\n";
            }
        }
    });

    return gcode;
}

/**
 * Upload GCode to the sand table as a drawing
 * @param {string} gcode - GCode string
 * @param {string} name - Drawing name
 * @returns {Promise} - Fetch promise
 */
export async function uploadGCode(gcode, name) {
    const blob = new Blob([gcode], { type: 'text/plain' });

    let filename = name.trim();
    if (filename === "") {
        filename = `pattern_${Date.now()}`;
    }
    if (!filename.toLowerCase().endsWith(".gcode")) {
        filename += ".gcode";
    }

    const formData = new FormData();
    formData.append('file', blob, filename);
    formData.append('filename', filename);

    const response = await fetch('/api/upload/', {
        method: 'POST',
        body: formData
    });

    if (response.ok) {
        window.showToast?.(`Pattern "${name}" sent to drawings!`);
    } else {
        window.showToast?.(`Error uploading pattern "${name}"`);
        throw new Error('Upload failed');
    }

    return response.json();
}
