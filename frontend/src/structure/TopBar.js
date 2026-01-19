import React, { Component } from 'react';
import { Navbar, Dropdown } from 'react-bootstrap';
import { ChevronCompactLeft, List, Shuffle, ArrowRepeat, StopFill } from 'react-bootstrap-icons';
import { connect } from 'react-redux';

import IconButton from '../components/IconButton';
import QueueControls from './tabs/queue/QueueControls';

import { getTab, showBack } from './tabs/selector';
import { setTab, tabBack } from './tabs/Tabs.slice';
import { showLEDs, systemIsLinux, updateDockerComposeLatest } from './tabs/settings/selector';
import { settingsRebootSystem, settingsShutdownSystem, queueStartRandom, queueStopAll, queueSetRepeat, queueSetShuffle } from '../sockets/sEmits';

const mapStateToProps = (state) => {
    return {
        showBack: showBack(state),
        isLinux: systemIsLinux(state),
        showLEDs: showLEDs(state),
        selectedTab: getTab(state),
        dockerComposeUpdateAvailable: updateDockerComposeLatest(state)
    }
}

const mapDispatchToProps = (dispatch) => {
    return {
        handleTab: (name) => dispatch(setTab(name)),
        handleTabBack: () => dispatch(tabBack())
    }
}

class TopBar extends Component {

    renderBack() {
        // Hide back button in menu if we are in Drawings tab (because we added it to the main UI there)
        if (this.props.showBack && this.props.selectedTab !== 'drawing')
            return <Dropdown.Item onClick={() => { this.props.handleTabBack() }} className="font-weight-bold"><ChevronCompactLeft className="mr-2" />Back</Dropdown.Item>
        else return null;
    }

    handleLoopRandom = () => {
        // Enable shuffle and repeat, then start random drawing
        queueSetShuffle(true);
        queueSetRepeat(true);
        queueStartRandom();
    }

    render() {
        return <div>
            <Navbar bg="primary" sticky="top" className="center justify-content-between px-3 py-0" style={{ minHeight: '40px' }}>
                <div className="d-flex align-items-center">
                    <Navbar.Brand href="#home" onClick={() => { this.props.handleTab("home") }} className="mr-0 p-0">
                        <h1 className="logo mb-0" style={{ fontSize: '1.2rem' }}>Sandypi</h1>
                    </Navbar.Brand>
                </div>

                <div className="d-flex align-items-center">
                    {/* Stop Button */}
                    <IconButton
                        className="mr-2"
                        style={{ backgroundColor: 'transparent', border: 'none', color: 'white', fontSize: '1.2rem', padding: '0.1rem 0.3rem' }}
                        onClick={() => queueStopAll()}
                        icon={StopFill}
                        iconMedium={true}
                        tip="Stop current drawing"
                    >
                    </IconButton>

                    {/* Loop Random Button */}
                    <IconButton
                        className="mr-2"
                        style={{ backgroundColor: 'transparent', border: 'none', color: 'white', fontSize: '1.2rem', padding: '0.1rem 0.3rem' }}
                        onClick={this.handleLoopRandom}
                        icon={ArrowRepeat}
                        iconMedium={true}
                        tip="Loop random drawings"
                    >
                    </IconButton>

                    {/* Play Random Drawing Icon */}
                    <IconButton
                        className="mr-2"
                        style={{ backgroundColor: 'transparent', border: 'none', color: 'white', fontSize: '1.2rem', padding: '0.1rem 0.3rem' }}
                        onClick={() => queueStartRandom()}
                        icon={Shuffle}
                        iconMedium={true}
                        tip="Start a random drawing"
                    >
                    </IconButton>

                    <Dropdown alignRight>
                        <Dropdown.Toggle id="main-menu-dropdown" className="no-caret" style={{ backgroundColor: 'transparent', border: 'none', color: 'white', fontSize: '1.2rem', padding: '0.1rem 0.3rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <List />
                        </Dropdown.Toggle>

                        <Dropdown.Menu className="shadow-lg border-0" style={{ minWidth: '320px', padding: '10px' }}>

                            {this.renderBack() && <><Dropdown.Divider /></>}
                            {this.renderBack()}

                            <Dropdown.Item
                                active={this.props.selectedTab === "drawings"}
                                onClick={() => { this.props.handleTab("drawings") }}>
                                Drawings
                            </Dropdown.Item>
                            <Dropdown.Item
                                active={this.props.selectedTab === "playlists"}
                                onClick={() => { this.props.handleTab("playlists") }}>
                                Playlists
                            </Dropdown.Item>
                            <Dropdown.Item
                                active={this.props.selectedTab === "canvas"}
                                onClick={() => { this.props.handleTab("canvas") }}>
                                Canvas
                            </Dropdown.Item>
                            <Dropdown.Item
                                active={this.props.selectedTab === "patternBuilder"}
                                onClick={() => { this.props.handleTab("patternBuilder") }}>
                                Pattern Builder
                            </Dropdown.Item>
                            <Dropdown.Item
                                active={this.props.selectedTab === "etchASketch"}
                                onClick={() => { this.props.handleTab("etchASketch") }}>
                                Etch-a-Sketch
                            </Dropdown.Item>
                            <Dropdown.Item
                                active={this.props.selectedTab === "kaleidoscope"}
                                onClick={() => { this.props.handleTab("kaleidoscope") }}>
                                Kaleidoscope
                            </Dropdown.Item>
                            <Dropdown.Item
                                active={this.props.selectedTab === "spirograph"}
                                onClick={() => { this.props.handleTab("spirograph") }}>
                                Spirograph
                            </Dropdown.Item>

                            <Dropdown.Item
                                active={this.props.selectedTab === "settings"}
                                onClick={() => { this.props.handleTab("settings") }}>
                                Settings
                                {!this.props.dockerComposeUpdateAvailable && <span className="badge badge-danger ml-2">1</span>}
                            </Dropdown.Item>

                            {this.props.isLinux && (
                                <>
                                    <Dropdown.Divider className="my-3" />
                                    <Dropdown.Header className="text-uppercase font-weight-bold text-danger">Power</Dropdown.Header>
                                    <Dropdown.Item className="text-danger font-weight-bold" onClick={() => settingsRebootSystem()}>
                                        Reboot System
                                    </Dropdown.Item>
                                    <Dropdown.Item className="text-danger font-weight-bold" onClick={() => settingsShutdownSystem()}>
                                        Shutdown System
                                    </Dropdown.Item>
                                </>
                            )}
                        </Dropdown.Menu>
                    </Dropdown>
                </div>
            </Navbar>
        </div>
    }
}

export default connect(mapStateToProps, mapDispatchToProps)(TopBar);