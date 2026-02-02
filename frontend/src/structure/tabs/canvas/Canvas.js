import React, { Component } from 'react';
import { Button, Form, InputGroup, ButtonGroup, Row, Col } from 'react-bootstrap';
import { Trash, Upload, Download, Square, Triangle, Circle, Slash, Star, Type, ArrowsMove, ArrowClockwise, BoxArrowUpRight, Pencil } from 'react-bootstrap-icons';
import { connect } from 'react-redux';
import { getSettings } from '../settings/selector';
import { settingsNow } from '../../../sockets/sCallbacks';
import { updateAllSettings } from '../settings/Settings.slice';
import { getTableConfig, getCanvasDisplaySize, getCornerCoordinates, formatCoordinate } from '../../../utils/tableConfig';
import { generateGCode, uploadGCode, downloadGCode, CoordinateType } from '../../../utils/gcodeGenerator';

import { generateSquare, generateTriangle, generateCircle, generateLine, generateStar } from '../../../utils/ShapeGenerator';
import { getTextPoints } from '../../../utils/SimpleVectorFont';

import './Canvas.scss';

const mapStateToProps = (state) => {
    return {
        settings: getSettings(state)
    }
}

const mapDispatchToProps = (dispatch) => {
    return {
        updateAllSettings: (val) => dispatch(updateAllSettings(val))
    }
}

class Canvas extends Component {
    constructor(props) {
        super(props);
        this.canvasRef = React.createRef();
        this.state = {
            elements: [], // { id, type, x, y, rotation, scale, points, text? }
            selectedId: null,
            interactionMode: 'select', // 'select', 'freehand'

            // Interaction state
            isDragging: false,
            dragStart: { x: 0, y: 0 },
            elementStart: { x: 0, y: 0 }, // Initial pos of element being dragged

            // Transform state
            transformAction: null, // 'move', 'rotate', 'scale'
            initialAngle: 0,
            initialScale: 1,

            drawingName: "",
            textInput: "HELLO",
            maxDisplaySize: 600
        };
        // Internal resolution for better precision
        this.internalSize = 1000;
        this.idCounter = 0;
    }

    componentDidMount() {
        this.ctx = this.canvasRef.current.getContext('2d');
        this.ctx.lineWidth = 2;
        this.ctx.lineCap = 'round';
        this.ctx.strokeStyle = 'black';

        // Handle window resize
        this.handleResize = () => {
            const viewportHeight = window.innerHeight;
            const viewportWidth = window.innerWidth;
            const isMobile = viewportWidth < 992;

            // Available space calculation
            // Sidebar is 320px on desktop
            const sidebarWidth = isMobile ? 0 : 480;
            const availableWidth = viewportWidth - sidebarWidth - 40; // 40px margin
            const availableHeight = viewportHeight - 100; // Header offset

            const maxSize = Math.min(availableWidth, availableHeight, 900);
            this.setState({ maxDisplaySize: Math.max(300, maxSize) });
        };
        window.addEventListener('resize', this.handleResize);
        this.handleResize();

        // Fetch latest settings from backend
        settingsNow((data) => {
            try {
                const parsed = JSON.parse(data);
                this.props.updateAllSettings(parsed);
                // Re-run resize after getting settings as table config affects generic size
                setTimeout(this.handleResize, 100);
            } catch (e) {
                console.error("Error parsing settings:", e);
            }
        });
    }

    componentWillUnmount() {
        window.removeEventListener('resize', this.handleResize);
    }

    // --- Helper Methods ---

