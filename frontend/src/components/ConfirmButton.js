import React, { Component } from 'react';
import { Button } from 'react-bootstrap';
import IconButton from './IconButton';

class ConfirmButton extends Component {
    constructor(props) {
        super(props);
        this.state = { mustConfirm: false }
    }

    render() {
        return <div className={this.props.className} style={{ position: 'relative', display: 'inline-block' }}>
            {/* Main button - always rendered to maintain size */}
            <div style={{ visibility: this.state.mustConfirm ? 'hidden' : 'visible' }}>
                <IconButton className="w-100 center"
                    onClick={() => this.setState({ mustConfirm: true })}
                    icon={this.props.icon}
                    tip={this.props.tip}>
                    {this.props.children}
                </IconButton>
            </div>

            {/* Confirmation overlay - positioned absolutely to not affect layout */}
            {this.state.mustConfirm && (
                <div style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    backgroundColor: 'rgba(30, 30, 30, 0.95)',
                    borderRadius: '8px',
                    padding: '8px 12px',
                    zIndex: 10,
                    whiteSpace: 'nowrap',
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4)',
                    border: '1px solid rgba(255, 255, 255, 0.1)'
                }}>
                    <div style={{
                        fontSize: '0.75rem',
                        color: '#aaa',
                        marginBottom: '6px',
                        textAlign: 'center'
                    }}>
                        Are you sure?
                    </div>
                    <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                        <Button
                            size="sm"
                            variant="success"
                            onClick={(evt) => {
                                this.setState({ mustConfirm: false });
                                this.props.onClick(evt);
                            }}
                            style={{ padding: '2px 12px', fontSize: '0.8rem' }}>
                            Yes
                        </Button>
                        <Button
                            size="sm"
                            variant="danger"
                            onClick={(evt) => this.setState({ mustConfirm: false })}
                            style={{ padding: '2px 12px', fontSize: '0.8rem' }}>
                            No
                        </Button>
                    </div>
                </div>
            )}
        </div>
    }
}

export default ConfirmButton;