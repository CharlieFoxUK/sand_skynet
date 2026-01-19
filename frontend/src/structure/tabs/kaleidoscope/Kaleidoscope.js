import React, { Component } from 'react';
import { Button, Card, Form, ButtonGroup } from 'react-bootstrap';
import { Trash, Upload, Download } from 'react-bootstrap-icons';
import { connect } from 'react-redux';
import { getSettings } from '../settings/selector';
import { getTableConfig, getCanvasDisplaySize, getCornerCoordinates, formatCoordinate } from '../../../utils/tableConfig';
import { generateGCode, uploadGCode as uploadGCodeUtil, downloadGCode as downloadGCodeUtil, CoordinateType } from '../../../utils/gcodeGenerator';
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
        this.state = {
            isDrawing: false,
            lastX: 0,
            lastY: 0,
            paths: [],
            currentPath: [],
            drawingName: "",
            feedrate: 2000,
            maxDisplaySize: 600,
            segments: 6,
            mirrorMode: 'radial',
            showGuides: true
        };
        this.internalSize = 1000;
    }

    componentDidMount() {
        this.ctx = this.canvasRef.current.getContext('2d');
        this.redrawCanvas();
        this.handleResize = () => {
            const viewportHeight = window.innerHeight;
            const viewportWidth = window.innerWidth;
            const availableHeight = viewportHeight - 350;
            const availableWidth = viewportWidth - 350;
            const maxSize = Math.min(availableWidth, availableHeight, 800);
            this.setState({ maxDisplaySize: Math.max(300, maxSize) });
        };
        window.addEventListener('resize', this.handleResize);
        this.handleResize();
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

    transformPoint = (x, y, segmentIndex, mirror = false) => {
        const { segments, mirrorMode } = this.state;
        const centerX = this.internalSize / 2;
        const centerY = this.internalSize / 2;

        const dx = x - centerX;
        const dy = y - centerY;
        const radius = Math.sqrt(dx * dx + dy * dy);
        let angle = Math.atan2(dy, dx);

        const segmentAngle = (2 * Math.PI) / segments;
        angle += segmentIndex * segmentAngle;

        if (mirror && mirrorMode === 'bilateral') {
            angle = segmentIndex * segmentAngle - (angle - segmentIndex * segmentAngle);
        }

        return {
            x: centerX + radius * Math.cos(angle),
            y: centerY + radius * Math.sin(angle)
        };
    }

    redrawCanvas = () => {
        const ctx = this.ctx;
        if (!ctx) return;

        const { segments, showGuides } = this.state;
        const size = this.internalSize;
        const centerX = size / 2;
        const centerY = size / 2;

        ctx.fillStyle = '#0d0d0d';
        ctx.fillRect(0, 0, size, size);

        if (showGuides) {
            ctx.strokeStyle = 'rgba(32, 201, 151, 0.2)';
            ctx.lineWidth = 2;

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

            ctx.beginPath();
            ctx.arc(centerX, centerY, size * 0.4, 0, 2 * Math.PI);
            ctx.stroke();

            ctx.beginPath();
            ctx.arc(centerX, centerY, size * 0.2, 0, 2 * Math.PI);
            ctx.stroke();
        }

        ctx.strokeStyle = '#20c997';
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        for (const path of this.state.paths) {
            this.drawKaleidoscopePath(path);
        }

        if (this.state.currentPath.length > 0) {
            this.drawKaleidoscopePath(this.state.currentPath);
        }
    }

    drawKaleidoscopePath = (path) => {
        if (path.length < 2) return;

        const ctx = this.ctx;
        const { segments, mirrorMode } = this.state;

        for (let seg = 0; seg < segments; seg++) {
            ctx.beginPath();
            const startMirrored = this.transformPoint(path[0].x, path[0].y, seg, false);
            ctx.moveTo(startMirrored.x, startMirrored.y);

            for (let i = 1; i < path.length; i++) {
                const mirrored = this.transformPoint(path[i].x, path[i].y, seg, false);
                ctx.lineTo(mirrored.x, mirrored.y);
            }
            ctx.stroke();

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

    handleEnd = () => {
        if (!this.state.isDrawing) return;
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

    // Convert internal canvas coordinates to center-normalized (-1 to 1)
    internalToCenterNormalized = (point) => {
        const normX = (point.x - this.internalSize / 2) / (this.internalSize / 2);
        const normY = -(point.y - this.internalSize / 2) / (this.internalSize / 2); // Flip Y
        return { x: normX, y: normY };
    }

    handleGenerateGCode = () => {
        const { paths, segments, mirrorMode } = this.state;
        const config = getTableConfig(this.props.settings);

        // Generate all mirrored paths
        const allPaths = [];

        for (const path of paths) {
            if (path.length < 2) continue;

            for (let seg = 0; seg < segments; seg++) {
                // Original path for this segment
                const transformedPath = path.map(p => {
                    const tp = this.transformPoint(p.x, p.y, seg, false);
                    return this.internalToCenterNormalized(tp);
                });
                allPaths.push(transformedPath);

                // Mirrored path in bilateral mode
                if (mirrorMode === 'bilateral') {
                    const mirroredPath = path.map(p => {
                        const tp = this.transformPoint(p.x, p.y, seg, true);
                        return this.internalToCenterNormalized(tp);
                    });
                    allPaths.push(mirroredPath);
                }
            }
        }

        return generateGCode(allPaths, config, {
            feedrate: this.state.feedrate,
            coordinateType: CoordinateType.CENTER_NORMALIZED
        });
    }

    sendToTable = async () => {
        const gcode = this.handleGenerateGCode();
        try {
            await uploadGCodeUtil(gcode, this.state.drawingName || `kaleidoscope_${Date.now()}`);
        } catch (error) {
            console.error('Error:', error);
            alert("Error sending drawing.");
        }
    }

    handleDownload = () => {
        const gcode = this.handleGenerateGCode();
        downloadGCodeUtil(gcode, this.state.drawingName || `kaleidoscope_${Date.now()}`);
    }

    render() {
        const { maxDisplaySize, segments, mirrorMode, showGuides } = this.state;
        const config = getTableConfig(this.props.settings);
        const displaySize = getCanvasDisplaySize(config, {
            maxWidth: maxDisplaySize,
            maxHeight: maxDisplaySize
        });
        const corners = getCornerCoordinates(config);

        return (
            <div className="kaleidoscope-page">
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
                            <Button variant="info" onClick={this.handleDownload}>
                                <Download className="me-2" /> Download
                            </Button>
                            <Button variant="success" onClick={this.sendToTable}>
                                <Upload className="me-2" /> Send to Table
                            </Button>
                        </div>
                    </Card.Body>
                </Card>

                <div className="kaleidoscope-canvas-area">
                    <div className="canvas-container" style={{
                        width: Math.min(displaySize.width, displaySize.height),
                        height: Math.min(displaySize.width, displaySize.height),
                        position: 'relative'
                    }}>
                        {/* Corner coordinates */}
                        <div className="corner-label top-left">{formatCoordinate(corners.topLeft)}</div>
                        <div className="corner-label top-right">{formatCoordinate(corners.topRight)}</div>
                        <div className="corner-label bottom-left">{formatCoordinate(corners.bottomLeft)}</div>
                        <div className="corner-label bottom-right">{formatCoordinate(corners.bottomRight)}</div>

                        <canvas
                            ref={this.canvasRef}
                            width={this.internalSize}
                            height={this.internalSize}
                            style={{
                                width: '100%',
                                height: '100%',
                                borderRadius: '12px',
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
                    </div>
                    <p className="text-muted text-center mt-2 small">
                        Draw in any segment - it will mirror automatically!
                    </p>
                </div>
            </div>
        );
    }
}

export default connect(mapStateToProps)(Kaleidoscope);
