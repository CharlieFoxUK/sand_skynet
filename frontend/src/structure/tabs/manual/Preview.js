import "./ManualControl.scss";

import React, { Component } from 'react';
import { connect } from "react-redux";

import { deviceNewPosition } from '../../../sockets/sCallbacks';
import { getDevice, getIsFastMode } from "../settings/selector";
import { dictsAreEqual } from "../../../utils/dictUtils";

const ANIMATION_FRAMES_MAX = 10;
const ANIMATION_DURATION = 1000;

const mapStateToProps = (state) => {
    // Safety checks to prevent crash on initial load or if settings are missing
    if (!state.settings || !state.settings.device) {
        return {
            device: { width: 500, height: 500, type: "Cartesian", radius: 250, physical_width: { value: 500 }, physical_height: { value: 500 } },
            isFastMode: false
        }
    }

    let isFastMode = false;
    try {
        isFastMode = getIsFastMode(state);
    } catch (e) {
        // fast_mode might be missing
    }

    return {
        device: getDevice(state),
        isFastMode: isFastMode
    }
}

class Preview extends Component {
    constructor(props) {
        super(props);
        this.canvasRef = React.createRef();
        this.imageRef = React.createRef();
        this.bgColor = "#000000";
        this.lineColor = "#ffffff";
        this.multiplier = 5;    // multiply the pixels to get a better resolution with small tables
        this.isPreviewMounted = false;
        this.forceImageRender = false;
        this.animationFrames = 0;

        // previous commanded point
        this.pp = {
            x: 0,
            y: 0
        }

        this.width = 100;
        this.height = 100;
        // setInterval removed from constructor to avoid running before mount
    }

    componentDidMount() {
        if (!this.isPreviewMounted) {
            this.isPreviewMounted = true;
            this.canvas = this.canvasRef.current;
            // Add safety check for canvas
            if (this.canvas) {
                this.ctx = this.canvas.getContext("2d");
                this.ctx.strokeStyle = this.lineColor;
                this.ctx.fillStyle = this.bgColor;
                this.ctx.lineWidth = this.multiplier;
                this.clearCanvas();
                this.forceUpdate();
                console.log("Preview Debug: Subscribing to deviceNewPosition");
                deviceNewPosition(this.newLineFromDevice.bind(this));
            }
        }
        // Start interval here
        this.intervalId = setInterval(this.updateImage.bind(this), 1000);
    }

    componentWillUnmount() {
        this.isPreviewMounted = false;
        if (this.intervalId) {
            clearInterval(this.intervalId);
        }
    }

    componentDidUpdate() {
        if (this.forceImageRender) {
            this.forceImageRender = false;
            this.updateImage();
        }
    }

    shouldComponentUpdate(nextProps) {
        if (!dictsAreEqual(nextProps.device, this.props.device))
            this.forceImageRender = true;
        return true;
    }

    updateImage() {
        if (this.canvas !== undefined && this.imageRef.current) {
            this.imageRef.current.src = this.canvas.toDataURL();
        }
    }

    limitValue(value, min, max) {
        // this is not the optimal solution for limiting the value. Will not keep the integrity of the drawing.
        // this limitation is necessary only when the drawing is bigger than the device sizes. 
        // If the sizes are set correctly in the settings, the feeder can adjust the external points to fit the device size this it is not necessary to limit the value
        return Math.min(max, Math.max(min, parseFloat(value)));
    }

    drawLine(line) {
        // prepare the line
        line = line.replace("\n", "");
        let l = line.split(" ");
        // parsing line for fast mode (will not have spaces thus split(" ") will not work)
        // TODO parse with regex like in the feeder
        if (this.props.isFastMode) {
            l = [];
            let tmp = ""
            for (let c in line) {
                if (line.charAt(c).match(/[A-Z]/)) {
                    if (tmp.length > 0) {
                        l.push(tmp);
                        tmp = "";
                    }
                }
                tmp += line.charAt(c);
            }
            l.push(tmp);
        }

        // parse the command
        let x = this.pp.x;
        let y = this.pp.y;
        for (const i in l) {
            if (l[i].includes("X")) {
                x = this.roundFloat(parseFloat(l[i].replace(/[^\d.-]/g, '')));
            }
            if (l[i].includes("Y")) {
                y = this.roundFloat(parseFloat(l[i].replace(/[^\d.-]/g, '')));
            }
        }

        this.pp.x = x;
        this.pp.y = y;

        let res;
        if (this.props.device.type === "Cartesian")
            res = this.convertCartesian(x, y)
        else if (this.props.device.type === "Scara")
            res = this.convertScara(x, y)
        else res = this.convertPolar(x, y)

        x = this.limitValue(res.x, 0, this.width);
        y = this.limitValue(res.y, 0, this.height);
        this.ctx.lineTo(x * this.multiplier, (this.height - y) * this.multiplier);
        this.ctx.stroke();
    }

