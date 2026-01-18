import React, { Component } from 'react';
import { Navbar, Dropdown } from 'react-bootstrap';
import { ChevronCompactLeft, List } from 'react-bootstrap-icons';
import { connect } from 'react-redux';

import QueueControls from './tabs/queue/QueueControls';

import { getTab, showBack } from './tabs/selector';
import { setTab, tabBack } from './tabs/Tabs.slice';
import { showLEDs, systemIsLinux, updateDockerComposeLatest } from './tabs/settings/selector';
import { settingsRebootSystem, settingsShutdownSystem } from '../sockets/sEmits';

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
        if (this.props.showBack)
            return <Dropdown.Item onClick={() => { this.props.handleTabBack() }} className="font-weight-bold"><ChevronCompactLeft className="mr-2" />Back</Dropdown.Item>
        else return null;
    }



    render() {
        return <div>
            <Navbar bg="primary" sticky="top" className="center justify-content-between px-3">
                <Navbar.Brand href="#home" onClick={() => { this.props.handleTab("home") }} className="mr-0">
                    <h1 className="logo mb-0">Sandypi</h1>
                </Navbar.Brand>

                <Dropdown alignRight>
                    <Dropdown.Toggle id="main-menu-dropdown" style={{ backgroundColor: 'transparent', border: 'none', color: 'white', fontSize: '1.5rem', padding: '0.2rem 0.5rem' }}>
                        <List />
                    </Dropdown.Toggle>

                    <Dropdown.Menu className="shadow-lg border-0" style={{ minWidth: '320px', padding: '10px' }}>

                        {this.renderBack() && <><Dropdown.Divider /></>}
                        {this.renderBack()}

                        <Dropdown.Header className="text-uppercase font-weight-bold">Menu</Dropdown.Header>
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

                        <Dropdown.Divider className="my-3" />
                        <Dropdown.Header className="text-uppercase font-weight-bold">Actions</Dropdown.Header>

                        {/* Queue Controls Container */}
                        <div className="px-2 pb-2 d-flex justify-content-center w-100" onClick={(e) => e.stopPropagation()}>
                            {/* stopPropagation prevents menu close when clicking Queue controls (optional, removed if auto-close desired) 
                                Actually, user might want to click multiple buttons (e.g. Shuffle then Next). 
                                But Start Random Drawing should probably close it. 
                                Let's NOT stopPropagation for now to keep standard dropdown behavior.
                             */}
                            <QueueControls />
                        </div>

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
            </Navbar>
        </div>
    }
}

export default connect(mapStateToProps, mapDispatchToProps)(TopBar);