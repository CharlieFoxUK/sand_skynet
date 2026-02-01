import React, { Component } from 'react';
import { connect } from 'react-redux';

import { Form, OverlayTrigger, Tooltip } from "react-bootstrap";
import { queueSetInterval } from '../../../sockets/sEmits';
import { getIntervalValue, getIsQueuePaused } from './selector';
import { setInterval } from './Queue.slice';

const mapStateToProps = state => {
    return {
        intervalValue: getIntervalValue(state),
        isPause: getIsQueuePaused(state)
    }
}

const mapDispatchToProps = dispatch => {
    return {
        setInterval: (interval) => dispatch(setInterval(interval))
    }
}

class IntervalControl extends Component {
    constructor(props) {
        super();
        this.state = {
            intervalValue: props.intervalValue,
            isChanging: false
        }
    }

    saveInterval() {
        queueSetInterval(this.state.intervalValue);
        this.props.setInterval(this.state.intervalValue);
    }

    componentDidUpdate() {
        if (this.props.intervalValue !== this.state.intervalValue && !this.state.isChanging) {
            this.setState({ ...this.state, intervalValue: this.props.intervalValue });
        }
    }

    slideEnd(evt) {
        this.setState({ ...this.state, intervalValue: evt.target.value, isChanging: false },
            this.saveInterval.bind(this));
    }

    formatInterval(value) {
        const hours = Math.floor(value);
        const minutes = Math.round((value - hours) * 60);
        if (hours === 0 && minutes === 0) return 'Continuous';
        if (hours === 0) return `${minutes}m`;
        if (minutes === 0) return `${hours}h`;
        return `${hours}h ${minutes}m`;
    }

    render() {
        let tip = this.props.isPause
            ? "Cannot change interval while paused"
            : "Time to wait between drawings (0 = continuous)";

        return <OverlayTrigger
            overlay={<Tooltip>{tip}</Tooltip>}
            delay={{ show: 1000, hide: 250 }}
            placement="top">
            <Form className="p-3 bg-dark rounded text-center" style={{ maxWidth: '400px', margin: '0 auto' }}>
                <div className="d-flex justify-content-between align-items-center mb-2">
                    <Form.Label className="mb-0 small text-muted">
                        Interval between drawings
                    </Form.Label>
                    <span className="badge bg-info">
                        {this.formatInterval(this.state.intervalValue)}
                    </span>
                </div>
                <div className="d-flex align-items-center">
                    <span className="small text-muted me-2" style={{ minWidth: '20px' }}>0</span>
                    <Form.Control
                        type="range"
                        value={this.state.intervalValue}
                        disabled={this.props.isPause}
                        min={0}
                        step={0.5}
                        max={24}
                        className="flex-grow-1"
                        onChange={(evt) => {
                            this.setState({ ...this.state, intervalValue: evt.target.value, isChanging: true });
                        }}
                        onTouchEnd={this.slideEnd.bind(this)}
                        onMouseUp={this.slideEnd.bind(this)} />
                    <span className="small text-muted ms-2" style={{ minWidth: '30px' }}>24h</span>
                </div>
            </Form>
        </OverlayTrigger>
    }
}

export default connect(mapStateToProps, mapDispatchToProps)(IntervalControl);