    // Add a new element to the center of the canvas
    addElement = (type) => {
        let points = [];
        let text = null;

        if (type === 'square') points = generateSquare(this.internalSize * 0.2);
        else if (type === 'triangle') points = generateTriangle(this.internalSize * 0.2);
        else if (type === 'circle') points = generateCircle(this.internalSize * 0.15); // Smaller radius
        else if (type === 'line') points = generateLine(this.internalSize * 0.2);
        else if (type === 'star') points = generateStar(this.internalSize * 0.15, this.internalSize * 0.06); // 50, 20 scaled
        else if (type === 'text') {
            points = getTextPoints(this.state.textInput, this.internalSize * 0.15, 0, 0); // initial points
            text = this.state.textInput;
        }

        const newElement = {
            id: this.idCounter++,
            type,
            x: this.internalSize / 2,
            y: this.internalSize / 2,
            rotation: 0,
            scale: 1,
            points: points,
            text: text
        };

        this.setState(prevState => ({
            elements: [...prevState.elements, newElement],
            selectedId: newElement.id,
            interactionMode: 'select'
        }), () => this.redrawCanvas());
    }

    deleteSelected = () => {
        if (this.state.selectedId === null) return;
        this.setState(prevState => ({
            elements: prevState.elements.filter(e => e.id !== prevState.selectedId),
            selectedId: null
        }), () => this.redrawCanvas());
    }

    clearCanvas = () => {
        this.setState({ elements: [], selectedId: null }, () => this.redrawCanvas());
    }

    // --- Interaction Handlers ---

    getCanvasCoordinates = (e) => {
        const canvas = this.canvasRef.current;
        const rect = canvas.getBoundingClientRect();

        // Handle both mouse and touch
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;

        const scaleX = this.internalSize / rect.width;
        const scaleY = this.internalSize / rect.height;

        return {
            x: (clientX - rect.left) * scaleX,
            y: (clientY - rect.top) * scaleY
        };
    }

    handleMouseDown = (e) => {
        e.preventDefault();
        const { x, y } = this.getCanvasCoordinates(e);
        const { selectedId, elements, interactionMode } = this.state;

        if (interactionMode === 'freehand') {
            this.setState({
                isDragging: true,
            });
            // We need a temp state for current stroke
            this.currentStroke = [{ x, y }];

            // Add listeners
            document.addEventListener('mousemove', this.handleMouseMove);
            document.addEventListener('mouseup', this.handleMouseUp);
            document.addEventListener('touchmove', this.handleMouseMove, { passive: false });
            document.addEventListener('touchend', this.handleMouseUp);
            return;
        }

        if (interactionMode === 'select' && selectedId !== null) {
            // Check if clicking handle (Rotate/Scale)
            const el = elements.find(e => e.id === selectedId);
            if (el) {
                const action = this.checkHandles(x, y, el);
                if (action) {
                    this.setState({
                        isDragging: true,
                        transformAction: action,
                        dragStart: { x, y },
                        elementStart: { ...el }, // Snapshot current state
                        initialAngle: Math.atan2(y - el.y, x - el.x),
                        initialScale: el.scale
                    });

                    // Add listeners
                    document.addEventListener('mousemove', this.handleMouseMove);
                    document.addEventListener('mouseup', this.handleMouseUp);
                    document.addEventListener('touchmove', this.handleMouseMove, { passive: false });
                    document.addEventListener('touchend', this.handleMouseUp);
                    return;
                }
            }
        }

        // ... selection logic ...
        // Check if clicking an element body (Move)
        let clickedId = null;
        for (let i = elements.length - 1; i >= 0; i--) {
            const el = elements[i];

            // Hit detection for freehand lines is hard with just distance to center
            // For now, allow selecting anything close to center or if it has points close to click?
            // For freehand, we compute a rough center?
            // Or just check bounding box.

            // Simple approach: distance to center (x,y)
            const dist = Math.sqrt((x - el.x) ** 2 + (y - el.y) ** 2);
            if (dist < 100 * el.scale) {
                clickedId = el.id;
                break;
            }
        }

        if (clickedId !== null) {
            this.setState({
                selectedId: clickedId,
                isDragging: true,
                transformAction: 'move',
                dragStart: { x, y },
                elementStart: { ...this.state.elements.find(e => e.id === clickedId) }
            }, () => this.redrawCanvas());
        } else {
            // Deselect
            this.setState({ selectedId: null }, () => this.redrawCanvas());
        }

        // Add listeners
        document.addEventListener('mousemove', this.handleMouseMove);
        document.addEventListener('mouseup', this.handleMouseUp);
        document.addEventListener('touchmove', this.handleMouseMove, { passive: false });
        document.addEventListener('touchend', this.handleMouseUp);
    }

