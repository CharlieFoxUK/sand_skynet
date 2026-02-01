/**
 * Boundary Clipping Utility
 * 
 * Clips G-code paths to stay within the drawing boundary.
 * When a path exits the boundary, it traces along the edge to the re-entry point.
 */

/**
 * Check if a point is inside the drawing boundary
 * @param {Object} point - {x, y} coordinates
 * @param {Object} bounds - {minX, maxX, minY, maxY}
 * @returns {boolean}
 */
export function isInsideBoundary(point, bounds) {
    return point.x >= bounds.minX && point.x <= bounds.maxX &&
        point.y >= bounds.minY && point.y <= bounds.maxY;
}



/**
 * Find the intersection point of a line segment with a boundary edge
 * Uses parametric line intersection
 * @param {Object} p1 - Start point {x, y}
 * @param {Object} p2 - End point {x, y}
 * @param {Object} bounds - {minX, maxX, minY, maxY}
 * @returns {Object|null} Intersection point {x, y, edge} or null
 */
export function findBoundaryIntersection(p1, p2, bounds) {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;

    let tMin = 0;
    let tMax = 1;
    let exitEdge = null;

    // Check each boundary edge
    const edges = [
        { p: -dx, q: p1.x - bounds.minX, edge: 'left' },
        { p: dx, q: bounds.maxX - p1.x, edge: 'right' },
        { p: -dy, q: p1.y - bounds.minY, edge: 'bottom' },
        { p: dy, q: bounds.maxY - p1.y, edge: 'top' }
    ];

    for (const { p, q, edge } of edges) {
        if (p === 0) {
            // Line is parallel to this edge
            if (q < 0) return null; // Line is outside
        } else {
            const t = q / p;
            if (p < 0) {
                // Entering boundary
                if (t > tMin) {
                    tMin = t;
                }
            } else {
                // Exiting boundary
                if (t < tMax) {
                    tMax = t;
                    exitEdge = edge;
                }
            }
        }
    }

    if (tMin > tMax) return null;

    // Return the first intersection (exit point from inside to outside)
    const t = tMax;
    if (t > 0 && t < 1) {
        return {
            x: p1.x + t * dx,
            y: p1.y + t * dy,
            edge: exitEdge,
            t: t
        };
    }

    return null;
}

/**
 * Find entry intersection (from outside to inside)
 * @param {Object} p1 - Start point (outside)
 * @param {Object} p2 - End point (inside)
 * @param {Object} bounds - Boundary
 * @returns {Object|null} Entry point
 */
export function findEntryIntersection(p1, p2, bounds) {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;

    let tMin = 0;
    let entryEdge = null;

    const edges = [
        { p: -dx, q: p1.x - bounds.minX, edge: 'left' },
        { p: dx, q: bounds.maxX - p1.x, edge: 'right' },
        { p: -dy, q: p1.y - bounds.minY, edge: 'bottom' },
        { p: dy, q: bounds.maxY - p1.y, edge: 'top' }
    ];

    for (const { p, q, edge } of edges) {
        if (p !== 0) {
            const t = q / p;
            if (p < 0 && t > tMin && t <= 1) {
                tMin = t;
                entryEdge = edge;
            }
        }
    }

    if (tMin > 0 && tMin <= 1) {
        return {
            x: p1.x + tMin * dx,
            y: p1.y + tMin * dy,
            edge: entryEdge,
            t: tMin
        };
    }

    return null;
}

/**
 * Clamp a point to the boundary
 * @param {Object} point - {x, y}
 * @param {Object} bounds - {minX, maxX, minY, maxY}
 * @returns {Object} Clamped point
 */
export function clampToBoundary(point, bounds) {
    return {
        x: Math.max(bounds.minX, Math.min(bounds.maxX, point.x)),
        y: Math.max(bounds.minY, Math.min(bounds.maxY, point.y))
    };
}

/**
 * Get the corner between two edges
 * @param {string} edge1 - First edge
 * @param {string} edge2 - Second edge
 * @param {Object} bounds - Boundary
 * @returns {Object|null} Corner point
 */
function getCorner(edge1, edge2, bounds) {
    const corners = {
        'left-top': { x: bounds.minX, y: bounds.maxY },
        'top-left': { x: bounds.minX, y: bounds.maxY },
        'left-bottom': { x: bounds.minX, y: bounds.minY },
        'bottom-left': { x: bounds.minX, y: bounds.minY },
        'right-top': { x: bounds.maxX, y: bounds.maxY },
        'top-right': { x: bounds.maxX, y: bounds.maxY },
        'right-bottom': { x: bounds.maxX, y: bounds.minY },
        'bottom-right': { x: bounds.maxX, y: bounds.minY }
    };

    return corners[`${edge1}-${edge2}`] || null;
}

/**
 * Generate path along the boundary from exit point to entry point
 * Takes the shorter path around the perimeter
 * @param {Object} exitPoint - {x, y, edge} where path exits
 * @param {Object} entryPoint - {x, y, edge} where path re-enters
 * @param {Object} bounds - {minX, maxX, minY, maxY}
 * @returns {Array} Array of points along the boundary
 */
