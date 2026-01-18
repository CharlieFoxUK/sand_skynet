import React, { Component } from 'react';
import { Container, Form, Col, Button, Row, Card, Accordion } from 'react-bootstrap';
import { PlusSquare, Save, Trash, Joystick, Lightbulb } from 'react-bootstrap-icons';
import { connect } from 'react-redux';

import { Section, Subsection, SectionGroup } from '../../../components/Section';
import IconButton from '../../../components/IconButton';

import { getSettings } from "./selector.js";
import { createNewHWButton, removeHWButton, updateAllSettings, updateSetting } from "./Settings.slice.js";

import { settingsNow } from '../../../sockets/sCallbacks';
import { settingsSave } from '../../../sockets/sEmits';
import { cloneDict } from '../../../utils/dictUtils';
import SettingField from './SettingField';
import SoftwareVersion from './SoftwareVersion';
import Visualizer from './Visualizer';

// Import ManualControl and LEDs components for embedding
import ManualControl from '../manual/ManualControl';
import LedsController from '../leds/Leds';

const mapStateToProps = (state) => {
    return {
        settings: getSettings(state)
    }
}

const mapDispatchToProps = (dispatch) => {
    return {
        updateAllSettings: (settings) => dispatch(updateAllSettings(settings)),
        updateSetting: (val) => dispatch(updateSetting(val)),
        createNewHWButton: () => dispatch(createNewHWButton()),
        removeHWButton: (idx) => dispatch(removeHWButton(idx))
    }
}

class Settings extends Component {

    componentDidMount() {
        settingsNow((data) => {
            this.props.updateAllSettings(JSON.parse(data));
        });
        this.checkStatus();
        this.statusInterval = setInterval(() => this.checkStatus(), 5000);
    }

    saveForm(connect = false) {
        let sets = cloneDict(this.props.settings); // cloning the dict before deleting data
        settingsSave(sets, connect);
    }

    mapEntries(entries) {
        if (entries !== undefined)
            return entries.map((singleSetting, key) => {
                if (singleSetting[1].hide) return null;
                return <SettingField
                    key={key}
                    singleSetting={singleSetting[1]}
                    settings={this.props.settings}
                    onUpdateSetting={this.props.updateSetting.bind(this)} />
            });
        else return "";
    }

    generateHWSettings() {
        if (!this.props.settings.buttons.available) // TODO include LEDS in this check
            return "";
        else return <Subsection sectionTitle="Additional hardware">
            {this.generateHWLEDs()}
            {this.generateHWButtonsForm()}
        </Subsection>
    }

    generateHWButtonsForm() {
        if (!this.props.settings.buttons.available)  // if the buttons are not available with the current hw will just hide the option
            return "";
        let rows = this.props.settings.buttons.buttons.map((button_option, i) => {
            let b = cloneDict(button_option);
            let idx = b.idx;
            let tmp = this.props.settings.buttons.available_values.filter(i => { return i.label === b.click.value });
            if (tmp.length > 0)
                b.click.tip = tmp[0].description;
            return <Form.Row key={idx} className="mb-5">
                <SettingField
                    singleSetting={b.pin}
                    settings={this.props.settings}
                    onUpdateSetting={this.props.updateSetting.bind(this)}
                    key={"bp_" + idx} />
                <SettingField
                    singleSetting={b.click}
                    settings={this.props.settings}
                    onUpdateSetting={this.props.updateSetting.bind(this)}
                    key={"bc_" + idx} />
                <SettingField
                    singleSetting={b.press}
                    settings={this.props.settings}
                    onUpdateSetting={this.props.updateSetting.bind(this)}
                    key={"br_" + idx} />
                <SettingField
                    singleSetting={b.pull}
                    settings={this.props.settings}
                    onUpdateSetting={this.props.updateSetting.bind(this)}
                    key={"bl_" + idx} />
                <Col sm={4} className="mt-4 w-100 pt-1">
                    <IconButton
                        className="w-100 mt-1 center"
                        icon={Trash}
                        onClick={() => this.props.removeHWButton(idx)}>
                        Remove button
                    </IconButton>
                </Col>
            </Form.Row>
        });
        return <SectionGroup sectionTitle="Buttons">
            <p>
                In this section it is possible to specify which functionality should be associated to any HW button wired in the table.
                Add as many buttons as needed, specify the GPIO input pin (BCM index) and select the associated function from the dropdown menu.
                For every button two actions are available: click and long press.
                Each action can be choosen independently.</p>
            <Container>
                {rows}
                <Form.Row className="center mt-2">
                    <IconButton className="center w-100"
                        icon={PlusSquare}
                        onClick={this.props.createNewHWButton.bind(this)}>
                        Add a new hardware button
                    </IconButton>
                </Form.Row>
            </Container>
        </SectionGroup>;
    }

