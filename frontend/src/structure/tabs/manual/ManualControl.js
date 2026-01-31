import React, { Component } from 'react';
import { Container, Row, Col, Button, Modal, Table } from 'react-bootstrap';

import "./ManualControl.scss";

import { Section } from '../../../components/Section';
import CommandLine from './CommandLine';
import Preview from './Preview';

import { controlEmergencyStop, sendCommand, controlSoftReset } from '../../../sockets/sEmits';

const COMMANDS = [
    { cmd: "$$", desc: "View Grbl Settings" },
    { cmd: "$H", desc: "Run Homing Cycle" },
    { cmd: "$X", desc: "Kill Alarm Lock" },
    { cmd: "G0 X(val) Y(val)", desc: "Rapid Move (Line)" },
    { cmd: "G1 X(val) Y(val) F(rate)", desc: "Linear Move at Feedrate" },
    { cmd: "G28", desc: "Go to Home Position" },
    { cmd: "G90", desc: "Absolute Positioning" },
    { cmd: "G91", desc: "Relative Positioning" },
    { cmd: "G92 X0 Y0", desc: "Set Current Position as Origin" },
    { cmd: "M114", desc: "Get Current Position" },
    { cmd: "?", desc: "Get Current Status" }
];

class ManualControl extends Component {
    constructor(props) {
        super(props);
        this.state = {
            showHelp: false
        };
    }

    render() {
        return <Container>
            <Modal show={this.state.showHelp} onHide={() => this.setState({ showHelp: false })} size="lg">
                <Modal.Header closeButton>
                    <Modal.Title>GRBL Command Help</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <Table striped bordered hover size="sm">
                        <thead>
                            <tr>
                                <th>Command</th>
                                <th>Description</th>
                            </tr>
                        </thead>
                        <tbody>
                            {COMMANDS.map((c, i) => (
                                <tr key={i}>
                                    <td className="font-weight-bold" style={{ fontFamily: 'monospace' }}>{c.cmd}</td>
                                    <td>{c.desc}</td>
                                </tr>
                            ))}
                        </tbody>
                    </Table>
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" onClick={() => this.setState({ showHelp: false })}>
                        Close
                    </Button>
                </Modal.Footer>
            </Modal>

            <Row>
                <Col>
                    <Section sectionTitle="Manual control">
                        <Row className="mb-2">
                            <Col md className="d-flex flex-column" >
                                <CommandLine />
                            </Col>
                            <Col md>
                                <Preview />
                            </Col>
                        </Row>
                        <Row>
                            <Col sm={3} className="center">
                                <Button className="w-100 m-2" onClick={() => { controlEmergencyStop() }} title="Warning: this button will not stop the device during homing">EMERGENCY STOP</Button>
                            </Col>
                            <Col sm={3} className="center">
                                <Button className="w-100 m-2" variant="warning" onClick={() => { controlSoftReset() }} title="Send Ctrl-X (Reset) to Grbl - Use to clear hard alarms">Soft Reset</Button>
                            </Col>
                            <Col sm={3} className="center">
                                <Button className="w-100 m-2" onClick={() => { sendCommand('G28') }}>Home</Button>
                            </Col>
                            <Col sm={3} className="center">
                                <Button className="w-100 m-2" variant="info" onClick={() => { this.setState({ showHelp: true }) }}>GRBL Help</Button>
                            </Col>
                        </Row>
                    </Section>
                </Col>
            </Row>
        </Container>
    }
}

export default ManualControl;