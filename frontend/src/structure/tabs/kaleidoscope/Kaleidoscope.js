import React, { Component } from 'react';
import { Button, Row, Col, Card, Form, InputGroup, ButtonGroup } from 'react-bootstrap';
import { Trash, Upload, Download } from 'react-bootstrap-icons';
import { connect } from 'react-redux';
import { getSettings } from '../settings/selector';
import { calculateCanvasSize } from '../../../utils/canvasSize';
import './Kaleidoscope.scss';

const mapStateToProps = (state) => {
    return {
        settings: getSettings(state)
    }
}

class Kaleidoscope extends Component {
    constructor(props) {
        super(props);
        this.canvasRef = React.createRef();
        const initialSize = calculateCanvasSize({ footerHeight: 280 });
        this.state = {
            isDrawing: false,
            lastX: 0,
            lastY: 0,
            paths: [], // Store paths for GCode generation
            currentPath: [], // Current stroke being drawn
            drawingName: "",
            feedrate: 2000,
            displaySize: initialSize.width,
            segments: 6, // Number of kaleidoscope segments
            mirrorMode: 'radial', // 'radial' (all point to center) or 'bilateral' (mirror each segment)
            showGuides: true
        };
        this.internalSize = 1000; // Internal canvas resolution
    }

    componentDidMount() {
        this.ctx = this.canvasRef.current.getContext('2d');
        this.redrawCanvas();

        this.handleResize = () => {
            const newSize = calculateCanvasSize({ footerHeight: 280 });
            this.setState({ displaySize: newSize.width });
        };
        window.addEventListener('resize', this.handleResize);
    }

    componentWillUnmount() {
        window.removeEventListener('resize', this.handleResize);
    }

    componentDidUpdate(prevProps, prevState) {
        if (prevState.segments !== this.state.segments ||
            prevState.mirrorMode !== this.state.mirrorMode ||
            prevState.showGuides !== this.state.showGuides ||
            prevState.paths !== this.state.paths) {
            this.redrawCanvas();
        }
    }

    // Transform a point through kaleidoscope reflections
    transformPoint = (x, y, segmentIndex, mirror = false) => {
        const { segments, mirrorMode } = this.state;
        const centerX = this.internalSize / 2;
        const centerY = this.internalSize / 2;

        // Convert to polar coordinates relative to center
        const dx = x - centerX;
        const dy = y - centerY;
        const radius = Math.sqrt(dx * dx + dy * dy);
        let angle = Math.atan2(dy, dx);

        // Rotate by segment
        const segmentAngle = (2 * Math.PI) / segments;
        angle += segmentIndex * segmentAngle;

        // Apply mirror if needed
        if (mirror && mirrorMode === 'bilateral') {
            angle = segmentIndex * segmentAngle - (angle - segmentIndex * segmentAngle);
        }

        return {
            x: centerX + radius * Math.cos(angle),
            y: centerY + radius * Math.sin(angle)
        };
    }

    // Get all mirrored points for a single point
    getMirroredPoints = (x, y) => {
        const { segments, mirrorMode } = this.state;
        const points = [];

        for (let i = 0; i < segments; i++) {
            // Original rotation
            points.push(this.transformPoint(x, y, i, false));

            // Mirror if bilateral mode
            if (mirrorMode === 'bilateral') {
                points.push(this.transformPoint(x, y, i, true));
            }
        }

        return points;
    }

