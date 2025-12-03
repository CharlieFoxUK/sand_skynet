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

    const physW = getVal('physical_width') || 500;
    const physH = getVal('physical_height') || 500;
    const drawW = getVal('width') || 100;
    const drawH = getVal('height') || 100;
    const offX = getVal('offset_x') || 0;
    const offY = getVal('offset_y') || 0;

    // Scale for display (fit within 300px width)
    const scale = 300 / Math.max(physW, physH, 1);
    const displayW = physW * scale;
    const displayH = physH * scale;

    return (
        <Card className="mb-3 mt-3">
            <Card.Header>Table Visualization</Card.Header>
            <Card.Body className="text-center">
                <div style={{ display: 'inline-block', position: 'relative', width: displayW, height: displayH, border: '2px solid red', backgroundColor: '#ffe6e6' }}>
                    <span style={{ position: 'absolute', top: -25, left: 0, color: 'red', fontSize: '12px' }}>
                        Physical: {physW}x{physH}
                    </span>

                    <div style={{
                        position: 'absolute',
                        left: offX * scale,
                        top: (physH - offY - drawH) * scale, // Cartesian Y is usually bottom-up, SVG/HTML is top-down. 
                        // If offset_y is from bottom: top = (physH - offY - drawH)
                        // If offset_y is from top: top = offY
                        // Assuming standard CNC (bottom-left origin):
                        width: drawW * scale,
                        height: drawH * scale,
                        border: '2px solid green',
                        backgroundColor: '#e6ffe6',
                        opacity: 0.8
                    }}>
                        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', color: 'green', fontSize: '10px', whiteSpace: 'nowrap' }}>
                            Drawing Area<br />{drawW}x{drawH}
                        </div>
                    </div>
                </div>
                <div className="mt-2 text-muted" style={{ fontSize: '12px' }}>
                    Red: Physical Limits | Green: Safe Drawing Area
                </div>
            </Card.Body>
        </Card>
    );
};

export default Visualizer;