    handleMouseMove = (e) => {
        if (!this.state.isDragging) return;
        e.preventDefault();

        const { x, y } = this.getCanvasCoordinates(e);

        if (this.state.interactionMode === 'freehand') {
            this.currentStroke.push({ x, y });
            this.redrawCanvas(); // We will draw this.currentStroke in redraw
            return;
        }

        const { transformAction, selectedId, dragStart, elementStart, initialAngle, initialScale } = this.state;

        if (selectedId === null) return;

        this.setState(prevState => ({
            elements: prevState.elements.map(el => {
                if (el.id !== selectedId) return el;

                if (transformAction === 'move') {
                    return {
                        ...el,
                        x: elementStart.x + (x - dragStart.x),
                        y: elementStart.y + (y - dragStart.y)
                    };
                } else if (transformAction === 'rotate') {
                    const currentAngle = Math.atan2(y - el.y, x - el.x);
                    const delta = currentAngle - initialAngle;
                    return { ...el, rotation: elementStart.rotation + delta };
                } else if (transformAction === 'scale') {
                    const initialDist = Math.sqrt((dragStart.x - el.x) ** 2 + (dragStart.y - el.y) ** 2);
                    const currentDist = Math.sqrt((x - el.x) ** 2 + (y - el.y) ** 2);
                    const scaleFactor = currentDist / initialDist;
                    return { ...el, scale: initialScale * scaleFactor };
                }
                return el;
            })
        }), () => this.redrawCanvas());
    }

    handleMouseUp = () => {
        if (this.state.interactionMode === 'freehand' && this.state.isDragging) {
            // Commit stroke
            if (this.currentStroke && this.currentStroke.length > 2) {
                // Calculate center of mass for the new stroke to support rotation later?
                // Simple approach: Center is average of min/max X/Y
                let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
                this.currentStroke.forEach(p => {
                    if (p.x < minX) minX = p.x;
                    if (p.x > maxX) maxX = p.x;
                    if (p.y < minY) minY = p.y;
                    if (p.y > maxY) maxY = p.y;
                });

                const centerX = (minX + maxX) / 2;
                const centerY = (minY + maxY) / 2;

                // Normalize points relative to center
                const relativePoints = this.currentStroke.map(p => ({
                    x: p.x - centerX,
                    y: p.y - centerY
                }));

                const newElement = {
                    id: this.idCounter++,
                    type: 'freehand',
                    x: centerX,
                    y: centerY,
                    rotation: 0,
                    scale: 1,
                    points: [relativePoints] // Freehand strokes are treated as multi-path for now, like text
                };

                this.setState(prevState => ({
                    elements: [...prevState.elements, newElement],
                    selectedId: newElement.id // Select the newly drawn element
                }));
            }
            this.currentStroke = [];
        }

        this.setState({ isDragging: false, transformAction: null });
        document.removeEventListener('mousemove', this.handleMouseMove);
        document.removeEventListener('mouseup', this.handleMouseUp);
        document.removeEventListener('touchmove', this.handleMouseMove);
        document.removeEventListener('touchend', this.handleMouseUp);
        this.redrawCanvas();
    }

    // --- Rendering ---

    checkHandles = (x, y, element) => {
        // Rotate handle: Top (offset by rotation)
        // We need to calculate handle position
        const handleDist = 120 * element.scale; // slightly outside size
        const rotX = element.x + handleDist * Math.sin(element.rotation);
        const rotY = element.y - handleDist * Math.cos(element.rotation); // Up is negative Y

        if (Math.hypot(x - rotX, y - rotY) < 60) return 'rotate';

        // Scale handle: Bottom Right
        // Approx corner
        const scaleDesc = 70 * element.scale;
        // We can just check a general "rim" click or specific corner
        // Let's implement a specific corner handle for Scale
        // Corner at 45 deg relative to rotation
        const cornerAngle = element.rotation + Math.PI / 4;
        const cornerDist = 80 * element.scale;
        const scaleX = element.x + cornerDist * Math.cos(cornerAngle);
        const scaleY = element.y + cornerDist * Math.sin(cornerAngle);

        // Debug
        console.log('CheckHandles', { x, y, rotX, rotY, scaleX, scaleY });

        if (Math.hypot(x - scaleX, y - scaleY) < 60) return 'scale';

        return null;
    }

