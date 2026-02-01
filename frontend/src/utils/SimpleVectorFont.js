
// Simple Single-Stroke Vector Font (Stick Font)
// Characters are defined as arrays of strokes.
// Each stroke is an array of points {x, y} normalized to 0-1 box.
// y=0 is top, y=1 is bottom (SVG style), but we'll flip if needed.

const fontMap = {
    'A': [[{ x: 0, y: 1 }, { x: 0.5, y: 0 }, { x: 1, y: 1 }], [{ x: 0.25, y: 0.5 }, { x: 0.75, y: 0.5 }]],
    'B': [[{ x: 0, y: 1 }, { x: 0, y: 0 }, { x: 0.7, y: 0 }, { x: 1, y: 0.25 }, { x: 0.7, y: 0.5 }, { x: 0, y: 0.5 }], [{ x: 0, y: 0.5 }, { x: 0.7, y: 0.5 }, { x: 1, y: 0.75 }, { x: 0.7, y: 1 }, { x: 0, y: 1 }]],
    'C': [[{ x: 1, y: 0.2 }, { x: 0.5, y: 0 }, { x: 0, y: 0.5 }, { x: 0.5, y: 1 }, { x: 1, y: 0.8 }]],
    'D': [[{ x: 0, y: 1 }, { x: 0, y: 0 }, { x: 0.6, y: 0 }, { x: 1, y: 0.5 }, { x: 0.6, y: 1 }, { x: 0, y: 1 }]],
    'E': [[{ x: 1, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }], [{ x: 0, y: 0.5 }, { x: 0.8, y: 0.5 }]],
    'F': [[{ x: 1, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 1 }], [{ x: 0, y: 0.5 }, { x: 0.8, y: 0.5 }]],
    'G': [[{ x: 1, y: 0.2 }, { x: 0.5, y: 0 }, { x: 0, y: 0.5 }, { x: 0.5, y: 1 }, { x: 1, y: 0.5 }, { x: 0.8, y: 0.5 }]],
    'H': [[{ x: 0, y: 0 }, { x: 0, y: 1 }], [{ x: 1, y: 0 }, { x: 1, y: 1 }], [{ x: 0, y: 0.5 }, { x: 1, y: 0.5 }]],
    'I': [[{ x: 0.5, y: 0 }, { x: 0.5, y: 1 }], [{ x: 0.2, y: 0 }, { x: 0.8, y: 0 }], [{ x: 0.2, y: 1 }, { x: 0.8, y: 1 }]],
    'J': [[{ x: 0.8, y: 0 }, { x: 0.8, y: 0.8 }, { x: 0.5, y: 1 }, { x: 0.2, y: 0.8 }]],
    'K': [[{ x: 0, y: 0 }, { x: 0, y: 1 }], [{ x: 1, y: 0 }, { x: 0, y: 0.5 }, { x: 1, y: 1 }]],
    'L': [[{ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }]],
    'M': [[{ x: 0, y: 1 }, { x: 0, y: 0 }, { x: 0.5, y: 0.6 }, { x: 1, y: 0 }, { x: 1, y: 1 }]],
    'N': [[{ x: 0, y: 1 }, { x: 0, y: 0 }, { x: 1, y: 1 }, { x: 1, y: 0 }]],
    'O': [[{ x: 0.5, y: 0 }, { x: 1, y: 0.5 }, { x: 0.5, y: 1 }, { x: 0, y: 0.5 }, { x: 0.5, y: 0 }]],
    'P': [[{ x: 0, y: 1 }, { x: 0, y: 0 }, { x: 0.8, y: 0 }, { x: 1, y: 0.25 }, { x: 0.8, y: 0.5 }, { x: 0, y: 0.5 }]],
    'Q': [[{ x: 0.5, y: 0 }, { x: 1, y: 0.5 }, { x: 0.5, y: 1 }, { x: 0, y: 0.5 }, { x: 0.5, y: 0 }], [{ x: 0.7, y: 0.7 }, { x: 1, y: 1 }]],
    'R': [[{ x: 0, y: 1 }, { x: 0, y: 0 }, { x: 0.8, y: 0 }, { x: 1, y: 0.25 }, { x: 0.8, y: 0.5 }, { x: 0, y: 0.5 }, { x: 1, y: 1 }]],
    'S': [[{ x: 1, y: 0.2 }, { x: 0.5, y: 0 }, { x: 0.2, y: 0.2 }, { x: 0.8, y: 0.8 }, { x: 0.5, y: 1 }, { x: 0, y: 0.8 }]],
    'T': [[{ x: 0.5, y: 0 }, { x: 0.5, y: 1 }], [{ x: 0, y: 0 }, { x: 1, y: 0 }]],
    'U': [[{ x: 0, y: 0 }, { x: 0, y: 0.8 }, { x: 0.5, y: 1 }, { x: 1, y: 0.8 }, { x: 1, y: 0 }]],
    'V': [[{ x: 0, y: 0 }, { x: 0.5, y: 1 }, { x: 1, y: 0 }]],
    'W': [[{ x: 0, y: 0 }, { x: 0.2, y: 1 }, { x: 0.5, y: 0.5 }, { x: 0.8, y: 1 }, { x: 1, y: 0 }]],
    'X': [[{ x: 0, y: 0 }, { x: 1, y: 1 }], [{ x: 1, y: 0 }, { x: 0, y: 1 }]],
    'Y': [[{ x: 0, y: 0 }, { x: 0.5, y: 0.5 }, { x: 1, y: 0 }], [{ x: 0.5, y: 0.5 }, { x: 0.5, y: 1 }]],
    'Z': [[{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }]],

    '0': [[{ x: 0.5, y: 0 }, { x: 1, y: 0.5 }, { x: 0.5, y: 1 }, { x: 0, y: 0.5 }, { x: 0.5, y: 0 }, { x: 1, y: 0.8 }]],
    '1': [[{ x: 0.2, y: 0.2 }, { x: 0.5, y: 0 }, { x: 0.5, y: 1 }, { x: 0.2, y: 1 }, { x: 0.8, y: 1 }]],
    '2': [[{ x: 0, y: 0.2 }, { x: 0.5, y: 0 }, { x: 1, y: 0.2 }, { x: 1, y: 0.5 }, { x: 0, y: 1 }, { x: 1, y: 1 }]],
    '3': [[{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0.5, y: 0.5 }, { x: 1, y: 0.5 }, { x: 1, y: 0.8 }, { x: 0.5, y: 1 }, { x: 0, y: 0.8 }]],
    '4': [[{ x: 0.7, y: 1 }, { x: 0.7, y: 0 }, { x: 0, y: 0.7 }, { x: 1, y: 0.7 }]],
    '5': [[{ x: 1, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0.4 }, { x: 0.5, y: 0.4 }, { x: 1, y: 0.6 }, { x: 1, y: 0.8 }, { x: 0.5, y: 1 }, { x: 0, y: 0.8 }]],
    '6': [[{ x: 1, y: 0.2 }, { x: 0.5, y: 0 }, { x: 0, y: 0.5 }, { x: 0, y: 0.8 }, { x: 0.5, y: 1 }, { x: 1, y: 0.8 }, { x: 1, y: 0.5 }, { x: 0, y: 0.5 }]],
    '7': [[{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0.4, y: 1 }]],
    '8': [[{ x: 0.5, y: 0.5 }, { x: 1, y: 0.25 }, { x: 0.5, y: 0 }, { x: 0, y: 0.25 }, { x: 0.5, y: 0.5 }, { x: 1, y: 0.75 }, { x: 0.5, y: 1 }, { x: 0, y: 0.75 }, { x: 0.5, y: 0.5 }]],
    '9': [[{ x: 1, y: 0.5 }, { x: 0, y: 0.5 }, { x: 0, y: 0.2 }, { x: 0.5, y: 0 }, { x: 1, y: 0.2 }, { x: 1, y: 0.5 }, { x: 0.5, y: 1 }, { x: 0, y: 0.8 }]],

    '-': [[{ x: 0.2, y: 0.5 }, { x: 0.8, y: 0.5 }]],
    ' ': [] // Space
};