    redrawCanvas = () => {
        const ctx = this.ctx;
        if (!ctx) return;

        const { segments, showGuides } = this.state;
        const size = this.internalSize;
        const centerX = size / 2;
        const centerY = size / 2;

        // Clear canvas
        ctx.fillStyle = '#0d0d0d';
        ctx.fillRect(0, 0, size, size);

        // Draw guides
        if (showGuides) {
            ctx.strokeStyle = 'rgba(32, 201, 151, 0.2)';
            ctx.lineWidth = 2;

            // Draw segment lines
            for (let i = 0; i < segments; i++) {
                const angle = (i * 2 * Math.PI) / segments;
                ctx.beginPath();
                ctx.moveTo(centerX, centerY);
                ctx.lineTo(
                    centerX + (size / 2) * Math.cos(angle),
                    centerY + (size / 2) * Math.sin(angle)
                );
                ctx.stroke();
            }

            // Draw circles
            ctx.beginPath();
            ctx.arc(centerX, centerY, size * 0.4, 0, 2 * Math.PI);
            ctx.stroke();

            ctx.beginPath();
            ctx.arc(centerX, centerY, size * 0.2, 0, 2 * Math.PI);
            ctx.stroke();
        }

        // Draw all paths with kaleidoscope effect
        ctx.strokeStyle = '#20c997';
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        // Draw stored paths
        for (const path of this.state.paths) {
            this.drawKaleidoscopePath(path);
        }

        // Draw current path being drawn
        if (this.state.currentPath.length > 0) {
            this.drawKaleidoscopePath(this.state.currentPath);
        }
    }

    drawKaleidoscopePath = (path) => {
        if (path.length < 2) return;

        const ctx = this.ctx;
        const { segments, mirrorMode } = this.state;

        // Draw the path for each segment
        for (let seg = 0; seg < segments; seg++) {
            // Draw original
            ctx.beginPath();
            const startMirrored = this.transformPoint(path[0].x, path[0].y, seg, false);
            ctx.moveTo(startMirrored.x, startMirrored.y);

            for (let i = 1; i < path.length; i++) {
                const mirrored = this.transformPoint(path[i].x, path[i].y, seg, false);
                ctx.lineTo(mirrored.x, mirrored.y);
            }
            ctx.stroke();

            // Draw mirrored version in bilateral mode
            if (mirrorMode === 'bilateral') {
                ctx.beginPath();
                const startMirroredBi = this.transformPoint(path[0].x, path[0].y, seg, true);
                ctx.moveTo(startMirroredBi.x, startMirroredBi.y);

                for (let i = 1; i < path.length; i++) {
                    const mirrored = this.transformPoint(path[i].x, path[i].y, seg, true);
                    ctx.lineTo(mirrored.x, mirrored.y);
                }
                ctx.stroke();
            }
        }
    }

    getCanvasCoordinates = (e) => {
        const canvas = this.canvasRef.current;
        const rect = canvas.getBoundingClientRect();
        let clientX, clientY;

        if (e.touches && e.touches.length > 0) {
            clientX = e.touches[0].clientX;
            clientY = e.touches[0].clientY;
        } else {
            clientX = e.clientX;
            clientY = e.clientY;
        }

        // Scale from display size to internal size
        const scaleX = this.internalSize / rect.width;
        const scaleY = this.internalSize / rect.height;

        return {
            x: (clientX - rect.left) * scaleX,
            y: (clientY - rect.top) * scaleY
        };
    }

    handleStart = (e) => {
        e.preventDefault();
        const { x, y } = this.getCanvasCoordinates(e);

        this.setState({
            isDrawing: true,
            lastX: x,
            lastY: y,
            currentPath: [{ x, y }]
        });
    }

    handleMove = (e) => {
        if (!this.state.isDrawing) return;
        e.preventDefault();

        const { x, y } = this.getCanvasCoordinates(e);

        this.setState(prevState => ({
            lastX: x,
            lastY: y,
            currentPath: [...prevState.currentPath, { x, y }]
        }), () => {
            this.redrawCanvas();
        });
    }

    handleEnd = (e) => {
        if (!this.state.isDrawing) return;

        // Save current path to paths array
        if (this.state.currentPath.length > 1) {
            this.setState(prevState => ({
                isDrawing: false,
                paths: [...prevState.paths, prevState.currentPath],
                currentPath: []
            }));
        } else {
            this.setState({ isDrawing: false, currentPath: [] });
        }
    }

    clearCanvas = () => {
        this.setState({ paths: [], currentPath: [] }, () => {
            this.redrawCanvas();
        });
    }

