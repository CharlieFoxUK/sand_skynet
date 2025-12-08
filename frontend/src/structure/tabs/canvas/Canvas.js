import React, { Component } from 'react';
import { Button, Row, Col, Card, Form, InputGroup } from 'react-bootstrap';
import { Trash, Upload, Download, ArrowClockwise } from 'react-bootstrap-icons';
import { connect } from 'react-redux';
import { getSettings } from '../settings/selector';
import { settingsSave } from '../../../sockets/sEmits';
import { settingsNow } from '../../../sockets/sCallbacks';
import { cloneDict } from '../../../utils/dictUtils';
import { updateAllSettings, updateSetting } from '../settings/Settings.slice';

const mapStateToProps = (state) => {
    return {
        settings: getSettings(state)
    }
}

const mapDispatchToProps = (dispatch) => {
    return {
        updateSetting: (val) => dispatch(updateSetting(val)),
        updateAllSettings: (val) => dispatch(updateAllSettings(val))
    }
}

class Canvas extends Component {
    constructor(props) {
        super(props);
        this.canvasRef = React.createRef();
        this.state = {
            isDrawing: false,
            lastX: 0,
            lastY: 0,
            paths: [], // Store paths for GCode generation
            drawingName: "",
            feedrate: 2000
        };
    }

    componentDidMount() {
        this.ctx = this.canvasRef.current.getContext('2d');
        this.ctx.lineWidth = 2;
        this.ctx.lineCap = 'round';
        this.ctx.strokeStyle = 'black';

        // Initial size, will be controlled by render logic
        this.canvasRef.current.width = 500;
        this.canvasRef.current.height = 500;

        // Fetch latest settings from backend to ensure persistence
        settingsNow((data) => {
            try {
                const parsed = JSON.parse(data);
                this.props.updateAllSettings(parsed);
            } catch (e) {
                console.error("Error parsing settings:", e);
            }
        });
    }

    startDrawing = (e) => {
        const { offsetX, offsetY } = this.getCoordinates(e);
        this.setState({
            isDrawing: true,
            lastX: offsetX,
            lastY: offsetY,
            paths: [...this.state.paths, [{ x: offsetX, y: offsetY }]] // Start new path
        });
    }

    draw = (e) => {
        if (!this.state.isDrawing) return;
        const { offsetX, offsetY } = this.getCoordinates(e);

        this.ctx.beginPath();
        this.ctx.moveTo(this.state.lastX, this.state.lastY);
        this.ctx.lineTo(offsetX, offsetY);
        this.ctx.stroke();

        // Add point to current path
        const newPaths = [...this.state.paths];
        newPaths[newPaths.length - 1].push({ x: offsetX, y: offsetY });

        this.setState({
            lastX: offsetX,
            lastY: offsetY,
            paths: newPaths
        });
    }

    stopDrawing = () => {
        this.setState({ isDrawing: false });
    }

    getCoordinates = (e) => {
        if (e.touches && e.touches.length > 0) {
            const rect = this.canvasRef.current.getBoundingClientRect();
            return {
                offsetX: e.touches[0].clientX - rect.left,
                offsetY: e.touches[0].clientY - rect.top
            };
        }
        return {
            offsetX: e.nativeEvent.offsetX,
            offsetY: e.nativeEvent.offsetY
        };
    }

    clearCanvas = () => {
        this.ctx.clearRect(0, 0, this.canvasRef.current.width, this.canvasRef.current.height);
        this.setState({ paths: [] });
    }

    updateSetting = (key, value) => {
        // key is like 'orientation_origin', we need 'device.orientation_origin.value'
        const fullKey = "device." + key + ".value";
        this.props.updateSetting([fullKey, value]);
    }