export function traceBoundary(exitPoint, entryPoint, bounds) {
    const path = [];

    // If on the same edge, just draw directly
    if (exitPoint.edge === entryPoint.edge) {
        return [{ x: entryPoint.x, y: entryPoint.y }];
    }

    // Define edge traversal order (clockwise)
    const edgeOrder = ['top', 'right', 'bottom', 'left'];
    const edgeIndex = {
        'top': 0,
        'right': 1,
        'bottom': 2,
        'left': 3
    };

    const startIdx = edgeIndex[exitPoint.edge];
    const endIdx = edgeIndex[entryPoint.edge];

    // Calculate clockwise and counter-clockwise distances
    const cwDist = (endIdx - startIdx + 4) % 4;
    const ccwDist = (startIdx - endIdx + 4) % 4;

    // Choose shorter path
    const goClockwise = cwDist <= ccwDist;
    const step = goClockwise ? 1 : -1;

    let currentIdx = startIdx;

    // Traverse edges until we reach the entry edge
    while (currentIdx !== endIdx) {
        const nextIdx = (currentIdx + step + 4) % 4;
        const currentEdge = edgeOrder[currentIdx];
        const nextEdge = edgeOrder[nextIdx];

        // Add corner between current and next edge
        const corner = getCorner(currentEdge, nextEdge, bounds);
        if (corner) {
            path.push(corner);
        }

        currentIdx = nextIdx;
    }

    // Add the entry point
    path.push({ x: entryPoint.x, y: entryPoint.y });

    return path;
}

/**
 * Clip a single path to the boundary
 * When the path exits, traces along the edge to the re-entry point
 * @param {Array} path - Array of {x, y} points (in G-code coordinates)
 * @param {Object} bounds - {minX, maxX, minY, maxY}
 * @returns {Array} Clipped path with boundary tracing
 */
export function clipPathToBoundary(path, bounds) {
    if (!path || path.length < 2) {
        return path;
    }

    const result = [];
    let wasInside = isInsideBoundary(path[0], bounds);

    // Handle first point
    if (wasInside) {
        result.push({ ...path[0] });
    } else {
        // Start outside - clamp to boundary
        result.push(clampToBoundary(path[0], bounds));
    }

    for (let i = 1; i < path.length; i++) {
        const prev = path[i - 1];
        const curr = path[i];

        // Skip invalid points
        if (curr.isBreak || isNaN(curr.x) || isNaN(curr.y)) {
            result.push(curr);
            wasInside = false;
            continue;
        }

        const currInside = isInsideBoundary(curr, bounds);

        if (wasInside && currInside) {
            // Both inside - add point normally
            result.push({ ...curr });
        } else if (wasInside && !currInside) {
            // Exiting boundary - find exit point
            const exit = findBoundaryIntersection(prev, curr, bounds);
            if (exit) {
                result.push({ x: exit.x, y: exit.y, exitEdge: exit.edge });
            }

            // Look ahead to find where we re-enter
            let reentryIdx = -1;
            let entryPoint = null;

            for (let j = i + 1; j < path.length; j++) {
                const futurePoint = path[j];
                if (futurePoint.isBreak || isNaN(futurePoint.x) || isNaN(futurePoint.y)) {
                    break;
                }

                if (isInsideBoundary(futurePoint, bounds)) {
                    // Found re-entry - get intersection point
                    const prevOutside = path[j - 1];
                    entryPoint = findEntryIntersection(prevOutside, futurePoint, bounds);
                    reentryIdx = j;
                    break;
                }
            }

            if (entryPoint && exit) {
                // Trace along boundary to entry point
                const boundaryPath = traceBoundary(exit, entryPoint, bounds);
                for (const pt of boundaryPath) {
                    result.push({ ...pt });
                }

                // Skip to the re-entry point
                i = reentryIdx - 1; // Will be incremented by loop
            } else {
                // No re-entry found - just clamp to boundary
                result.push(clampToBoundary(curr, bounds));
            }
        } else if (!wasInside && currInside) {
            // Re-entering boundary
            const entry = findEntryIntersection(prev, curr, bounds);
            if (entry) {
                result.push({ x: entry.x, y: entry.y });
            }
            result.push({ ...curr });
        } else {
            // Both outside - check if line crosses through
            // For now, just skip (the look-ahead handles this)
        }

        wasInside = currInside;
    }

    return result;
}

/**
 * Get boundary limits from table config
 * @param {Object} config - Table config from getTableConfig()
 * @returns {Object} {minX, maxX, minY, maxY}
 */
export function getBoundsFromConfig(config) {
    const { drawWidth, drawHeight, offsetX, offsetY } = config;
    return {
        minX: offsetX,
        maxX: offsetX + drawWidth,
        minY: offsetY,
        maxY: offsetY + drawHeight
    };
}