    generateGCode = () => {
        const { paths, segments, mirrorMode } = this.state;
        const device = this.props.settings.device || {};
        const drawWidth = parseFloat(device.width ? device.width.value : 100) || 100;
        const drawHeight = parseFloat(device.height ? device.height.value : 100) || 100;

        const tableSize = Math.min(drawWidth, drawHeight);
        const centerX = drawWidth / 2;
        const centerY = drawHeight / 2;

        let gcode = "";
        let firstMove = true;
        let firstCut = true;

        // Generate paths for all segments
        for (const path of paths) {
            if (path.length < 2) continue;

            for (let seg = 0; seg < segments; seg++) {
                // Original path for this segment
                const start = this.transformPoint(path[0].x, path[0].y, seg, false);
                const startNorm = this.normalizeToTable(start, tableSize, centerX, centerY);

                gcode += `G0 X${startNorm.x.toFixed(3)} Y${startNorm.y.toFixed(3)}`;
                if (firstMove) {
                    gcode += " ; TYPE: PRE-TRANSFORMED";
                    firstMove = false;
                }
                gcode += "\n";

                for (let i = 1; i < path.length; i++) {
                    const point = this.transformPoint(path[i].x, path[i].y, seg, false);
                    const norm = this.normalizeToTable(point, tableSize, centerX, centerY);
                    gcode += `G1 X${norm.x.toFixed(3)} Y${norm.y.toFixed(3)}`;
                    if (firstCut) {
                        gcode += ` F${this.state.feedrate}`;
                        firstCut = false;
                    }
                    gcode += "\n";
                }

                // Mirrored path in bilateral mode
                if (mirrorMode === 'bilateral') {
                    const startMirror = this.transformPoint(path[0].x, path[0].y, seg, true);
                    const startMirrorNorm = this.normalizeToTable(startMirror, tableSize, centerX, centerY);
                    gcode += `G0 X${startMirrorNorm.x.toFixed(3)} Y${startMirrorNorm.y.toFixed(3)}\n`;

                    for (let i = 1; i < path.length; i++) {
                        const point = this.transformPoint(path[i].x, path[i].y, seg, true);
                        const norm = this.normalizeToTable(point, tableSize, centerX, centerY);
                        gcode += `G1 X${norm.x.toFixed(3)} Y${norm.y.toFixed(3)}\n`;
                    }
                }
            }
        }

        return gcode;
    }

    normalizeToTable = (point, tableSize, centerX, centerY) => {
        // Convert from internal canvas coords to table coords
        const normX = (point.x - this.internalSize / 2) / (this.internalSize / 2);
        const normY = (point.y - this.internalSize / 2) / (this.internalSize / 2);

        return {
            x: normX * (tableSize / 2) + centerX,
            y: -normY * (tableSize / 2) + centerY // Flip Y for table coords
        };
    }

    sendToTable = () => {
        const gcode = this.generateGCode();
        const blob = new Blob([gcode], { type: 'text/plain' });
        const formData = new FormData();

        let filename = this.state.drawingName.trim();
        if (filename === "") {
            filename = `kaleidoscope_${Date.now()}`;
        }
        if (!filename.toLowerCase().endsWith(".gcode")) {
            filename += ".gcode";
        }

        formData.append('file', blob, filename);

        fetch('/api/upload/', {
            method: 'POST',
            body: formData
        })
            .then(response => response.json())
            .then(data => {
                console.log('Success:', data);
                alert("Kaleidoscope drawing sent to table!");
            })
            .catch((error) => {
                console.error('Error:', error);
                alert("Error sending drawing.");
            });
    }

