import React, { Component } from 'react';
import { Container, Button } from 'react-bootstrap';
import { connect } from 'react-redux';

import { Section } from '../../../components/Section';
import { ledsAutoDim, ledsSetColor } from '../../../sockets/sEmits';
import { getSettings } from '../settings/selector';
import DimmableColorPicker from './DimmableColorPicker';
import RGBWColorPicker from './RGBWColorPicker';
import WWAColorPicker from './WWAColorPicker';

const mapStateToProps = (state) => {
    return {
        settings: getSettings(state)
    }
}

class LedsController extends Component {
    constructor(props) {
        super();
        this.last_color = "";
        this.saved_color = "#FFFFFF00"; // Default to white
    }

    changeColor(color) {
        if (color !== this.last_color) {
            // Save color if it's not the OFF command
            if (color !== "#00000000") {
                this.saved_color = color;
            }
            this.last_color = color;
            ledsSetColor(color);
        }
    }

    renderColorPicker() {
        const startup_color = this.props.settings.leds.startup_color ? this.props.settings.leds.startup_color.value : "#FFFFFF";
        const startup_brightness = this.props.settings.leds.startup_brightness ? this.props.settings.leds.startup_brightness.value : 1.0;

        if (this.props.settings.leds.type.value === "Dimmable") {
            return <DimmableColorPicker
                initialBrightness={startup_brightness}
                onColorChange={this.changeColor.bind(this)} />
        } else {
            let PickerType = RGBWColorPicker
            if (this.props.settings.leds.type.value === "WWA")
                PickerType = WWAColorPicker

            // SP107E uses RGBW picker (or just RGB if we hide white)
            // For now, use RGBW picker for SP107E

            let show_white_channel = this.props.settings.leds.type.value === "RGBW" || this.props.settings.leds.type.value === "SP107E";
            let show_auto_dim = this.props.settings.leds.has_light_sensor.value;
            return <PickerType
                useWhite={show_white_channel}
                useAutoDim={show_auto_dim}
                initialColor={startup_color}
                initialBrightness={startup_brightness}
                onAutoDimChange={(ad) => ledsAutoDim(ad)}
                onColorChange={this.changeColor.bind(this)} />
        }
    }

    componentDidMount() {
        this.checkStatus();
        this.statusInterval = setInterval(() => this.checkStatus(), 5000);
    }

    componentWillUnmount() {
        if (this.statusInterval) clearInterval(this.statusInterval);
    }

    checkStatus() {
        if (this.props.settings && this.props.settings.leds && this.props.settings.leds.type.value === "SP107E") {
            fetch('/api/leds/status')
                .then(response => response.json())
                .then(data => {
                    this.setState({ ledStatus: data });
                })
                .catch(err => console.error(err));
        }
    }

    reconnectLeds() {
        window.showToast("Reconnecting...");
        fetch('/api/leds/reconnect', { method: 'POST' })
            .then(response => response.json())
            .then(data => {
                if (data.error) window.showToast("Reconnect failed: " + data.error);
                else window.showToast("Reconnection triggered");
            })
            .catch(err => window.showToast("Reconnect error: " + err));
    }

    disconnectLeds() {
        window.showToast("Disconnecting...");
        fetch('/api/leds/disconnect', { method: 'POST' })
            .then(response => response.json())
            .then(data => {
                if (data.error) window.showToast("Disconnect failed: " + data.error);
                else window.showToast("Disconnected");
            })
            .catch(err => window.showToast("Disconnect error: " + err));
    }

    restartBluetooth() {
        if (!window.confirm("Are you sure you want to restart the Bluetooth service? This will disconnect all devices.")) return;
        window.showToast("Restarting Bluetooth...");
        fetch('/api/system/bluetooth/restart', { method: 'POST' })
            .then(response => response.json())
            .then(data => {
                if (data.error) window.showToast("Restart failed: " + data.error);
                else window.showToast("Bluetooth service restarted");
            })
            .catch(err => window.showToast("Restart error: " + err));
    }

    render() {
        if (!this.props.settings || !this.props.settings.leds) return <Container>Loading settings...</Container>;

        let statusBadge = "";
        let reconnectBtn = "";
        if (this.props.settings.leds.type.value === "SP107E" && this.state && this.state.ledStatus) {
            const color = this.state.ledStatus.connected ? "success" : "danger";
            const text = this.state.ledStatus.connected ? "Connected" : "Disconnected";
            statusBadge = <span className={`badge badge-${color} ml-2`}>{text}</span>;
            reconnectBtn = <Button variant="warning" size="sm" className="ml-2" onClick={() => this.reconnectLeds()}>Reconnect</Button>;
        }

        return <Container>
            <Section sectionTitle={<span>LEDs control {statusBadge}</span>}>
                <div className="mb-3">
                    <Button variant="success" className="mr-2" onClick={() => this.changeColor(this.saved_color)}>ON</Button>
                    <Button variant="danger" onClick={() => this.changeColor("#00000000")}>OFF</Button>
                </div>
                {this.renderColorPicker()}
            </Section>
        </Container>
    }
}

export default connect(mapStateToProps)(LedsController);