import React, { Component } from 'react';
import { Container } from 'react-bootstrap';

class Sandify extends Component {
    render() {
        return (
            <div style={{ width: '100%', height: '85vh', backgroundColor: 'white' }}>
                <iframe
                    src="/sandify/index.html"
                    title="Sandify"
                    width="100%"
                    height="100%"
                    style={{ border: 'none' }}
                />
            </div>
        );
    }
}

export default Sandify;
