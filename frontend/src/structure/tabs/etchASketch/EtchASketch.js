import React, { useRef, useState, useCallback, useEffect } from 'react';
import { Form, Button, Modal, InputGroup } from 'react-bootstrap';
import { Trash, Broadcast, Gear, Upload } from 'react-bootstrap-icons';
import { useSelector } from 'react-redux';
import RotaryDial from './RotaryDial';
import { sendCommand, liveModeStart, liveModeStop } from '../../../sockets/sEmits';
import { getTableConfig, getCanvasDisplaySize } from '../../../utils/tableConfig';
import { generateGCode, uploadGCode, CoordinateType } from '../../../utils/gcodeGenerator';
import { canvasToGcode } from '../../../utils/coordinateTransform';
import './EtchASketch.scss';

// localStorage keys for persisted live mode settings
const LS_FEEDRATE = 'etchLiveModeFeedrate';
const LS_INTERVAL = 'etchLiveModeInterval';
const LS_DISTANCE_SCALE = 'etchLiveModeDistanceScale';

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

    // Live mode settings — persisted in localStorage
    const [liveModeFeedrate, setLiveModeFeedrate] = useState(() => {
        const saved = localStorage.getItem(LS_FEEDRATE);
        return saved ? parseInt(saved, 10) : 5000;
    });
    const [liveModeInterval, setLiveModeInterval] = useState(() => {
        const saved = localStorage.getItem(LS_INTERVAL);
        return saved ? parseInt(saved, 10) : 250;
    });
    const [liveModeDistanceScale, setLiveModeDistanceScale] = useState(() => {
        const saved = localStorage.getItem(LS_DISTANCE_SCALE);
        return saved ? parseFloat(saved) : 0.05;
    });

    // Persist live mode settings when they change
    useEffect(() => { localStorage.setItem(LS_FEEDRATE, liveModeFeedrate); }, [liveModeFeedrate]);
    useEffect(() => { localStorage.setItem(LS_INTERVAL, liveModeInterval); }, [liveModeInterval]);
    useEffect(() => { localStorage.setItem(LS_DISTANCE_SCALE, liveModeDistanceScale); }, [liveModeDistanceScale]);

    // Refs for live mode streaming
    const liveIntervalRef = useRef(null);
    const lastSentPositionRef = useRef(null);
    // Refs to hold latest values for the interval callback (avoids effect re-runs)
    const configRef = useRef(null);
    const liveModeFeedrateRef = useRef(liveModeFeedrate);
    const liveModeIntervalRef = useRef(liveModeInterval);
    const liveTrackRef = useRef(liveTrack);

    // Get table config from Redux
    const config = getTableConfig(settings);

    // Keep refs in sync with state
    configRef.current = config;
    liveModeFeedrateRef.current = liveModeFeedrate;
    liveModeIntervalRef.current = liveModeInterval;
    liveTrackRef.current = liveTrack;

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

        // Blur any focused dropdown toggles to prevent arrow keys from re-opening the menu
        const blurTimer = setTimeout(() => {
            const dropdownToggle = document.querySelector('#main-menu-dropdown');
            if (dropdownToggle) {
                dropdownToggle.blur();
            }
            if (document.activeElement && document.activeElement !== document.body) {
                document.activeElement.blur();
            }
        }, 100);

        return () => clearTimeout(blurTimer);
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
            // In live mode, scale distance by liveModeDistanceScale to slow cursor movement
            const distScale = liveTrackRef.current ? liveModeDistanceScale : 1.0;
            const moveDelta = rotateDelta * 0.1 * resolution * distScale;

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

            // Record path and generate G-code line
            if (pathRef.current.length === 0 ||
                Math.abs(newPos.x - pathRef.current[pathRef.current.length - 1].x) > 0.0005 ||
                Math.abs(newPos.y - pathRef.current[pathRef.current.length - 1].y) > 0.0005) {

                pathRef.current.push(newPos);

                // Generate G-code using proper transform
                const currentConfig = configRef.current;
                const feedrate = liveTrackRef.current ? liveModeFeedrateRef.current : 1000;
                const gp = canvasToGcode(newPos.x, 1 - newPos.y, 1, 1, currentConfig);
                const gcode = `G1 X${gp.x.toFixed(3)} Y${gp.y.toFixed(3)} F${feedrate}`;
                setGcodeLines(lines => [...lines, gcode]);

                // In live mode, commands are sent via the interval timer at a controlled rate
                // to avoid overwhelming GRBL with too many commands (error 24)
            }

            return newPos;
        });
    }, [resolution, liveModeDistanceScale]);

    // Live mode streaming: send G-code at fixed intervals (handles straight lines)
    // Only depends on liveTrack to start/stop — reads other values from refs
    useEffect(() => {
        if (liveTrack) {
            // Signal backend to stop drawing & pause queue
            liveModeStart();
            lastSentPositionRef.current = null;

            liveIntervalRef.current = setInterval(() => {
                // Read current position from the latest path point
                const path = pathRef.current;
                if (path.length === 0) return;
                const currentPos = path[path.length - 1];

                // Always send the current position, even if unchanged
                // This keeps the machine moving toward the target during straight lines
                const currentConfig = configRef.current;
                const feedrate = liveModeFeedrateRef.current;
                const gp = canvasToGcode(currentPos.x, 1 - currentPos.y, 1, 1, currentConfig);
                const gcode = `G1 X${gp.x.toFixed(3)} Y${gp.y.toFixed(3)} F${feedrate}`;
                sendCommand(gcode);

                lastSentPositionRef.current = { x: currentPos.x, y: currentPos.y };
            }, liveModeIntervalRef.current);
        } else {
            // Clear interval when live mode is turned off
            if (liveIntervalRef.current) {
                clearInterval(liveIntervalRef.current);
                liveIntervalRef.current = null;
                liveModeStop();
            }
        }

        return () => {
            if (liveIntervalRef.current) {
                clearInterval(liveIntervalRef.current);
                liveIntervalRef.current = null;
            }
        };
    }, [liveTrack]); // Only re-run when live mode is toggled

    // Keyboard handlers
    useEffect(() => {
        const handleKeyDown = (e) => {
            const STEP_DEGREES = 15; // Amount of rotation per key press

            // Only capture arrow keys if not focused on inputs
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

            // Don't capture arrow keys if any dropdown menu is open (e.g., hamburger menu)
            const dropdownOpen = document.querySelector('.dropdown-menu.show');
            if (dropdownOpen) return;

            // If the dropdown toggle is focused, blur it immediately
            const dropdownToggle = document.querySelector('#main-menu-dropdown');
            if (dropdownToggle && (document.activeElement === dropdownToggle || e.target === dropdownToggle)) {
                dropdownToggle.blur();
                if (document.activeElement && document.activeElement !== document.body) {
                    document.activeElement.blur();
                }
            }

            switch (e.key) {
                case 'ArrowRight':
                    handleDoMove('x', STEP_DEGREES);
                    e.preventDefault();
                    e.stopPropagation();
                    break;
                case 'ArrowLeft':
                    handleDoMove('x', -STEP_DEGREES);
                    e.preventDefault();
                    e.stopPropagation();
                    break;
                case 'ArrowUp':
                    handleDoMove('y', STEP_DEGREES);
                    e.preventDefault();
                    e.stopPropagation();
                    break;
                case 'ArrowDown':
                    handleDoMove('y', -STEP_DEGREES);
                    e.preventDefault();
                    e.stopPropagation();
                    break;
                default:
                    break;
            }
        };

        window.addEventListener('keydown', handleKeyDown, true);
        return () => window.removeEventListener('keydown', handleKeyDown, true);
    }, [handleDoMove]);

    // Clear canvas
    const handleClear = useCallback(() => {
        pathRef.current = [{ x: 0.5, y: 0.5 }];
        setPosition({ x: 0.5, y: 0.5 });
        setRotations({ x: 0, y: 0 }); // Reset Dials
        setGcodeLines([]);
    }, []);

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

                    {/* Live Mode Settings */}
                    <div className="border-top border-secondary pt-3 mt-3">
                        <h6 className="text-success mb-3">
                            <Broadcast className="mr-1" /> Live Mode Settings
                        </h6>

                        <Form.Group className="mb-3">
                            <Form.Label className="d-flex justify-content-between">
                                <span>Machine Speed (Feedrate)</span>
                                <span className="text-muted">{liveModeFeedrate} mm/min</span>
                            </Form.Label>
                            <Form.Control
                                type="range"
                                min={500}
                                max={10000}
                                step={50}
                                value={liveModeFeedrate}
                                onChange={(e) => setLiveModeFeedrate(parseInt(e.target.value, 10))}
                                className="custom-range"
                            />
                            <div className="d-flex justify-content-between mt-1">
                                <small className="text-muted">500</small>
                                <small className="text-muted">10000</small>
                            </div>
                        </Form.Group>

                        <Form.Group className="mb-3">
                            <Form.Label className="d-flex justify-content-between">
                                <span>Dial Distance Scale</span>
                                <span className="text-muted">{(liveModeDistanceScale * 100).toFixed(0)}% of normal</span>
                            </Form.Label>
                            <Form.Control
                                type="range"
                                min={0.01}
                                max={0.10}
                                step={0.01}
                                value={liveModeDistanceScale}
                                onChange={(e) => setLiveModeDistanceScale(parseFloat(e.target.value))}
                                className="custom-range"
                            />
                            <div className="d-flex justify-content-between mt-1">
                                <small className="text-muted">1%</small>
                                <small className="text-muted">10%</small>
                            </div>
                        </Form.Group>

                        <Form.Group className="mb-3">
                            <Form.Label className="d-flex justify-content-between">
                                <span>Send Interval</span>
                                <span className="text-muted">{liveModeInterval}ms (~{Math.round(1000 / liveModeInterval)}/sec)</span>
                            </Form.Label>
                            <Form.Control
                                type="range"
                                min={100}
                                max={1000}
                                step={50}
                                value={liveModeInterval}
                                onChange={(e) => setLiveModeInterval(parseInt(e.target.value, 10))}
                                className="custom-range"
                            />
                            <div className="d-flex justify-content-between mt-1">
                                <small className="text-muted">100ms (fast)</small>
                                <small className="text-muted">1000ms (slow)</small>
                            </div>
                        </Form.Group>
                    </div>

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
