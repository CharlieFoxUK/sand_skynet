import React, { Component } from 'react';
import { Button, Card, Form, ButtonGroup } from 'react-bootstrap';
import { Play, Pause, ArrowRepeat, Upload, Download, Plus, Trash } from 'react-bootstrap-icons';
import { connect } from 'react-redux';
import { getSettings } from '../settings/selector';
import { getTableConfig, getCanvasDisplaySize, getCornerCoordinates, formatCoordinate } from '../../../utils/tableConfig';
import { generateGCode, uploadGCode as uploadGCodeUtil, downloadGCode as downloadGCodeUtil, CoordinateType } from '../../../utils/gcodeGenerator';
import './Spirograph.scss';

const mapStateToProps = (state) => ({
    settings: getSettings(state)
});

class Spirograph extends Component {
    constructor(props) {
        super(props);
        this.canvasRef = React.createRef();
        this.animationRef = null;

        this.state = {
            maxDisplaySize: 600,
            fixedTeeth: 96,
            movingTeeth: 36,
            penPosition: 0.8,
            mode: 'inside',
            isPlaying: false,
            currentAngle: 0,
            speed: 2,
            points: [],
            layers: [], // Store completed patterns: { points: [], color: string }
            showGears: true,
            lineColor: '#20c997',
            drawingName: '',
            feedrate: 2000
        };

        this.internalSize = 800;
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
        if (this.animationRef) {
            cancelAnimationFrame(this.animationRef);
        }
    }

    componentDidUpdate(prevProps, prevState) {
        if (prevState.fixedTeeth !== this.state.fixedTeeth ||
            prevState.movingTeeth !== this.state.movingTeeth ||
            prevState.penPosition !== this.state.penPosition ||
            prevState.mode !== this.state.mode ||
            prevState.showGears !== this.state.showGears ||
            prevState.points !== this.state.points ||
            prevState.layers !== this.state.layers ||
            prevState.currentAngle !== this.state.currentAngle) {
            this.redrawCanvas();
        }
    }

    getSpirographPoint = (angle) => {
        const { fixedTeeth, movingTeeth, penPosition, mode } = this.state;
        const centerX = this.internalSize / 2;
        const centerY = this.internalSize / 2;

        const maxRadius = this.internalSize / 2 - 40;
        const R = maxRadius * 0.7;
        const r = R * (movingTeeth / fixedTeeth);
        const d = r * penPosition;

        let x, y;

        if (mode === 'inside') {
            x = (R - r) * Math.cos(angle) + d * Math.cos(((R - r) / r) * angle);
            y = (R - r) * Math.sin(angle) - d * Math.sin(((R - r) / r) * angle);
        } else {
            x = (R + r) * Math.cos(angle) - d * Math.cos(((R + r) / r) * angle);
            y = (R + r) * Math.sin(angle) - d * Math.sin(((R + r) / r) * angle);
        }

        return {
            x: centerX + x,
            y: centerY + y
        };
    }

    getMovingGearState = (angle) => {
        const { fixedTeeth, movingTeeth, mode } = this.state;
        const centerX = this.internalSize / 2;
        const centerY = this.internalSize / 2;

        const maxRadius = this.internalSize / 2 - 40;
        const R = maxRadius * 0.7;
        const r = R * (movingTeeth / fixedTeeth);

        let gearCenterX, gearCenterY, gearRotation;

        if (mode === 'inside') {
            gearCenterX = centerX + (R - r) * Math.cos(angle);
            gearCenterY = centerY + (R - r) * Math.sin(angle);
            gearRotation = -((R - r) / r) * angle;
        } else {
            gearCenterX = centerX + (R + r) * Math.cos(angle);
            gearCenterY = centerY + (R + r) * Math.sin(angle);
            gearRotation = ((R + r) / r) * angle;
        }

        return { x: gearCenterX, y: gearCenterY, rotation: gearRotation, radius: r };
    }

