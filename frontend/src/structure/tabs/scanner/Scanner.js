import React, { Component } from 'react';
import { Button, Card, Form, Accordion, Collapse, InputGroup } from 'react-bootstrap';
import { CameraVideo, Camera, Upload, Image as ImageIcon, ExclamationTriangle, ZoomIn, ZoomOut, XLg, Gear } from 'react-bootstrap-icons';
import { connect } from 'react-redux';
import { getSettings } from '../settings/selector';
import { getTableConfig, getCanvasDisplaySize } from '../../../utils/tableConfig';
import { generateGCode, uploadGCode, CoordinateType } from '../../../utils/gcodeGenerator';
import { SelfieSegmentation } from '@mediapipe/selfie_segmentation';

import './Scanner.scss';

const mapStateToProps = (state) => {
    return {
        settings: getSettings(state)
    }
}

class Scanner extends Component {
    constructor(props) {
        super(props);
        this.videoRef = React.createRef();
        this.canvasRef = React.createRef();
        this.fileInputRef = React.createRef();
        this.stream = null;
        this.segmenter = null;

        this.state = {
            hasCamera: false,
            isStreaming: false,
            showVideo: false,
            isIOS: false, // Detect iPad/iPhone
            zoom: 1.0,

            generatedPoints: [], // Normalized -1..1
            maxDisplaySize: 600,
            error: null,

            // New Parameters for Edge Detection
            edgeThreshold: 25,   // 0-255. Lower = more edges.
            blurRadius: 2,       // 0-10. Denoise.
            resolution: 200,     // Internal grid size (e.g. 200x200). 

            contrast: 1.0,       // Optional post-process
            invert: false,       // Invert path order? Or maybe invert selection logic.
            drawingName: '',     // Name for the generated file/job
            focusBlur: false,    // AI Background Removal Mode
            isProcessing: false, // Loading state for AI
            showSettings: false
        };

        // This is the processing canvas size, matches 'resolution' state usually, 
        // but we'll adapt dynamically.
        this.internalSize = 1000;
    }

    componentDidMount() {
        // Detect iOS or iPadOS (since iPadOS 13 it poses as Mac)
        // macOS Chrome sometimes incorrectly reports maxTouchPoints > 0, so we use pointer: coarse to reliably detect touch devices (iPads).
        const isIOSMobile = (/iPad|iPhone|iPod/.test(navigator.userAgent)) ||
            (navigator.userAgent.includes("Mac") && window.matchMedia && window.matchMedia("(pointer: coarse)").matches);

        this.setState({ isIOS: isIOSMobile });

        if (!isIOSMobile) {
            this.startCamera();
        }

        // Initialize Selfie Segmentation
        const segmenter = new SelfieSegmentation({
            locateFile: (file) => {
                return `https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/${file}`;
            }
        });
        segmenter.setOptions({
            modelSelection: 0, // 0: General (slower, accurate), 1: Landscape (faster)
        });
        this.segmenter = segmenter;

        this.handleResize = () => {
            const viewportHeight = window.innerHeight;
            const viewportWidth = window.innerWidth;
            const headerHeight = 80;
            const padding = 40;
            const extraSpace = this.state.showSettings ? 380 : 100; // Leave more room for inline settings
            const availableHeight = viewportHeight - headerHeight - padding - extraSpace;
            const availableWidth = viewportWidth - 40;
            const maxSize = Math.min(availableWidth, availableHeight, 900);
            this.setState({ maxDisplaySize: Math.max(300, maxSize) });
        };
        window.addEventListener('resize', this.handleResize);
        this.handleResize();
    }

    componentWillUnmount() {
        this.stopCamera();
        window.removeEventListener('resize', this.handleResize);
        if (this.segmenter) {
            this.segmenter.close();
        }
    }

