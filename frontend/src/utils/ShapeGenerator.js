
// Shape generation utilities
// All shapes return an array of {x, y} points centered at 0,0 with approx size 100 (radius or side)

export const generateLine = (length = 100) => {
    return [
        { x: -length / 2, y: 0 },
        { x: length / 2, y: 0 }
    ];
};

export const generateSquare = (size = 100) => {
    const half = size / 2;
    return [
        { x: -half, y: -half },
        { x: half, y: -half },
        { x: half, y: half },
        { x: -half, y: half },
        { x: -half, y: -half } // Close loop
    ];
};

export const generateTriangle = (size = 100) => {
    const height = size * (Math.sqrt(3) / 2);
    // Centroid adjustment to keep center at 0,0
    const topY = -height * (2 / 3);
    const bottomY = height * (1 / 3);

    return [
        { x: 0, y: topY },
        { x: size / 2, y: bottomY },
        { x: -size / 2, y: bottomY },
        { x: 0, y: topY } // Close loop
    ];
};

export const generateCircle = (radius = 50, segments = 64) => {
    const points = [];
    for (let i = 0; i <= segments; i++) {
        const theta = (i / segments) * 2 * Math.PI;
        points.push({
            x: radius * Math.cos(theta),
            y: radius * Math.sin(theta)
        });
    }
    return points;
};

export const generateStar = (outerRadius = 50, innerRadius = 20, points = 5) => {
    const results = [];
    const angleStep = Math.PI / points;

    for (let i = 0; i <= 2 * points; i++) {
        const r = i % 2 === 0 ? outerRadius : innerRadius;
        // Start at -90deg (top)
        const theta = i * angleStep - Math.PI / 2;

        results.push({
            x: r * Math.cos(theta),
            y: r * Math.sin(theta)
        });
    }
    return results;
};
