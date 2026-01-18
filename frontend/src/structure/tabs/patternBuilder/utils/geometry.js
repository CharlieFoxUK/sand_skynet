/**
 * Pattern Builder - Geometry Utilities
 * 
 * Pure math functions for generating pattern points.
 * All patterns return arrays of {x, y} points normalized to a unit circle/square.
 */

import { generateTextPoints } from './textFont';


/**
 * Generate points for a circle or regular polygon
 * @param {number} sides - Number of sides (use high number like 100+ for smooth circle)
 * @param {number} radius - Radius (0-1 normalized)
 * @param {number} rotation - Rotation in degrees
 * @returns {Array<{x: number, y: number}>}
 */
export function generatePolygon(sides = 100, radius = 1, rotation = 0) {
    const points = [];
    const rotRad = (rotation * Math.PI) / 180;

    for (let i = 0; i <= sides; i++) {
        const angle = (i / sides) * 2 * Math.PI + rotRad;
        points.push({
            x: radius * Math.cos(angle),
            y: radius * Math.sin(angle)
        });
    }
    return points;
}

/**
 * Generate points for an Archimedean spiral
 * @param {number} turns - Number of turns
 * @param {number} spacing - Space between turns (0-1)
 * @param {number} direction - 1 for outward, -1 for inward
 * @param {number} samples - Points per turn
 * @returns {Array<{x: number, y: number}>}
 */
export function generateArchimedeanSpiral(turns = 5, spacing = 0.1, direction = 1, samples = 50) {
    const points = [];
    const totalSamples = turns * samples;
    const maxRadius = turns * spacing;

    for (let i = 0; i <= totalSamples; i++) {
        const t = direction === 1 ? i / totalSamples : 1 - (i / totalSamples);
        const angle = t * turns * 2 * Math.PI;
        const r = t * maxRadius;
        points.push({
            x: r * Math.cos(angle),
            y: r * Math.sin(angle)
        });
    }

    // Normalize to fit in unit circle
    const scale = maxRadius > 0 ? 1 / maxRadius : 1;
    return points.map(p => ({ x: p.x * scale, y: p.y * scale }));
}

/**
 * Generate points for a Fermat spiral
 * @param {number} turns - Number of turns
 * @param {number} direction - 1 for outward, -1 for inward
 * @param {number} samples - Points per turn
 * @returns {Array<{x: number, y: number}>}
 */
export function generateFermatSpiral(turns = 5, direction = 1, samples = 50) {
    const points = [];
    const totalSamples = turns * samples;

    for (let i = 0; i <= totalSamples; i++) {
        const t = direction === 1 ? i / totalSamples : 1 - (i / totalSamples);
        const angle = t * turns * 2 * Math.PI;
        const r = Math.sqrt(t); // Fermat spiral: r = sqrt(theta)
        points.push({
            x: r * Math.cos(angle),
            y: r * Math.sin(angle)
        });
    }
    return points;
}

/**
 * Generate points for a rose curve (rhodonea)
 * @param {number} petals - Number of petals (n parameter)
 * @param {number} amplitude - Size of the rose (0-1)
 * @param {number} samples - Number of sample points
 * @returns {Array<{x: number, y: number}>}
 */
export function generateRose(petals = 5, amplitude = 1, samples = 360) {
    const points = [];
    // For odd n, rose has n petals; for even n, it has 2n petals
    const k = petals;
    const loops = petals % 2 === 0 ? 2 : 1;

    for (let i = 0; i <= samples * loops; i++) {
        const theta = (i / samples) * 2 * Math.PI;
        const r = amplitude * Math.cos(k * theta);
        points.push({
            x: r * Math.cos(theta),
            y: r * Math.sin(theta)
        });
    }
    return points;
}

/**
 * Generate points for an epitrochoid (spirograph pattern)
 * @param {number} outerRadius - Radius of fixed circle
 * @param {number} innerRadius - Radius of rolling circle
 * @param {number} penOffset - Distance of pen from center of rolling circle
 * @param {number} rotations - Number of full rotations
 * @param {number} samples - Points per rotation
 * @returns {Array<{x: number, y: number}>}
 */
export function generateSpirograph(outerRadius = 1, innerRadius = 0.3, penOffset = 0.5, rotations = 10, samples = 100) {
    const R = outerRadius;
    const r = innerRadius;
    const d = penOffset * r;
    const totalSamples = rotations * samples;

    let maxX = 0, maxY = 0;
    const rawPoints = [];

    for (let i = 0; i <= totalSamples; i++) {
        const t = (i / samples) * 2 * Math.PI;
        const x = (R - r) * Math.cos(t) + d * Math.cos(((R - r) / r) * t);
        const y = (R - r) * Math.sin(t) - d * Math.sin(((R - r) / r) * t);
        rawPoints.push({ x, y });
        maxX = Math.max(maxX, Math.abs(x));
        maxY = Math.max(maxY, Math.abs(y));
    }

    // Normalize to fit in unit circle
    const scale = Math.max(maxX, maxY);
    return rawPoints.map(p => ({ x: p.x / scale, y: p.y / scale }));
}

