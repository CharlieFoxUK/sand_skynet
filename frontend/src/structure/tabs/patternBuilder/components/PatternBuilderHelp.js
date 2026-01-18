import React, { useState } from 'react';
import { Modal, Button, Card } from 'react-bootstrap';
import { QuestionCircle } from 'react-bootstrap-icons';

const PATTERN_HELP = [
    {
        name: 'Circle',
        description: 'Creates a smooth circle or regular polygon.',
        params: [
            { name: 'Segments', desc: 'Number of line segments (higher = smoother)' }
        ]
    },
    {
        name: 'Polygon',
        description: 'Creates regular polygons like triangles, squares, hexagons.',
        params: [
            { name: 'Sides', desc: 'Number of sides (3 = triangle, 6 = hexagon)' },
            { name: 'Rotation', desc: 'Rotate the polygon in degrees' }
        ]
    },
    {
        name: 'Spiral',
        description: 'Creates spiral patterns that wind outward from the center.',
        params: [
            { name: 'Type', desc: 'Archimedean (evenly spaced) or Fermat (tighter center)' },
            { name: 'Turns', desc: 'How many times the spiral loops around' },
            { name: 'Spacing', desc: 'Distance between spiral arms' }
        ]
    },
    {
        name: 'Rose Curve',
        description: 'Creates flower-like patterns with petals.',
        params: [
            { name: 'Petals', desc: 'Number of petals in the rose pattern' }
        ]
    },
    {
        name: 'Spirograph',
        description: 'Creates intricate looping patterns like the classic drawing toy.',
        params: [
            { name: 'Inner Radius', desc: 'Size of the rolling circle' },
            { name: 'Pen Offset', desc: 'Distance of pen from rolling circle center' },
            { name: 'Rotations', desc: 'Number of times to trace the pattern' }
        ]
    },
    {
        name: 'Star',
        description: 'Creates pointed star shapes.',
        params: [
            { name: 'Points', desc: 'Number of star points' },
            { name: 'Inner Ratio', desc: 'How deep the inner points go (smaller = sharper)' },
            { name: 'Rotation', desc: 'Rotate the star in degrees' }
        ]
    },
    {
        name: 'Lissajous',
        description: 'Creates figure-8 and bow-tie shaped curves.',
        params: [
            { name: 'Frequency X/Y', desc: 'Controls the complexity of the curve' },
            { name: 'Phase', desc: 'Shifts the pattern shape' }
        ]
    },
    {
        name: 'Text',
        description: 'Draws text using single-stroke letters. Great for names and messages.',
        params: [
            { name: 'Text', desc: 'The text to display (automatically converted to uppercase)' },
            { name: 'Font Size', desc: 'Size of the letters' },
            { name: 'Letter Spacing', desc: 'Space between letters' },
            { name: 'Center X/Y', desc: 'Position the text on the canvas' }
        ]
    }
];

function PatternBuilderHelp() {
    const [show, setShow] = useState(false);

    return (
        <>
            <Button
                variant="outline-info"
                size="sm"
                onClick={() => setShow(true)}
                title="Help"
            >
                <QuestionCircle className="me-1" /> Help
            </Button>

            <Modal show={show} onHide={() => setShow(false)} size="lg" centered scrollable>
                <Modal.Header closeButton className="bg-dark text-white">
                    <Modal.Title>Pattern Builder Guide</Modal.Title>
                </Modal.Header>
                <Modal.Body className="bg-dark text-white">
                    <h5 className="mb-3">Getting Started</h5>
                    <ol className="mb-4">
                        <li className="mb-2"><strong>Add a Layer</strong> - Click the "Add" button in the Layers panel</li>
                        <li className="mb-2"><strong>Select Pattern Type</strong> - Choose from Circle, Spiral, Rose, Spirograph, Star, or Lissajous</li>
                        <li className="mb-2"><strong>Adjust Parameters</strong> - Use the sliders to customize your pattern</li>
                        <li className="mb-2"><strong>Transform</strong> - Scale, rotate, or offset the pattern</li>
                        <li className="mb-2"><strong>Add More Layers</strong> - Combine multiple patterns for complex designs</li>
                        <li className="mb-2"><strong>Export</strong> - Click "Send to Drawings" to add to your library</li>
                    </ol>

                    <h5 className="mb-3">Layer Controls</h5>
                    <ul className="mb-4">
                        <li><strong>Eye icon</strong> - Toggle layer visibility</li>
                        <li><strong>Up/Down arrows</strong> - Reorder layers</li>
                        <li><strong>Trash icon</strong> - Delete a layer</li>
                        <li><strong>Click layer</strong> - Select to edit settings</li>
                    </ul>

                    <h5 className="mb-3">Pattern Types</h5>
                    <div className="pattern-help-list">
                        {PATTERN_HELP.map((pattern, index) => (
                            <Card key={index} className="bg-secondary text-white border-dark mb-3">
                                <Card.Header className="font-weight-bold">
                                    {pattern.name}
                                </Card.Header>
                                <Card.Body className="bg-dark pt-3 pb-3">
                                    <p className="mb-2">{pattern.description}</p>
                                    <h6 className="text-muted mb-2" style={{ fontSize: '0.9em' }}>Parameters:</h6>
                                    <ul className="mb-0 pl-3">
                                        {pattern.params.map((param, i) => (
                                            <li key={i}><small><strong>{param.name}</strong>: {param.desc}</small></li>
                                        ))}
                                    </ul>
                                </Card.Body>
                            </Card>
                        ))}
                    </div>

                    <h5 className="mt-4 mb-3">Tips</h5>
                    <ul className="mb-0">
                        <li>Start with a <strong>Spirograph</strong> for impressive results</li>
                        <li>Use <strong>Scale</strong> to make patterns fit your table</li>
                        <li>Combine patterns: try a Spiral inside a Star</li>
                        <li>Lower <strong>Feedrate</strong> for finer sand detail</li>
                    </ul>
                </Modal.Body>
                <Modal.Footer className="bg-dark">
                    <Button variant="secondary" onClick={() => setShow(false)}>
                        Close
                    </Button>
                </Modal.Footer>
            </Modal>
        </>
    );
}

export default PatternBuilderHelp;
