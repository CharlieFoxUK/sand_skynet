import React, { Component } from 'react';
import { Button, Col, Container, Row } from 'react-bootstrap';
import { connect } from 'react-redux';

import { getElementClass } from '../playlists/SinglePlaylist/Elements';
import IconButton from '../../../components/IconButton';
import { Trash } from 'react-bootstrap-icons';
import { listsAreEqual } from '../../../utils/dictUtils';
import { queueStatus } from '../../../sockets/sCallbacks';
import { queueGetStatus, queueSetOrder, queueNextDrawing, queueRemoveItem } from '../../../sockets/sEmits';
import SortableElements from '../../../components/SortableElements';
import { Section, Subsection } from '../../../components/Section';

import { getIsQueuePaused, getQueueCurrent, getQueueElements, getQueueEmpty, getQueueProgress } from './selector';
import { isViewQueue } from '../selector';
import { setQueueElements, setQueueStatus } from './Queue.slice';
import { setTab, tabBack } from '../Tabs.slice';
import IntervalControl from './IntervalControl';

const mapStateToProps = (state) => {
    return {
        elements: getQueueElements(state),
        currentElement: getQueueCurrent(state),
        isQueueEmpty: getQueueEmpty(state),
        isViewQueue: isViewQueue(state)
    }
}

const mapDispatchToProps = (dispatch) => {
    return {
        setQueueStatus: (val) => dispatch(setQueueStatus(val)),
        handleTabBack: () => dispatch(tabBack()),
        setQueueElements: (list) => dispatch(setQueueElements(list)),
        setTabHome: () => dispatch(setTab('home'))
    }
}

class Queue extends Component {
    constructor(props) {
        super(props);
        this.state = {
            elements: []
        }
    }

    componentDidUpdate() {
        if (!listsAreEqual(this.state.elements, this.props.elements)) {
            this.setState({ ...this.state, elements: this.props.elements, refreshList: true });
        }
    }

    componentDidMount() {
        queueStatus(this.parseQueue.bind(this));
        queueGetStatus();
    }

    parseQueue(data) {
        let res = JSON.parse(data);
        res.elements = res.elements.map((el) => { return JSON.parse(el) });
        this.props.setQueueStatus(res);
    }

    handleSortableUpdate(list) {
        console.log("Elements: ");
        console.log(list);
        if (!listsAreEqual(list, this.state.elements)) {
            this.setState({ ...this.state, elements: list });
            this.props.setQueueElements(list);
            queueSetOrder(list);
        }
    }

    renderList() {
        if (this.state.elements !== undefined)
            if (this.state.elements.length > 0) {
                return <Subsection sectionTitle="Coming next:" className="mb-5">
                    <SortableElements
                        list={this.state.elements}
                        onUpdate={this.handleSortableUpdate.bind(this)}
                        onRemove={(idx) => queueRemoveItem(idx)}
                        hideOptions={true}
                        alwaysShowRemove={true}
                        disableClick={true}>
                    </SortableElements>
                </Subsection>
            }
        return "";
    }

    render() {
        if (this.props.isQueueEmpty && this.props.currentElement === undefined) {
            return <Container>
                <div className="center pt-5">
                    Nothing is being drawn at the moment
                </div>
                <div className="center pt-3">
                    <Button onClick={() => this.props.setTabHome()}>Homepage</Button>
                </div>
            </Container>
        } else {
            let ElementType = getElementClass(this.props.currentElement);
            return <Container>
                <Section sectionTitle="Now drawing">
                    <Row className={"center mb-4"}>
                        <Col md={6} className="p-3">
                            <div className="p-0 position-relative w-100">
                                <ElementType element={this.props.currentElement}
                                    hideOptions={"true"} />
                                <div className="position-absolute top-0 end-0 p-2 d-flex align-items-center">
                                    <div className="mr-2 text-danger font-weight-bold bg-white rounded p-1 shadow-sm" style={{ fontSize: "0.8rem" }}>
                                        Stopping and deleting can take up to 10s
                                    </div>
                                    <IconButton
                                        className="btn btn-danger text-light shadow"
                                        onClick={() => queueRemoveItem(-1)}
                                        icon={Trash}
                                        tip="Stop and Remove this drawing">
                                    </IconButton>
                                </div>
                            </div>
                        </Col>
                    </Row>
                    <IntervalControl />
                </Section>
                {this.renderList()}
            </Container>
        }
    }
}

export default connect(mapStateToProps, mapDispatchToProps)(Queue);