    redrawCanvas = () => {
        const ctx = this.ctx;
        if (!ctx) return;

        const { fixedTeeth, movingTeeth, showGears, points, layers, currentAngle, lineColor, penPosition, mode } = this.state;
        const size = this.internalSize;
        const centerX = size / 2;
        const centerY = size / 2;

        const maxRadius = size / 2 - 40;
        const R = maxRadius * 0.7;
        const r = R * (movingTeeth / fixedTeeth);

        ctx.fillStyle = '#0d0d0d';
        ctx.fillRect(0, 0, size, size);

        // Draw saved layers first
        layers.forEach(layer => {
            if (layer.points.length > 1) {
                ctx.beginPath();
                ctx.strokeStyle = layer.color;
                ctx.lineWidth = 2;
                ctx.moveTo(layer.points[0].x, layer.points[0].y);
                for (let i = 1; i < layer.points.length; i++) {
                    ctx.lineTo(layer.points[i].x, layer.points[i].y);
                }
                ctx.stroke();
            }
        });

        // Draw current active pattern
        if (points.length > 1) {
            ctx.beginPath();
            ctx.strokeStyle = lineColor;
            ctx.lineWidth = 2;
            ctx.moveTo(points[0].x, points[0].y);
            for (let i = 1; i < points.length; i++) {
                ctx.lineTo(points[i].x, points[i].y);
            }
            ctx.stroke();
        }

        if (showGears) {
            ctx.strokeStyle = 'rgba(100, 100, 100, 0.6)';
            ctx.lineWidth = 3;
            ctx.beginPath();

            if (mode === 'inside') {
                ctx.arc(centerX, centerY, R, 0, 2 * Math.PI);
                ctx.stroke();

                ctx.strokeStyle = 'rgba(80, 80, 80, 0.5)';
                ctx.lineWidth = 1;
                for (let i = 0; i < fixedTeeth; i++) {
                    const angle = (i / fixedTeeth) * 2 * Math.PI;
                    const innerR = R - 8;
                    ctx.beginPath();
                    ctx.moveTo(centerX + R * Math.cos(angle), centerY + R * Math.sin(angle));
                    ctx.lineTo(centerX + innerR * Math.cos(angle), centerY + innerR * Math.sin(angle));
                    ctx.stroke();
                }
            } else {
                ctx.arc(centerX, centerY, R, 0, 2 * Math.PI);
                ctx.stroke();

                ctx.strokeStyle = 'rgba(80, 80, 80, 0.5)';
                ctx.lineWidth = 1;
                for (let i = 0; i < fixedTeeth; i++) {
                    const angle = (i / fixedTeeth) * 2 * Math.PI;
                    const outerR = R + 8;
                    ctx.beginPath();
                    ctx.moveTo(centerX + R * Math.cos(angle), centerY + R * Math.sin(angle));
                    ctx.lineTo(centerX + outerR * Math.cos(angle), centerY + outerR * Math.sin(angle));
                    ctx.stroke();
                }
            }

            const gearState = this.getMovingGearState(currentAngle);

            ctx.strokeStyle = 'rgba(32, 201, 151, 0.7)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(gearState.x, gearState.y, r, 0, 2 * Math.PI);
            ctx.stroke();

            ctx.strokeStyle = 'rgba(32, 201, 151, 0.4)';
            ctx.lineWidth = 1;
            for (let i = 0; i < movingTeeth; i++) {
                const angle = (i / movingTeeth) * 2 * Math.PI + gearState.rotation;
                const outerR = r + 6;
                ctx.beginPath();
                ctx.moveTo(gearState.x + r * Math.cos(angle), gearState.y + r * Math.sin(angle));
                ctx.lineTo(gearState.x + outerR * Math.cos(angle), gearState.y + outerR * Math.sin(angle));
                ctx.stroke();
            }

            const penX = gearState.x + r * penPosition * Math.cos(gearState.rotation);
            const penY = gearState.y + r * penPosition * Math.sin(gearState.rotation);

            ctx.fillStyle = '#ff6b6b';
            ctx.beginPath();
            ctx.arc(penX, penY, 5, 0, 2 * Math.PI);
            ctx.fill();

            ctx.strokeStyle = 'rgba(255, 107, 107, 0.5)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(gearState.x, gearState.y);
            ctx.lineTo(penX, penY);
            ctx.stroke();
        }
    }

    animate = () => {
        if (!this.state.isPlaying) return;

        const { speed, fixedTeeth, movingTeeth } = this.state;
        const gcd = this.gcd(fixedTeeth, movingTeeth);
        const rotationsNeeded = movingTeeth / gcd;
        const maxAngle = rotationsNeeded * 2 * Math.PI;

        this.setState(prevState => {
            const newAngle = prevState.currentAngle + (speed * 0.02);
            const newPoint = this.getSpirographPoint(newAngle);

            if (newAngle >= maxAngle) {
                return {
                    isPlaying: false,
                    currentAngle: maxAngle,
                    points: [...prevState.points, newPoint]
                };
            }

            return {
                currentAngle: newAngle,
                points: [...prevState.points, newPoint]
            };
        }, () => {
            this.animationRef = requestAnimationFrame(this.animate);
        });
    }

    gcd = (a, b) => b === 0 ? a : this.gcd(b, a % b);

    togglePlay = () => {
        this.setState(prevState => {
            const newPlaying = !prevState.isPlaying;
            if (newPlaying) {
                setTimeout(() => this.animate(), 0);
            }
            return { isPlaying: newPlaying };
        });
    }

    reset = () => {
        if (this.animationRef) {
            cancelAnimationFrame(this.animationRef);
        }
        this.setState({
            isPlaying: false,
            currentAngle: 0,
            points: []
        });
    }