    scanLeds() {
        window.showToast("Scanning for BLE devices...");
        fetch('/api/leds/scan')
            .then(response => response.json())
            .then(data => {
                if (data.error) {
                    window.showToast("Scan failed: " + data.error);
                } else {
                    // Find device named "SandTable" or "SP107E"
                    let device = data.find(d => d.name === "SandTable" || d.name === "SP107E");
                    if (device) {
                        window.showToast(`Found ${device.name} (${device.address})`);
                        this.props.updateSetting(["leds.mac_address", device.address]);
                    } else {
                        // Show list of found devices
                        let msg = "Devices found:\n" + data.map(d => `${d.name}: ${d.address}`).join("\n");
                        window.showToast(msg);
                        // If only one device found, maybe auto-select? No, risky.
                        if (data.length > 0) {
                            // For now just show toast. User can copy-paste if needed, or we can improve UI.
                            // But user said "The LED controller is called SandTable".
                            // So if we didn't find it, maybe the name is different.
                        } else {
                            window.showToast("No devices found.");
                        }
                    }
                }
            })
            .catch(error => {
                window.showToast("Scan error: " + error);
            });
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

    componentWillUnmount() {
        if (this.statusInterval) clearInterval(this.statusInterval);
    }

    checkStatus() {
        if (this.props.settings.leds.type.value === "SP107E") {
            fetch('/api/leds/status')
                .then(response => response.json())
                .then(data => {
                    this.setState({ ledStatus: data });
                })
                .catch(err => console.error(err));
        }
    }

    generateHWLEDs() {
        if (this.props.settings.leds.available) {
            let ledsEntries = Object.entries(this.props.settings.leds);
            let statusBadge = "";
            if (this.props.settings.leds.type.value === "SP107E" && this.state && this.state.ledStatus) {
                const color = this.state.ledStatus.connected ? "success" : "danger";
                const text = this.state.ledStatus.connected ? "Connected" : "Disconnected";
                statusBadge = <span className={`badge badge-${color} ml-2`}>{text}</span>;
            }

            return <SectionGroup sectionTitle="LEDs">
                <Container>
                    <Form.Row>
                        {this.mapEntries(ledsEntries)}
                        {this.props.settings.leds.type.value === "SP107E" && (
                            <Col>
                                <div className="d-flex align-items-center mt-2">
                                    <Button className="flex-grow-1" onClick={() => this.scanLeds()}>Scan</Button>
                                    <Button variant="warning" className="ml-2" onClick={() => this.reconnectLeds()}>Reconnect</Button>
                                    {statusBadge}
                                </div>
                            </Col>
                        )}
                    </Form.Row>
                </Container>
            </SectionGroup>
        } else return "";
    }

    // render the list of settings divided by sections
    render() {
        let serialEntries = Object.entries(this.props.settings.serial);
        let deviceEntries = Object.entries(this.props.settings.device);
        let scriptEntries = Object.entries(this.props.settings.scripts);
        let autostartEntries = Object.entries(this.props.settings.autostart);

        // Check if LEDs are available
        const showLEDs = this.props.settings.leds && this.props.settings.leds.available;

        return <Container>
            <Form>
                <Section sectionTitle="Settings"
                    sectionButtonHandler={this.saveForm.bind(this)}
                    buttonIcon={Save}
                    sectionButton="Save settings">

                    {/* Tools Section - Manual Control and LEDs */}
                    <Subsection sectionTitle="Tools">
                        <Accordion className="mb-4">
                            {/* Manual Control */}
                            <Card className="bg-dark border-secondary mb-2">
                                <Card.Header className="bg-dark p-0 border-secondary">
                                    <Accordion.Toggle
                                        as={Button}
                                        variant="link"
                                        eventKey="manual"
                                        className="w-100 text-left text-white text-decoration-none p-3 d-flex align-items-center"
                                    >
                                        <Joystick className="mr-3" size={20} />
                                        <span className="font-weight-bold">Manual Control</span>
                                        <small className="ml-auto text-muted">G-code commands & jogging</small>
                                    </Accordion.Toggle>
                                </Card.Header>
                                <Accordion.Collapse eventKey="manual">
                                    <Card.Body className="bg-secondary p-0">
                                        <ManualControl />
                                    </Card.Body>
                                </Accordion.Collapse>
                            </Card>

                            {/* LEDs Control */}
                            {showLEDs && (
                                <Card className="bg-dark border-secondary">
                                    <Card.Header className="bg-dark p-0 border-secondary">
                                        <Accordion.Toggle
                                            as={Button}
                                            variant="link"
                                            eventKey="leds"
                                            className="w-100 text-left text-white text-decoration-none p-3 d-flex align-items-center"
                                        >
                                            <Lightbulb className="mr-3" size={20} />
                                            <span className="font-weight-bold">LED Control</span>
                                            <small className="ml-auto text-muted">Color & brightness</small>
                                        </Accordion.Toggle>
                                    </Card.Header>
                                    <Accordion.Collapse eventKey="leds">
                                        <Card.Body className="bg-secondary p-0">
                                            <LedsController />
                                        </Card.Body>
                                    </Accordion.Collapse>
                                </Card>
                            )}
                        </Accordion>
                    </Subsection>

                    <Subsection sectionTitle="Device settings">
                        <SectionGroup sectionTitle="Serial port settings">
                            <Container>
                                <Form.Row>
                                    {this.mapEntries(serialEntries)}
                                    <Col>
                                        <Button className="w-100 h-100" onClick={() => this.saveForm(true)}>Save and connect</Button>
                                    </Col>
                                </Form.Row>
                            </Container>
                        </SectionGroup>
                        <SectionGroup sectionTitle="Device type">
                            <Container>
                                <Form.Row>
                                    {this.mapEntries(deviceEntries.filter(e => e[0] !== 'orientation_origin' && e[0] !== 'orientation_swap'))}
                                </Form.Row>
                                <Visualizer settings={this.props.settings} />
                                <Form.Row className="center mt-2">
                                    <Button variant="info" onClick={() => {
                                        window.showToast("Sending calibration pattern...");
                                        fetch('/api/calibration/draw_boundaries', {
                                            method: 'POST',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify(this.props.settings)
                                        })
                                            .then(r => r.json())
                                            .then(d => {
                                                if (d.error) window.showToast("Error: " + d.error);
                                                else window.showToast("Pattern sent!");
                                            })
                                            .catch(e => window.showToast("Error: " + e));
                                    }}>
                                        Draw Boundaries & Calibrate
                                    </Button>
                                </Form.Row>
                            </Container>
                        </SectionGroup>
                    </Subsection>
                    <Subsection sectionTitle="Automatisms">
                        <SectionGroup sectionTitle="Scripts">
                            <Container>
                                <Form.Row>
                                    {this.mapEntries(scriptEntries)}
                                </Form.Row>
                            </Container>
                        </SectionGroup>
                        <SectionGroup sectionTitle="Autostart options">
                            <Container>
                                <Form.Row>
                                    {this.mapEntries(autostartEntries)}
                                </Form.Row>
                            </Container>
                        </SectionGroup>
                    </Subsection>
                    {this.generateHWSettings()}
                </Section>
                <SectionGroup sectionTitle="Software info">
                    <Container>
                        <SoftwareVersion />
                    </Container>
                </SectionGroup>
                <Row className="pr-3 pl-2 mb-5">
                    <Col>
                        <IconButton
                            className="w-100 center"
                            icon={Save}
                            onClick={() => this.saveForm()}>
                            Save settings
                        </IconButton>
                    </Col>
                </Row>
            </Form>
        </Container>
    }
}

export default connect(mapStateToProps, mapDispatchToProps)(Settings);