    redrawCanvas = () => {
        const ctx = this.ctx;
        if (!ctx) return;

        // Clear
        ctx.clearRect(0, 0, this.internalSize, this.internalSize);
        // Background optional

        // Draw Elements
        this.state.elements.forEach(el => {
            ctx.save();
            ctx.translate(el.x, el.y);
            ctx.rotate(el.rotation);
            ctx.scale(el.scale, el.scale);

            ctx.strokeStyle = el.id === this.state.selectedId ? '#20c997' : 'black';
            ctx.lineWidth = 2 / el.scale; // Maintain constant width visually? Or scale it? 
            // Scaling linewidth is better for previewing "thickness"
            // But for single line drawing, linewidth doesn't matter, it's the path.
            // Let's keep visually consistant line width
            ctx.lineWidth = 5 / el.scale;

            // Handle Text (multi-path) or Freehand (multi-path) or Single Shape (points array)
            const isMultiPath = el.type === 'text' || el.type === 'freehand';

            if (isMultiPath) {
                // el.points is [[{x,y},...], [{x,y},...]]
                el.points.forEach(stroke => {
                    ctx.beginPath();
                    ctx.moveTo(stroke[0].x, stroke[0].y);
                    for (let i = 1; i < stroke.length; i++) ctx.lineTo(stroke[i].x, stroke[i].y);
                    ctx.stroke();
                });
            } else {
                // Single path
                ctx.beginPath();
                ctx.moveTo(el.points[0].x, el.points[0].y);
                for (let i = 1; i < el.points.length; i++) ctx.lineTo(el.points[i].x, el.points[i].y);
                ctx.stroke();
            }
            ctx.restore();
        });

        // Draw current freehand stroke
        if (this.currentStroke && this.currentStroke.length > 1) {
            ctx.beginPath();
            ctx.strokeStyle = '#20c997'; // Highlight color while drawing
            ctx.lineWidth = 3;
            ctx.moveTo(this.currentStroke[0].x, this.currentStroke[0].y);
            for (let i = 1; i < this.currentStroke.length; i++) ctx.lineTo(this.currentStroke[i].x, this.currentStroke[i].y);
            ctx.stroke();
        }

        // Draw HUD for selection
        if (this.state.selectedId !== null) {
            const el = this.state.elements.find(e => e.id === this.state.selectedId);
            if (el) {
                ctx.save();
                ctx.translate(el.x, el.y);
                // Don't rotate HUD relative to screen? Or rotate it with object?
                // Rotate with object is intuitive for "Rotate" handle
                ctx.rotate(el.rotation);

                // Draw Rotate Handle (Top)
                const handleDist = 120 * el.scale;
                ctx.beginPath();
                ctx.moveTo(0, 0);
                ctx.lineTo(0, -handleDist);
                ctx.strokeStyle = '#007bff';
                ctx.lineWidth = 2;
                ctx.stroke();

                ctx.beginPath();
                ctx.arc(0, -handleDist, 15, 0, 2 * Math.PI);
                ctx.fillStyle = '#007bff';
                ctx.fill();

                // Draw Scale Handle (Corner)
                const cornerAngle = Math.PI / 4;
                const cornerDist = 80 * el.scale;

                ctx.beginPath();
                ctx.arc(cornerDist * Math.cos(cornerAngle), cornerDist * Math.sin(cornerAngle), 15, 0, 2 * Math.PI);
                ctx.fillStyle = '#ffc107'; // yellow
                ctx.fill();

                ctx.restore();
            }
        }
    }

