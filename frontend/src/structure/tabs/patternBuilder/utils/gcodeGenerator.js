/**
 * Pattern Builder - GCode Generator
 * 
 * Uses the shared gcodeGenerator utility for consistent coordinate handling
 * across all canvas pages.
 */

import { generateGCode as sharedGenerateGCode, CoordinateType } from '../../../../utils/gcodeGenerator';
import { getTableConfig } from '../../../../utils/tableConfig';

/**
 * Generate GCode from layers
 * @param {Array} layers - Array of layer objects with points
 * @param {Object} settings - Redux settings object
 * @param {Object} options - Options including feedrate
 * @returns {string} - GCode string
 */
export function generateGCode(layers, settings, options = {}) {
    const { feedrate = 2000 } = options;
    const config = getTableConfig(settings);

    // Filter visible layers and extract their points
    const visibleLayers = layers.filter(layer => layer.visible !== false);

    // Convert layer points to paths format
    // PatternBuilder uses -1 to 1 normalized coordinates
    const paths = visibleLayers.map(layer => {
        const points = layer.points || [];
        if (points.length === 0) return [];

        // Convert points, handling stroke breaks
        return points.map(p => {
            if (isNaN(p.x) || isNaN(p.y) || p.isBreak) {
                return { x: NaN, y: NaN, isBreak: true };
            }
            return { x: p.x, y: p.y };
        });
    }).filter(path => path.length > 0);

    // Use shared generator with center-normalized coordinate type
    return sharedGenerateGCode(paths, config, {
        feedrate,
        coordinateType: CoordinateType.PATTERN_BUILDER
    });
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