    rotateCanvas = () => {
        const device = this.props.settings.device || {};
        // Use local state as base if available to ensure continuity
        const currentRotation = this.state.debugRotation !== undefined
            ? this.state.debugRotation
            : (parseInt(device.canvas_rotation ? device.canvas_rotation.value : 0) || 0);

        const newRotation = (currentRotation + 90) % 360;

        console.log("Rotating to:", newRotation);
        this.setState({ debugRotation: newRotation });
        this.updateSetting('canvas_rotation', newRotation);

        // Persist to backend
        const newSettings = cloneDict(this.props.settings);
        if (newSettings.device) {
            if (!newSettings.device.canvas_rotation) {
                newSettings.device.canvas_rotation = { value: 0 };
            }
            newSettings.device.canvas_rotation.value = newRotation;
            settingsSave(newSettings, false);
        }
    }

    generateGCode = () => {
        // Get settings or defaults
        const device = this.props.settings.device || {};
        const drawWidth = parseFloat(device.width ? device.width.value : 100) || 100;
        const drawHeight = parseFloat(device.height ? device.height.value : 100) || 100;
        const offX = parseFloat(device.offset_x ? device.offset_x.value : 0) || 0;
        const offY = parseFloat(device.offset_y ? device.offset_y.value : 0) || 0;
        const rotation = parseInt(device.canvas_rotation ? device.canvas_rotation.value : 0) || 0;

        const canvasWidth = this.canvasRef.current.width;
        const canvasHeight = this.canvasRef.current.height;

        let gcode = "";
        let firstMove = true;
        let firstCut = true;

        this.state.paths.forEach(path => {
            if (path.length === 0) return;

            // Helper to transform coordinates
            const transform = (p) => {
                let xNorm = p.x / canvasWidth;
                let yNorm = p.y / canvasHeight; // 0 at top, 1 at bottom (Screen Coords)

                let xPhysNorm, yPhysNorm;

                // Apply Rotation Logic
                switch (rotation) {
                    case 90:
                        xPhysNorm = 1 - yNorm;
                        yPhysNorm = 1 - xNorm;
                        break;
                    case 180:
                        xPhysNorm = 1 - xNorm;
                        yPhysNorm = yNorm;
                        break;
                    case 270:
                        xPhysNorm = yNorm;
                        yPhysNorm = xNorm;
                        break;
                    case 0:
                    default:
                        xPhysNorm = xNorm;
                        yPhysNorm = 1 - yNorm;
                        break;
                }

                // Scale to Physical Dimensions AND ADD OFFSETS
                // Since we are sending PRE-TRANSFORMED, we must output Machine Coordinates
                const xFinal = xPhysNorm * drawWidth + offX;
                const yFinal = yPhysNorm * drawHeight + offY;

                if (isNaN(xFinal) || isNaN(yFinal)) {
                    console.error("NaN coordinates detected", p, xNorm, yNorm);
                    return { x: "0.000", y: "0.000" }; // Safe fallback
                }

                return { x: xFinal.toFixed(3), y: yFinal.toFixed(3) };
            };

            // Move to start
            const start = transform(path[0]);
            gcode += `G0 X${start.x} Y${start.y}`;
            if (firstMove) {
                gcode += " ; TYPE: PRE-TRANSFORMED";
                firstMove = false;
            }
            gcode += "\n";

            for (let i = 1; i < path.length; i++) {
                const p = transform(path[i]);
                gcode += `G1 X${p.x} Y${p.y}`;
                if (firstCut) {
                    gcode += ` F${this.state.feedrate}`;
                    firstCut = false;
                }
                gcode += "\n";
            }
        });

        return gcode;
    }

