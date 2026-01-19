import './DrawingCard.scss';

import React, { Component } from 'react';
import { Card } from 'react-bootstrap';
import { connect } from 'react-redux';

import { getImgUrl } from '../../../utils/utils';
import { drawingQueue } from '../../../sockets/sEmits';

import { showSingleDrawing } from '../Tabs.slice';

import Image from '../../../components/Image';
import GCodePreview from '../../../components/GCodePreview';
import DrawingCardMenu from './DrawingCardMenu';

import { getSettings } from '../settings/selector';

const mapStateToProps = (state) => {
    return {
        settings: getSettings(state)
    }
}

const mapDispatchToProps = (dispatch) => {
    return { showSingleDrawing: (id) => dispatch(showSingleDrawing(id)) }
}

class DrawingCard extends Component {

    render() {
        if (this.props.drawing === undefined || this.props.drawing === null)
            return "";
        const highlight = this.props.highlight ? " card-highlight" : "";

        const device = this.props.settings.device || {};
        const canvasRotation = parseInt(device.canvas_rotation ? device.canvas_rotation.value : 0) || 0;
        // Base 90° needed because canvas shows X as vertical but thumbnails are generated with X as horizontal
        const rotation = 90 - canvasRotation;

        return <DrawingCardMenu onStartDrawing={(id) => drawingQueue(id)} drawing={this.props.drawing}>
            <Card className="p-2 hover-zoom" onClick={() => this.props.showSingleDrawing(this.props.drawing.id)}>

                <div className={"border-0 bg-black rounded text-dark clickable center p-0"} style={{ overflow: 'hidden', aspectRatio: '1' }}>
                    <GCodePreview
                        drawingId={this.props.drawing.id}
                        className={"card-img-top rounded" + highlight}
                    />
                    <div className="card-img-overlay h-100 d-flex flex-column justify-content-end p-2" style={{ pointerEvents: 'none' }}>
                        <div className="card-text text-center text-primary p-1 glass rounded-bottom">
                            {this.props.drawing.filename.replace(/\.gcode$/i, '')}
                        </div>
                    </div>
                </div>
            </Card>
        </DrawingCardMenu>
    }
}

export default connect(mapStateToProps, mapDispatchToProps)(DrawingCard);