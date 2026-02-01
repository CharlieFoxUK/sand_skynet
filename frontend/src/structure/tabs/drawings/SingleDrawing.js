import React, { Component } from 'react';
import { Container, Form, Modal, Row, Col, InputGroup } from 'react-bootstrap';
import { FileEarmarkX, Play, Plus, PlusSquare, X, Download, ChevronCompactLeft, Pencil, Check, FileCode } from 'react-bootstrap-icons';
import { connect } from 'react-redux';

import { drawingDelete, drawingQueue } from '../../../sockets/sEmits';

import ConfirmButton from '../../../components/ConfirmButton';
import IconButton from '../../../components/IconButton';

import { createElementDrawing } from '../playlists/elementsFactory';
import { getImgUrl } from '../../../utils/utils';

import { getQueueCurrent } from '../queue/selector';
import { getSingleDrawing } from './selector';
import { getPlaylistsList } from '../playlists/selector';
import { getSettings } from '../settings/selector';
import { tabBack } from '../Tabs.slice';
import { deleteDrawing, setRefreshDrawing } from './Drawings.slice';
import { addToPlaylist } from '../playlists/Playlists.slice';
import Image from '../../../components/Image';
import GCodePreview from '../../../components/GCodePreview';


const mapStateToProps = (state) => {
    return {
        currentElement: getQueueCurrent(state),
        drawing: getSingleDrawing(state),
        playlists: getPlaylistsList(state),
        settings: getSettings(state)
    }
}

const mapDispatchToProps = (dispatch) => {
    return {
        handleTabBack: () => dispatch(tabBack()),
        refreshDrawings: () => dispatch(setRefreshDrawing()),
        deleteDrawing: (id) => dispatch(deleteDrawing(id)),
        addToPlaylist: (bundle) => dispatch(addToPlaylist(bundle))
    }
}

class SingleDrawing extends Component {
    constructor(props) {
        super(props);
        this.state = {
            showPlaylists: false,
            isRenaming: false,
            renameValue: "",
            showGCodeViewer: false,
            gCodeContent: "",
            gCodeLoading: false
        };
        this.selectRef = React.createRef();
    }

    renderAddToPlaylistButton() {
        if (this.props.playlists.length > 0) {
            return <IconButton className="btn w-100 center"
                icon={PlusSquare}
                tip="Add to playlist"
                onClick={() => this.setState({ ...this.state, showPlaylists: true })}>
            </IconButton>
        } else return "";
    }

    handleRenameStart = () => {
        const currentName = this.props.drawing.filename.replace(/\.gcode$/i, '');
        this.setState({ isRenaming: true, renameValue: currentName });
    }

    handleRenameCancel = () => {
        this.setState({ isRenaming: false, renameValue: "" });
    }

