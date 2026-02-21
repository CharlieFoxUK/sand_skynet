import React, { Component } from 'react';
import { Button, Form, InputGroup, ButtonGroup, Row, Col, Collapse } from 'react-bootstrap';
import { Trash, Upload, Download, Square, Triangle, Circle, Slash, Star, ArrowsMove, Gear, Pencil } from 'react-bootstrap-icons';
import { connect } from 'react-redux';
import { getSettings } from '../settings/selector';
import { settingsNow } from '../../../sockets/sCallbacks';
import { updateAllSettings } from '../settings/Settings.slice';
import { getTableConfig, getCanvasDisplaySize } from '../../../utils/tableConfig';
import { generateGCode, uploadGCode, CoordinateType } from '../../../utils/gcodeGenerator';

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
            maxDisplaySize: 600,
            showSettings: false
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

            // Account for top nav (70) + header (80)
            const headerHeight = 150;
            const padding = 40;
            // Leave room for inline settings panel height
            const extraSpace = this.state.showSettings ? 340 : 120; // 120 for nametext

            const availableWidth = viewportWidth - 40; // 40px margin
            const availableHeight = viewportHeight - headerHeight - padding - extraSpace;

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

    componentDidUpdate(prevProps, prevState) {
        if (prevState.showSettings !== this.state.showSettings) {
            // Delay slightly to let the collapse transition finish before resizing canvas
            setTimeout(this.handleResize, 350);
        }
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



    render() {
        if (!this.props.settings || !this.props.settings.device) {
            return <div className="text-center mt-5 text-white">Loading settings...</div>;
        }

        const config = getTableConfig(this.props.settings);
        const { maxDisplaySize, drawingName, textInput, showSettings, interactionMode } = this.state;

        const displaySize = getCanvasDisplaySize(config, {
            maxWidth: maxDisplaySize,
            maxHeight: maxDisplaySize
        });

        return (
            <div className="canvas-layout">
                {/* Header Controls */}
                <div className="canvas-header">
                    <h4 className="mb-0">✏️ Canvas Tool</h4>
                    <div className="canvas-controls">
                        {/* Action Tools */}
                        <ButtonGroup className="mr-2 tool-group">
                            <Button
                                variant={interactionMode === 'select' ? 'info' : 'outline-light'}
                                onClick={() => this.setState({ interactionMode: 'select' })}
                                title="Select & Move Objects"
                            >
                                <ArrowsMove />
                            </Button>
                            <Button
                                variant={interactionMode === 'freehand' ? 'info' : 'outline-light'}
                                onClick={() => this.setState({ interactionMode: 'freehand', selectedId: null })}
                                title="Freehand Drawing Mode"
                            >
                                <Pencil />
                            </Button>
                        </ButtonGroup>

                        {/* Shape Tools */}
                        <ButtonGroup className="mr-2 tool-group">
                            <Button variant="outline-light" onClick={() => this.addElement('square')} title="Add Square"><Square /></Button>
                            <Button variant="outline-light" onClick={() => this.addElement('circle')} title="Add Circle"><Circle /></Button>
                            <Button variant="outline-light" onClick={() => this.addElement('triangle')} title="Add Triangle"><Triangle /></Button>
                            <Button variant="outline-light" onClick={() => this.addElement('line')} title="Add Straight Line"><Slash /></Button>
                            <Button variant="outline-light" onClick={() => this.addElement('star')} title="Add Star"><Star /></Button>
                        </ButtonGroup>

                        <Button
                            variant={showSettings ? "primary" : "outline-secondary"}
                            size="sm"
                            onClick={() => this.setState({ showSettings: !showSettings })}
                            title="Toggle Text and settings menu"
                        >
                            <Gear />
                        </Button>

                        <Button variant="outline-success" size="sm" onClick={this.sendToTable} title="Send directly to Sandtable" disabled={this.state.elements.length === 0}>
                            <Upload />
                        </Button>
                    </div>
                </div>

                {/* Main Content Area */}
                <div className="canvas-main-content">
                    <div className="canvas-wrapper mb-3" style={{
                        width: Math.min(displaySize.width, displaySize.height),
                        height: Math.min(displaySize.width, displaySize.height)
                    }}>
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
                                width: '100%',
                                height: '100%',
                            }}
                            onMouseDown={this.handleMouseDown}
                            // Mouse move/up are handled by document listener for drag
                            onTouchStart={this.handleMouseDown}
                        />
                    </div>

                    <p className="text-muted text-center small mb-3">
                        {interactionMode === 'freehand'
                            ? "Drag anywhere on canvas to draw freely."
                            : "Select items to drag them. Click handles to scale and rotate."}
                    </p>

                    {/* Name Input Row */}
                    <div className="w-100 d-flex justify-content-center mt-2" style={{ maxWidth: '400px', margin: '0 auto' }}>
                        <InputGroup size="sm">
                            <InputGroup.Prepend>
                                <InputGroup.Text className="bg-dark text-white border-secondary">Name</InputGroup.Text>
                            </InputGroup.Prepend>
                            <Form.Control
                                type="text"
                                placeholder={`canvas_${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
                                value={drawingName}
                                onChange={(e) => this.setState({ drawingName: e.target.value })}
                                className="bg-dark text-white border-secondary"
                            />
                        </InputGroup>
                    </div>

                    {/* Settings Panel Inline */}
                    <Collapse in={showSettings}>
                        <div className="canvas-inline-settings w-100 mt-4 p-3 bg-dark rounded border border-secondary" style={{ maxWidth: '600px', margin: '0 auto' }}>
                            <Row>
                                <Col md={8}>
                                    <Form.Label className="small text-muted mb-1">Add Single-Line Text</Form.Label>
                                    <InputGroup size="sm">
                                        <Form.Control
                                            type="text"
                                            className="bg-secondary text-white border-secondary"
                                            value={textInput}
                                            placeholder="Enter text (A-Z, 0-9)"
                                            onChange={(e) => this.setState({ textInput: e.target.value.toUpperCase() })}
                                        />
                                        <InputGroup.Append>
                                            <Button
                                                variant="info"
                                                onClick={() => this.addElement('text')}
                                            >
                                                Add to Canvas
                                            </Button>
                                        </InputGroup.Append>
                                    </InputGroup>
                                    <small className="text-muted d-block mt-1">Generates single-line stick font perfect for drawing</small>
                                </Col>
                                <Col md={4} className="d-flex flex-column justify-content-end border-left border-secondary">
                                    {this.state.selectedId !== null && (
                                        <Button variant="danger" size="sm" className="mb-2 w-100" onClick={this.deleteSelected}>
                                            <Trash className="mr-1" /> Delete Selected
                                        </Button>
                                    )}
                                    <Button variant="outline-danger" size="sm" className="w-100" onClick={this.clearCanvas} disabled={this.state.elements.length === 0}>
                                        <Trash className="mr-1" /> Clear Canvas
                                    </Button>
                                </Col>
                            </Row>
                        </div>
                    </Collapse>
                </div>
            </div>
        );
    }
}

export default connect(mapStateToProps, mapDispatchToProps)(Canvas);