/**
 * Generates points for a string of text.
 * @param {string} text The text to render
 * @param {number} size Height of the text
 * @param {number} startX Starting X coordinate (center of string? no, left)
 * @param {number} startY Starting Y coordinate (top)
 * @returns {Array<Array<{x,y}>>} Array of paths (strokes)
 */
export const getTextPoints = (text, size, startX, startY) => {
    const paths = [];
    const spacing = size * 0.8; // default letter spacing
    const width = 0.5 * size; // roughly

    let cursorX = startX;

    // Calculate total width to center it?
    // User wants to add "text" object, usually centered.
    // Let's assume startX/Y is the CENTER of the text object.

    text = text.toUpperCase();

    // First pass: calculate total width
    let totalWidth = 0;
    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        if (fontMap[char]) {
            totalWidth += size * 0.8;
        } else if (char === ' ') {
            totalWidth += size * 0.5;
        } else {
            totalWidth += size * 0.8; // unknown char placeholder
        }
    }

    // Re-adjust startX to be left-aligned relative to the requested center
    cursorX = -totalWidth / 2;
    const cursorY = -size / 2; // vertically centered

    for (let i = 0; i < text.length; i++) {
        const char = text[i];

        if (char === ' ') {
            cursorX += size * 0.5;
            continue;
        }

        const strokes = fontMap[char];
        if (strokes) {
            for (const stroke of strokes) {
                const points = stroke.map(p => ({
                    x: cursorX + p.x * (size * 0.7), // Scale width a bit
                    y: cursorY + p.y * size
                }));
                paths.push(points);
            }
        }

        cursorX += size * 0.9;
    }

    return paths;
};