    handleRenameSave = () => {
        const id = this.props.drawing.id;
        const name = this.state.renameValue;

        if (!name || name.trim() === "") return;

        fetch('/api/rename/' + id, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ name: name }),
        })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    this.props.refreshDrawings();
                    this.setState({ isRenaming: false });
                    window.showToast("Drawing renamed successfully");
                } else {
                    window.showToast("Error renaming drawing: " + (data.error || "Unknown error"));
                }
            })
            .catch((error) => {
                console.error('Error:', error);
                window.showToast("Error renaming drawing");
            });
    }

    handleOpenGCodeViewer = async () => {
        this.setState({ showGCodeViewer: true, gCodeLoading: true, gCodeContent: "" });

        try {
            const response = await fetch(`/api/download/${this.props.drawing.id}`);
            if (!response.ok) throw new Error("Failed to fetch G-code");
            const text = await response.text();
            this.setState({ gCodeContent: text, gCodeLoading: false });
        } catch (error) {
            console.error('Error fetching G-code:', error);
            this.setState({ gCodeContent: "Error loading G-code", gCodeLoading: false });
        }
    }

    render() {
        if (this.props.drawing.id !== undefined) {
            let startDrawingLabel = "Queue drawing";
            if (this.props.currentElement === undefined) {
                startDrawingLabel = "Start drawing";
            }
            // TODO add possibility to edit the gcode file and render again the drawing
            return <Container>
                <div className="mb-3 w-100 center">
                    {this.state.isRenaming ? (
                        <div className="d-inline-flex w-50 align-items-center justify-content-center">
                            <Form.Control
                                type="text"
                                value={this.state.renameValue}
                                onChange={(e) => this.setState({ renameValue: e.target.value })}
                                style={{ fontSize: '1.5rem', textAlign: 'center' }}
                            />
                            <IconButton className="btn-success ml-2" icon={Check} onClick={this.handleRenameSave} />
                            <IconButton className="btn-danger ml-2" icon={X} onClick={this.handleRenameCancel} />
                        </div>
                    ) : (
                        <h1 className="d-inline-flex align-items-center ml-3">
                            {this.props.drawing.filename.replace(/\.gcode$/i, '')}
                            <IconButton className="btn-link text-white ml-3 p-0" style={{ fontSize: '1rem' }} icon={Pencil} onClick={this.handleRenameStart} />
                        </h1>
                    )}
                </div>
                <Row className="center pb-3 justify-content-center">
                    <Col xs="auto" className="center mx-1 mb-2">
                        <IconButton className="btn center"
                            icon={ChevronCompactLeft}
                            tip="Back to drawings"
                            onClick={() => this.props.handleTabBack()}>
                        </IconButton>
                    </Col>
                    <Col xs="auto" className="center mx-1 mb-2">
                        <IconButton className="btn center"
                            icon={Play}
                            tip={startDrawingLabel}
                            onClick={() => {
                                drawingQueue(this.props.drawing.id);
                                this.props.handleTabBack();
                            }}>
                        </IconButton>
                    </Col>
                    <Col xs="auto" className="center mx-1 mb-2">
                        {this.renderAddToPlaylistButton()}
                    </Col>
                    <Col xs="auto" className="center mx-1 mb-2">
                        <IconButton className="btn center"
                            icon={Download}
                            tip="Download G-code"
                            onClick={() => window.open('/api/download/' + this.props.drawing.id)}>
                        </IconButton>
                    </Col>
                    <Col xs="auto" className="center mx-1 mb-2">
                        <IconButton className="btn center"
                            icon={FileCode}
                            tip="View G-code"
                            onClick={this.handleOpenGCodeViewer}>
                        </IconButton>
                    </Col>
                    <Col xs="auto" className="center mx-1 mb-2">
                        <ConfirmButton className="center"
                            icon={FileEarmarkX}
                            tip="Delete drawing"
                            onClick={() => {
                                drawingDelete(this.props.drawing.id);
                                this.props.deleteDrawing(this.props.drawing.id);
                                this.props.handleTabBack();
                            }}>
                        </ConfirmButton>
                    </Col>
                </Row>
                <div className="center mb-5">
                    {(() => {
                        return <div className="modal-drawing-preview" style={{ aspectRatio: '500/510', width: '850px', maxWidth: '100%', margin: '0 auto' }}>
                            <GCodePreview
                                drawingId={this.props.drawing.id}
                                strokeWidth={2}
                                resolutionScale={2}
                            />
                        </div>
                    })()}
                </div>
                <Modal show={this.state.showPlaylists}
                    onHide={() => this.setState({ ...this.state, showPlaylists: false })}
                    aria-labelledby="contained-modal-title-vcenter"
                    centered>
                    <Modal.Header className="center">
                        <Modal.Title>
                            Choose a playlist
                        </Modal.Title>
                    </Modal.Header>
                    <Modal.Body className="p-5 center">
                        <Form>
                            <Form.Group>
                                <Form.Control as="select" ref={this.selectRef}>
                                    {this.props.playlists.map((el, idx) => {
                                        return <option key={idx} value={el.id}>{el.name}</option>
                                    })}
                                </Form.Control>
                            </Form.Group>
                        </Form>
                    </Modal.Body>
                    <Modal.Footer>
                        <IconButton icon={X} onClick={() => this.setState({ ...this.state, showPlaylists: false })}>Undo</IconButton>
                        <IconButton icon={Plus}
                            onClick={() => {
                                this.props.addToPlaylist({
                                    elements: [createElementDrawing(this.props.drawing)],
                                    playlistId: parseInt(this.selectRef.current.value)
                                });
                                this.setState({ ...this.state, showPlaylists: false });
                                window.showToast("Drawing added to the playlist");
                            }}>
                            Add to selected playlist
                        </IconButton>
                    </Modal.Footer>
                </Modal>

                {/* G-code Viewer Modal */}
                <Modal
                    show={this.state.showGCodeViewer}
                    onHide={() => this.setState({ showGCodeViewer: false })}
                    size="lg"
                    aria-labelledby="gcode-viewer-modal"
                    centered>
                    <Modal.Header closeButton className="bg-dark text-white">
                        <Modal.Title id="gcode-viewer-modal">
                            G-code: {this.props.drawing.filename}
                        </Modal.Title>
                    </Modal.Header>
                    <Modal.Body className="p-0" style={{ maxHeight: '60vh', overflow: 'auto', backgroundColor: '#1a1a1a' }}>
                        {this.state.gCodeLoading ? (
                            <div className="text-center p-5 text-muted">Loading G-code...</div>
                        ) : (
                            <pre style={{
                                margin: 0,
                                padding: '1rem',
                                fontSize: '0.85rem',
                                fontFamily: 'monospace',
                                color: '#00ff88',
                                backgroundColor: '#1a1a1a',
                                whiteSpace: 'pre-wrap',
                                wordBreak: 'break-all',
                                lineHeight: '1.4'
                            }}>
                                {this.state.gCodeContent.split('\n').map((line, idx) => (
                                    <div key={idx} style={{ display: 'flex' }}>
                                        <span style={{
                                            color: '#666',
                                            minWidth: '4em',
                                            textAlign: 'right',
                                            paddingRight: '1em',
                                            userSelect: 'none'
                                        }}>
                                            {idx + 1}
                                        </span>
                                        <span>{line}</span>
                                    </div>
                                ))}
                            </pre>
                        )}
                    </Modal.Body>
                    <Modal.Footer className="bg-dark">
                        <small className="text-muted me-auto">
                            {this.state.gCodeContent ? `${this.state.gCodeContent.split('\n').length} lines` : ''}
                        </small>
                        <IconButton
                            icon={X}
                            onClick={() => this.setState({ showGCodeViewer: false })}
                        >
                            Close
                        </IconButton>
                    </Modal.Footer>
                </Modal>
            </Container>
        } else return null;
    }
}

export default connect(mapStateToProps, mapDispatchToProps)(SingleDrawing);