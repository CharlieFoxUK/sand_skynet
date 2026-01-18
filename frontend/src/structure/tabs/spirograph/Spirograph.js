import React, { Component } from 'react';
import { Button, Card, Form, ButtonGroup, Row, Col } from 'react-bootstrap';
import { Play, Pause, ArrowRepeat, Upload, Download } from 'react-bootstrap-icons';
import { connect } from 'react-redux';
import { getSettings } from '../settings/selector';
import { calculateCanvasSize } from '../../../utils/canvasSize';
import './Spirograph.scss';

const mapStateToProps = (state) => ({
    settings: getSettings(state)
});

class Spirograph extends Component {
    constructor(props) {
        super(props);
        const initialSize = calculateCanvasSize({ footerHeight: 280 });
        this.canvasRef = React.createRef();
        this.animationRef = null;

        this.state = {
            displaySize: initialSize.width,
            // Fixed gear (ring)
            fixedTeeth: 96,
            // Moving gear
            movingTeeth: 36,
            // Pen position (0 = center, 1 = edge of moving gear)
            penPosition: 0.8,
            // Mode: 'inside' (hypotrochoid) or 'outside' (epitrochoid)
            mode: 'inside',
            // Animation
            isPlaying: false,
            currentAngle: 0,
            speed: 2,
            // Drawing
            points: [],
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
            const newSize = calculateCanvasSize({ footerHeight: 280 });
            this.setState({ displaySize: newSize.width });
        };
        window.addEventListener('resize', this.handleResize);
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
            prevState.currentAngle !== this.state.currentAngle) {
            this.redrawCanvas();
        }
    }

    // Calculate spirograph point at given angle
    getSpirographPoint = (angle) => {
        const { fixedTeeth, movingTeeth, penPosition, mode } = this.state;
        const centerX = this.internalSize / 2;
        const centerY = this.internalSize / 2;

        // Scale to fit canvas
        const maxRadius = this.internalSize / 2 - 40;

        // Calculate radii based on teeth (proportional)
        const R = maxRadius * 0.7; // Fixed gear radius
        const r = R * (movingTeeth / fixedTeeth); // Moving gear radius
        const d = r * penPosition; // Pen distance from center of moving gear

        let x, y;

        if (mode === 'inside') {
            // Hypotrochoid: moving gear inside fixed gear
            x = (R - r) * Math.cos(angle) + d * Math.cos(((R - r) / r) * angle);
            y = (R - r) * Math.sin(angle) - d * Math.sin(((R - r) / r) * angle);
        } else {
            // Epitrochoid: moving gear outside fixed gear
            x = (R + r) * Math.cos(angle) - d * Math.cos(((R + r) / r) * angle);
            y = (R + r) * Math.sin(angle) - d * Math.sin(((R + r) / r) * angle);
        }

        return {
            x: centerX + x,
            y: centerY + y
        };
    }

    // Get the position and rotation of the moving gear
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

        const { fixedTeeth, movingTeeth, showGears, points, currentAngle, lineColor, penPosition, mode } = this.state;
        const size = this.internalSize;
        const centerX = size / 2;
        const centerY = size / 2;

        const maxRadius = size / 2 - 40;
        const R = maxRadius * 0.7;
        const r = R * (movingTeeth / fixedTeeth);

        // Clear canvas
        ctx.fillStyle = '#0d0d0d';
        ctx.fillRect(0, 0, size, size);

        // Draw the pattern
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

        // Draw gears if enabled
        if (showGears) {
            // Draw fixed gear (ring)
            ctx.strokeStyle = 'rgba(100, 100, 100, 0.6)';
            ctx.lineWidth = 3;
            ctx.beginPath();

            if (mode === 'inside') {
                // Inner ring - draw teeth pointing inward
                ctx.arc(centerX, centerY, R, 0, 2 * Math.PI);
                ctx.stroke();

                // Draw teeth marks
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
                // Outer mode - fixed gear is smaller, in center
                ctx.arc(centerX, centerY, R, 0, 2 * Math.PI);
                ctx.stroke();

                // Draw teeth marks pointing outward
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

            // Draw moving gear
            const gearState = this.getMovingGearState(currentAngle);

            ctx.strokeStyle = 'rgba(32, 201, 151, 0.7)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(gearState.x, gearState.y, r, 0, 2 * Math.PI);
            ctx.stroke();

            // Draw teeth on moving gear
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

            // Draw pen hole
            const penX = gearState.x + r * penPosition * Math.cos(gearState.rotation);
            const penY = gearState.y + r * penPosition * Math.sin(gearState.rotation);

            ctx.fillStyle = '#ff6b6b';
            ctx.beginPath();
            ctx.arc(penX, penY, 5, 0, 2 * Math.PI);
            ctx.fill();

            // Draw line from gear center to pen
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

        // Calculate how many rotations needed for complete pattern
        const gcd = this.gcd(fixedTeeth, movingTeeth);
        const rotationsNeeded = movingTeeth / gcd;
        const maxAngle = rotationsNeeded * 2 * Math.PI;

        this.setState(prevState => {
            const newAngle = prevState.currentAngle + (speed * 0.02);
            const newPoint = this.getSpirographPoint(newAngle);

            // Check if pattern is complete
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

    gcd = (a, b) => {
        return b === 0 ? a : this.gcd(b, a % b);
    }

    togglePlay = () => {
        this.setState(prevState => {
            const newPlaying = !prevState.isPlaying;
            if (newPlaying) {
                // Start animation
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

    // Generate complete pattern instantly
    generateComplete = () => {
        const { fixedTeeth, movingTeeth } = this.state;

        const gcd = this.gcd(fixedTeeth, movingTeeth);
        const rotationsNeeded = movingTeeth / gcd;
        const maxAngle = rotationsNeeded * 2 * Math.PI;

        const points = [];
        const steps = rotationsNeeded * 360; // High resolution

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

    generateGCode = () => {
        const { points } = this.state;
        if (points.length < 2) return '';

        const device = this.props.settings.device || {};
        const drawWidth = parseFloat(device.width?.value) || 100;
        const drawHeight = parseFloat(device.height?.value) || 100;
        const tableSize = Math.min(drawWidth, drawHeight);
        const centerX = drawWidth / 2;
        const centerY = drawHeight / 2;

        let gcode = '';
        let firstMove = true;

        // Normalize points to table coordinates
        const normalizedPoints = points.map(p => {
            const normX = (p.x - this.internalSize / 2) / (this.internalSize / 2);
            const normY = (p.y - this.internalSize / 2) / (this.internalSize / 2);
            return {
                x: normX * (tableSize / 2) * 0.9 + centerX,
                y: -normY * (tableSize / 2) * 0.9 + centerY
            };
        });

        // First point - rapid move
        const start = normalizedPoints[0];
        gcode += `G0 X${start.x.toFixed(3)} Y${start.y.toFixed(3)} ; TYPE: PRE-TRANSFORMED\n`;

        // Draw path
        for (let i = 1; i < normalizedPoints.length; i++) {
            const p = normalizedPoints[i];
            gcode += `G1 X${p.x.toFixed(3)} Y${p.y.toFixed(3)}`;
            if (firstMove) {
                gcode += ` F${this.state.feedrate}`;
                firstMove = false;
            }
            gcode += '\n';
        }

        return gcode;
    }

    sendToTable = () => {
        const gcode = this.generateGCode();
        if (!gcode) {
            alert('Generate a pattern first!');
            return;
        }

        const blob = new Blob([gcode], { type: 'text/plain' });
        const formData = new FormData();

        let filename = this.state.drawingName.trim() || `spirograph_${Date.now()}`;
        if (!filename.toLowerCase().endsWith('.gcode')) {
            filename += '.gcode';
        }

        formData.append('file', blob, filename);

        fetch('/api/upload/', {
            method: 'POST',
            body: formData
        })
            .then(response => response.json())
            .then(() => alert('Spirograph sent to table!'))
            .catch(() => alert('Error sending drawing.'));
    }

    downloadGCode = () => {
        const gcode = this.generateGCode();
        if (!gcode) {
            alert('Generate a pattern first!');
            return;
        }

        const blob = new Blob([gcode], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');

        let filename = this.state.drawingName.trim() || `spirograph_${Date.now()}`;
        if (!filename.toLowerCase().endsWith('.gcode')) {
            filename += '.gcode';
        }

        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    }

    render() {
        const {
            displaySize, fixedTeeth, movingTeeth, penPosition, mode,
            isPlaying, showGears, speed, lineColor
        } = this.state;

        // Calculate pattern complexity info
        const gcd = this.gcd(fixedTeeth, movingTeeth);
        const petals = movingTeeth / gcd;

        return (
            <div className="spirograph-page">
                {/* Settings Panel */}
                <Card className="spirograph-settings bg-dark text-white">
                    <Card.Header>
                        <h5 className="mb-0">🎡 Spirograph</h5>
                    </Card.Header>
                    <Card.Body>
                        {/* Mode Selection */}
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

                        {/* Fixed Gear */}
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

                        {/* Moving Gear */}
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

                        {/* Pen Position */}
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
                                0% = center, 100% = edge, &gt;100% = outside gear
                            </small>
                        </Form.Group>

                        {/* Animation Speed */}
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

                        {/* Pattern Info */}
                        <div className="mb-3 p-2 bg-secondary rounded small">
                            <div>Pattern will have <strong>{petals}</strong> petals/loops</div>
                            <div className="text-muted">GCD: {gcd}, Ratio: {fixedTeeth}:{movingTeeth}</div>
                        </div>

                        {/* Controls */}
                        <div className="d-flex gap-2 mb-3">
                            <Button
                                variant={isPlaying ? 'warning' : 'success'}
                                onClick={this.togglePlay}
                                className="flex-grow-1"
                            >
                                {isPlaying ? <><Pause /> Pause</> : <><Play /> Draw</>}
                            </Button>
                            <Button variant="outline-secondary" onClick={this.reset}>
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

                        {/* Options */}
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

                        {/* Export */}
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
                <div className="spirograph-canvas-area">
                    <canvas
                        ref={this.canvasRef}
                        width={this.internalSize}
                        height={this.internalSize}
                        style={{
                            width: displaySize,
                            height: displaySize,
                            borderRadius: '12px',
                            border: '3px solid #20c997',
                            boxShadow: '0 0 40px rgba(32, 201, 151, 0.2)'
                        }}
                    />
                    <p className="text-muted text-center mt-2 small">
                        Adjust the gears and click "Draw" to animate, or "Generate Instantly"
                    </p>
                </div>
            </div>
        );
    }
}

export default connect(mapStateToProps)(Spirograph);
