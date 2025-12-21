import './Content.scss';

import React, { Component } from 'react';
import { connect } from 'react-redux';
import { Tabs, Tab } from 'react-bootstrap';

import Home from './tabs/Home.js';
import Drawings from './tabs/drawings/Drawings';
import Playlists from './tabs/playlists/Playlists';
import ManualControl from './tabs/manual/ManualControl';
import Settings from './tabs/settings/Settings';
import Queue from './tabs/queue/Queue';
import SingleDrawing from './tabs/drawings/SingleDrawing';

import { getTab } from './tabs/selector';
import DrawingDataDownloader from '../components/DrawingDataDownloader';
import PlaylistDataDownloader from '../components/PlaylistDataDownloader';
import SinglePlaylist from './tabs/playlists/SinglePlaylist/SinglePlaylist';
import LedsController from './tabs/leds/Leds';
import Canvas from './tabs/canvas/Canvas';
import Sandify from './tabs/sandify/Sandify';

const mapStateToProps = (state) => {
    return {
        tab: getTab(state)
    }
}

class Content extends Component {

    componentDidMount() {
        window.addEventListener("message", this.handleSandifyMessage);
    }

    componentWillUnmount() {
        window.removeEventListener("message", this.handleSandifyMessage);
    }

    handleSandifyMessage = (event) => {
        if (event.data.type === 'SANDIFY_GCODE') {
            const { gcode, name } = event.data;
            const blob = new Blob([gcode], { type: 'text/plain' });
            const file = new File([blob], name, { type: 'text/plain' });

            let data = new FormData();
            data.append("file", file);
            data.append("filename", name);

            fetch("/api/upload/", {
                method: "POST",
                body: data
            }).then(response => {
                if (response.status === 200) {
                    window.showToast(`Drawing "${name}" uploaded successfully`);
                } else {
                    window.showToast(`Error uploading "${name}"`);
                }
            }).catch(err => console.error(err));
        }
    }

    render() {
        return <div className="max-width m-auto text-light pt-3 pb-5 mh100">
            <DrawingDataDownloader />
            <PlaylistDataDownloader />

            <Tabs id="content_tabs" className="hide-nav" activeKey={this.props.tab}>
                <Tab eventKey="home" title="Home">
                    <Home />
                </Tab>
                <Tab eventKey="drawings" title="Drawings">
                    <Drawings />
                </Tab>
                <Tab eventKey="playlists" title="Playlists">
                    <Playlists />
                </Tab>
                <Tab eventKey="manual" title="Manual control">
                    <ManualControl />
                </Tab>
                <Tab eventKey="settings" title="Settings">
                    <Settings />
                </Tab>
                <Tab eventKey="queue" title="Queue">
                    <Queue />
                </Tab>
                <Tab eventKey="drawing" title="Drawing">
                    <SingleDrawing />
                </Tab>
                <Tab eventKey="playlist" title="Playlist">
                    <SinglePlaylist />
                </Tab>
                <Tab eventKey="leds" title="LEDs">
                    <LedsController />
                </Tab>
                <Tab eventKey="canvas" title="Canvas">
                    <Canvas />
                </Tab>
                <Tab eventKey="sandify" title="Sandify">
                    <Sandify />
                </Tab>
            </Tabs>
        </div>
    }
}

export default connect(mapStateToProps)(Content);