    addLayer = () => {
        const { points, lineColor } = this.state;
        if (points.length === 0) return;

        this.setState(prevState => ({
            layers: [...prevState.layers, { points: [...points], color: lineColor }],
            // Do NOT reset the gear parameters, just reset the drawing state so they can change settings for the next layer
            points: [],
            currentAngle: 0,
            isPlaying: false
        }));
    }

    clearLayers = () => {
        if (this.animationRef) {
            cancelAnimationFrame(this.animationRef);
        }
        this.setState({
            layers: [],
            points: [],
            currentAngle: 0,
            isPlaying: false
        });
    }

    generateComplete = () => {
        const { fixedTeeth, movingTeeth } = this.state;
        const gcd = this.gcd(fixedTeeth, movingTeeth);
        const rotationsNeeded = movingTeeth / gcd;
        const maxAngle = rotationsNeeded * 2 * Math.PI;

        const points = [];
        const steps = rotationsNeeded * 360;

        for (let i = 0; i <= steps; i++) {
            const angle = (i / steps) * maxAngle;
            points.push(this.getSpirographPoint(angle));
        }

        this.setState({
            points,
            currentAngle: maxAngle,
            isPlaying: false
        });
    }

    // Convert internal canvas coordinates to center-normalized (-1 to 1)
    internalToCenterNormalized = (point) => {
        const normX = (point.x - this.internalSize / 2) / (this.internalSize / 2);
        const normY = -(point.y - this.internalSize / 2) / (this.internalSize / 2); // Flip Y
        return { x: normX, y: normY };
    }

    handleGenerateGCode = () => {
        const { points, layers } = this.state;

        let allPaths = [];

        // Add saved layers
        layers.forEach(layer => {
            if (layer.points.length > 1) {
                allPaths.push(layer.points.map(p => this.internalToCenterNormalized(p)));
            }
        });

        // Add current points
        if (points.length > 1) {
            allPaths.push(points.map(p => this.internalToCenterNormalized(p)));
        }

        if (allPaths.length === 0) return '';

        const config = getTableConfig(this.props.settings);

        return generateGCode(allPaths, config, {
            feedrate: 2000,
            coordinateType: CoordinateType.CENTER_NORMALIZED
        });
    }

    sendToTable = async () => {
        const gcode = this.handleGenerateGCode();
        if (!gcode) {
            alert('Generate a pattern first!');
            return;
        }

        try {
            await uploadGCodeUtil(gcode, this.state.drawingName || `spirograph_${Date.now()}`);
        } catch (error) {
            console.error('Error:', error);
            alert("Error sending drawing.");
        }
    }

    handleDownload = () => {
        const gcode = this.handleGenerateGCode();
        if (!gcode) {
            alert('Generate a pattern first!');
            return;
        }
        downloadGCodeUtil(gcode, this.state.drawingName || `spirograph_${Date.now()}`);
    }

