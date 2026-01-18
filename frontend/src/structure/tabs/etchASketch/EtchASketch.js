import React, { useRef, useState, useCallback, useEffect } from 'react';
import { Form, Button, Modal } from 'react-bootstrap';
import { Trash, Download, Broadcast, Gear } from 'react-bootstrap-icons';
import RotaryDial from './RotaryDial';
import { sendCommand } from '../../../sockets/sEmits';
import './EtchASketch.scss';

/**
 * EtchASketch - A manual drawing interface with rotary dial controls
 * Similar to the classic Etch-a-Sketch toy
 */
function EtchASketch() {
    const canvasRef = useRef(null);
    const containerRef = useRef(null);
    const [position, setPosition] = useState({ x: 0.5, y: 0.5 });
    const [liveTrack, setLiveTrack] = useState(false);
    const [gcodeLines, setGcodeLines] = useState([]);
    const [isInitialized, setIsInitialized] = useState(false);
    const [showSettings, setShowSettings] = useState(false);

    // Settings - resolution affects how many rotations needed to cross canvas
    // Lower value = more rotations needed
    const [resolution, setResolution] = useState(0.02); // Default: requires ~50 full rotations to cross

    // Cursor size setting (0 = invisible, 1 = normal, 2 = large)
    const [cursorSize, setCursorSize] = useState(1);

    // Display canvas size (fills available screen)
    const [displaySize, setDisplaySize] = useState({ width: 800, height: 600 });

    // Internal canvas resolution (high res for smooth lines)
    const INTERNAL_RESOLUTION = 2000;

    // Store path history for redrawing
    const pathRef = useRef([{ x: 0.5, y: 0.5 }]);

    // Machine bounds (normalized 0-1)
    const BOUNDS = { min: 0, max: 1 };

    // Calculate display size to fill available viewport
    useEffect(() => {
        const updateSize = () => {
            // Get viewport dimensions
            const viewportHeight = window.innerHeight;
            const viewportWidth = window.innerWidth;

            // Reserve space for: header (~70px), dials (~220px on mobile, ~250px on desktop), padding
            const headerHeight = 80;
            const dialsHeight = viewportWidth < 768 ? 200 : 230;
            const padding = 40;

            // Available height for canvas
            const availableHeight = viewportHeight - headerHeight - dialsHeight - padding;
            const availableWidth = viewportWidth - 40; // 20px padding each side

            // Use the maximum square that fits
            const size = Math.min(availableWidth, availableHeight, 1200);

            setDisplaySize({ width: size, height: size });
        };

        updateSize();
        window.addEventListener('resize', updateSize);
        return () => window.removeEventListener('resize', updateSize);
    }, []);

    // Draw the entire canvas (background + all paths)
    const redrawCanvas = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        const size = INTERNAL_RESOLUTION;

        // Clear and draw background
        ctx.fillStyle = '#0d0d0d';
        ctx.fillRect(0, 0, size, size);

        // Draw grid (finer grid for larger canvas)
        ctx.strokeStyle = '#1a1a1a';
        ctx.lineWidth = 1;
        const gridCount = 20;
        const gridSize = size / gridCount;
        for (let i = 0; i <= gridCount; i++) {
            ctx.beginPath();
            ctx.moveTo(i * gridSize, 0);
            ctx.lineTo(i * gridSize, size);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(0, i * gridSize);
            ctx.lineTo(size, i * gridSize);
            ctx.stroke();
        }

        // Draw major grid lines
        ctx.strokeStyle = '#2a2a2a';
        ctx.lineWidth = 2;
        const majorGridSize = size / 4;
        for (let i = 0; i <= 4; i++) {
            ctx.beginPath();
            ctx.moveTo(i * majorGridSize, 0);
            ctx.lineTo(i * majorGridSize, size);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(0, i * majorGridSize);
            ctx.lineTo(size, i * majorGridSize);
            ctx.stroke();
        }

        // Draw all path segments
        const path = pathRef.current;
        if (path.length > 1) {
            ctx.strokeStyle = '#20c997';
            ctx.lineWidth = 6; // Thicker line for high-res canvas
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';

            ctx.beginPath();
            const startX = path[0].x * size;
            const startY = (1 - path[0].y) * size;
            ctx.moveTo(startX, startY);

            for (let i = 1; i < path.length; i++) {
                const x = path[i].x * size;
                const y = (1 - path[i].y) * size;
                ctx.lineTo(x, y);
            }
            ctx.stroke();
        }

        // Draw current position indicator (cursor) - only if cursorSize > 0
        if (cursorSize > 0) {
            const currentX = position.x * size;
            const currentY = (1 - position.y) * size;

            // Scale factor based on cursor size setting
            const scale = cursorSize;

            // Outer glow
            ctx.beginPath();
            ctx.arc(currentX, currentY, 30 * scale, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(32, 201, 151, 0.2)';
            ctx.fill();

            // Middle ring
            ctx.beginPath();
            ctx.arc(currentX, currentY, 20 * scale, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(32, 201, 151, 0.4)';
            ctx.fill();

            // Inner dot
            ctx.beginPath();
            ctx.arc(currentX, currentY, 12 * scale, 0, Math.PI * 2);
            ctx.fillStyle = '#fff';
            ctx.fill();
            ctx.strokeStyle = '#20c997';
            ctx.lineWidth = 4 * scale;
            ctx.stroke();
        }

    }, [position, cursorSize]);

    // Initialize canvas
    useEffect(() => {
        setIsInitialized(true);
        pathRef.current = [{ x: 0.5, y: 0.5 }];
    }, []);

    // Redraw whenever position changes
    useEffect(() => {
        if (isInitialized) {
            redrawCanvas();
        }
    }, [position, isInitialized, redrawCanvas]);

    // Handle X dial rotation - resolution controls sensitivity
    const handleXChange = useCallback((delta) => {
        setPosition(prev => {
            // Apply resolution factor - lower resolution = smaller movement per dial turn
            const scaledDelta = delta * resolution;
            const newX = Math.max(BOUNDS.min, Math.min(BOUNDS.max, prev.x + scaledDelta));

            // Only process if position actually changed meaningfully
            if (Math.abs(newX - prev.x) > 0.0001) {
                const newPos = { x: newX, y: prev.y };

                // Add to path (only if moved enough to be visible)
                if (pathRef.current.length === 0 ||
                    Math.abs(newX - pathRef.current[pathRef.current.length - 1].x) > 0.0005) {
                    pathRef.current.push(newPos);
                }

                // Generate G-code
                const gcode = `G1 X${(newX * 100).toFixed(3)} Y${(prev.y * 100).toFixed(3)} F1000`;
                setGcodeLines(lines => [...lines, gcode]);

                // Send command if live tracking is enabled
                if (liveTrack) {
                    sendCommand(gcode);
                }

                return newPos;
            }
            return prev;
        });
    }, [liveTrack, resolution]);

    // Handle Y dial rotation
    const handleYChange = useCallback((delta) => {
        setPosition(prev => {
            // Apply resolution factor
            const scaledDelta = delta * resolution;
            const newY = Math.max(BOUNDS.min, Math.min(BOUNDS.max, prev.y + scaledDelta));

            // Only process if position actually changed meaningfully
            if (Math.abs(newY - prev.y) > 0.0001) {
                const newPos = { x: prev.x, y: newY };

                // Add to path
                if (pathRef.current.length === 0 ||
                    Math.abs(newY - pathRef.current[pathRef.current.length - 1].y) > 0.0005) {
                    pathRef.current.push(newPos);
                }

                // Generate G-code
                const gcode = `G1 X${(prev.x * 100).toFixed(3)} Y${(newY * 100).toFixed(3)} F1000`;
                setGcodeLines(lines => [...lines, gcode]);

                // Send command if live tracking is enabled
                if (liveTrack) {
                    sendCommand(gcode);
                }

                return newPos;
            }
            return prev;
        });
    }, [liveTrack, resolution]);

    // Clear canvas
    const handleClear = useCallback(() => {
        pathRef.current = [{ x: 0.5, y: 0.5 }];
        setPosition({ x: 0.5, y: 0.5 });
        setGcodeLines([]);
    }, []);

    // Download G-code
    const handleDownload = useCallback(() => {
        if (gcodeLines.length === 0) {
            window.showToast && window.showToast('No drawing to download');
            return;
        }

        const header = [
            '; Etch-a-Sketch Drawing',
            '; Generated by Sandypi',
            `; Lines: ${gcodeLines.length}`,
            `; Resolution setting: ${resolution}`,
            'G28 ; Home',
            'G90 ; Absolute positioning',
            ''
        ];

        const footer = [
            '',
            'G28 ; Return home',
            '; End of drawing'
        ];

        const fullGcode = [...header, ...gcodeLines, ...footer].join('\n');

        const blob = new Blob([fullGcode], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `etch-a-sketch-${Date.now()}.gcode`;
        a.click();
        URL.revokeObjectURL(url);

        window.showToast && window.showToast('G-code downloaded!');
    }, [gcodeLines, resolution]);

    // Calculate dial size based on viewport
    const dialSize = Math.min(window.innerWidth * 0.25, 180);

    // Calculate approximate rotations needed to cross canvas
    const rotationsNeeded = Math.round(1 / (resolution * 0.1));

    return (
        <div className="etch-a-sketch-container" ref={containerRef}>
            {/* Header Controls */}
            <div className="etch-header">
                <h4 className="mb-0">Etch-a-Sketch</h4>
                <div className="etch-controls">
                    <Form.Check
                        type="switch"
                        id="live-track-switch"
                        label={
                            <span className={liveTrack ? 'text-success' : 'text-muted'}>
                                <Broadcast className="mr-1" />
                                Live {liveTrack ? 'ON' : 'OFF'}
                            </span>
                        }
                        checked={liveTrack}
                        onChange={(e) => setLiveTrack(e.target.checked)}
                        className="live-track-toggle"
                    />
                    <Button
                        variant="outline-secondary"
                        size="sm"
                        onClick={() => setShowSettings(true)}
                        title="Settings"
                    >
                        <Gear />
                    </Button>
                    <Button
                        variant="outline-light"
                        size="sm"
                        onClick={handleDownload}
                        disabled={gcodeLines.length === 0}
                        title="Download G-code"
                    >
                        <Download />
                    </Button>
                    <Button
                        variant="outline-danger"
                        size="sm"
                        onClick={handleClear}
                        title="Clear canvas"
                    >
                        <Trash />
                    </Button>
                </div>
            </div>

            {/* Main Drawing Area */}
            <div className="etch-canvas-wrapper">
                <canvas
                    ref={canvasRef}
                    width={INTERNAL_RESOLUTION}
                    height={INTERNAL_RESOLUTION}
                    className="etch-canvas"
                    style={{
                        width: displaySize.width,
                        height: displaySize.height
                    }}
                />

                {/* Position indicator */}
                <div className="position-display">
                    X: {(position.x * 100).toFixed(2)}% | Y: {(position.y * 100).toFixed(2)}%
                </div>

                {/* G-code line count */}
                <div className="gcode-count">
                    {gcodeLines.length} lines
                </div>
            </div>

            {/* Rotary Dials - Fixed at bottom */}
            <div className="etch-dials">
                <div className="dial-wrapper dial-left">
                    <RotaryDial
                        label="X"
                        onChange={handleXChange}
                        size={dialSize}
                        sensitivity={1.0}
                        color="#20c997"
                    />
                </div>

                <div className="dial-wrapper dial-right">
                    <RotaryDial
                        label="Y"
                        onChange={handleYChange}
                        size={dialSize}
                        sensitivity={1.0}
                        color="#17a2b8"
                    />
                </div>
            </div>

            {/* Live Track Indicator */}
            {liveTrack && (
                <div className="live-indicator">
                    <div className="live-dot"></div>
                    LIVE
                </div>
            )}

            {/* Settings Modal */}
            <Modal show={showSettings} onHide={() => setShowSettings(false)} centered>
                <Modal.Header closeButton className="bg-dark text-white border-secondary">
                    <Modal.Title>Etch-a-Sketch Settings</Modal.Title>
                </Modal.Header>
                <Modal.Body className="bg-dark text-white">
                    <Form.Group className="mb-4">
                        <Form.Label className="d-flex justify-content-between">
                            <span>Resolution / Dial Sensitivity</span>
                            <span className="text-muted">~{rotationsNeeded} rotations to cross</span>
                        </Form.Label>
                        <Form.Control
                            type="range"
                            min={0.005}
                            max={0.1}
                            step={0.005}
                            value={resolution}
                            onChange={(e) => setResolution(parseFloat(e.target.value))}
                            className="custom-range"
                        />
                        <div className="d-flex justify-content-between mt-2">
                            <small className="text-muted">Fine (more rotations)</small>
                            <small className="text-primary font-weight-bold">{resolution.toFixed(3)}</small>
                            <small className="text-muted">Coarse (fewer rotations)</small>
                        </div>
                    </Form.Group>

                    <Form.Group className="mb-4">
                        <Form.Label className="d-flex justify-content-between">
                            <span>Cursor Size</span>
                            <span className="text-muted">
                                {cursorSize === 0 ? 'Hidden' : cursorSize <= 0.5 ? 'Small' : cursorSize <= 1 ? 'Normal' : 'Large'}
                            </span>
                        </Form.Label>
                        <Form.Control
                            type="range"
                            min={0}
                            max={2}
                            step={0.25}
                            value={cursorSize}
                            onChange={(e) => setCursorSize(parseFloat(e.target.value))}
                            className="custom-range"
                        />
                        <div className="d-flex justify-content-between mt-2">
                            <small className="text-muted">Hidden</small>
                            <small className="text-muted">Normal</small>
                            <small className="text-muted">Large</small>
                        </div>
                    </Form.Group>

                    <div className="border-top border-secondary pt-3 mt-3">
                        <h6 className="text-muted mb-2">Resolution Presets</h6>
                        <div className="d-flex gap-2 flex-wrap">
                            <Button
                                variant={resolution === 0.01 ? "primary" : "outline-secondary"}
                                size="sm"
                                onClick={() => setResolution(0.01)}
                            >
                                Ultra Fine (~100 rotations)
                            </Button>
                            <Button
                                variant={resolution === 0.02 ? "primary" : "outline-secondary"}
                                size="sm"
                                onClick={() => setResolution(0.02)}
                            >
                                Fine (~50 rotations)
                            </Button>
                            <Button
                                variant={resolution === 0.04 ? "primary" : "outline-secondary"}
                                size="sm"
                                onClick={() => setResolution(0.04)}
                            >
                                Medium (~25 rotations)
                            </Button>
                            <Button
                                variant={resolution === 0.08 ? "primary" : "outline-secondary"}
                                size="sm"
                                onClick={() => setResolution(0.08)}
                            >
                                Coarse (~12 rotations)
                            </Button>
                        </div>
                    </div>
                </Modal.Body>
                <Modal.Footer className="bg-dark border-secondary">
                    <Button variant="primary" onClick={() => setShowSettings(false)}>
                        Done
                    </Button>
                </Modal.Footer>
            </Modal>
        </div>
    );
}

export default EtchASketch;
