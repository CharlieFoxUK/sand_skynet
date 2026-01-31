import React from 'react';
import { Card } from 'react-bootstrap';

const Visualizer = ({ settings }) => {
    // Helper to safely get values
    const getVal = (key) => {
        try {
            return parseFloat(settings.device[key].value);
        } catch (e) {
            return 0;
        }
    };

    const getSetting = (key, defaultVal) => {
        try {
            return settings.device[key].value;
        } catch (e) {
            return defaultVal;
        }
    }

    const physW = getVal('physical_width') || 500;
    const physH = getVal('physical_height') || 500;
    const drawW = getVal('width') || 100;
    const drawH = getVal('height') || 100;
    const offX = getVal('offset_x') || 0;
    const offY = getVal('offset_y') || 0;

    const orientationOrigin = getSetting('orientation_origin', 'Bottom-Left');
    const orientationSwap = getSetting('orientation_swap', false);

    // Scale for display (fit within 600px width)
    const maxDim = Math.max(physW, physH, 1);
    const scale = 600 / maxDim;
    const displayW = physW * scale;
    const displayH = physH * scale;

    // SVG Coordinate Helper: Flip Y because SVG is Top-Down, Machine is Bottom-Up
    const toSvgY = (y) => physH - y;

    // Arrow Helper (Inline function to avoid React component issues)
    const renderArrow = (x1, y1, x2, y2, color, label) => {
        const angle = Math.atan2(y2 - y1, x2 - x1);
        const headLen = 15 / scale;
        return (
            <g stroke={color} fill={color} strokeWidth={3 / scale} key={label}>
                <line x1={x1} y1={y1} x2={x2} y2={y2} />
                <path d={`M ${x2} ${y2} L ${x2 - headLen * Math.cos(angle - Math.PI / 6)} ${y2 - headLen * Math.sin(angle - Math.PI / 6)} L ${x2 - headLen * Math.cos(angle + Math.PI / 6)} ${y2 - headLen * Math.sin(angle + Math.PI / 6)} Z`} stroke="none" />
                <text x={x2 + 20 / scale * Math.cos(angle)} y={y2 + 20 / scale * Math.sin(angle)} fontSize={20 / scale} fontWeight="bold" stroke="none" textAnchor="middle" alignmentBaseline="middle" fill="black">{label}</text>
            </g>
        );
    };

    // Determine Drawing Origin (Physical Bottom-Left of the Drawing Area)
    // User requested: "drawing X and Y axis should be true to the physical x and y axis"
    // and "0,0 corner... closest to physical 0,0... with correct offset"
    // So we always show the axes originating from (offX, offY) and pointing in Physical +X, +Y directions.
    let originX = offX;
    let originY = offY;
    let axisXX = 1;
    let axisXY = 0;
    let axisYX = 0;
    let axisYY = 1;

    const arrowLen = Math.min(drawW, drawH) * 0.4;
    const padding = 80 / scale; // Increased padding around the table

    return (
        <Card className="mb-3 mt-3">
            <Card.Header>Table Visualization</Card.Header>
            <Card.Body className="text-center">
                <svg width="100%" height="100%" style={{ maxWidth: '600px', maxHeight: '600px', border: '1px solid #ccc', backgroundColor: '#fafafa' }} viewBox={`${-padding} ${-padding} ${physW + padding * 2} ${physH + padding * 2}`}>
                    {/* Physical Area */}
                    <rect x={0} y={0} width={physW} height={physH} fill="#ffe6e6" stroke="red" strokeWidth={2 / scale} />

                    {/* Drawing Area */}
                    <rect x={offX} y={toSvgY(offY + drawH)} width={drawW} height={drawH} fill="#e6ffe6" stroke="green" strokeWidth={2 / scale} opacity={0.8} />

                    {/* Physical Axes (Bottom-Left) */}
                    {renderArrow(0, toSvgY(0), 80 / scale, toSvgY(0), "red", "Phys X")}
                    {renderArrow(0, toSvgY(0), 0, toSvgY(80 / scale), "red", "Phys Y")}
                    <circle cx={0} cy={toSvgY(0)} r={5 / scale} fill="red" />
                    <text x={-15 / scale} y={toSvgY(-15 / scale)} fontSize={18 / scale} fontWeight="bold" fill="black" stroke="none" textAnchor="end">Phys(0,0)</text>

                    {/* Physical Dimensions Label */}
                    <text x={physW / 2} y={-30 / scale} fontSize={18 / scale} fill="red" stroke="none" textAnchor="middle">Physical Width: {physW}</text>
                    <text x={-30 / scale} y={physH / 2} fontSize={18 / scale} fill="red" stroke="none" textAnchor="middle" transform={`rotate(-90, ${-30 / scale}, ${physH / 2})`}>Physical Height: {physH}</text>

                    {/* Drawing Axes (Aligned with Physical) */}
                    {renderArrow(
                        originX, toSvgY(originY),
                        originX + axisXX * arrowLen, toSvgY(originY + axisXY * arrowLen),
                        "green", "Draw X"
                    )}
                    {renderArrow(
                        originX, toSvgY(originY),
                        originX + axisYX * arrowLen, toSvgY(originY + axisYY * arrowLen),
                        "green", "Draw Y"
                    )}
                    <circle cx={originX} cy={toSvgY(originY)} r={5 / scale} fill="green" />
                    <text x={originX + 15 / scale} y={toSvgY(originY) - 15 / scale} fontSize={18 / scale} fontWeight="bold" fill="black" stroke="none">
                        ({originX}, {originY})
                    </text>

                    {/* Center Label */}
                    <text x={offX + drawW / 2} y={toSvgY(offY + drawH / 2)} fontSize={18 / scale} fill="black" textAnchor="middle" alignmentBaseline="middle" stroke="none" fontWeight="bold">
                        Drawing Area
                    </text>
                </svg>
                <div className="mt-2 text-muted" style={{ fontSize: '12px' }}>
                    Red: Physical Limits | Green: Drawing Area (with Orientation)
                </div>
            </Card.Body>
        </Card>
    );
};

export default Visualizer;