    render() {
        const {
            maxDisplaySize, fixedTeeth, movingTeeth, penPosition, mode,
            isPlaying, showGears, speed, lineColor, points
        } = this.state;

        const config = getTableConfig(this.props.settings);
        const displaySize = getCanvasDisplaySize(config, {
            maxWidth: maxDisplaySize,
            maxHeight: maxDisplaySize
        });
        const corners = getCornerCoordinates(config);

        const gcd = this.gcd(fixedTeeth, movingTeeth);
        const petals = movingTeeth / gcd;

        return (
            <div className="spirograph-page">
                <Card className="spirograph-settings bg-dark text-white">
                    <Card.Header>
                        <h5 className="mb-0">🎡 Spirograph</h5>
                    </Card.Header>
                    <Card.Body>
                        <Form.Group className="mb-3">
                            <Form.Label className="small">Mode</Form.Label>
                            <ButtonGroup className="w-100">
                                <Button
                                    variant={mode === 'inside' ? 'info' : 'outline-secondary'}
                                    size="sm"
                                    onClick={() => { this.reset(); this.setState({ mode: 'inside' }); }}
                                >
                                    Inside (Ring)
                                </Button>
                                <Button
                                    variant={mode === 'outside' ? 'info' : 'outline-secondary'}
                                    size="sm"
                                    onClick={() => { this.reset(); this.setState({ mode: 'outside' }); }}
                                >
                                    Outside
                                </Button>
                            </ButtonGroup>
                        </Form.Group>

                        <Form.Group className="mb-3">
                            <Form.Label className="small">
                                Fixed Gear Teeth: <strong>{fixedTeeth}</strong>
                            </Form.Label>
                            <Form.Control
                                type="range"
                                min={24}
                                max={150}
                                step={6}
                                value={fixedTeeth}
                                onChange={(e) => { this.reset(); this.setState({ fixedTeeth: parseInt(e.target.value) }); }}
                            />
                        </Form.Group>

                        <Form.Group className="mb-3">
                            <Form.Label className="small">
                                Moving Gear Teeth: <strong>{movingTeeth}</strong>
                            </Form.Label>
                            <Form.Control
                                type="range"
                                min={12}
                                max={Math.floor(fixedTeeth * 0.9)}
                                step={3}
                                value={Math.min(movingTeeth, Math.floor(fixedTeeth * 0.9))}
                                onChange={(e) => { this.reset(); this.setState({ movingTeeth: parseInt(e.target.value) }); }}
                            />
                        </Form.Group>

                        <Form.Group className="mb-3">
                            <Form.Label className="small">
                                Pen Position: <strong>{(penPosition * 100).toFixed(0)}%</strong>
                            </Form.Label>
                            <Form.Control
                                type="range"
                                min={0.1}
                                max={1.2}
                                step={0.05}
                                value={penPosition}
                                onChange={(e) => { this.reset(); this.setState({ penPosition: parseFloat(e.target.value) }); }}
                            />
                            <small className="text-muted">
                                0% = center, 100% = edge, &gt;100% = outside
                            </small>
                        </Form.Group>

                        <Form.Group className="mb-3">
                            <Form.Label className="small">Speed: {speed}x</Form.Label>
                            <Form.Control
                                type="range"
                                min={0.5}
                                max={10}
                                step={0.5}
                                value={speed}
                                onChange={(e) => this.setState({ speed: parseFloat(e.target.value) })}
                            />
                        </Form.Group>

                        <div className="mb-3 p-2 bg-secondary rounded small">
                            <div>Pattern will have <strong>{petals}</strong> petals</div>
                            <div className="text-muted">GCD: {gcd}, Ratio: {fixedTeeth}:{movingTeeth}</div>
                        </div>

                        <div className="d-flex gap-2 mb-3">
                            <Button
                                variant={isPlaying ? 'warning' : 'success'}
                                onClick={this.togglePlay}
                                className="flex-grow-1"
                            >
                                {isPlaying ? <><Pause /> Pause</> : <><Play /> Draw</>}
                            </Button>
                            <Button variant="outline-secondary" onClick={this.reset} title="Reset Parameters">
                                <ArrowRepeat />
                            </Button>
                        </div>

                        <Button
                            variant="outline-info"
                            className="w-100 mb-3"
                            onClick={this.generateComplete}
                        >
                            Generate Instantly
                        </Button>

                        {/* Layer Controls */}
                        <div className="d-flex gap-2 mb-3">
                            <Button
                                variant="outline-light"
                                className="flex-grow-1"
                                onClick={this.addLayer}
                                disabled={points.length === 0}
                                title="Add current pattern as a new layer"
                            >
                                <Plus /> Add Layer
                            </Button>

                            <Button
                                variant="outline-danger"
                                onClick={this.clearLayers}
                                title="Clear All Layers"
                            >
                                <Trash />
                            </Button>
                        </div>

                        <Form.Group className="mb-3">
                            <Form.Check
                                type="checkbox"
                                label="Show Gears"
                                checked={showGears}
                                onChange={(e) => this.setState({ showGears: e.target.checked })}
                            />
                        </Form.Group>

                        <Form.Group className="mb-3">
                            <Form.Label className="small">Line Color</Form.Label>
                            <Form.Control
                                type="color"
                                value={lineColor}
                                onChange={(e) => this.setState({ lineColor: e.target.value })}
                                className="w-100"
                            />
                        </Form.Group>

                        <hr className="border-secondary" />

                        <Form.Group className="mb-2">
                            <Form.Label className="small">Drawing Name</Form.Label>
                            <Form.Control
                                type="text"
                                placeholder="my_spirograph"
                                value={this.state.drawingName}
                                onChange={(e) => this.setState({ drawingName: e.target.value })}
                                className="bg-secondary text-white border-0"
                                size="sm"
                            />
                        </Form.Group>

                        <div className="d-grid gap-2">
                            <Button variant="info" onClick={this.handleDownload}>
                                <Download className="me-2" /> Download
                            </Button>
                            <Button variant="success" onClick={this.sendToTable}>
                                <Upload className="me-2" /> Send to Table
                            </Button>
                        </div>
                    </Card.Body>
                </Card>

                <div className="spirograph-canvas-area">
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
                                boxShadow: '0 0 40px rgba(32, 201, 151, 0.2)'
                            }}
                        />
                    </div>
                    <p className="text-muted text-center mt-2 small">
                        Adjust the gears and click "Draw" to animate. Click "Add Layer" to keep the pattern.
                    </p>
                </div>
            </div>
        );
    }
}

export default connect(mapStateToProps)(Spirograph);
