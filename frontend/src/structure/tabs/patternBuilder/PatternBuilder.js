import './PatternBuilder.scss';

import React, { Component } from 'react';
import { Card, Form, Button } from 'react-bootstrap';
import { Upload, Download, ArrowRepeat } from 'react-bootstrap-icons';
import { connect } from 'react-redux';

import LayerPanel from './components/LayerPanel';
import LayerSettings from './components/LayerSettings';
import PatternPreview from './components/PatternPreview';
import PatternBuilderHelp from './components/PatternBuilderHelp';

import { generateLayerPoints } from './utils/geometry';
import { generateGCode, uploadGCode } from './utils/gcodeGenerator';
import { setDrawingName, setFeedrate, resetPattern } from './PatternBuilder.slice';

const mapStateToProps = (state) => ({
    layers: state.patternBuilder?.layers || [],
    drawingName: state.patternBuilder?.drawingName || '',
    feedrate: state.patternBuilder?.feedrate || 2000,
    settings: state.settings
});

const mapDispatchToProps = (dispatch) => ({
    setDrawingName: (name) => dispatch(setDrawingName(name)),
    setFeedrate: (rate) => dispatch(setFeedrate(rate)),
    resetPattern: () => dispatch(resetPattern())
});

class PatternBuilder extends Component {
    constructor(props) {
        super(props);
        this.state = {
            isSending: false,
            sidebarCollapsed: false
        };
    }

    getLayersWithPoints = () => {
        return this.props.layers.map(layer => ({
            ...layer,
            points: generateLayerPoints(layer)
        }));
    }

    handleSendToDrawings = async () => {
        const { layers, drawingName, feedrate, settings } = this.props;

        if (layers.filter(l => l.visible).length === 0) {
            window.showToast?.('Add at least one visible layer to send');
            return;
        }

        this.setState({ isSending: true });

        try {
            const layersWithPoints = this.getLayersWithPoints();
            const device = settings?.device || {};
            const gcode = generateGCode(layersWithPoints, {
                tableWidth: parseFloat(device.width?.value) || 300,
                tableHeight: parseFloat(device.height?.value) || 300,
                offsetX: parseFloat(device.offset_x?.value) || 0,
                offsetY: parseFloat(device.offset_y?.value) || 0,
                feedrate
            });

            await uploadGCode(gcode, drawingName || `pattern_${Date.now()}`);
        } catch (error) {
            console.error('Error sending pattern:', error);
        } finally {
            this.setState({ isSending: false });
        }
    }

    handleDownload = () => {
        const { layers, drawingName, feedrate, settings } = this.props;

        if (layers.filter(l => l.visible).length === 0) {
            window.showToast?.('Add at least one visible layer to download');
            return;
        }

        const layersWithPoints = this.getLayersWithPoints();
        const device = settings?.device || {};
        const gcode = generateGCode(layersWithPoints, {
            tableWidth: parseFloat(device.width?.value) || 300,
            tableHeight: parseFloat(device.height?.value) || 300,
            offsetX: parseFloat(device.offset_x?.value) || 0,
            offsetY: parseFloat(device.offset_y?.value) || 0,
            feedrate
        });

        const blob = new Blob([gcode], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');

        let filename = drawingName || `pattern_${Date.now()}`;
        if (!filename.toLowerCase().endsWith('.gcode')) {
            filename += '.gcode';
        }

        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    render() {
        const { drawingName, feedrate, setDrawingName, setFeedrate, resetPattern } = this.props;
        const { isSending } = this.state;

        return (
            <div className="pattern-builder-layout">
                {/* Fixed Sidebar - hugs left edge */}
                <div className="pb-sidebar">
                    {/* Header */}
                    <div className="pb-sidebar-header">
                        <h5 className="text-white mb-0">Pattern Builder</h5>
                        <PatternBuilderHelp />
                    </div>

                    {/* Scrollable content */}
                    <div className="pb-sidebar-content">
                        {/* Layers List */}
                        <LayerPanel />

                        {/* Layer Settings */}
                        <LayerSettings />

                        {/* Export Controls */}
                        <Card className="bg-dark text-white">
                            <Card.Body className="p-2">
                                <Form.Group className="mb-2">
                                    <Form.Label className="small mb-1 text-muted">Drawing Name</Form.Label>
                                    <Form.Control
                                        type="text"
                                        placeholder="my_pattern"
                                        value={drawingName}
                                        onChange={(e) => setDrawingName(e.target.value)}
                                        className="bg-secondary text-white border-0"
                                        size="sm"
                                    />
                                </Form.Group>
                                <Form.Group className="mb-2">
                                    <Form.Label className="small mb-1 text-muted">Feedrate</Form.Label>
                                    <Form.Control
                                        type="number"
                                        value={feedrate}
                                        onChange={(e) => setFeedrate(parseInt(e.target.value) || 2000)}
                                        className="bg-secondary text-white border-0"
                                        size="sm"
                                    />
                                </Form.Group>
                                <div className="d-flex flex-wrap gap-1 mt-2">
                                    <Button
                                        variant="outline-secondary"
                                        size="sm"
                                        onClick={resetPattern}
                                        title="Reset"
                                    >
                                        <ArrowRepeat />
                                    </Button>
                                    <Button
                                        variant="info"
                                        size="sm"
                                        onClick={this.handleDownload}
                                        className="flex-grow-1"
                                    >
                                        <Download className="me-1" /> Download
                                    </Button>
                                    <Button
                                        variant="success"
                                        size="sm"
                                        onClick={this.handleSendToDrawings}
                                        disabled={isSending}
                                        className="w-100 mt-1"
                                    >
                                        <Upload className="me-1" />
                                        {isSending ? 'Sending...' : 'Send to Drawings'}
                                    </Button>
                                </div>
                            </Card.Body>
                        </Card>
                    </div>
                </div>

                {/* Main Content Area - Canvas centered */}
                <div className="pb-main-content">
                    <PatternPreview />
                </div>
            </div>
        );
    }
}

export default connect(mapStateToProps, mapDispatchToProps)(PatternBuilder);
