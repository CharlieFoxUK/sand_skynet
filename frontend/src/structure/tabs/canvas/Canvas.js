import React, { Component } from 'react';
import { Button, Row, Col, Card, Form } from 'react-bootstrap';
import { Trash, Upload, Download } from 'react-bootstrap-icons';
import { connect } from 'react-redux';
import { getSettings } from '../settings/selector';

const mapStateToProps = (state) => {
    return {
        settings: getSettings(state)
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
            drawingName: ""
        };
    }

    componentDidMount() {
        this.ctx = this.canvasRef.current.getContext('2d');
        this.ctx.lineWidth = 2;
        this.ctx.lineCap = 'round';
        this.ctx.strokeStyle = 'black';

        // Handle window resize to keep canvas responsive? 
        // For now fixed size or 100% width might be easier.
        // Let's set a fixed internal resolution but display with CSS.
        this.canvasRef.current.width = 500; // Example width, maybe match table aspect ratio
        this.canvasRef.current.height = 500;
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

    generateGCode = () => {
        // Get settings or defaults
        const device = this.props.settings.device || {};
        const drawWidth = parseFloat(device.width ? device.width.value : 100);
        const drawHeight = parseFloat(device.height ? device.height.value : 100);
        const offsetX = parseFloat(device.offset_x ? device.offset_x.value : 0);
        const offsetY = parseFloat(device.offset_y ? device.offset_y.value : 0);

        const origin = device.orientation_origin ? device.orientation_origin.value : "Bottom-Left";
        const swapAxes = device.orientation_swap ? device.orientation_swap.value : false;

        const canvasWidth = this.canvasRef.current.width;
        const canvasHeight = this.canvasRef.current.height;

        let gcode = "G21 ; Set units to mm\n";
        gcode += "G90 ; Absolute positioning\n";

        this.state.paths.forEach(path => {
            if (path.length === 0) return;

            // Helper to transform coordinates
            const transform = (p) => {
                let xNorm = p.x / canvasWidth;
                let yNorm = p.y / canvasHeight; // 0 at top, 1 at bottom (Screen Coords)

                // 1. Map Screen Origin (Top-Left) to Physical Table Corner
                // Standard Cartesian (Bottom-Left Origin):
                // Screen (0,0) -> Table (0,1) [Top-Left]
                // Screen (0,1) -> Table (0,0) [Bottom-Left]
                // So standard mapping is: x' = x, y' = 1 - y

                let xMapped, yMapped;

                switch (origin) {
                    case "Top-Left":
                        // Screen Top-Left (0,0) matches Table Top-Left (0,1)
                        // x' = x
                        // y' = 1 - y
                        xMapped = xNorm;
                        yMapped = 1 - yNorm;
                        break;
                    case "Top-Right":
                        // Screen Top-Left (0,0) matches Table Top-Right (1,1)
                        // x' = 1 - x
                        // y' = 1 - y
                        xMapped = 1 - xNorm;
                        yMapped = 1 - yNorm;
                        break;
                    case "Bottom-Right":
                        // Screen Top-Left (0,0) matches Table Bottom-Right (1,0)
                        // x' = 1 - x
                        // y' = y
                        xMapped = 1 - xNorm;
                        yMapped = yNorm;
                        break;
                    case "Bottom-Left":
                    default:
                        // Screen Top-Left (0,0) matches Table Bottom-Left (0,0)
                        // x' = x
                        // y' = y
                        xMapped = xNorm;
                        yMapped = yNorm;
                        break;
                }

                // 2. Swap Axes if requested
                if (swapAxes) {
                    const temp = xMapped;
                    xMapped = yMapped;
                    yMapped = temp;
                }

                // Scale to drawing area and add offset
                const xFinal = (xMapped * drawWidth) + offsetX;
                const yFinal = (yMapped * drawHeight) + offsetY;

                return { x: xFinal.toFixed(3), y: yFinal.toFixed(3) };
            };

            // Move to start
            const start = transform(path[0]);
            gcode += `G0 X${start.x} Y${start.y}\n`;

            for (let i = 1; i < path.length; i++) {
                const p = transform(path[i]);
                gcode += `G1 X${p.x} Y${p.y}\n`;
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
            filename = `drawing_${Date.now()}`;
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
            filename = `drawing_${Date.now()}`;
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
        return (
            <div className="canvas-container">
                <Card className="bg-secondary text-white mb-3">
                    <Card.Header>
                        <h2>Draw on Canvas</h2>
                    </Card.Header>
                    <Card.Body className="text-center">
                        <canvas
                            ref={this.canvasRef}
                            style={{ border: '1px solid white', backgroundColor: 'white', touchAction: 'none' }}
                            onMouseDown={this.startDrawing}
                            onMouseMove={this.draw}
                            onMouseUp={this.stopDrawing}
                            onMouseLeave={this.stopDrawing}
                            onTouchStart={this.startDrawing}
                            onTouchMove={this.draw}
                            onTouchEnd={this.stopDrawing}
                        />
                        <Row className="mt-3 justify-content-center align-items-center">
                            <Col xs={12} md={6} className="mb-2">
                                <Form.Control
                                    type="text"
                                    placeholder="Drawing Name (optional)"
                                    value={this.state.drawingName}
                                    onChange={(e) => this.setState({ drawingName: e.target.value })}
                                />
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

export default connect(mapStateToProps)(Canvas);