    roundFloat(val) {
        return Math.round(val * 1000) / 1000;
    }

    convertCartesian(x, y) {
        return {
            x: x,
            y: y
        }
    }

    convertPolar(x, y) {
        return {
            x: this.roundFloat((Math.cos(x * 2 * Math.PI / this.props.device.angle_conversion_factor) * y + 1) * this.props.device.radius),    // +1 to center with respect to the image (shifts by one radius)
            y: this.roundFloat((Math.sin(x * 2 * Math.PI / this.props.device.angle_conversion_factor) * y + 1) * this.props.device.radius)     // +1 to center with respect to the image (shifts by one radius)
        }
    }

    convertScara(x, y) {
        // For more info about the conversion check the server/utils/gcode_converter.py file
        let theta = (x + y + this.props.device.offset_angle_1 * 2) * Math.PI / this.props.device.angle_conversion_factor;
        let rho = Math.cos((x - y + this.props.device.offset_angle_2 * 2) * Math.PI / this.props.device.angle_conversion_factor) * this.radius;
        return {
            x: this.roundFloat(Math.cos(theta) * rho + this.radius),                                                    // +radius to center with respect to the preview
            y: this.roundFloat(Math.sin(theta) * rho + this.radius)
        }
    }

    clearCanvas() {
        if (this.props.device.type === "Scara") {
            let res = this.convertScara(0, 0);
            this.pp.x = res.x + this.radius;
            this.pp.y = res.y + this.radius;
        } else if (this.props.device.type === "Polar") {
            this.pp.x = this.radius;
            this.pp.y = this.radius;
        }
        else {  // Cartesian and Polar
            this.pp.x = 0;
            this.pp.y = 0;
        }
        this.ctx.beginPath();
        // Fix potential typo in logic: using height for y coordinate
        this.ctx.moveTo(this.pp.x, this.height * this.multiplier - this.pp.y);
        this.animationFrames = 0;
        this.animateClear();
    }

    animateClear() {
        this.ctx.globalAlpha = 0.7;
        this.ctx.fillRect(0, 0, this.width * this.multiplier, this.height * this.multiplier);
        this.ctx.globalAlpha = 1;
        this.updateImage();
        if (this.animationFrames++ < ANIMATION_FRAMES_MAX) {
            setTimeout(this.animateClear.bind(this), ANIMATION_DURATION / ANIMATION_FRAMES_MAX);
        }
    }

    newLineFromDevice(line) {
        if (line.includes("G28")) {
            this.clearCanvas();
        }
        if (line.includes("G0") || line.includes("G1") || line.includes("G00") || line.includes("G01")) {
            this.drawLine(line);
        }
    }

    render() {
        if (this.props.device.type === "Cartesian") {
            // Use physical dimensions if available, otherwise fall back to drawing dimensions
            const physW = this.props.device.physical_width ? parseInt(this.props.device.physical_width.value) : 0;
            const physH = this.props.device.physical_height ? parseInt(this.props.device.physical_height.value) : 0;

            if (physW > 0 && physH > 0) {
                this.width = physW;
                this.height = physH;
            } else {
                this.width = parseInt(this.props.device.width);
                this.height = parseInt(this.props.device.height);
            }
        } else {      // For polar and scara should be square with height and width = diameter or 2*radius
            this.width = parseInt(this.props.device.radius) * 2;
            this.height = this.width;
            this.radius = parseInt(this.props.device.radius);
        }

        // Safety check for dimensions
        if (isNaN(this.width) || this.width <= 0) this.width = 500;
        if (isNaN(this.height) || this.height <= 0) this.height = 500;

        // TODO add right click event on the preview with a "move here" command

        // Generate a placeholder data URL (1x1 transparent pixel or black canvas)
        const placeholderSrc = `data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="${this.width * this.multiplier}" height="${this.height * this.multiplier}"><rect width="100%" height="100%" fill="%23000000"/></svg>`;

        return <div>
            <canvas ref={this.canvasRef} className="d-none" width={this.width * this.multiplier} height={this.height * this.multiplier} />
            <img ref={this.imageRef}
                key={this.props.imageKey}
                className="preview-style"
                src={placeholderSrc}
                alt="Preview" />
        </div>
    }
}

export default connect(mapStateToProps)(Preview);