    sendToTable = () => {
        const gcode = this.generateGCode();
        const blob = new Blob([gcode], { type: 'text/plain' });
        const formData = new FormData();

        let filename = this.state.drawingName.trim();
        if (filename === "") {
            filename = `drawing_${Date.now()} `;
        }
        // Ensure extension
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
                // Maybe show a toast or notification
                alert("Drawing sent to table!");
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
            filename = `drawing_${Date.now()} `;
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
        if (!this.props.settings || !this.props.settings.device) {
            return <div className="text-center mt-5">Loading settings...</div>;
        }

        const device = this.props.settings.device || {};
        console.log("Canvas Render - Device Settings:", device);
        console.log("Canvas Render - Rotation:", device.canvas_rotation);

        const drawWidth = parseFloat(device.width ? device.width.value : 100) || 100;
        const drawHeight = parseFloat(device.height ? device.height.value : 100) || 100;
        const offX = parseFloat(device.offset_x ? device.offset_x.value : 0) || 0;
        const offY = parseFloat(device.offset_y ? device.offset_y.value : 0) || 0;

        // Use local debug rotation if available, otherwise Redux
        let rotation = parseInt(device.canvas_rotation ? device.canvas_rotation.value : 0) || 0;
        if (this.state.debugRotation !== undefined) {
            rotation = this.state.debugRotation;
        }

        // Dynamic Canvas Dimensions
        // If 90 or 270, swap W/H
        const isRotated = rotation === 90 || rotation === 270;
        const canvasWidth = isRotated ? drawHeight : drawWidth;
        const canvasHeight = isRotated ? drawWidth : drawHeight;

        // Calculate labels based on rotation
        const getLabel = (xNorm, yNorm) => {
            let xPhysNorm, yPhysNorm;

            switch (rotation) {
                case 90:
                    xPhysNorm = yNorm;
                    yPhysNorm = xNorm;
                    break;
                case 180:
                    xPhysNorm = 1 - xNorm;
                    yPhysNorm = yNorm;
                    break;
                case 270:
                    xPhysNorm = 1 - yNorm;
                    yPhysNorm = 1 - xNorm;
                    break;
                case 0:
                default:
                    xPhysNorm = xNorm;
                    yPhysNorm = 1 - yNorm;
                    break;
            }

            const xVal = xPhysNorm * drawWidth + offX;
            const yVal = yPhysNorm * drawHeight + offY;

            if (isNaN(xVal) || isNaN(yVal)) return "(Error)";

            return `(${xVal.toFixed(0)}, ${yVal.toFixed(0)})`;
        }

        const tlLabel = getLabel(0, 0);
        const trLabel = getLabel(1, 0);
        const blLabel = getLabel(0, 1);
        const brLabel = getLabel(1, 1);

        // Axis Indicators
        // 0: X Right, Y Up
        // 90: X Down, Y Right
        // 180: X Left, Y Down
        // 270: X Up, Y Left

        let xAxisStyle = { position: 'absolute', color: '#0dcaf0', fontWeight: 'bold' };
        let yAxisStyle = { position: 'absolute', color: '#0dcaf0', fontWeight: 'bold' };
        let xAxisText = "X Axis \u2192";
        let yAxisText = "Y Axis \u2192";

        switch (rotation) {
            case 90:
                // X is Down (Visual Vertical)
                xAxisStyle = { ...xAxisStyle, top: '50%', right: '-45px', transform: 'translateY(-50%) rotate(90deg)' };
                // Y is Right (Visual Horizontal)
                yAxisStyle = { ...yAxisStyle, top: '-45px', left: '50%', transform: 'translateX(-50%)' };
                break;
            case 180:
                // X is Left
                xAxisStyle = { ...xAxisStyle, bottom: '-45px', left: '50%', transform: 'translateX(-50%) rotate(180deg)' };
                // Y is Down
                yAxisStyle = { ...yAxisStyle, top: '50%', left: '-45px', transform: 'translateY(-50%) rotate(90deg)' };
                break;
            case 270:
                // X is Up
                xAxisStyle = { ...xAxisStyle, top: '50%', left: '-45px', transform: 'translateY(-50%) rotate(-90deg)' };
                // Y is Left
                yAxisStyle = { ...yAxisStyle, bottom: '-45px', left: '50%', transform: 'translateX(-50%) rotate(180deg)' };
                break;
            case 0:
            default:
                // X is Right
                xAxisStyle = { ...xAxisStyle, bottom: '-45px', left: '50%', transform: 'translateX(-50%)' };
                // Y is Up
                yAxisStyle = { ...yAxisStyle, top: '50%', left: '-45px', transform: 'translateY(-50%) rotate(-90deg)' };
                break;
        }

        return (
            <div className="canvas-container">
                <Card className="bg-secondary text-white mb-3">
                    <Card.Header className="d-flex justify-content-between align-items-center">
                        <h2>Draw on Canvas</h2>
                        <div>
                            <span className="mr-3">Rot: {rotation}°</span>
                            <Button variant="light" onClick={this.rotateCanvas}>
                                <ArrowClockwise className="mr-2" /> Rotate 90°
                            </Button>
                        </div>
                    </Card.Header>
                    <Card.Body className="text-center">

                        <div style={{ position: 'relative', display: 'inline-block', marginTop: '40px', marginBottom: '60px' }}>
                            {/* Axis Labels */}
                            <div style={{ position: 'absolute', top: '-25px', left: '-10px', color: 'white' }}>
                                {tlLabel}
                            </div>
                            <div style={{ position: 'absolute', top: '-25px', right: '-10px', color: 'white' }}>
                                {trLabel}
                            </div>
                            <div style={{ position: 'absolute', bottom: '-25px', left: '-10px', color: 'white' }}>
                                {blLabel}
                            </div>
                            <div style={{ position: 'absolute', bottom: '-25px', right: '-10px', color: 'white' }}>
                                {brLabel}
                            </div>

                            {/* Axis Indicators */}
                            <div style={xAxisStyle}>
                                {xAxisText}
                            </div>
                            <div style={yAxisStyle}>
                                {yAxisText}
                            </div>

                            <canvas
                                ref={this.canvasRef}
                                width={canvasWidth}
                                height={canvasHeight}
                                style={{
                                    border: '1px solid white',
                                    backgroundColor: 'white',
                                    touchAction: 'none',
                                    cursor: 'crosshair',
                                    maxWidth: '100%',
                                    height: 'auto'
                                }}
                                onMouseDown={this.startDrawing}
                                onMouseMove={this.draw}
                                onMouseUp={this.stopDrawing}
                                onMouseLeave={this.stopDrawing}
                                onTouchStart={this.startDrawing}
                                onTouchMove={this.draw}
                                onTouchEnd={this.stopDrawing}
                            />
                        </div>
                        <Row className="mb-3 justify-content-center">
                            <Col xs={12} md={6} lg={4}>
                                <InputGroup className="mb-3">
                                    <InputGroup.Prepend>
                                        <InputGroup.Text>Name</InputGroup.Text>
                                    </InputGroup.Prepend>
                                    <Form.Control
                                        type="text"
                                        placeholder="Drawing Name"
                                        value={this.state.drawingName}
                                        onChange={(e) => this.setState({ drawingName: e.target.value })}
                                    />
                                </InputGroup>
                            </Col>
                            <Col xs={12} md={6} lg={4}>
                                <InputGroup className="mb-3">
                                    <InputGroup.Prepend>
                                        <InputGroup.Text>Feedrate</InputGroup.Text>
                                    </InputGroup.Prepend>
                                    <Form.Control
                                        type="number"
                                        placeholder="2000"
                                        value={this.state.feedrate}
                                        onChange={(e) => this.setState({ feedrate: parseInt(e.target.value) || 2000 })}
                                    />
                                </InputGroup>
                            </Col>
                        </Row>
                        <Row className="justify-content-center">
                            <Col xs="auto">
                                <Button variant="danger" onClick={this.clearCanvas}>
                                    <Trash className="mr-2" /> Clear
                                </Button>
                            </Col>
                            <Col xs="auto">
                                <Button variant="info" onClick={this.downloadGCode}>
                                    <Download className="mr-2" /> Download
                                </Button>
                            </Col>
                            <Col xs="auto">
                                <Button variant="success" onClick={this.sendToTable}>
                                    <Upload className="mr-2" /> Send to Table
                                </Button>
                            </Col>
                        </Row>
                    </Card.Body>
                </Card>
            </div>
        );
    }
}

export default connect(mapStateToProps, mapDispatchToProps)(Canvas);
