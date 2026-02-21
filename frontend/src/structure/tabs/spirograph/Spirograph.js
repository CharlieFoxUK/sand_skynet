import React, { Component } from 'react';
import { Button, Card, Form, ButtonGroup, InputGroup, Collapse } from 'react-bootstrap';
import { Play, Pause, ArrowRepeat, Upload, Plus, Trash, Gear } from 'react-bootstrap-icons';
import { connect } from 'react-redux';
import { getSettings } from '../settings/selector';
import { getTableConfig, getCanvasDisplaySize } from '../../../utils/tableConfig';
import { generateGCode, uploadGCode as uploadGCodeUtil, CoordinateType } from '../../../utils/gcodeGenerator';
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
            feedrate: 2000,
            showSettings: false,
            isDragging: false,
            lastPointerAngle: null
        };

        this.internalSize = 800;
    }

    componentDidMount() {
        this.ctx = this.canvasRef.current.getContext('2d');
        this.redrawCanvas();

        this.handleResize = () => {
            const viewportHeight = window.innerHeight;
            const viewportWidth = window.innerWidth;
            const headerHeight = 80;
            const padding = 40;
            const extraSpace = this.state.showSettings ? 380 : 100; // Leave more room for inline settings
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
        if (!this.state.isPlaying || this.state.isDragging) return;

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
            if (this.state.isPlaying && !this.state.isDragging) {
                this.animationRef = requestAnimationFrame(this.animate);
            }
        });
    }

    gcd = (a, b) => b === 0 ? a : this.gcd(b, a % b);

    // Pointer Events for Dragging
    getPointerPos = (e) => {
        const canvas = this.canvasRef.current;
        if (!canvas) return null;
        const rect = canvas.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;

        // Scale to internal size
        const scaleX = this.internalSize / rect.width;
        const scaleY = this.internalSize / rect.height;

        return {
            x: (clientX - rect.left) * scaleX,
            y: (clientY - rect.top) * scaleY
        };
    }

    handlePointerDown = (e) => {
        // Only allow drag if not playing
        if (this.state.isPlaying) return;

        const pos = this.getPointerPos(e);
        if (!pos) return;

        // Calculate the angle of the pointer relative to the center of the canvas
        const centerX = this.internalSize / 2;
        const centerY = this.internalSize / 2;
        const pointerAngle = Math.atan2(pos.y - centerY, pos.x - centerX);

        if (this.animationRef) {
            cancelAnimationFrame(this.animationRef);
        }

        this.setState({
            isDragging: true,
            lastPointerAngle: pointerAngle
        });

        e.preventDefault(); // Prevent scrolling on touch
    }

    handlePointerMove = (e) => {
        if (!this.state.isDragging) return;

        const pos = this.getPointerPos(e);
        if (!pos) return;

        const centerX = this.internalSize / 2;
        const centerY = this.internalSize / 2;
        const currentPointerAngle = Math.atan2(pos.y - centerY, pos.x - centerX);

        this.setState(prevState => {
            let { lastPointerAngle, currentAngle, fixedTeeth, movingTeeth, mode } = prevState;

            // Calculate angle difference avoiding wrapping issues (-PI to PI)
            let deltaAngle = currentPointerAngle - lastPointerAngle;
            if (deltaAngle > Math.PI) deltaAngle -= 2 * Math.PI;
            if (deltaAngle < -Math.PI) deltaAngle += 2 * Math.PI;

            // The pointer angle represents the position of the *center* of the moving gear.
            // The `currentAngle` parameter in our formulas usually correlates to that directly.
            // When moving a gear around the inside, an increase in standard angle rotates it clockwise on the screen.
            let newAngle = currentAngle + deltaAngle;

            const newPoint = this.getSpirographPoint(newAngle);

            return {
                currentAngle: newAngle,
                lastPointerAngle: currentPointerAngle,
                points: [...prevState.points, newPoint]
            };
        });

        e.preventDefault();
    }

    handlePointerUp = () => {
        if (this.state.isDragging) {
            this.setState({ isDragging: false, lastPointerAngle: null });
        }
    }

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

        this.setState(prevState => {
            if (prevState.points.length > 1) {
                return {
                    layers: [...prevState.layers, { points: [...prevState.points], color: prevState.lineColor }],
                    isPlaying: false,
                    currentAngle: 0,
                    points: []
                };
            }
            return {
                isPlaying: false,
                currentAngle: 0,
                points: []
            };
        });
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

        const newPoints = [];
        const steps = rotationsNeeded * 360;

        for (let i = 0; i <= steps; i++) {
            const angle = (i / steps) * maxAngle;
            newPoints.push(this.getSpirographPoint(angle));
        }

        this.setState(prevState => {
            let nextLayers = prevState.layers;
            if (prevState.points.length > 1) {
                nextLayers = [...nextLayers, { points: [...prevState.points], color: prevState.lineColor }];
            }
            return {
                layers: nextLayers,
                points: newPoints,
                currentAngle: maxAngle,
                isPlaying: false
            };
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



    render() {
        const {
            maxDisplaySize, fixedTeeth, movingTeeth, penPosition, mode,
            isPlaying, showGears, speed, lineColor, points, showSettings
        } = this.state;

        const config = getTableConfig(this.props.settings);
        const displaySize = getCanvasDisplaySize(config, {
            maxWidth: maxDisplaySize,
            maxHeight: maxDisplaySize
        });

        const gcd = this.gcd(fixedTeeth, movingTeeth);
        const petals = movingTeeth / gcd;

        return (
            <div className="spirograph-page">
                {/* Header Controls */}
                <div className="spirograph-header">
                    <h4 className="mb-0">🎡 Spirograph</h4>
                    <div className="spirograph-controls">
                        <Button
                            variant={isPlaying ? 'warning' : 'success'}
                            onClick={this.togglePlay}
                            size="sm"
                            className="play-btn"
                        >
                            {isPlaying ? <><Pause /> Pause</> : <><Play /> Draw</>}
                        </Button>
                        <Button
                            variant="outline-info"
                            size="sm"
                            onClick={this.generateComplete}
                            title="Generate Instantly"
                        >
                            Generate
                        </Button>

                        <Button variant={this.state.showSettings ? "primary" : "outline-secondary"} size="sm" onClick={() => {
                            this.setState(prev => ({ showSettings: !prev.showSettings }), this.handleResize);
                        }} title="Toggle Settings">
                            <Gear />
                        </Button>

                        <Button variant="outline-success" size="sm" onClick={this.sendToTable} disabled={this.state.layers.length === 0 && points.length === 0} title="Save to Drawings">
                            <Upload />
                        </Button>
                        <Button variant="outline-danger" size="sm" onClick={this.clearLayers} title="Clear all layers">
                            <Trash />
                        </Button>
                    </div>
                </div>

                {/* Main Drawing Area */}
                <div className="spirograph-canvas-wrapper">
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
                            className="spirograph-canvas"
                            style={{
                                width: '100%',
                                height: '100%',
                                cursor: 'pointer',
                                touchAction: 'none' // Prevent pull-to-refresh
                            }}
                            onMouseDown={this.handlePointerDown}
                            onMouseMove={this.handlePointerMove}
                            onMouseUp={this.handlePointerUp}
                            onMouseLeave={this.handlePointerUp}
                            onTouchStart={this.handlePointerDown}
                            onTouchMove={this.handlePointerMove}
                            onTouchEnd={this.handlePointerUp}
                            onTouchCancel={this.handlePointerUp}
                        />
                    </div>

                    <p className="text-muted text-center mt-2 small instruction-text">
                        Drag the canvas to draw manually, or click "Draw" to animate. Drawings stack automatically when settings change.
                    </p>

                    {/* Name Input Row */}
                    <div className="w-100 d-flex justify-content-center mt-3" style={{ maxWidth: '400px', margin: '0 auto' }}>
                        <InputGroup size="sm">
                            <InputGroup.Prepend>
                                <InputGroup.Text className="bg-dark text-white border-secondary">Name</InputGroup.Text>
                            </InputGroup.Prepend>
                            <Form.Control
                                type="text"
                                placeholder={`spirograph_${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
                                value={this.state.drawingName}
                                onChange={(e) => this.setState({ drawingName: e.target.value })}
                                className="bg-dark text-white border-secondary"
                            />
                        </InputGroup>
                    </div>
                    {/* Settings Panel Inline */}
                    <Collapse in={showSettings}>
                        <div className="spirograph-inline-settings mt-3 p-3 bg-dark rounded border border-secondary text-left w-100" style={{ maxWidth: '800px', margin: '0 auto' }}>
                            <div className="d-flex justify-content-between align-items-center border-bottom border-secondary pb-2 mb-3">
                                <h6 className="text-info m-0">Settings</h6>
                                <Button variant="outline-secondary" size="sm" onClick={this.reset} title="Reset Parameters to defaults" style={{ padding: '2px 8px', fontSize: '12px' }}>
                                    <ArrowRepeat /> Reset Params
                                </Button>
                            </div>

                            <div className="row">
                                <div className="col-md-6 mb-3">
                                    <Form.Group className="mb-3">
                                        <Form.Label className="d-flex justify-content-between mb-1">
                                            <span className="small text-muted">Fixed Gear Teeth</span>
                                            <span className="text-primary font-weight-bold small">{fixedTeeth}</span>
                                        </Form.Label>
                                        <Form.Control
                                            type="range"
                                            min={24}
                                            max={450}
                                            step={6}
                                            value={fixedTeeth}
                                            onChange={(e) => { this.reset(); this.setState({ fixedTeeth: parseInt(e.target.value) }); }}
                                            className="custom-range"
                                        />
                                    </Form.Group>

                                    <Form.Group className="mb-3">
                                        <Form.Label className="d-flex justify-content-between mb-1">
                                            <span className="small text-muted">Moving Gear Teeth</span>
                                            <span className="text-primary font-weight-bold small">{movingTeeth}</span>
                                        </Form.Label>
                                        <Form.Control
                                            type="range"
                                            min={12}
                                            max={405}
                                            step={3}
                                            value={movingTeeth}
                                            onChange={(e) => { this.reset(); this.setState({ movingTeeth: parseInt(e.target.value) }); }}
                                            className="custom-range"
                                        />
                                    </Form.Group>

                                    <div className="p-2 bg-secondary rounded small gear-info-box mt-4">
                                        <div>Pattern will have <strong>{petals}</strong> petals</div>
                                        <div className="text-muted">GCD: {gcd}, Ratio: {fixedTeeth}:{movingTeeth}</div>
                                    </div>
                                </div>

                                <div className="col-md-6 mb-3">
                                    <Form.Group className="mb-3">
                                        <Form.Label className="d-flex justify-content-between mb-1">
                                            <span className="small text-muted">Pen Position</span>
                                            <span className="text-primary font-weight-bold small">{(penPosition * 100).toFixed(0)}%</span>
                                        </Form.Label>
                                        <Form.Control
                                            type="range"
                                            min={0.1}
                                            max={1.2}
                                            step={0.05}
                                            value={penPosition}
                                            onChange={(e) => { this.reset(); this.setState({ penPosition: parseFloat(e.target.value) }); }}
                                            className="custom-range"
                                        />
                                        <small className="text-muted d-block mt-1" style={{ fontSize: '10px' }}>
                                            0% = center, 100% = edge, &gt;100% = outside
                                        </small>
                                    </Form.Group>

                                    <Form.Group className="mb-3">
                                        <Form.Label className="d-flex justify-content-between mb-1">
                                            <span className="small text-muted">Speed</span>
                                            <span className="text-primary font-weight-bold small">{speed}x</span>
                                        </Form.Label>
                                        <Form.Control
                                            type="range"
                                            min={0.5}
                                            max={10}
                                            step={0.5}
                                            value={speed}
                                            onChange={(e) => this.setState({ speed: parseFloat(e.target.value) })}
                                            className="custom-range"
                                        />
                                    </Form.Group>

                                    <div className="d-flex w-100 justify-content-between mt-4">
                                        <Form.Group className="mb-0 flex-grow-1 mr-2">
                                            <Form.Label className="small text-muted mb-1 d-block">Mode</Form.Label>
                                            <ButtonGroup className="w-100">
                                                <Button
                                                    variant={mode === 'inside' ? 'info' : 'outline-secondary'}
                                                    size="sm"
                                                    onClick={() => { this.reset(); this.setState({ mode: 'inside' }); }}
                                                    style={{ padding: '2px 8px', fontSize: '12px' }}
                                                >
                                                    Inside
                                                </Button>
                                                <Button
                                                    variant={mode === 'outside' ? 'info' : 'outline-secondary'}
                                                    size="sm"
                                                    onClick={() => { this.reset(); this.setState({ mode: 'outside' }); }}
                                                    style={{ padding: '2px 8px', fontSize: '12px' }}
                                                >
                                                    Outside
                                                </Button>
                                            </ButtonGroup>
                                        </Form.Group>

                                        <div className="d-flex flex-column justify-content-between">
                                            <Form.Check
                                                type="switch"
                                                id="show-gears-switch"
                                                label={<span className="small">Gears</span>}
                                                checked={showGears}
                                                onChange={(e) => this.setState({ showGears: e.target.checked })}
                                                className="custom-switch mb-1"
                                            />
                                            <div className="d-flex align-items-center">
                                                <span className="small mr-2 text-muted">Color:</span>
                                                <Form.Control
                                                    type="color"
                                                    value={lineColor}
                                                    onChange={(e) => this.setState({ lineColor: e.target.value })}
                                                    style={{ width: '30px', height: '24px', padding: '0', border: 'none', background: 'transparent', cursor: 'pointer' }}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </Collapse>
                </div>
            </div>
        );
    }
}

export default connect(mapStateToProps)(Spirograph);
