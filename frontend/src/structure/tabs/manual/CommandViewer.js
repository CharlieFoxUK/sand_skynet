import React, { Component } from 'react';

class CommandViewer extends Component {
    constructor(props) {
        super(props);
        this.scrollDiv = React.createRef();
    }

    scrollToBottom() {
        // TODO scroll to bottom only if already there otherwise keep the scroll position
        this.scrollDiv.current.scrollIntoView({ behaviour: "smooth", block: "nearest", inline: "start" });
    }

    componentDidUpdate(prevProps) {
        // Only scroll if a new command was added
        if (prevProps.children.length !== this.props.children.length) {
            this.scrollToBottom();
        }
    }

    render() {
        // TODO fix height to stay fixed when new lines are added and the scroll bar appears
        return <div className="bg-light rounded p-2 mb-2 text-dark command-line-history">
            <div>
                {this.props.children.map((el, index) => {
                    // Show all lines. For user commands, add checkmark if acknowledged
                    return <div key={index} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span>{(el.device ? "" : "> ") + el.line}</span>
                        {!el.device && el.acknowledged && <span style={{ color: '#007bff', fontSize: '0.9em' }}>✓</span>}
                    </div>;
                })}
                <div ref={this.scrollDiv} />
            </div>
        </div>
    }
}

export default CommandViewer;