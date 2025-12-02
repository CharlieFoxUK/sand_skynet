import React, { Component } from 'react';
import { Button, Row, Col, Card } from 'react-bootstrap';
import { Trash, Upload } from 'react-bootstrap-icons';

class Canvas extends Component {
    constructor(props) {
        super(props);
        this.canvasRef = React.createRef();
        this.state = {
            isDrawing: false,
            lastX: 0,
            lastY: 0,
            paths: [] // Store paths for GCode generation
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
            paths: [...this.state.paths, [{x: offsetX, y: offsetY}]] // Start new path
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
        newPaths[newPaths.length - 1].push({x: offsetX, y: offsetY});

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
        // Simple GCode generator
        // Scale coordinates to table size if needed. 
        // Assuming canvas 500x500 maps to 0-1 or physical units.
        // Let's assume normalized 0-1 for now or keep pixel units and let backend/firmware handle scaling if standard.
        // Usually GCode expects physical units (mm). 
        // Let's map 500px to 100 units (arbitrary) or just keep as is.
        // Better: Normalized 0-1 might be safer if the machine size varies.
        // But standard GCode is usually mm.
        // Let's stick to simple pixel-to-unit 1:1 or 1:0.1 for now.
        // Or better, just output raw pixels and let user scale?
        // Let's normalize to 0-1 range.
        
        const width = this.canvasRef.current.width;
        const height = this.canvasRef.current.height;
        
        let gcode = "G21 ; Set units to mm\n";
        gcode += "G90 ; Absolute positioning\n";
        
        this.state.paths.forEach(path => {
            if (path.length === 0) return;
            
            // Move to start
            const start = path[0];
            const x0 = start.x / width; // Normalize 0-1
            const y0 = start.y / height;
            
            // G0 is rapid move (pen up equivalent usually, but for sand table it might just be move without drawing if Z is involved, 
            // but sand tables usually don't have Z lift, they just move. 
            // Wait, sand tables usually draw everything connected or have a way to "lift" the ball (magnet).
            // If no Z axis, we can't "lift". But typically they are continuous.
            // If we have multiple paths, we have to travel between them.
            // Standard sand tables (like Sisyphus) are continuous.
            // But if we want to support "lifting", we might need specific commands.
            // Assuming standard GCode:
            // G0 X... Y... (Travel)
            // G1 X... Y... (Draw)
            
            gcode += `G0 X${x0} Y${y0}\n`; 
            
            for (let i = 1; i < path.length; i++) {
                const p = path[i];
                const x = p.x / width;
                const y = p.y / height;
                gcode += `G1 X${x} Y${y}\n`;
            }
        });
        
        return gcode;
    }

    sendToTable = () => {
        const gcode = this.generateGCode();
        const blob = new Blob([gcode], { type: 'text/plain' });
        const formData = new FormData();
        formData.append('file', blob, `drawing_${Date.now()}.gcode`);

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
                        <Row className="mt-3 justify-content-center">
                            <Col xs="auto">
                                <Button variant="danger" onClick={this.clearCanvas}>
                                    <Trash className="mr-2" /> Clear
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

export default Canvas;