    handleGenerateGCode = () => {
        const config = getTableConfig(this.props.settings);
        const { elements } = this.state;

        let allPaths = [];

        elements.forEach(el => {
            // Transform points based on element properties
            // Normalize internal coordinates to 0..1 relative to canvas
            const centerX = el.x;
            const centerY = el.y;
            const size = this.internalSize;

            const transformPoint = (p) => {
                // 1. Rotate
                const rx = p.x * Math.cos(el.rotation) - p.y * Math.sin(el.rotation);
                const ry = p.x * Math.sin(el.rotation) + p.y * Math.cos(el.rotation);
                // 2. Scale
                const sx = rx * el.scale;
                const sy = ry * el.scale;
                // 3. Translate (in internal coordinates)
                const tx = sx + centerX;
                const ty = sy + centerY;

                // 4. Normalize to -1..1 range (centered)
                // If internalSize is 1000, 500 is 0.
                const nx = (tx - size / 2) / (size / 2);
                const ny = -(ty - size / 2) / (size / 2); // Flip Y for GCode

                return { x: nx, y: ny };
            };

            const isMultiPath = el.type === 'text' || el.type === 'freehand';

            if (isMultiPath) {
                el.points.forEach(stroke => {
                    const transformedStroke = stroke.map(transformPoint);
                    allPaths.push(transformedStroke);
                });
            } else {
                const transformedPath = el.points.map(transformPoint);
                allPaths.push(transformedPath);
            }
        });

        // Use CENTER_NORMALIZED since we did the normalization ourselves
        return generateGCode(allPaths, config, {
            feedrate: 2000,
            coordinateType: CoordinateType.CENTER_NORMALIZED
        });
    }

    sendToTable = async () => {
        const gcode = this.handleGenerateGCode();
        try {
            await uploadGCode(gcode, this.state.drawingName || `canvas_${Date.now()}`);
            window.showToast?.(`Drawing sent to table!`);
        } catch (error) {
            console.error('Error:', error);
            alert("Error sending drawing.");
        }
    }

    handleDownload = () => {
        const gcode = this.handleGenerateGCode();
        downloadGCode(gcode, this.state.drawingName || `canvas_${Date.now()}`);
    }

