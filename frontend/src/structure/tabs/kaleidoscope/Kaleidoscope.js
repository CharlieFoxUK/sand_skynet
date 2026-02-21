import React, { Component, createRef } from 'react';
import { Button, Card, Form, ButtonGroup, InputGroup, Collapse } from 'react-bootstrap';
import { Trash, Upload, Pencil, Slash, Circle, Square, Triangle, Gear } from 'react-bootstrap-icons';
import { connect } from 'react-redux';
import { getSettings } from '../settings/selector';
import { getTableConfig, getCanvasDisplaySize } from '../../../utils/tableConfig';
import { generateGCode, uploadGCode as uploadGCodeUtil, CoordinateType } from '../../../utils/gcodeGenerator';
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
            maxDisplaySize: 600,
            segments: 6,
            mirrorMode: 'radial',
            showGuides: true,
            drawMode: 'freehand', // 'freehand', 'line', 'circle', 'square', 'triangle'
            shapeStart: null, // { x, y } for shape start point
            shapePreview: null, // Preview points while dragging
            showSettings: false
        };
        this.internalSize = 1000;
    }

    componentDidMount() {
        this.ctx = this.canvasRef.current.getContext('2d');
        this.redrawCanvas();
        this.handleResize = () => {
            const viewportHeight = window.innerHeight;
            const viewportWidth = window.innerWidth;
            const headerHeight = 80;
            const padding = 40;
            const extraSpace = this.state.showSettings ? 280 : 100; // Leave more room for inline settings
            const availableHeight = viewportHeight - headerHeight - padding - extraSpace;
            const availableWidth = viewportWidth - 40;
            const maxSize = Math.min(availableWidth, availableHeight, 900);
            this.setState({ maxDisplaySize: Math.max(300, maxSize) });
        };
        window.addEventListener('resize', this.handleResize);
        this.handleResize();
    }

    componentWillUnmount() {
        window.removeEventListener('resize', this.handleResize);
        // Clean up document-level listeners if component unmounts while drawing
        document.removeEventListener('mousemove', this.handleDocumentMove);
        document.removeEventListener('mouseup', this.handleDocumentEnd);
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

        // Draw shape preview while dragging
        if (this.state.shapePreview && this.state.shapePreview.length > 1) {
            this.drawKaleidoscopePath(this.state.shapePreview);
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

    // Shape generation functions
    generateLinePoints = (start, end) => {
        return [start, end];
    }

    generateCirclePoints = (center, radiusPoint) => {
        const radius = Math.sqrt(
            Math.pow(radiusPoint.x - center.x, 2) +
            Math.pow(radiusPoint.y - center.y, 2)
        );
        const points = [];
        const segments = 64;
        for (let i = 0; i <= segments; i++) {
            const angle = (i / segments) * 2 * Math.PI;
            points.push({
                x: center.x + radius * Math.cos(angle),
                y: center.y + radius * Math.sin(angle)
            });
        }
        return points;
    }

    generateSquarePoints = (start, end) => {
        const width = end.x - start.x;
        const height = end.y - start.y;
        return [
            { x: start.x, y: start.y },
            { x: start.x + width, y: start.y },
            { x: start.x + width, y: start.y + height },
            { x: start.x, y: start.y + height },
            { x: start.x, y: start.y } // Close the shape
        ];
    }

    generateTrianglePoints = (start, end) => {
        const width = end.x - start.x;
        const height = end.y - start.y;
        // Equilateral-ish triangle: top center, bottom left, bottom right
        return [
            { x: start.x + width / 2, y: start.y },           // Top center
            { x: start.x + width, y: start.y + height },      // Bottom right
            { x: start.x, y: start.y + height },              // Bottom left
            { x: start.x + width / 2, y: start.y }            // Close to top
        ];
    }

    generateShapePoints = (start, end, shapeType) => {
        switch (shapeType) {
            case 'line': return this.generateLinePoints(start, end);
            case 'circle': return this.generateCirclePoints(start, end);
            case 'square': return this.generateSquarePoints(start, end);
            case 'triangle': return this.generateTrianglePoints(start, end);
            default: return [];
        }
    }

    handleStart = (e) => {
        e.preventDefault();
        const { x, y } = this.getCanvasCoordinates(e);
        const { drawMode } = this.state;

        if (drawMode === 'freehand') {
            this.setState({
                isDrawing: true,
                lastX: x,
                lastY: y,
                currentPath: [{ x, y }]
            });
        } else {
            // Shape mode: store start point
            this.setState({
                isDrawing: true,
                shapeStart: { x, y },
                shapePreview: null
            });
        }

        // Add document-level listeners to continue drawing when cursor leaves canvas
        document.addEventListener('mousemove', this.handleDocumentMove);
        document.addEventListener('mouseup', this.handleDocumentEnd);
    }

    handleMove = (e) => {
        if (!this.state.isDrawing) return;
        e.preventDefault();
        const { x, y } = this.getCanvasCoordinates(e);
        this.processMove(x, y);
    }

    handleDocumentMove = (e) => {
        if (!this.state.isDrawing) return;
        const canvas = this.canvasRef.current;
        const rect = canvas.getBoundingClientRect();

        const scaleX = this.internalSize / rect.width;
        const scaleY = this.internalSize / rect.height;

        // Clamp coordinates to canvas bounds
        const x = Math.max(0, Math.min(this.internalSize, (e.clientX - rect.left) * scaleX));
        const y = Math.max(0, Math.min(this.internalSize, (e.clientY - rect.top) * scaleY));

        this.processMove(x, y);
    }

    processMove = (x, y) => {
        const { drawMode, shapeStart } = this.state;

        if (drawMode === 'freehand') {
            this.setState(prevState => ({
                lastX: x,
                lastY: y,
                currentPath: [...prevState.currentPath, { x, y }]
            }), () => {
                this.redrawCanvas();
            });
        } else if (shapeStart) {
            // Shape mode: generate preview
            const shapePoints = this.generateShapePoints(shapeStart, { x, y }, drawMode);
            this.setState({ shapePreview: shapePoints }, () => {
                this.redrawCanvas();
            });
        }
    }

    handleDocumentEnd = () => {
        // Remove document-level listeners
        document.removeEventListener('mousemove', this.handleDocumentMove);
        document.removeEventListener('mouseup', this.handleDocumentEnd);
        this.handleEnd();
    }

    handleEnd = () => {
        if (!this.state.isDrawing) return;

        const { drawMode, currentPath, shapePreview } = this.state;

        if (drawMode === 'freehand') {
            if (currentPath.length > 1) {
                this.setState(prevState => ({
                    isDrawing: false,
                    paths: [...prevState.paths, prevState.currentPath],
                    currentPath: []
                }));
            } else {
                this.setState({ isDrawing: false, currentPath: [] });
            }
        } else {
            // Shape mode: add preview to paths
            if (shapePreview && shapePreview.length > 1) {
                this.setState(prevState => ({
                    isDrawing: false,
                    paths: [...prevState.paths, shapePreview],
                    shapeStart: null,
                    shapePreview: null
                }));
            } else {
                this.setState({ isDrawing: false, shapeStart: null, shapePreview: null });
            }
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

        // Clamp to valid range to prevent coordinates exceeding table bounds
        // When points are rotated/mirrored, they can go beyond the canvas edges
        return {
            x: Math.max(-1, Math.min(1, normX)),
            y: Math.max(-1, Math.min(1, normY))
        };
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
            feedrate: 2000,
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



    render() {
        const { maxDisplaySize, segments, mirrorMode, showGuides, showSettings } = this.state;
        const config = getTableConfig(this.props.settings);
        const displaySize = getCanvasDisplaySize(config, {
            maxWidth: maxDisplaySize,
            maxHeight: maxDisplaySize
        });

        return (
            <div className="kaleidoscope-page">
                {/* Header Controls */}
                <div className="kaleidoscope-header">
                    <h4 className="mb-0">Kaleidoscope</h4>
                    <div className="kaleidoscope-controls">
                        <ButtonGroup className="mr-2 tool-group">
                            <Button
                                variant={this.state.drawMode === 'freehand' ? 'info' : 'outline-secondary'}
                                size="sm"
                                onClick={() => this.setState({ drawMode: 'freehand' })}
                                title="Freehand"
                            ><Pencil /></Button>
                            <Button
                                variant={this.state.drawMode === 'line' ? 'info' : 'outline-secondary'}
                                size="sm"
                                onClick={() => this.setState({ drawMode: 'line' })}
                                title="Line"
                            ><Slash /></Button>
                            <Button
                                variant={this.state.drawMode === 'circle' ? 'info' : 'outline-secondary'}
                                size="sm"
                                onClick={() => this.setState({ drawMode: 'circle' })}
                                title="Circle"
                            ><Circle /></Button>
                            <Button
                                variant={this.state.drawMode === 'square' ? 'info' : 'outline-secondary'}
                                size="sm"
                                onClick={() => this.setState({ drawMode: 'square' })}
                                title="Square"
                            ><Square /></Button>
                            <Button
                                variant={this.state.drawMode === 'triangle' ? 'info' : 'outline-secondary'}
                                size="sm"
                                onClick={() => this.setState({ drawMode: 'triangle' })}
                                title="Triangle"
                            ><Triangle /></Button>
                        </ButtonGroup>

                        <Button variant={this.state.showSettings ? "primary" : "outline-secondary"} size="sm" onClick={() => {
                            this.setState(prev => ({ showSettings: !prev.showSettings }), this.handleResize);
                        }} title="Toggle Settings">
                            <Gear />
                        </Button>

                        <Button variant="outline-success" size="sm" onClick={this.sendToTable} disabled={this.state.paths.length === 0} title="Save to Drawings">
                            <Upload />
                        </Button>
                        <Button variant="outline-danger" size="sm" onClick={this.clearCanvas} title="Clear canvas">
                            <Trash />
                        </Button>
                    </div>
                </div>

                {/* Main Drawing Area */}
                <div className="kaleidoscope-canvas-wrapper">
                    <div className="canvas-container" style={{
                        width: Math.min(displaySize.width, displaySize.height),
                        height: Math.min(displaySize.width, displaySize.height),
                        position: 'relative',
                        margin: '0 auto'
                    }}>
                        <canvas
                            ref={this.canvasRef}
                            width={this.internalSize}
                            height={this.internalSize}
                            className="kaleidoscope-canvas"
                            style={{
                                width: '100%',
                                height: '100%'
                            }}
                            onMouseDown={this.handleStart}
                            onMouseMove={this.handleMove}
                            onMouseUp={this.handleEnd}
                            onTouchStart={this.handleStart}
                            onTouchMove={this.handleMove}
                            onTouchEnd={this.handleEnd}
                        />
                    </div>

                    <p className="text-muted text-center mt-2 small instruction-text">
                        Draw in any segment - it will mirror automatically!
                    </p>

                    {/* Name Input Row */}
                    <div className="w-100 d-flex justify-content-center mt-3" style={{ maxWidth: '400px', margin: '0 auto' }}>
                        <InputGroup size="sm">
                            <InputGroup.Prepend>
                                <InputGroup.Text className="bg-dark text-white border-secondary">Name</InputGroup.Text>
                            </InputGroup.Prepend>
                            <Form.Control
                                type="text"
                                placeholder={`kaleidoscope_${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
                                value={this.state.drawingName}
                                onChange={(e) => this.setState({ drawingName: e.target.value })}
                                className="bg-dark text-white border-secondary"
                            />
                        </InputGroup>
                    </div>
                    {/* Settings Panel Inline */}
                    <Collapse in={showSettings}>
                        <div className="kaleidoscope-inline-settings mt-3 p-3 bg-dark rounded border border-secondary text-left w-100" style={{ maxWidth: '600px', margin: '0 auto' }}>
                            <h6 className="text-info border-bottom border-secondary pb-2 mb-3">Settings</h6>
                            <div className="row">
                                <div className="col-md-6 mb-3">
                                    <Form.Group>
                                        <Form.Label className="d-flex justify-content-between mb-1">
                                            <span className="small text-muted">Segments</span>
                                            <span className="text-primary font-weight-bold small">{segments}</span>
                                        </Form.Label>
                                        <Form.Control
                                            type="range"
                                            min={2}
                                            max={24}
                                            value={segments}
                                            onChange={(e) => this.setState({ segments: parseInt(e.target.value) })}
                                            className="custom-range"
                                        />
                                    </Form.Group>

                                    <Form.Group className="mb-0 mt-3">
                                        <Form.Check
                                            type="switch"
                                            id="show-guides-switch-k"
                                            label="Show Guides"
                                            checked={showGuides}
                                            onChange={(e) => this.setState({ showGuides: e.target.checked })}
                                            className="custom-switch small"
                                        />
                                    </Form.Group>
                                </div>

                                <div className="col-md-6 mb-3">
                                    <Form.Group>
                                        <Form.Label className="small text-muted mb-1">Mirror Mode</Form.Label>
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
                                        <small className="text-muted d-block mt-1" style={{ fontSize: '11px' }}>
                                            {mirrorMode === 'radial' ? 'Rotates around center' : 'Mirrors like a real kaleidoscope'}
                                        </small>
                                    </Form.Group>
                                </div>
                            </div>
                        </div>
                    </Collapse>
                </div>
            </div>
        );
    }
}

export default connect(mapStateToProps)(Kaleidoscope);