    downloadGCode = () => {
        const gcode = this.generateGCode();
        const blob = new Blob([gcode], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');

        let filename = this.state.drawingName.trim();
        if (filename === "") {
            filename = `kaleidoscope_${Date.now()}`;
        }
        if (!filename.toLowerCase().endsWith(".gcode")) {
            filename += ".gcode";
        }

        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    render() {
        const { displaySize, segments, mirrorMode, showGuides } = this.state;

        return (
            <div className="kaleidoscope-page">
                {/* Settings Panel */}
                <Card className="kaleidoscope-settings bg-dark text-white">
                    <Card.Header>
                        <h5 className="mb-0">Kaleidoscope</h5>
                    </Card.Header>
                    <Card.Body>
                        <Form.Group className="mb-3">
                            <Form.Label className="small">Segments: {segments}</Form.Label>
                            <Form.Control
                                type="range"
                                min={2}
                                max={12}
                                value={segments}
                                onChange={(e) => this.setState({ segments: parseInt(e.target.value) })}
                            />
                        </Form.Group>

                        <Form.Group className="mb-3">
                            <Form.Label className="small">Mirror Mode</Form.Label>
                            <ButtonGroup className="w-100">
                                <Button
                                    variant={mirrorMode === 'radial' ? 'info' : 'outline-secondary'}
                                    size="sm"
                                    onClick={() => this.setState({ mirrorMode: 'radial' })}
                                >
                                    Radial
                                </Button>
                                <Button
                                    variant={mirrorMode === 'bilateral' ? 'info' : 'outline-secondary'}
                                    size="sm"
                                    onClick={() => this.setState({ mirrorMode: 'bilateral' })}
                                >
                                    Bilateral
                                </Button>
                            </ButtonGroup>
                            <small className="text-muted d-block mt-1">
                                {mirrorMode === 'radial'
                                    ? 'Rotates drawing around center'
                                    : 'Mirrors each segment like a real kaleidoscope'}
                            </small>
                        </Form.Group>

                        <Form.Group className="mb-3">
                            <Form.Check
                                type="checkbox"
                                label="Show Guides"
                                checked={showGuides}
                                onChange={(e) => this.setState({ showGuides: e.target.checked })}
                            />
                        </Form.Group>

                        <hr className="border-secondary" />

                        <Form.Group className="mb-2">
                            <Form.Label className="small">Drawing Name</Form.Label>
                            <Form.Control
                                type="text"
                                placeholder="my_kaleidoscope"
                                value={this.state.drawingName}
                                onChange={(e) => this.setState({ drawingName: e.target.value })}
                                className="bg-secondary text-white border-0"
                                size="sm"
                            />
                        </Form.Group>

                        <Form.Group className="mb-3">
                            <Form.Label className="small">Feedrate</Form.Label>
                            <Form.Control
                                type="number"
                                value={this.state.feedrate}
                                onChange={(e) => this.setState({ feedrate: parseInt(e.target.value) || 2000 })}
                                className="bg-secondary text-white border-0"
                                size="sm"
                            />
                        </Form.Group>

                        <div className="d-grid gap-2">
                            <Button variant="danger" onClick={this.clearCanvas}>
                                <Trash className="me-2" /> Clear
                            </Button>
                            <Button variant="info" onClick={this.downloadGCode}>
                                <Download className="me-2" /> Download
                            </Button>
                            <Button variant="success" onClick={this.sendToTable}>
                                <Upload className="me-2" /> Send to Table
                            </Button>
                        </div>
                    </Card.Body>
                </Card>

                {/* Canvas Area */}
                <div className="kaleidoscope-canvas-area">
                    <canvas
                        ref={this.canvasRef}
                        width={this.internalSize}
                        height={this.internalSize}
                        style={{
                            width: displaySize,
                            height: displaySize,
                            borderRadius: '50%',
                            border: '3px solid #20c997',
                            boxShadow: '0 0 40px rgba(32, 201, 151, 0.3)',
                            cursor: 'crosshair',
                            touchAction: 'none'
                        }}
                        onMouseDown={this.handleStart}
                        onMouseMove={this.handleMove}
                        onMouseUp={this.handleEnd}
                        onMouseLeave={this.handleEnd}
                        onTouchStart={this.handleStart}
                        onTouchMove={this.handleMove}
                        onTouchEnd={this.handleEnd}
                    />
                    <p className="text-muted text-center mt-2 small">
                        Draw in any segment - it will mirror automatically!
                    </p>
                </div>
            </div>
        );
    }
}

export default connect(mapStateToProps)(Kaleidoscope);