    render() {
        if (!this.props.settings || !this.props.settings.device) {
            return <div className="text-center mt-5 text-white">Loading settings...</div>;
        }

        const config = getTableConfig(this.props.settings);
        const { maxDisplaySize, drawingName, textInput } = this.state;

        const displaySize = getCanvasDisplaySize(config, {
            maxWidth: maxDisplaySize,
            maxHeight: maxDisplaySize
        });
        const corners = getCornerCoordinates(config);

        return (
            <div className="canvas-layout">
                {/* Sidebar */}
                <div className="canvas-sidebar">
                    <div className="canvas-sidebar-header">
                        <h2>Canvas Tools</h2>
                    </div>

                    <div className="canvas-sidebar-content">
                        <p className="text-muted small mb-3">
                            Add shapes, drag to move. Click handles to rotate/scale.
                        </p>

                        <div className="mb-4">
                            <label className="form-label text-white small">Tools</label>
                            <ButtonGroup className="w-100 mb-3">
                                <Button
                                    variant={this.state.interactionMode === 'select' ? 'info' : 'outline-light'}
                                    onClick={() => this.setState({ interactionMode: 'select' })}
                                    title="Select / Move"
                                >
                                    <ArrowsMove className="mr-2" /> Select
                                </Button>
                                <Button
                                    variant={this.state.interactionMode === 'freehand' ? 'info' : 'outline-light'}
                                    onClick={() => this.setState({ interactionMode: 'freehand', selectedId: null })}
                                    title="Freehand Drawing"
                                >
                                    <Pencil className="mr-2" /> Freehand
                                </Button>
                            </ButtonGroup>

                            <label className="form-label text-white small">Add Shape</label>
                            <div className="d-grid gap-2">
                                <ButtonGroup className="w-100 mb-2">
                                    <Button variant="outline-light" onClick={() => this.addElement('square')} title="Square"><Square /></Button>
                                    <Button variant="outline-light" onClick={() => this.addElement('circle')} title="Circle"><Circle /></Button>
                                    <Button variant="outline-light" onClick={() => this.addElement('triangle')} title="Triangle"><Triangle /></Button>
                                </ButtonGroup>
                                <ButtonGroup className="w-100">
                                    <Button variant="outline-light" onClick={() => this.addElement('line')} title="Line"><Slash /></Button>
                                    <Button variant="outline-light" onClick={() => this.addElement('star')} title="Star"><Star /></Button>
                                </ButtonGroup>
                            </div>
                        </div>

                        <div className="mb-4">
                            <label className="form-label text-white small">Add Single-Line Text</label>
                            <Form.Control
                                type="text"
                                className="bg-secondary text-white border-secondary mb-2"
                                value={textInput}
                                placeholder="Enter text (A-Z, 0-9)"
                                onChange={(e) => this.setState({ textInput: e.target.value.toUpperCase() })}
                            />
                            <Button
                                variant="info"
                                size="sm"
                                className="w-100"
                                onClick={() => this.addElement('text')}
                            >
                                Add Text to Canvas
                            </Button>
                            <small className="text-muted d-block mt-1">Stick font style</small>
                        </div>

                        <div className="mb-4 pt-3 border-top border-secondary">
                            {this.state.selectedId !== null ? (
                                <Button variant="danger" block onClick={this.deleteSelected}>
                                    <Trash className="mr-2" /> Delete Selected
                                </Button>
                            ) : (
                                <div className="text-muted small text-center">Select an item to edit</div>
                            )}
                        </div>

                        <div className="mb-3 mt-auto pt-3 border-top border-secondary">
                            <label className="form-label text-white small">File Name</label>
                            <InputGroup size="sm">
                                <Form.Control
                                    type="text"
                                    placeholder="Enter name..."
                                    value={drawingName}
                                    onChange={(e) => this.setState({ drawingName: e.target.value })}
                                    className="bg-secondary text-white border-secondary"
                                />
                            </InputGroup>
                        </div>

                        <div className="d-grid gap-2">
                            <Button variant="success" onClick={this.sendToTable} className="mb-2">
                                <Upload className="mr-2" /> Send to Table
                            </Button>
                            <Button variant="info" onClick={this.handleDownload} className="mb-2">
                                <Download className="mr-2" /> Download G-Code
                            </Button>
                            <Button variant="outline-danger" size="sm" onClick={this.clearCanvas}>
                                Clear All
                            </Button>
                        </div>
                    </div>
                </div>

                {/* Main Content */}
                <div className="canvas-main-content">
                    <div className="canvas-wrapper">
                        {/* Corner Labels */}
                        <div className="corner-label top-left">{formatCoordinate(corners.topLeft)}</div>
                        <div className="corner-label top-right">{formatCoordinate(corners.topRight)}</div>
                        <div className="corner-label bottom-left">{formatCoordinate(corners.bottomLeft)}</div>
                        <div className="corner-label bottom-right">{formatCoordinate(corners.bottomRight)}</div>

                        <canvas
                            ref={this.canvasRef}
                            width={this.internalSize}
                            height={this.internalSize}
                            style={{
                                border: '3px solid #20c997',
                                borderRadius: '12px',
                                boxShadow: '0 0 30px rgba(32, 201, 151, 0.2)',
                                backgroundColor: 'white',
                                touchAction: 'none',
                                cursor: this.state.interactionMode === 'freehand' ? 'crosshair' : (this.state.isDragging ? 'grabbing' : 'grab'),
                                width: displaySize.width,
                                height: displaySize.height,
                            }}
                            onMouseDown={this.handleMouseDown}
                            // Mouse move/up are handled by document listener for drag
                            onTouchStart={this.handleMouseDown}
                        />
                    </div>
                </div>
            </div>
        );
    }
}

export default connect(mapStateToProps, mapDispatchToProps)(Canvas);
