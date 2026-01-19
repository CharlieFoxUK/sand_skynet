import React, { useRef, useState, useCallback, useEffect } from 'react';
import { Form, Button, Modal, InputGroup } from 'react-bootstrap';
import { Trash, Download, Broadcast, Gear, Upload } from 'react-bootstrap-icons';
import { useSelector } from 'react-redux';
import RotaryDial from './RotaryDial';
import { sendCommand } from '../../../sockets/sEmits';
import { getTableConfig, getCanvasDisplaySize, getCornerCoordinates, formatCoordinate } from '../../../utils/tableConfig';
import { generateGCode, downloadGCode as downloadGCodeUtil, uploadGCode, CoordinateType } from '../../../utils/gcodeGenerator';
import { canvasToGcode } from '../../../utils/coordinateTransform';
import './EtchASketch.scss';

/**
 * EtchASketch - A manual drawing interface with rotary dial controls
 * Similar to the classic Etch-a-Sketch toy
 */
function EtchASketch() {
    const settings = useSelector(state => state.settings);
    const canvasRef = useRef(null);
    const containerRef = useRef(null);
    const [position, setPosition] = useState({ x: 0.5, y: 0.5 });
    const [liveTrack, setLiveTrack] = useState(false);
    const [gcodeLines, setGcodeLines] = useState([]);
    const [isInitialized, setIsInitialized] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [drawingName, setDrawingName] = useState("");

    const [rotations, setRotations] = useState({ x: 0, y: 0 });

    // Settings - resolution affects how many rotations needed to cross canvas
    const [resolution, setResolution] = useState(0.02);
    const [cursorSize, setCursorSize] = useState(1);
    const [maxDisplaySize, setMaxDisplaySize] = useState(600);

    // Get table config from Redux
    const config = getTableConfig(settings);

    // Store path history for redrawing
    const pathRef = useRef([{ x: 0.5, y: 0.5 }]);

    // Internal canvas resolution for smooth rendering
    const INTERNAL_RESOLUTION = 2000;

    // Calculate display size based on table aspect ratio and viewport
    useEffect(() => {
        const updateSize = () => {
            const viewportHeight = window.innerHeight;
            const viewportWidth = window.innerWidth;
            const headerHeight = 80;
            const dialsHeight = viewportWidth < 768 ? 200 : 230;
            const padding = 40;
            const inputRowHeight = 50;
            const availableHeight = viewportHeight - headerHeight - dialsHeight - padding - inputRowHeight;
            const availableWidth = viewportWidth - 40;
            const maxSize = Math.min(availableWidth, availableHeight, 900);
            setMaxDisplaySize(Math.max(300, maxSize));
        };

        updateSize();
        window.addEventListener('resize', updateSize);
        return () => window.removeEventListener('resize', updateSize);
    }, []);

    // Get proper display size maintaining aspect ratio
    const displaySize = getCanvasDisplaySize(config, {
        maxWidth: maxDisplaySize,
        maxHeight: maxDisplaySize
    });
    const corners = getCornerCoordinates(config);

    // Draw the entire canvas
    const redrawCanvas = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        const size = INTERNAL_RESOLUTION;

        // Clear and draw background
        ctx.fillStyle = '#0d0d0d';
        ctx.fillRect(0, 0, size, size);

        // Draw grid
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
            ctx.lineWidth = 6;
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

        // Draw cursor
        if (cursorSize > 0) {
            const currentX = position.x * size;
            const currentY = (1 - position.y) * size;
            const scale = cursorSize;

            ctx.beginPath();
            ctx.arc(currentX, currentY, 30 * scale, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(32, 201, 151, 0.2)';
            ctx.fill();

            ctx.beginPath();
            ctx.arc(currentX, currentY, 20 * scale, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(32, 201, 151, 0.4)';
            ctx.fill();

            ctx.beginPath();
            ctx.arc(currentX, currentY, 12 * scale, 0, Math.PI * 2);
            ctx.fillStyle = '#fff';
            ctx.fill();
            ctx.strokeStyle = '#20c997';
            ctx.lineWidth = 4 * scale;
            ctx.stroke();
        }
    }, [position, cursorSize]);

    // Initialize
    useEffect(() => {
        setIsInitialized(true);
        pathRef.current = [{ x: 0.5, y: 0.5 }];
    }, []);

    // Redraw on position change
    useEffect(() => {
        if (isInitialized) {
            redrawCanvas();
        }
    }, [position, isInitialized, redrawCanvas]);

    // Generic handler for movement (updates position and rotation)
    const handleDoMove = useCallback((axis, rotateDelta) => {
        // Update visual rotation
        setRotations(prev => ({
            ...prev,
            [axis]: prev[axis] + rotateDelta
        }));

        // Update position
        setPosition(prev => {
            // Calculate movement delta. 
            // We use 0.1 scale factor to match previous RotaryDial 'output' logic.
            const moveDelta = rotateDelta * 0.1 * resolution;

            let newPos = { ...prev };

            if (axis === 'x') {
                const newX = Math.max(0, Math.min(1, prev.x + moveDelta));
                if (Math.abs(newX - prev.x) > 0.0001) {
                    newPos.x = newX;
                } else return prev;
            } else {
                const newY = Math.max(0, Math.min(1, prev.y + moveDelta));
                if (Math.abs(newY - prev.y) > 0.0001) {
                    newPos.y = newY;
                } else return prev;
            }

            // Record path and send G-code
            if (pathRef.current.length === 0 ||
                Math.abs(newPos.x - pathRef.current[pathRef.current.length - 1].x) > 0.0005 ||
                Math.abs(newPos.y - pathRef.current[pathRef.current.length - 1].y) > 0.0005) {

                pathRef.current.push(newPos);

                // Generate G-code using proper transform
                const gp = canvasToGcode(newPos.x, 1 - newPos.y, 1, 1, config);
                const gcode = `G1 X${gp.x.toFixed(3)} Y${gp.y.toFixed(3)} F1000`;
                setGcodeLines(lines => [...lines, gcode]);

                if (liveTrack) {
                    sendCommand(gcode);
                }
            }

            return newPos;
        });
    }, [liveTrack, resolution, config]);

    // Keyboard handlers
    useEffect(() => {
        const handleKeyDown = (e) => {
            const STEP_DEGREES = 15; // Amount of rotation per key press

            // Only capture arrow keys if not focused on inputs
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

            switch (e.key) {
                case 'ArrowRight':
                    handleDoMove('x', STEP_DEGREES);
                    e.preventDefault();
                    break;
                case 'ArrowLeft':
                    handleDoMove('x', -STEP_DEGREES);
                    e.preventDefault();
                    break;
                case 'ArrowUp':
                    handleDoMove('y', STEP_DEGREES);
                    e.preventDefault();
                    break;
                case 'ArrowDown':
                    handleDoMove('y', -STEP_DEGREES);
                    e.preventDefault();
                    break;
                default:
                    break;
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleDoMove]);

    // Clear canvas
    const handleClear = useCallback(() => {
        pathRef.current = [{ x: 0.5, y: 0.5 }];
        setPosition({ x: 0.5, y: 0.5 });
        setRotations({ x: 0, y: 0 }); // Reset Dials
        setGcodeLines([]);
    }, []);

    // Download G-code
    const handleDownload = useCallback(() => {
        if (pathRef.current.length < 2) {
            window.showToast && window.showToast('No drawing to download');
            return;
        }

        // Convert path to canvas coordinates for the generator
        const canvasPath = pathRef.current.map(p => ({
            x: p.x,
            y: 1 - p.y // Flip Y (path uses bottom-up, canvas uses top-down)
        }));

        const gcode = generateGCode([canvasPath], config, {
            feedrate: 1000,
            coordinateType: CoordinateType.CANVAS,
            canvasSize: { width: 1, height: 1 }
        });

        downloadGCodeUtil(gcode, `etch-a-sketch-${Date.now()}`);
        window.showToast && window.showToast('G-code downloaded!');
    }, [config]);

    // Upload/Save G-code
    const handleSave = useCallback(async () => {
        if (pathRef.current.length < 2) {
            window.showToast?.('No drawing to save');
            return;
        }

        const name = drawingName.trim() || `etch-${new Date().toLocaleTimeString().replace(/:/g, '-')}`;

        // Convert path to canvas coordinates
        const canvasPath = pathRef.current.map(p => ({
            x: p.x,
            y: 1 - p.y
        }));

        const gcode = generateGCode([canvasPath], config, {
            feedrate: 1000,
            coordinateType: CoordinateType.CANVAS,
            canvasSize: { width: 1, height: 1 }
        });

        try {
            await uploadGCode(gcode, name);
            window.showToast?.(`Drawing "${name}" saved successfully!`);
        } catch (error) {
            console.error("Save error:", error);
            alert(`Error saving drawing: ${error.message}`);
        }
    }, [config, drawingName]);

    const dialSize = Math.min(window.innerWidth * 0.25, 180);
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
                        disabled={pathRef.current.length < 2}
                        title="Download G-code"
                    >
                        <Download />
                    </Button>
                    <Button
                        variant="outline-success"
                        size="sm"
                        onClick={handleSave}
                        disabled={pathRef.current.length < 2}
                        title="Save to Drawings"
                    >
                        <Upload />
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
                {/* Corner coordinates */}
                <div className="corner-label top-left">{formatCoordinate(corners.topLeft)}</div>
                <div className="corner-label top-right">{formatCoordinate(corners.topRight)}</div>
                <div className="corner-label bottom-left">{formatCoordinate(corners.bottomLeft)}</div>
                <div className="corner-label bottom-right">{formatCoordinate(corners.bottomRight)}</div>

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

                <div className="position-display">
                    X: {(position.x * 100).toFixed(2)}% | Y: {(position.y * 100).toFixed(2)}%
                </div>

                <div className="gcode-count">
                    {gcodeLines.length} lines
                </div>
            </div>

            {/* Name Input Row */}
            <div className="w-100 d-flex justify-content-center mb-2" style={{ maxWidth: '400px', margin: '0 auto', padding: '0 10px' }}>
                <InputGroup size="sm">
                    <InputGroup.Prepend>
                        <InputGroup.Text className="bg-dark text-white border-secondary">Name</InputGroup.Text>
                    </InputGroup.Prepend>
                    <Form.Control
                        type="text"
                        placeholder={`etch-${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
                        value={drawingName}
                        onChange={(e) => setDrawingName(e.target.value)}
                        className="bg-dark text-white border-secondary"
                    />
                </InputGroup>
            </div>

            {/* Rotary Dials */}
            <div className="etch-dials">
                <div className="dial-wrapper dial-left">
                    <RotaryDial
                        label="X"
                        value={rotations.x}
                        onRotate={(delta) => handleDoMove('x', delta)}
                        size={dialSize}
                        sensitivity={1.0}
                        color="#20c997"
                    />
                </div>

                <div className="dial-wrapper dial-right">
                    <RotaryDial
                        label="Y"
                        value={rotations.y}
                        onRotate={(delta) => handleDoMove('y', delta)}
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
                            <small className="text-muted">Fine</small>
                            <small className="text-primary font-weight-bold">{resolution.toFixed(3)}</small>
                            <small className="text-muted">Coarse</small>
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
                        />
                    </Form.Group>

                    <div className="border-top border-secondary pt-3 mt-3">
                        <h6 className="text-muted mb-2">Presets</h6>
                        <div className="d-flex gap-2 flex-wrap">
                            <Button
                                variant={resolution === 0.01 ? "primary" : "outline-secondary"}
                                size="sm"
                                onClick={() => setResolution(0.01)}
                            >
                                Ultra Fine
                            </Button>
                            <Button
                                variant={resolution === 0.02 ? "primary" : "outline-secondary"}
                                size="sm"
                                onClick={() => setResolution(0.02)}
                            >
                                Fine
                            </Button>
                            <Button
                                variant={resolution === 0.04 ? "primary" : "outline-secondary"}
                                size="sm"
                                onClick={() => setResolution(0.04)}
                            >
                                Medium
                            </Button>
                            <Button
                                variant={resolution === 0.08 ? "primary" : "outline-secondary"}
                                size="sm"
                                onClick={() => setResolution(0.08)}
                            >
                                Coarse
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
