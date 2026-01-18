import React from 'react';
import { Card, ListGroup, Button, ButtonGroup } from 'react-bootstrap';
import { Plus, Trash, Eye, EyeSlash, ChevronUp, ChevronDown } from 'react-bootstrap-icons';
import { connect } from 'react-redux';
import {
    addLayer,
    removeLayer,
    selectLayer,
    toggleLayerVisibility,
    reorderLayers
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

const mapStateToProps = (state) => ({
    layers: state.patternBuilder?.layers || [],
    selectedLayerId: state.patternBuilder?.selectedLayerId
});

const mapDispatchToProps = (dispatch) => ({
    addLayer: (type) => dispatch(addLayer(type)),
    removeLayer: (id) => dispatch(removeLayer(id)),
    selectLayer: (id) => dispatch(selectLayer(id)),
    toggleVisibility: (id) => dispatch(toggleLayerVisibility(id)),
    reorderLayers: (from, to) => dispatch(reorderLayers({ fromIndex: from, toIndex: to }))
});

function LayerPanel({ layers, selectedLayerId, addLayer, removeLayer, selectLayer, toggleVisibility, reorderLayers }) {

    const handleAddLayer = () => {
        addLayer('circle');
    };

    const handleMoveUp = (index) => {
        if (index > 0) {
            reorderLayers(index, index - 1);
        }
    };

    const handleMoveDown = (index) => {
        if (index < layers.length - 1) {
            reorderLayers(index, index + 1);
        }
    };

    return (
        <Card className="bg-dark text-white mb-3">
            <Card.Header className="d-flex justify-content-between align-items-center">
                <span className="h6 mb-0">Layers</span>
                <Button variant="outline-success" size="sm" onClick={handleAddLayer}>
                    <Plus /> Add
                </Button>
            </Card.Header>
            <ListGroup variant="flush">
                {layers.length === 0 && (
                    <ListGroup.Item className="bg-secondary text-white text-center">
                        No layers yet. Click "Add" to start.
                    </ListGroup.Item>
                )}
                {layers.map((layer, index) => (
                    <ListGroup.Item
                        key={layer.id}
                        className={`bg-secondary text-white d-flex justify-content-between align-items-center ${selectedLayerId === layer.id ? 'border-primary border-2' : ''}`}
                        style={{ cursor: 'pointer', borderLeft: selectedLayerId === layer.id ? '3px solid #0d6efd' : '3px solid transparent' }}
                        onClick={() => selectLayer(layer.id)}
                    >
                        <div className="d-flex align-items-center flex-grow-1">
                            <Button
                                variant="link"
                                size="sm"
                                className="p-0 me-2 text-white"
                                onClick={(e) => { e.stopPropagation(); toggleVisibility(layer.id); }}
                            >
                                {layer.visible ? <Eye /> : <EyeSlash className="text-muted" />}
                            </Button>
                            <span className="me-2">{layer.name}</span>
                            <small className="text-muted">({PATTERN_TYPES.find(p => p.value === layer.patternType)?.label || layer.patternType})</small>
                        </div>
                        <ButtonGroup size="sm">
                            <Button
                                variant="outline-light"
                                onClick={(e) => { e.stopPropagation(); handleMoveUp(index); }}
                                disabled={index === 0}
                            >
                                <ChevronUp />
                            </Button>
                            <Button
                                variant="outline-light"
                                onClick={(e) => { e.stopPropagation(); handleMoveDown(index); }}
                                disabled={index === layers.length - 1}
                            >
                                <ChevronDown />
                            </Button>
                            <Button
                                variant="outline-danger"
                                onClick={(e) => { e.stopPropagation(); removeLayer(layer.id); }}
                            >
                                <Trash />
                            </Button>
                        </ButtonGroup>
                    </ListGroup.Item>
                ))}
            </ListGroup>
        </Card>
    );
}

export default connect(mapStateToProps, mapDispatchToProps)(LayerPanel);