    componentDidUpdate(prevProps, prevState) {
        const { edgeThreshold, blurRadius, resolution, contrast, invert } = this.state;

        // Re-process if settings changed AND we have source image data
        // Note: We need to store originalImageData to re-process without re-capturing.
        // For now, let's assuming re-processing happens on capture or we need a way to store source.

        // Actually, to make sliders responsive, we MUST store the captured processed pixels 
        // OR the raw capture. Storing raw capture is best.
        if (this.lastCapturedImageData && (
            prevState.edgeThreshold !== edgeThreshold ||
            prevState.blurRadius !== blurRadius ||
            prevState.resolution !== resolution ||
            prevState.contrast !== contrast ||
            prevState.invert !== invert
        )) {
            // Debounce processing slightly?
            this.processImage(this.lastCapturedImageData);
        }

        if (prevState.generatedPoints !== this.state.generatedPoints ||
            prevProps.settings !== this.props.settings) {
            this.renderPreview();
        }

        if (this.state.showVideo && !prevState.showVideo && this.stream) {
            if (this.videoRef.current) {
                this.videoRef.current.srcObject = this.stream;
            }
        }
    }

    startCamera = async () => {
        this.setState({ error: null });
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: "user",
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                }
            });

            this.stream = stream;

            this.setState({ showVideo: true }, () => {
                if (this.videoRef.current) {
                    this.videoRef.current.srcObject = stream;
                    this.videoRef.current.onloadedmetadata = () => {
                        this.setState({ hasCamera: true, isStreaming: true });
                    };
                }
            });

        } catch (err) {
            console.error("Error accessing camera:", err);
            let errorMessage = "Camera access denied.";
            if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
                errorMessage = "Camera permission denied. Please enable camera access in your browser settings.";
            } else if (err.name === 'NotFoundError') errorMessage = "No camera found.";

            this.setState({ hasCamera: false, isStreaming: false, showVideo: false, error: errorMessage });
        }
    }

    stopCamera = () => {
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }
        this.setState({ isStreaming: false, hasCamera: false });
    }

    captureImage = () => {
        if (!this.videoRef.current) return;

        const video = this.videoRef.current;
        const zoom = this.state.zoom;
        const res = this.state.resolution; // Use selected resolution for extraction

        // We capture at high res, then downscale to 'res' for processing speed loop
        const captureSize = 1000;

        const videoWidth = video.videoWidth;
        const videoHeight = video.videoHeight;
        const minDim = Math.min(videoWidth, videoHeight);
        const sourceBoxSize = minDim / zoom;
        const sourceX = (videoWidth - sourceBoxSize) / 2;
        const sourceY = (videoHeight - sourceBoxSize) / 2;

        const offscreen = document.createElement('canvas');
        offscreen.width = captureSize;
        offscreen.height = captureSize;
        const ctx = offscreen.getContext('2d');

        ctx.drawImage(video, sourceX, sourceY, sourceBoxSize, sourceBoxSize, 0, 0, captureSize, captureSize);

        const imageData = ctx.getImageData(0, 0, captureSize, captureSize);

        // Store for re-processing
        this.lastCapturedImageData = imageData;

        this.setState({ isProcessing: true, showVideo: false });
        // processImage is async, but we rely on callbacks or internal state updates.
        // We set isProcessing=false in computeEdgesAndPath.
        this.processImage(imageData);
        this.stopCamera();
    }

    handleFileChange = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                const size = 1000;
                const offscreen = document.createElement('canvas');
                offscreen.width = size;
                offscreen.height = size;
                const ctx = offscreen.getContext('2d');

                const scale = Math.max(size / img.width, size / img.height);
                const x = (size - img.width * scale) / 2;
                const y = (size - img.height * scale) / 2;

                ctx.fillStyle = 'white';
                ctx.fillRect(0, 0, size, size);
                ctx.drawImage(img, x, y, img.width * scale, img.height * scale);

                const imageData = ctx.getImageData(0, 0, size, size);
                this.lastCapturedImageData = imageData;
                this.processImage(imageData);
                this.setState({ showVideo: false });
            }
            img.src = event.target.result;
        };
        reader.readAsDataURL(file);
    }

    // --- NEW ALGORITHM: Edge Detection + Greedy Path ---
    processImage = async (sourceImageData) => {
        // If "AI Background Removal" (reusing focusBlur flag for now) is ON
        if (this.state.focusBlur && this.segmenter) {
            // Send to MediaPipe
            // We need to pass an HTML element (Image, Video, Canvas)
            // sourceImageData is ImageData. Let's put it on a temp canvas.
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = sourceImageData.width;
            tempCanvas.height = sourceImageData.height;
            tempCanvas.getContext('2d').putImageData(sourceImageData, 0, 0);

            await this.segmenter.send({ image: tempCanvas });
            // The result will come back in onSegmentationResults
        } else {
            // Direct processing
            this.computeEdgesAndPath(sourceImageData);
        }
    }

    onSegmentationResults = (results) => {
        // results.segmentationMask is the mask (1 = person, 0 = background)
        // results.image is the input image

        const w = results.image.width;
        const h = results.image.height;

        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');

        // Draw original image
        ctx.drawImage(results.image, 0, 0, w, h);

        // Apply Mask: Composite operation
        // Goal: Background (Mask=0) becomes WHITE. Subject (Mask=1) stays original.

        // 1. Draw Mask. 
        // We can draw the mask on top with 'destination-in' to keep only the subject?
        // That makes background transparent.
        // Then draw white behind it?

        // Let's try:
        // Draw Image.
        // Draw Mask (globalCompositeOperation = 'destination-in'). Result: Subject + Transparent BG.
        // Draw White (globalCompositeOperation = 'destination-over'). Result: Subject + White BG.

        ctx.globalCompositeOperation = 'destination-in';
        ctx.drawImage(results.segmentationMask, 0, 0, w, h);

        ctx.globalCompositeOperation = 'destination-over';
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, w, h);

        // Reset
        ctx.globalCompositeOperation = 'source-over';

        const finalImageData = ctx.getImageData(0, 0, w, h);
        this.computeEdgesAndPath(finalImageData);
    }

    computeEdgesAndPath = (sourceImageData) => {
        const { edgeThreshold, blurRadius, resolution, contrast } = this.state;

        // 1. Resize to working resolution
        // We do this manually to strictly control the grid
        const w = resolution;
        const h = resolution;

        // Create a temporary canvas to resize the heavy source data down to 'resolution'
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = w;
        tempCanvas.height = h;
        const tempCtx = tempCanvas.getContext('2d');

        // Create an ImageBitmap or just putImageData to a large canvas and drawImage down
        // Since we have ImageData, put it on a canvas equal to its size first
        const sourceCanvas = document.createElement('canvas');
        sourceCanvas.width = sourceImageData.width;
        sourceCanvas.height = sourceImageData.height;
        sourceCanvas.getContext('2d').putImageData(sourceImageData, 0, 0);

        // Draw scaled down
        tempCtx.drawImage(sourceCanvas, 0, 0, w, h);
        const inputData = tempCtx.getImageData(0, 0, w, h);
        const data = inputData.data;

        // 2. Grayscale & Blur & Vignette
        // We'll use a Float32Array for processing luminance
        let gray = new Float32Array(w * h);
        for (let i = 0; i < w * h; i++) {
            const r = data[i * 4];
            const g = data[i * 4 + 1];
            const b = data[i * 4 + 2];
            // Luminance
            let val = 0.299 * r + 0.587 * g + 0.114 * b;

            // Apply Focus Blur (Vignette)
            // Apply Focus Blur (Vignette)
            if (false) {
                const px = i % w;
                const py = Math.floor(i / w);
                const dx = px - w / 2;
                const dy = py - h / 2;
                const dist = Math.sqrt(dx * dx + dy * dy);
                const maxRad = Math.min(w, h) / 2;

                // Sigmoid-like vignette: 1 at center, 0 at edges.
                // Center 40% clean (0.4), fade out to 80% (0.8)
                const normDist = dist / maxRad;
                let mask = 1.0;
                if (normDist > 0.4) {
                    mask = 1.0 - (normDist - 0.4) / (0.8 - 0.4);
                    if (mask < 0) mask = 0;
                }
                // Blend towards mid-gray (128)
                val = val * mask + 128 * (1 - mask);
            }

            // Apply contrast (simple linear)
            val = (val - 128) * contrast + 128;
            gray[i] = Math.max(0, Math.min(255, val));
        }

        // Apply Box Blur
        if (blurRadius > 0) {
            gray = this.boxBlur(gray, w, h, blurRadius);
        }

        // 3. Sobel Edge Detection
        const edges = new Float32Array(w * h); // Gradient magnitude
        const kernelX = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
        const kernelY = [-1, -2, -1, 0, 0, 0, 1, 2, 1];

        const getVal = (arr, x, y) => {
            if (x < 0 || x >= w || y < 0 || y >= h) return 0;
            return arr[y * w + x];
        };

        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                let gx = 0;
                let gy = 0;

                // Convolve
                // Optimized 3x3 unroll
                gx = -getVal(gray, x - 1, y - 1) + getVal(gray, x + 1, y - 1)
                    - 2 * getVal(gray, x - 1, y) + 2 * getVal(gray, x + 1, y)
                    - getVal(gray, x - 1, y + 1) + getVal(gray, x + 1, y + 1);

                gy = -getVal(gray, x - 1, y - 1) - 2 * getVal(gray, x, y - 1) - getVal(gray, x + 1, y - 1)
                    + getVal(gray, x - 1, y + 1) + 2 * getVal(gray, x, y + 1) + getVal(gray, x + 1, y + 1);

                edges[y * w + x] = Math.sqrt(gx * gx + gy * gy);
            }
        }

        // 4. Threshold & Collect Points
        const activePoints = [];
        // Typically Sobel magnitudes can go high, but around 0-100 is faint, >200 is strong
        // Threshold slider is 0-255.
        // Let's normalize magnitude? Or just raw check. Raw check is faster.

        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                if (edges[y * w + x] > edgeThreshold) {
                    activePoints.push({ x, y, visited: false });
                }
            }
        }

        // 5. Greedy Path Generation (Traveling Salesman-ish)
        // Connect points to form lines
        const finalPath = [];
        if (activePoints.length > 0) {
            // Pick random start or top-left? Top-left (first in array) usually minimizes jump
            let currentIdx = 0;
            let current = activePoints[0];
            current.visited = true;
            finalPath.push(this.normalize(current.x, current.y, w, h));

            // Limit max points for safety?
            const maxPoints = 50000;
            let count = 0;

            // Optimization: Spatial Hashing or k-d tree is overkill for JS single thread if N is small.
            // But N can be 4000+. O(N^2) is bad. 
            // Simple Optimization: Look only in local window? Hard if lines jump.
            // Strategy: Just brute force nearest neighbor for now, but if N > 2000 it might lag.
            // Let's optimize: Store points in a simple Y-bucket list.

            const buckets = new Array(h).fill(null).map(() => []);
            activePoints.forEach(p => buckets[p.y].push(p));

            // Search radius optimization?
            // Actually, we just want *connected* components first.
            // But straightforward greedy is "classic" plotter style.

            // Let's do a simplified search:
            // Only search for neighbors within R pixels. If none, jump to closest global unvisited.
            // Global closest is expensive. 
            // Compromise: Just grab the next available point in the array as a "jump" if we lose track.

            let pointsLeft = activePoints.filter(p => !p.visited);

            while (pointsLeft.length > 0 && count < maxPoints) {
                const px = current.x;
                const py = current.y;

                // Find nearest in 'pointsLeft'
                // Performance hack: Only scan a subset if strict nearest is too slow.
                // For 'Resolution' ~200, we might have 2000 points. 2000^2 = 4M ops. Fast enough.

                let minDist = 999999;
                let bestIdx = -1;

                // Scanning ALL remaining points is the bottleneck.
                // optimization: if we find a neighbor distance < 1.5 (connected), take it immediately.
                for (let i = 0; i < pointsLeft.length; i++) {
                    const p = pointsLeft[i];
                    const dx = p.x - px;
                    const dy = p.y - py;
                    const dSq = dx * dx + dy * dy;

                    if (dSq < minDist) {
                        minDist = dSq;
                        bestIdx = i;
                        if (dSq <= 2) break; // Optimization: Immediate neighbor
                    }
                }

                if (bestIdx !== -1) {
                    current = pointsLeft[bestIdx];
                    // Remove from list (swap pop is O(1))
                    pointsLeft[bestIdx] = pointsLeft[pointsLeft.length - 1];
                    pointsLeft.pop();

                    finalPath.push(this.normalize(current.x, current.y, w, h));
                } else {
                    break;
                }
                count++;
            }
        }

        this.setState({ generatedPoints: finalPath, isProcessing: false });
    }

    normalize(x, y, w, h) {
        // Map 0..w to -1..1
        // Fix: Invert Y so Top (0) maps to +1 (Top), and Bottom (h) maps to -1
        // Fix: Invert X as well (was rotated 180), so Left (0) maps to +1 (Right) -> Wait, if 0 is Left, it should map to -1.
        // If it was rotated 180, then 0 was actually Right.
        // Let's just Flip X. 
        // Original: (x / w) * 2 - 1
        // New: 1 - (x / w) * 2
        return {
            x: 1 - (x / w) * 2,
            y: 1 - (y / h) * 2
        };
    }

    boxBlur(data, w, h, contextRadius) {
        const output = new Float32Array(data.length);
        // Simple 1D separable blur or just brute force kernel?
        // Box blur is fast.
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                let sum = 0;
                let count = 0;
                for (let ky = -contextRadius; ky <= contextRadius; ky++) {
                    for (let kx = -contextRadius; kx <= contextRadius; kx++) {
                        const iy = y + ky;
                        const ix = x + kx;
                        if (ix >= 0 && ix < w && iy >= 0 && iy < h) {
                            sum += data[iy * w + ix];
                            count++;
                        }
                    }
                }
                output[y * w + x] = sum / count;
            }
        }
        return output;
    }

    renderPreview = () => {
        if (!this.canvasRef.current || !this.state.generatedPoints) return;
        const canvas = this.canvasRef.current;
        const ctx = canvas.getContext('2d');
        const points = this.state.generatedPoints;
        const size = this.internalSize;

        canvas.width = size;
        canvas.height = size;

        ctx.clearRect(0, 0, size, size);
        ctx.fillStyle = '#111';
        ctx.fillRect(0, 0, size, size);

        if (points.length < 2) return;

        const cx = size / 2;
        const cy = size / 2;
        // Scale to fit: Canvas is -1..1
        // We want a bit of padding.
        const scale = (size / 2) - 0; // Full bleed allowed? 

        ctx.beginPath();
        // Use a thinner line for "Sketch" look
        ctx.strokeStyle = '#20c997'; // Teal
        ctx.lineWidth = 1;
        ctx.globalAlpha = 0.8;

        const p0 = points[0];
        // Flip Y for canvas
        ctx.moveTo(cx + p0.x * scale, cy + p0.y * scale); // Note: Normalization implies -1 is top?
        // In this app, Y seems to be standard Cartesian or Screen?
        // Usually Top-Left is -1,-1 in sand tables? Or Center 0.
        // Standard code used "cy - p.y * scale".
        // Let's stick to previous convention.

        ctx.moveTo(cx + p0.x * scale, cy - p0.y * scale);

        for (let i = 1; i < points.length; i++) {
            const p = points[i];
            // Check for large jumps to simulate "pen lift" visually? 
            // The table can't lift pen. So we draw everything physically connected.
            ctx.lineTo(cx + p.x * scale, cy - p.y * scale);
        }
        ctx.stroke();
    }

    handleGenerateGCode = () => {
        const config = getTableConfig(this.props.settings);
        const points = this.state.generatedPoints;
        if (!points || points.length === 0) return null;

        const path = points.map(p => ({ x: p.x, y: p.y }));
        return generateGCode([path], config, {
            feedrate: 2000,
            coordinateType: CoordinateType.CENTER_NORMALIZED
        });
    }

    sendToTable = async () => {
        const gcode = this.handleGenerateGCode();
        if (gcode) {
            const name = this.state.drawingName.trim() || `scan_${Date.now()}`;
            try { await uploadGCode(gcode, name); }
            catch (error) { alert("Error sending drawing."); }
        }
    }



    render() {
        const { maxDisplaySize, error, isStreaming, showVideo, generatedPoints, zoom, edgeThreshold, blurRadius, resolution, isIOS } = this.state;
        const config = getTableConfig(this.props.settings);
        const displaySize = getCanvasDisplaySize(config, { maxWidth: maxDisplaySize, maxHeight: maxDisplaySize });

        return (
            <div className={`scanner-page ${showVideo ? 'camera-mode' : 'canvas-mode'}`}>
                {/* Header Controls */}
                <div className="scanner-header">
                    <h4 className="mb-0">👁️ Scanner</h4>
                    <div className="scanner-controls">
                        {!isIOS && (
                            !isStreaming && !error ? (
                                <Button variant="outline-warning" size="sm" onClick={this.startCamera} title="Activate Camera">
                                    <CameraVideo /> Camera
                                </Button>
                            ) : (
                                <Button variant={showVideo ? "outline-secondary" : "outline-primary"} size="sm" onClick={() => this.setState({ showVideo: !showVideo })} disabled={!isStreaming} title={showVideo ? "Close Camera" : "Open Camera"}>
                                    {showVideo ? <><XLg /> Close</> : <><Camera /> Open</>}
                                </Button>
                            )
                        )}
                        <input type="file" ref={this.fileInputRef} style={{ display: 'none' }} accept="image/*" onChange={this.handleFileChange} />
                        <Button variant="outline-light" size="sm" onClick={() => this.fileInputRef.current.click()} title="Upload Photo">
                            <ImageIcon /> Upload
                        </Button>

                        <Button variant={this.state.showSettings ? "primary" : "outline-secondary"} size="sm" onClick={() => {
                            this.setState(prev => ({ showSettings: !prev.showSettings }), this.handleResize);
                        }} title="Toggle Settings">
                            <Gear />
                        </Button>


                        <Button variant="outline-success" size="sm" onClick={this.sendToTable} disabled={generatedPoints.length === 0} title="Save to Drawings">
                            <Upload />
                        </Button>
                    </div>
                </div>

                {/* Main Viewing Area */}
                <div className="scanner-canvas-wrapper">
                    {error && !isIOS && <div className="alert alert-danger small p-2 mb-3 mt-3 w-100 text-center">{error}</div>}

                    {showVideo && !isIOS && (
                        <div className="camera-fullscreen-container" style={{ width: Math.min(displaySize.width, displaySize.height), height: Math.min(displaySize.width, displaySize.height) }}>
                            <div className="video-crop-window w-100 h-100">
                                <video ref={this.videoRef} autoPlay playsInline muted style={{ transform: `scale(${zoom}) scaleX(-1)`, transformOrigin: 'center center', width: '100%', height: '100%', objectFit: 'cover' }} />
                                <div className="capture-guide-overlay"><div className="guide-box"></div></div>
                            </div>
                            <Button variant="danger" size="lg" className="mt-4" onClick={this.captureImage} style={{ zIndex: 60 }}><Camera className="mr-2" /> SNAP PHOTO</Button>
                        </div>
                    )}

                    {!showVideo && (
                        <div className="canvas-container" style={{ width: Math.min(displaySize.width, displaySize.height), height: Math.min(displaySize.width, displaySize.height), position: 'relative', margin: '0 auto' }}>
                            {/* Loading Overlay */}
                            {this.state.isProcessing && (
                                <div className="position-absolute w-100 h-100 d-flex flex-column justify-content-center align-items-center" style={{ zIndex: 50, background: 'rgba(0,0,0,0.7)', color: 'white', borderRadius: '12px' }}>
                                    <div className="spinner-border text-info mb-2" role="status"></div>
                                    <div>Processing Image...</div>
                                    {this.state.focusBlur && <small className="text-white-50 mt-1">Applying AI Mask</small>}
                                </div>
                            )}
                            <canvas ref={this.canvasRef} width={this.internalSize} height={this.internalSize} style={{ width: '100%', height: '100%', borderRadius: '12px', border: '3px solid #20c997', boxShadow: '0 0 30px rgba(32, 201, 151, 0.15)', background: '#000' }} />
                            {generatedPoints.length === 0 && <div className="canvas-placeholder text-center text-muted"><ImageIcon size={48} className="mb-3" /><p>Open camera or upload photo to begin.</p></div>}
                        </div>
                    )}

                    <p className="text-muted text-center mt-2 small instruction-text">
                        {showVideo ? "Ensure face/object is centered, then snap." : "Adjust Sketch Settings to refine the continuous path drawing."}
                    </p>

                    {/* Name Input */}
                    {!showVideo && (
                        <div className="w-100 d-flex justify-content-center mt-3" style={{ maxWidth: '400px', margin: '0 auto' }}>
                            <InputGroup size="sm">
                                <InputGroup.Prepend>
                                    <InputGroup.Text className="bg-dark text-white border-secondary">Name</InputGroup.Text>
                                </InputGroup.Prepend>
                                <Form.Control
                                    type="text"
                                    placeholder={`scan_${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
                                    value={this.state.drawingName}
                                    onChange={(e) => this.setState({ drawingName: e.target.value })}
                                    className="bg-dark text-white border-secondary"
                                />
                            </InputGroup>
                        </div>
                    )}

                    {/* Inline Settings Panel */}
                    <Collapse in={this.state.showSettings}>
                        <div className="scanner-inline-settings mt-3 p-3 bg-dark rounded border border-secondary text-left w-100" style={{ maxWidth: '800px', margin: '0 auto' }}>
                            <div className="d-flex justify-content-between align-items-center border-bottom border-secondary pb-2 mb-3">
                                <h6 className="text-info m-0">Settings</h6>
                            </div>

                            <div className="row">
                                <div className="col-md-6 mb-3">
                                    <Form.Group className="mb-3">
                                        <Form.Label className="d-flex justify-content-between mb-1">
                                            <span className="small text-muted">Edge Threshold</span>
                                            <span className="text-primary font-weight-bold small">{edgeThreshold}</span>
                                        </Form.Label>
                                        <Form.Control type="range" min="5" max="100" value={edgeThreshold}
                                            onChange={e => this.setState({ edgeThreshold: parseInt(e.target.value) })} className="custom-range" />
                                        <Form.Text className="text-muted small" style={{ fontSize: '10px' }}>Lower = More detail/noise.</Form.Text>
                                    </Form.Group>

                                    <Form.Group className="mb-3">
                                        <Form.Label className="d-flex justify-content-between mb-1">
                                            <span className="small text-muted">Smoothing (Blur)</span>
                                            <span className="text-primary font-weight-bold small">{blurRadius}</span>
                                        </Form.Label>
                                        <Form.Control type="range" min="0" max="5" value={blurRadius}
                                            onChange={e => this.setState({ blurRadius: parseInt(e.target.value) })} className="custom-range" />
                                    </Form.Group>
                                </div>

                                <div className="col-md-6 mb-3">
                                    <Form.Group className="mb-3">
                                        <Form.Label className="small text-muted mb-1 d-block">Resolution</Form.Label>
                                        <Form.Control as="select" size="sm" value={resolution} className="bg-secondary text-white border-secondary"
                                            onChange={e => this.setState({ resolution: parseInt(e.target.value) })}>
                                            <option value="150">Low (Fast - 150px)</option>
                                            <option value="200">Medium (200px)</option>
                                            <option value="300">High (300px)</option>
                                            <option value="400">Ultra (Slow - 400px)</option>
                                        </Form.Control>
                                    </Form.Group>

                                    {showVideo && (
                                        <>
                                            <Form.Group className="mb-3">
                                                <Form.Label className="d-flex justify-content-between mb-1">
                                                    <span className="small text-muted">Digital Zoom</span>
                                                    <span className="text-primary font-weight-bold small">{zoom.toFixed(1)}x</span>
                                                </Form.Label>
                                                <Form.Control type="range" min="1.0" max="10.0" step="0.1" value={zoom}
                                                    onChange={e => this.setState({ zoom: parseFloat(e.target.value) })} className="custom-range" />
                                            </Form.Group>

                                            <Form.Check
                                                type="switch"
                                                id="focus-blur-switch"
                                                label={<span className="small text-warning">🎯 Focus Mode</span>}
                                                checked={this.state.focusBlur}
                                                onChange={e => this.setState({ focusBlur: e.target.checked })}
                                                className="custom-switch"
                                            />
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                    </Collapse>
                </div>
            </div>
        );
    }
}
export default connect(mapStateToProps)(Scanner);
