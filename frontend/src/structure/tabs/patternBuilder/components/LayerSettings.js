import React from 'react';
import { Card, Form, Row, Col, Accordion } from 'react-bootstrap';
import { connect } from 'react-redux';
import {
    updateLayerParams,
    updateLayerTransform,
    updateLayerPatternType,
    renameLayer
} from '../PatternBuilder.slice';

const PATTERN_TYPES = [
    { value: 'circle', label: 'Circle' },
    { value: 'polygon', label: 'Polygon' },
    { value: 'spiral', label: 'Spiral' },
    { value: 'rose', label: 'Rose Curve' },
    { value: 'spirograph', label: 'Spirograph' },
    { value: 'star', label: 'Star' },
    { value: 'lissajous', label: 'Lissajous' },
    { value: 'text', label: 'Text' }
];

const mapStateToProps = (state) => {
    const layers = state.patternBuilder?.layers || [];
    const selectedId = state.patternBuilder?.selectedLayerId;
    const selectedLayer = layers.find(l => l.id === selectedId);
    return { selectedLayer };
};

const mapDispatchToProps = (dispatch) => ({
    updateParams: (id, params) => dispatch(updateLayerParams({ id, params })),
    updateTransform: (id, transform) => dispatch(updateLayerTransform({ id, transform })),
    updatePatternType: (id, patternType) => dispatch(updateLayerPatternType({ id, patternType })),
    renameLayer: (id, name) => dispatch(renameLayer({ id, name }))
});

