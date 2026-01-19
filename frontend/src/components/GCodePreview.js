import React, { useEffect, useRef, useState } from 'react';
import { connect } from 'react-redux';
import { getSettings } from '../structure/tabs/settings/selector';
import { getTableConfig } from '../utils/tableConfig';

const GCodePreview = ({
    drawingId,
    settings,
    className,
    canvasClassName,
    strokeColor = "rgba(255, 255, 255, 0.8)",
    strokeWidth = 2,
    resolutionScale = 1
}) => {
    const canvasRef = useRef(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    useEffect(() => {
        let mounted = true;
        const fetchAndDraw = async () => {
            if (!drawingId) return;

            try {
                setLoading(true);
                // Fetch the raw G-code
                const response = await fetch(`/api/download/${drawingId}`);
                if (!response.ok) throw new Error("Failed to fetch G-code");
                const text = await response.text();

                if (mounted) {
                    drawGCode(text);
                    setLoading(false);
                }
            } catch (err) {
                console.error("Error loading G-code preview:", err);
                if (mounted) {
                    setError(true);
                    setLoading(false);
                }
            }
        };

        fetchAndDraw();

        return () => { mounted = false; };
    }, [drawingId, settings]); // Re-draw if settings change (e.g. orientation)

    const drawGCode = (gcode) => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        const width = canvas.width;
        const height = canvas.height;

        ctx.clearRect(0, 0, width, height);

        // Parse G-code to extract paths
        const lines = gcode.split('\n');
        const paths = [];
        let currentPath = [];

        // tableConfig gives us the "Safe Area" dimensions and offsets
        const config = getTableConfig(settings || {});

        // We need to map G-code (Machine) coordinates back to Screen coordinates
        // Based on user's config:
        // Screen Vertical (0->H) = Machine X (0->500)
        // Screen Horizontal (0->W) = Machine Y (50->560)

        // Bounds for normalization
        const minGCodeX = config.offsetX;
        const maxGCodeX = config.offsetX + config.drawWidth;
        const minGCodeY = config.offsetY;
        const maxGCodeY = config.offsetY + config.drawHeight;

        // Draw helper
        ctx.beginPath();
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = strokeWidth;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        let hasPoints = false;

        lines.forEach(line => {
            const l = line.trim().toUpperCase();
            if (l.startsWith('G0') || l.startsWith('G1')) {
                const xMatch = l.match(/X([\d.-]+)/);
                const yMatch = l.match(/Y([\d.-]+)/);

                if (xMatch && yMatch) {
                    const gx = parseFloat(xMatch[1]);
                    const gy = parseFloat(yMatch[1]);

                    // Transform Logic (Inverse of Canvas.js):
                    // G-code X is Screen Vertical (Y axis)
                    // G-code Y is Screen Horizontal (X axis)

                    // Normalize to 0-1
                    const normGCodeX = (gx - minGCodeX) / (maxGCodeX - minGCodeX); // 0-1 range of X axis
                    const normGCodeY = (gy - minGCodeY) / (maxGCodeY - minGCodeY); // 0-1 range of Y axis

                    // Map to Screen
                    // User Config: Screen Top->Bottom (Y) maps to Mach X
                    //              Screen Left->Right (X) maps to Mach Y

                    const screenX = normGCodeY * width;  // Machine Y -> Screen X
                    const screenY = normGCodeX * height; // Machine X -> Screen Y

                    if (l.startsWith('G0')) {
                        ctx.moveTo(screenX, screenY);
                    } else {
                        ctx.lineTo(screenX, screenY);
                    }
                    hasPoints = true;
                }
            }
        });

        if (hasPoints) {
            ctx.stroke();
        }
    };

    return (
        <div className={className} style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }}>
            {/* Background to match canvas look */}
            <div style={{
                position: 'absolute',
                top: 0, left: 0, right: 0, bottom: 0,
                backgroundColor: '#000',
                borderRadius: 'inherit'
            }} />

            <canvas
                ref={canvasRef}
                width={500 * resolutionScale}
                height={510 * resolutionScale}
                className={canvasClassName}
                style={{
                    width: '100%',
                    height: '100%',
                    position: 'relative',
                    zIndex: 1,
                    objectFit: 'contain'
                }}
            />

            {loading && (
                <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', color: '#666' }}>
                    Running...
                </div>
            )}
            {error && (
                <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', color: 'red', fontSize: '0.8rem' }}>
                    Preview Err
                </div>
            )}
        </div>
    );
};

const mapStateToProps = (state) => ({
    settings: getSettings(state)
});

export default connect(mapStateToProps)(GCodePreview);
