import React, { Component } from 'react';
import { Container, Row, Col, Button } from 'react-bootstrap';
import { FileEarmarkPlus, ArrowClockwise } from 'react-bootstrap-icons';
import { connect } from 'react-redux';

import { Section } from '../../../components/Section';

import UploadDrawingsModal from './UploadDrawing';
import DrawingCard from './DrawingCard';

import { setRefreshDrawing } from './Drawings.slice';
import { getDrawings } from './selector';
import { getQueueCurrent } from '../queue/selector';
import { getSettings } from '../settings/selector';
import { settingsSave } from '../../../sockets/sEmits';
import { cloneDict } from '../../../utils/dictUtils';

const mapStateToProps = (state) => {
    return {
        drawings: getDrawings(state),
        currentElement: getQueueCurrent(state),
        settings: getSettings(state)
    }
}

const mapDispatchToProps = (dispatch) => {
    return {
        setRefreshDrawing: () => dispatch(setRefreshDrawing(true))
    }
}

class Drawings extends Component {
    constructor(props) {
        super(props);
        this.state = { showUpload: false, loaded: false }
    }

    componentDidMount() {
        if (this.props.drawings.length > 0) {
            this.setState({ loaded: true });
        }
    }

    handleFileUploaded() {
        this.props.setRefreshDrawing();
        this.setState({ loaded: true });
    }

    rotateThumbnails = () => {
        const device = this.props.settings.device || {};
        const currentRotation = parseInt(device.thumbnail_rotation ? device.thumbnail_rotation.value : 0) || 0;
        const newRotation = (currentRotation + 90) % 360;

        const newSettings = cloneDict(this.props.settings);
        if (newSettings.device) {
            if (!newSettings.device.thumbnail_rotation) {
                newSettings.device.thumbnail_rotation = { value: 0 };
            }
            newSettings.device.thumbnail_rotation.value = newRotation;
            settingsSave(newSettings, false);
        }
    }

    renderDrawings(drawings) {
        if (drawings !== undefined) {
            let currentDrawingId = 0;
            if (this.props.currentElement !== undefined)
                if (this.props.currentElement.element_type === "drawing")
                    currentDrawingId = this.props.currentElement.drawing_id
            return drawings.map((d, index) => {
                return <Col key={index} sm={4}>
                    <DrawingCard drawing={d} highlight={d.id === currentDrawingId} />
                </Col>
            });
        } else {
            return <div></div>
        }
    }

    render() {
        const device = this.props.settings.device || {};
        const rotation = parseInt(device.thumbnail_rotation ? device.thumbnail_rotation.value : 0) || 0;

        return <Container>
            <Section sectionTitle="Drawings"
                sectionButton="Upload new drawing"
                buttonIcon={FileEarmarkPlus}
                sectionButtonHandler={() => this.setState({ showUpload: true })}>

                <Row className="mb-3 justify-content-end">
                    <Col xs="auto">
                        <Button variant="outline-primary" size="sm" onClick={this.rotateThumbnails}>
                            <ArrowClockwise className="mr-2" /> Rotate Thumbnails ({rotation}°)
                        </Button>
                    </Col>
                </Row>

                <Row>
                    {this.renderDrawings(this.props.drawings)}
                </Row>

                <UploadDrawingsModal key={2}
                    show={this.state.showUpload}
                    handleClose={() => { this.setState({ showUpload: false }) }}
                    handleFileUploaded={this.handleFileUploaded.bind(this)} />
            </Section>
        </Container>
    }
}

// TODO possibility to create elements instead of loading drawings. This will allow to share same elements between different playlists

export default connect(mapStateToProps, mapDispatchToProps)(Drawings);