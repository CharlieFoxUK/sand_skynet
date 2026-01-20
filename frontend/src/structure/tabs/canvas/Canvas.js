import React, { Component } from 'react';
import { Button, Form, InputGroup } from 'react-bootstrap';
import { Trash, Upload, Download } from 'react-bootstrap-icons';
import { connect } from 'react-redux';
import { getSettings } from '../settings/selector';
import { settingsNow } from '../../../sockets/sCallbacks';
import { updateAllSettings } from '../settings/Settings.slice';
import { getTableConfig, getCanvasDisplaySize, getCornerCoordinates, formatCoordinate } from '../../../utils/tableConfig';
import { generateGCode, uploadGCode, downloadGCode, CoordinateType } from '../../../utils/gcodeGenerator';

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
            isDrawing: false,
            lastX: 0,
            lastY: 0,
            paths: [], // Store paths for GCode generation
            drawingName: "",
            maxDisplaySize: 600
        };
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
            const sidebarWidth = isMobile ? 0 : 320;
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

    startDrawing = (e) => {
        const { offsetX, offsetY } = this.getCoordinates(e);
        this.setState({
            isDrawing: true,
            lastX: offsetX,
            lastY: offsetY,
            paths: [...this.state.paths, [{ x: offsetX, y: offsetY }]]
        });
    }

    draw = (e) => {
        if (!this.state.isDrawing) return;
        const { offsetX, offsetY } = this.getCoordinates(e);

        this.ctx.beginPath();
        this.ctx.moveTo(this.state.lastX, this.state.lastY);
        this.ctx.lineTo(offsetX, offsetY);
        this.ctx.stroke();

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
        const canvas = this.canvasRef.current;
        const rect = canvas.getBoundingClientRect();
        // Scale factor: internal resolution is 2x display size
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;

        if (e.touches && e.touches.length > 0) {
            return {
                offsetX: (e.touches[0].clientX - rect.left) * scaleX,
                offsetY: (e.touches[0].clientY - rect.top) * scaleY
            };
        }
        return {
            offsetX: e.nativeEvent.offsetX * scaleX,
            offsetY: e.nativeEvent.offsetY * scaleY
        };
    }

    clearCanvas = () => {
        this.ctx.clearRect(0, 0, this.canvasRef.current.width, this.canvasRef.current.height);
        this.setState({ paths: [] });
    }

    handleGenerateGCode = () => {
        const config = getTableConfig(this.props.settings);
        const canvas = this.canvasRef.current;

        return generateGCode(this.state.paths, config, {
            feedrate: 2000,
            coordinateType: CoordinateType.CANVAS,
            canvasSize: { width: canvas.width, height: canvas.height }
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
        const displaySize = getCanvasDisplaySize(config, {
            maxWidth: this.state.maxDisplaySize,
            maxHeight: this.state.maxDisplaySize
        });
        const corners = getCornerCoordinates(config);

        // Internal canvas resolution (higher for smooth drawing)
        const internalWidth = Math.round(displaySize.width * 2);
        const internalHeight = Math.round(displaySize.height * 2);

        return (
            <div className="canvas-layout">
                {/* Sidebar */}
                <div className="canvas-sidebar">
                    <div className="canvas-sidebar-header">
                        <h2>Draw on Canvas</h2>
                    </div>

                    <div className="canvas-sidebar-content">
                        <p className="text-muted small mb-4">
                            Draw freely below. Your strokes will be converted to G-code.
                        </p>

                        <div className="mb-3">
                            <label className="form-label">Drawing Name</label>
                            <InputGroup>
                                <Form.Control
                                    type="text"
                                    placeholder="Enter name..."
                                    value={this.state.drawingName}
                                    onChange={(e) => this.setState({ drawingName: e.target.value })}
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

                            <hr className="border-secondary my-3" />

                            <Button variant="outline-danger" onClick={this.clearCanvas}>
                                <Trash className="mr-2" /> Clear Canvas
                            </Button>
                        </div>

                        <div className="mt-4 pt-3 border-top border-secondary">
                            <div className="text-muted small">
                                Canvas Size: <span className="text-light">{config.drawWidth} × {config.drawHeight} mm</span>
                            </div>
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
                            width={internalWidth}
                            height={internalHeight}
                            style={{
                                border: '3px solid #20c997',
                                borderRadius: '12px',
                                boxShadow: '0 0 30px rgba(32, 201, 151, 0.2), 0 8px 32px rgba(0, 0, 0, 0.4)',
                                backgroundColor: 'white',
                                touchAction: 'none',
                                cursor: 'crosshair',
                                width: displaySize.width,
                                height: displaySize.height,
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
                </div>
            </div>
        );
    }
}

export default connect(mapStateToProps, mapDispatchToProps)(Canvas);