/**
 * Generate points for a star polygon
 * @param {number} points - Number of star points
 * @param {number} innerRatio - Inner radius as ratio of outer (0-1)
 * @param {number} rotation - Rotation in degrees
 * @returns {Array<{x: number, y: number}>}
 */
export function generateStar(numPoints = 5, innerRatio = 0.5, rotation = 0) {
    const points = [];
    const rotRad = (rotation * Math.PI) / 180;
    const outerRadius = 1;
    const innerRadius = outerRadius * innerRatio;

    for (let i = 0; i <= numPoints * 2; i++) {
        const angle = (i / (numPoints * 2)) * 2 * Math.PI + rotRad;
        const r = i % 2 === 0 ? outerRadius : innerRadius;
        points.push({
            x: r * Math.cos(angle - Math.PI / 2),
            y: r * Math.sin(angle - Math.PI / 2)
        });
    }
    return points;
}

/**
 * Generate points for a Lissajous curve
 * @param {number} freqX - Frequency in X direction
 * @param {number} freqY - Frequency in Y direction
 * @param {number} phase - Phase offset in degrees
 * @param {number} samples - Number of sample points
 * @returns {Array<{x: number, y: number}>}
 */
export function generateLissajous(freqX = 3, freqY = 2, phase = 90, samples = 360) {
    const points = [];
    const phaseRad = (phase * Math.PI) / 180;

    for (let i = 0; i <= samples; i++) {
        const t = (i / samples) * 2 * Math.PI;
        points.push({
            x: Math.sin(freqX * t + phaseRad),
            y: Math.sin(freqY * t)
        });
    }
    return points;
}

/**
 * Apply transformations to a set of points
 * @param {Array<{x: number, y: number}>} points - Input points
 * @param {Object} transform - Transform object with scale, rotation, offsetX, offsetY
 * @returns {Array<{x: number, y: number}>}
 */
export function transformPoints(points, transform) {
    const { scale = 1, rotation = 0, offsetX = 0, offsetY = 0 } = transform;
    const rotRad = (rotation * Math.PI) / 180;
    const cos = Math.cos(rotRad);
    const sin = Math.sin(rotRad);

    return points.map(p => {
        // Scale
        let x = p.x * scale;
        let y = p.y * scale;

        // Rotate
        const rx = x * cos - y * sin;
        const ry = x * sin + y * cos;

        // Translate
        return {
            x: rx + offsetX,
            y: ry + offsetY
        };
    });
}

/**
 * Generate points for a layer based on its pattern type and params
 * @param {Object} layer - Layer object with patternType, params, transform
 * @returns {Array<{x: number, y: number}>}
 */
export function generateLayerPoints(layer) {
    const { patternType, params = {}, transform = {} } = layer;
    let points = [];

    switch (patternType) {
        case 'circle':
            points = generatePolygon(
                params.sides || 100,
                params.radius || 1,
                params.rotation || 0
            );
            break;
        case 'polygon':
            points = generatePolygon(
                params.sides || 6,
                params.radius || 1,
                params.rotation || 0
            );
            break;
        case 'spiral':
            if (params.spiralType === 'fermat') {
                points = generateFermatSpiral(
                    params.turns || 5,
                    params.direction || 1,
                    params.samples || 50
                );
            } else {
                points = generateArchimedeanSpiral(
                    params.turns || 5,
                    params.spacing || 0.15,
                    params.direction || 1,
                    params.samples || 50
                );
            }
            break;
        case 'rose':
            points = generateRose(
                params.petals || 5,
                params.amplitude || 1,
                params.samples || 360
            );
            break;
        case 'spirograph':
            points = generateSpirograph(
                params.outerRadius || 1,
                params.innerRadius || 0.3,
                params.penOffset || 0.5,
                params.rotations || 10,
                params.samples || 100
            );
            break;
        case 'star':
            points = generateStar(
                params.points || 5,
                params.innerRatio || 0.5,
                params.rotation || 0
            );
            break;
        case 'lissajous':
            points = generateLissajous(
                params.freqX || 3,
                params.freqY || 2,
                params.phase || 90,
                params.samples || 360
            );
            break;
        case 'text':
            points = generateTextPoints(
                params.text || 'HELLO',
                params.fontSize || 0.3,
                params.letterSpacing || 0.05,
                params.centerX || 0,
                params.centerY || 0
            );
            break;
        default:
            points = generatePolygon(100, 1, 0);
    }

    return transformPoints(points, transform);
}