function LayerSettings({ selectedLayer, updateParams, updateTransform, updatePatternType, renameLayer }) {
    if (!selectedLayer) {
        return (
            <Card className="bg-dark text-white">
                <Card.Body className="text-center text-muted">
                    Select a layer to edit its settings
                </Card.Body>
            </Card>
        );
    }

    const { id, name, patternType, params, transform } = selectedLayer;

    const handleParamChange = (key, value) => {
        updateParams(id, { [key]: value });
    };

    const handleTransformChange = (key, value) => {
        updateTransform(id, { [key]: value });
    };

    const renderPatternParams = () => {
        switch (patternType) {
            case 'circle':
                return (
                    <>
                        <Form.Group className="mb-2">
                            <Form.Label className="small mb-1">Segments</Form.Label>
                            <Form.Control
                                type="range"
                                min={3}
                                max={200}
                                value={params.sides || 100}
                                onChange={(e) => handleParamChange('sides', parseInt(e.target.value))}
                            />
                            <small className="text-muted">{params.sides || 100}</small>
                        </Form.Group>
                    </>
                );
            case 'polygon':
                return (
                    <>
                        <Form.Group className="mb-2">
                            <Form.Label className="small mb-1">Sides</Form.Label>
                            <Form.Control
                                type="range"
                                min={3}
                                max={12}
                                value={params.sides || 6}
                                onChange={(e) => handleParamChange('sides', parseInt(e.target.value))}
                            />
                            <small className="text-muted">{params.sides || 6}</small>
                        </Form.Group>
                        <Form.Group className="mb-2">
                            <Form.Label className="small mb-1">Rotation</Form.Label>
                            <Form.Control
                                type="range"
                                min={0}
                                max={360}
                                value={params.rotation || 0}
                                onChange={(e) => handleParamChange('rotation', parseInt(e.target.value))}
                            />
                            <small className="text-muted">{params.rotation || 0}°</small>
                        </Form.Group>
                    </>
                );
            case 'spiral':
                return (
                    <>
                        <Form.Group className="mb-2">
                            <Form.Label className="small mb-1">Type</Form.Label>
                            <Form.Control
                                as="select"
                                size="sm"
                                value={params.spiralType || 'archimedean'}
                                onChange={(e) => handleParamChange('spiralType', e.target.value)}
                            >
                                <option value="archimedean">Archimedean</option>
                                <option value="fermat">Fermat</option>
                            </Form.Control>
                        </Form.Group>
                        <Form.Group className="mb-2">
                            <Form.Label className="small mb-1">Turns</Form.Label>
                            <Form.Control
                                type="range"
                                min={1}
                                max={20}
                                value={params.turns || 5}
                                onChange={(e) => handleParamChange('turns', parseInt(e.target.value))}
                            />
                            <small className="text-muted">{params.turns || 5}</small>
                        </Form.Group>
                        {params.spiralType !== 'fermat' && (
                            <Form.Group className="mb-2">
                                <Form.Label className="small mb-1">Spacing</Form.Label>
                                <Form.Control
                                    type="range"
                                    min={5}
                                    max={30}
                                    value={(params.spacing || 0.15) * 100}
                                    onChange={(e) => handleParamChange('spacing', parseInt(e.target.value) / 100)}
                                />
                                <small className="text-muted">{((params.spacing || 0.15) * 100).toFixed(0)}%</small>
                            </Form.Group>
                        )}
                    </>
                );
            case 'rose':
                return (
                    <>
                        <Form.Group className="mb-2">
                            <Form.Label className="small mb-1">Petals</Form.Label>
                            <Form.Control
                                type="range"
                                min={2}
                                max={12}
                                value={params.petals || 5}
                                onChange={(e) => handleParamChange('petals', parseInt(e.target.value))}
                            />
                            <small className="text-muted">{params.petals || 5}</small>
                        </Form.Group>
                    </>
                );
            case 'spirograph':
                return (
                    <>
                        <Form.Group className="mb-2">
                            <Form.Label className="small mb-1">Inner Radius</Form.Label>
                            <Form.Control
                                type="range"
                                min={10}
                                max={90}
                                value={(params.innerRadius || 0.3) * 100}
                                onChange={(e) => handleParamChange('innerRadius', parseInt(e.target.value) / 100)}
                            />
                            <small className="text-muted">{((params.innerRadius || 0.3) * 100).toFixed(0)}%</small>
                        </Form.Group>
                        <Form.Group className="mb-2">
                            <Form.Label className="small mb-1">Pen Offset</Form.Label>
                            <Form.Control
                                type="range"
                                min={10}
                                max={100}
                                value={(params.penOffset || 0.5) * 100}
                                onChange={(e) => handleParamChange('penOffset', parseInt(e.target.value) / 100)}
                            />
                            <small className="text-muted">{((params.penOffset || 0.5) * 100).toFixed(0)}%</small>
                        </Form.Group>
                        <Form.Group className="mb-2">
                            <Form.Label className="small mb-1">Rotations</Form.Label>
                            <Form.Control
                                type="range"
                                min={1}
                                max={30}
                                value={params.rotations || 10}
                                onChange={(e) => handleParamChange('rotations', parseInt(e.target.value))}
                            />
                            <small className="text-muted">{params.rotations || 10}</small>
                        </Form.Group>
                    </>
                );
            case 'star':
                return (
                    <>
                        <Form.Group className="mb-2">
                            <Form.Label className="small mb-1">Points</Form.Label>
                            <Form.Control
                                type="range"
                                min={3}
                                max={12}
                                value={params.points || 5}
                                onChange={(e) => handleParamChange('points', parseInt(e.target.value))}
                            />
                            <small className="text-muted">{params.points || 5}</small>
                        </Form.Group>
                        <Form.Group className="mb-2">
                            <Form.Label className="small mb-1">Inner Ratio</Form.Label>
                            <Form.Control
                                type="range"
                                min={10}
                                max={90}
                                value={(params.innerRatio || 0.5) * 100}
                                onChange={(e) => handleParamChange('innerRatio', parseInt(e.target.value) / 100)}
                            />
                            <small className="text-muted">{((params.innerRatio || 0.5) * 100).toFixed(0)}%</small>
                        </Form.Group>
                        <Form.Group className="mb-2">
                            <Form.Label className="small mb-1">Rotation</Form.Label>
                            <Form.Control
                                type="range"
                                min={0}
                                max={360}
                                value={params.rotation || 0}
                                onChange={(e) => handleParamChange('rotation', parseInt(e.target.value))}
                            />
                            <small className="text-muted">{params.rotation || 0}°</small>
                        </Form.Group>
                    </>
                );
            case 'lissajous':
                return (
                    <>
                        <Form.Group className="mb-2">
                            <Form.Label className="small mb-1">Frequency X</Form.Label>
                            <Form.Control
                                type="range"
                                min={1}
                                max={10}
                                value={params.freqX || 3}
                                onChange={(e) => handleParamChange('freqX', parseInt(e.target.value))}
                            />
                            <small className="text-muted">{params.freqX || 3}</small>
                        </Form.Group>
                        <Form.Group className="mb-2">
                            <Form.Label className="small mb-1">Frequency Y</Form.Label>
                            <Form.Control
                                type="range"
                                min={1}
                                max={10}
                                value={params.freqY || 2}
                                onChange={(e) => handleParamChange('freqY', parseInt(e.target.value))}
                            />
                            <small className="text-muted">{params.freqY || 2}</small>
                        </Form.Group>
                        <Form.Group className="mb-2">
                            <Form.Label className="small mb-1">Phase</Form.Label>
                            <Form.Control
                                type="range"
                                min={0}
                                max={180}
                                value={params.phase || 90}
                                onChange={(e) => handleParamChange('phase', parseInt(e.target.value))}
                            />
                            <small className="text-muted">{params.phase || 90}°</small>
                        </Form.Group>
                    </>
                );
            case 'text':
                return (
                    <>
                        <Form.Group className="mb-2">
                            <Form.Label className="small mb-1">Text</Form.Label>
                            <Form.Control
                                type="text"
                                value={params.text || 'HELLO'}
                                onChange={(e) => handleParamChange('text', e.target.value.toUpperCase())}
                                className="bg-secondary text-white border-0"
                                size="sm"
                                placeholder="Enter text..."
                            />
                        </Form.Group>
                        <Form.Group className="mb-2">
                            <Form.Label className="small mb-1">Font Size</Form.Label>
                            <Form.Control
                                type="range"
                                min={0.1}
                                max={0.8}
                                step={0.05}
                                value={params.fontSize || 0.3}
                                onChange={(e) => handleParamChange('fontSize', parseFloat(e.target.value))}
                            />
                            <small className="text-muted">{(params.fontSize || 0.3).toFixed(2)}</small>
                        </Form.Group>
                        <Form.Group className="mb-2">
                            <Form.Label className="small mb-1">Letter Spacing</Form.Label>
                            <Form.Control
                                type="range"
                                min={0}
                                max={0.2}
                                step={0.01}
                                value={params.letterSpacing || 0.05}
                                onChange={(e) => handleParamChange('letterSpacing', parseFloat(e.target.value))}
                            />
                            <small className="text-muted">{(params.letterSpacing || 0.05).toFixed(2)}</small>
                        </Form.Group>
                        <Row>
                            <Col xs={6}>
                                <Form.Group className="mb-2">
                                    <Form.Label className="small mb-1">Center X</Form.Label>
                                    <Form.Control
                                        type="range"
                                        min={-0.5}
                                        max={0.5}
                                        step={0.05}
                                        value={params.centerX || 0}
                                        onChange={(e) => handleParamChange('centerX', parseFloat(e.target.value))}
                                    />
                                    <small className="text-muted">{(params.centerX || 0).toFixed(2)}</small>
                                </Form.Group>
                            </Col>
                            <Col xs={6}>
                                <Form.Group className="mb-2">
                                    <Form.Label className="small mb-1">Center Y</Form.Label>
                                    <Form.Control
                                        type="range"
                                        min={-0.5}
                                        max={0.5}
                                        step={0.05}
                                        value={params.centerY || 0}
                                        onChange={(e) => handleParamChange('centerY', parseFloat(e.target.value))}
                                    />
                                    <small className="text-muted">{(params.centerY || 0).toFixed(2)}</small>
                                </Form.Group>
                            </Col>
                        </Row>
                    </>
                );
            default:
                return null;
        }
    };

    return (
        <Card className="bg-dark text-white">
            <Card.Header>
                <Form.Control
                    type="text"
                    value={name}
                    onChange={(e) => renameLayer(id, e.target.value)}
                    className="bg-secondary text-white border-0"
                    size="sm"
                />
            </Card.Header>
            <Card.Body className="py-2">
                <Accordion defaultActiveKey="0" className="bg-dark text-white mb-2">
                    <Card className="bg-dark border-secondary">
                        <Card.Header className="bg-dark p-0 border-secondary">
                            <Accordion.Toggle as={React.Button} variant="link" eventKey="0" className="btn-block text-left text-white text-decoration-none p-2 font-weight-bold">
                                Pattern Type
                            </Accordion.Toggle>
                        </Card.Header>
                        <Accordion.Collapse eventKey="0">
                            <Card.Body className="bg-dark py-2">
                                <Form.Control
                                    as="select"
                                    size="sm"
                                    value={patternType}
                                    onChange={(e) => updatePatternType(id, e.target.value)}
                                    className="mb-2 bg-secondary text-white border-0"
                                >
                                    {PATTERN_TYPES.map(pt => (
                                        <option key={pt.value} value={pt.value}>{pt.label}</option>
                                    ))}
                                </Form.Control>
                                {renderPatternParams()}
                            </Card.Body>
                        </Accordion.Collapse>
                    </Card>
                </Accordion>

                <Accordion defaultActiveKey="0" className="bg-dark text-white">
                    <Card className="bg-dark border-secondary">
                        <Card.Header className="bg-dark p-0 border-secondary">
                            <Accordion.Toggle as={React.Button} variant="link" eventKey="0" className="btn-block text-left text-white text-decoration-none p-2 font-weight-bold">
                                Transform
                            </Accordion.Toggle>
                        </Card.Header>
                        <Accordion.Collapse eventKey="0">
                            <Card.Body className="bg-dark py-2">
                                <Form.Group className="mb-2">
                                    <Form.Label className="small mb-1">Scale</Form.Label>
                                    <Form.Control
                                        type="range"
                                        min={10}
                                        max={150}
                                        value={(transform.scale || 1) * 100}
                                        onChange={(e) => handleTransformChange('scale', parseInt(e.target.value) / 100)}
                                    />
                                    <small className="text-muted">{((transform.scale || 1) * 100).toFixed(0)}%</small>
                                </Form.Group>
                                <Form.Group className="mb-2">
                                    <Form.Label className="small mb-1">Rotation</Form.Label>
                                    <Form.Control
                                        type="range"
                                        min={0}
                                        max={360}
                                        value={transform.rotation || 0}
                                        onChange={(e) => handleTransformChange('rotation', parseInt(e.target.value))}
                                    />
                                    <small className="text-muted">{transform.rotation || 0}°</small>
                                </Form.Group>
                                <Row>
                                    <Col>
                                        <Form.Group className="mb-2">
                                            <Form.Label className="small mb-1">Offset X</Form.Label>
                                            <Form.Control
                                                type="range"
                                                min={-50}
                                                max={50}
                                                value={(transform.offsetX || 0) * 100}
                                                onChange={(e) => handleTransformChange('offsetX', parseInt(e.target.value) / 100)}
                                            />
                                            <small className="text-muted">{((transform.offsetX || 0) * 100).toFixed(0)}%</small>
                                        </Form.Group>
                                    </Col>
                                    <Col>
                                        <Form.Group className="mb-2">
                                            <Form.Label className="small mb-1">Offset Y</Form.Label>
                                            <Form.Control
                                                type="range"
                                                min={-50}
                                                max={50}
                                                value={(transform.offsetY || 0) * 100}
                                                onChange={(e) => handleTransformChange('offsetY', parseInt(e.target.value) / 100)}
                                            />
                                            <small className="text-muted">{((transform.offsetY || 0) * 100).toFixed(0)}%</small>
                                        </Form.Group>
                                    </Col>
                                </Row>
                            </Card.Body>
                        </Accordion.Collapse>
                    </Card>
                </Accordion>
            </Card.Body>
        </Card>
    );
}

export default connect(mapStateToProps, mapDispatchToProps)(LayerSettings);
