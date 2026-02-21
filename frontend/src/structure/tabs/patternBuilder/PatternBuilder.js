import './PatternBuilder.scss';

import React, { Component } from 'react';
import { Card, Form, Button, Collapse, InputGroup } from 'react-bootstrap';
import { Upload, ArrowRepeat, Gear } from 'react-bootstrap-icons';
import { connect } from 'react-redux';

import LayerPanel from './components/LayerPanel';
import LayerSettings from './components/LayerSettings';
import PatternPreview from './components/PatternPreview';
import PatternBuilderHelp from './components/PatternBuilderHelp';

import { generateLayerPoints } from './utils/geometry';
import { generateGCode, uploadGCode } from './utils/gcodeGenerator';
import { setDrawingName, resetPattern } from './PatternBuilder.slice';

const mapStateToProps = (state) => ({
    layers: state.patternBuilder?.layers || [],
    drawingName: state.patternBuilder?.drawingName || '',
    settings: state.settings
});

const mapDispatchToProps = (dispatch) => ({
    setDrawingName: (name) => dispatch(setDrawingName(name)),
    resetPattern: () => dispatch(resetPattern())
});

class PatternBuilder extends Component {
    constructor(props) {
        super(props);
        this.state = {
            isSending: false,
            showSettings: false,
            maxDisplaySize: 600
        };
    }

    componentDidMount() {
        this.handleResize();
        window.addEventListener('resize', this.handleResize);
    }

    componentWillUnmount() {
        window.removeEventListener('resize', this.handleResize);
    }

    handleResize = () => {
        const viewportHeight = window.innerHeight;
        const viewportWidth = window.innerWidth;

        // Account for top nav (70) + header (80)
        const headerHeight = 150;
        const padding = 40;
        // Leave room for inline settings if open
        const extraSpace = this.state.showSettings ? 380 : 80;

        const availableHeight = viewportHeight - headerHeight - padding - extraSpace;

        // Mobile layout stacks settings
        const isMobile = viewportWidth < 992;
        const availableWidth = isMobile ? viewportWidth - 40 : viewportWidth - 40;

        const maxSize = Math.min(availableWidth, availableHeight, 900);
        this.setState({ maxDisplaySize: Math.max(300, maxSize) });
    };

    componentDidUpdate(prevProps, prevState) {
        if (prevState.showSettings !== this.state.showSettings) {
            // Delay slightly to let the collapse transition finish before resizing canvas
            setTimeout(this.handleResize, 350);
        }
    }

    getLayersWithPoints = () => {
        return this.props.layers.map(layer => ({
            ...layer,
            points: generateLayerPoints(layer)
        }));
    }

    handleSendToDrawings = async () => {
        const { layers, drawingName, settings } = this.props;

        if (layers.filter(l => l.visible).length === 0) {
            window.showToast?.('Add at least one visible layer to send');
            return;
        }

        this.setState({ isSending: true });

        try {
            const layersWithPoints = this.getLayersWithPoints();
            const gcode = generateGCode(layersWithPoints, settings, { feedrate: 2000 });

            await uploadGCode(gcode, drawingName || `pattern_${Date.now()}`);
        } catch (error) {
            console.error('Error sending pattern:', error);
        } finally {
            this.setState({ isSending: false });
        }
    }



    render() {
        const { drawingName, setDrawingName, resetPattern } = this.props;
        const { isSending, showSettings, maxDisplaySize } = this.state;

        return (
            <div className="pattern-builder-layout">
                {/* Header Controls */}
                <div className="pb-header">
                    <div className="d-flex align-items-center gap-3">
                        <h4 className="mb-0">✨ Pattern Builder</h4>
                        <PatternBuilderHelp />
                    </div>

                    <div className="pb-controls">
                        <Button
                            variant={showSettings ? "primary" : "outline-secondary"}
                            size="sm"
                            onClick={() => this.setState({ showSettings: !showSettings })}
                            title="Toggle Settings"
                        >
                            <Gear /> {showSettings ? 'Hide Details' : 'Design Layers'}
                        </Button>

                        <InputGroup size="sm" style={{ width: '200px' }}>
                            <Form.Control
                                type="text"
                                placeholder="my_pattern"
                                value={drawingName}
                                onChange={(e) => setDrawingName(e.target.value)}
                                className="bg-dark text-white border-secondary"
                            />
                        </InputGroup>

                        <Button variant="outline-danger" size="sm" onClick={resetPattern} title="Reset">
                            <ArrowRepeat />
                        </Button>

                        <Button variant="success" size="sm" onClick={this.handleSendToDrawings} disabled={isSending}>
                            <Upload /> {isSending ? 'Sending...' : 'Send'}
                        </Button>
                    </div>
                </div>

                {/* Main Content Area */}
                <div className="pb-canvas-wrapper d-flex flex-column" style={{ flex: 1 }}>
                    <div className="d-flex justify-content-center w-100 mb-3" style={{ flex: '1 1 auto', position: 'relative' }}>
                        <PatternPreview maxDisplaySize={maxDisplaySize} />
                    </div>

                    {/* Inline Settings Panel */}
                    <Collapse in={showSettings}>
                        <div className="pb-inline-settings w-100">
                            <div className="pb-settings-content">
                                {/* Layers List */}
                                <LayerPanel />

                                {/* Layer Settings */}
                                <LayerSettings />
                            </div>
                        </div>
                    </Collapse>
                </div>
            </div>
        );
    }
}

export default connect(mapStateToProps, mapDispatchToProps)(PatternBuilder);
