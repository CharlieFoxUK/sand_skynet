import React, { Component } from 'react';
import { Form, Row, Col, Button } from 'react-bootstrap';

import { sendCommand } from '../../../sockets/sEmits';
import { deviceCommandLineReturn, deviceNewPosition } from '../../../sockets/sCallbacks';
import CommandViewer from './CommandViewer';

class CommandLine extends Component {
    constructor(props) {
        super(props);
        this.state = {
            history: []
        };
        this.commandHistoryCounter = 0;
        this.commandHistory = [];
        this.inputRef = React.createRef();
    }

    componentDidMount() {
        deviceCommandLineReturn(this.addLine.bind(this));
        deviceNewPosition(this.addLine.bind(this));
    }

    submitCommand(event) {
        // Always prevent default form submission and event bubbling
        if (event) {
            event.preventDefault();
            event.stopPropagation();
        }

        sendCommand(this.getInputValue());
        this.addLine(this.getInputValue(), false);
        this.commandHistory.push(this.getInputValue());
        this.commandHistoryCounter = 0;
        this.setInputValue("");
    }

    setInputValue(value) {
        this.inputRef.current.value = value;
    }

    getInputValue() {
        return this.inputRef.current.value;
    }

    keyUpHandler(event) {
        if (!this.commandHistory.length) {
            return;
        }
        if (event.keyCode === 38) {      // Arrow up 
            if (this.commandHistoryCounter > 0) {
                this.commandHistoryCounter--;
            }
        } else if (event.keyCode === 40) {      // Arrow down
            if (this.commandHistoryCounter < this.commandHistory.length) {
                this.commandHistoryCounter++;
            }
        } else {
            return;
        }
        if (this.commandHistory[this.commandHistoryCounter]) {
            this.setInputValue(this.commandHistory[this.commandHistoryCounter]);
        } else {
            this.setInputValue("");
        }
    }

    addLine(line, device = true) {
        this.setState(prevState => {
            let ch = [...prevState.history];

            // If this is an "ok" acknowledgment from device, mark the last unacknowledged command as acknowledged
            if (device && line.trim() === "ok") {
                // Find the last command (device=false) that hasn't been acknowledged yet
                // We create a new object for the modified item to treat state as immutable (best practice)
                for (let i = ch.length - 1; i >= 0; i--) {
                    if (!ch[i].device && !ch[i].acknowledged) {
                        ch[i] = { ...ch[i], acknowledged: true };
                        break;
                    }
                }
            } else {
                // Add normal line (command or device response that's not "ok")
                ch.push({ line: line, device: device, acknowledged: false });
            }

            // limiting the number of lines in the preview (for performance)
            while (ch.length > 100)
                ch.shift();

            return { history: ch };
        });
    }

    render() {
        return <div className="h-100 p-relative d-flex flex-column command-viewer">
            <CommandViewer>
                {this.state.history}
            </CommandViewer>
            <Form onSubmit={(e) => this.submitCommand(e)}>
                <Form.Group>
                    <Row sm={12} className="p-2">
                        <Col sm={8} className="align-items-center">
                            <Form.Control
                                placeholder="Write a command"
                                className="mt-3"
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        this.submitCommand(e);
                                    }
                                }}
                                onKeyUp={this.keyUpHandler.bind(this)}
                                ref={this.inputRef} />
                        </Col>
                        <Col sm={4} className="center">
                            <Button type="button" onClick={(e) => this.submitCommand(e)}>Send command</Button>
                        </Col>
                    </Row>
                </Form.Group>
            </Form>
        </div>
    }
}

export default CommandLine;