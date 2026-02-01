import React, { useMemo, useState, useEffect } from 'react';
import { connect } from 'react-redux';
import { generateLayerPoints } from '../utils/geometry';
import { getTableConfig, getCanvasDisplaySize, getCornerCoordinates, formatCoordinate } from '../../../../utils/tableConfig';

const COLORS = ['#0dcaf0', '#20c997', '#ffc107', '#fd7e14', '#dc3545', '#6f42c1', '#d63384'];

const mapStateToProps = (state) => ({
    layers: state.patternBuilder?.layers || [],
    settings: state.settings
});

function PatternPreview({ layers, settings }) {
    const [maxDisplaySize, setMaxDisplaySize] = useState(600);

    // Calculate size based on available viewport
    useEffect(() => {
        const updateSize = () => {
            const viewportWidth = window.innerWidth;
            const viewportHeight = window.innerHeight;
            const isMobile = viewportWidth < 992;
            const availableWidth = isMobile ? viewportWidth - 40 : viewportWidth - 320 - 80;
            const availableHeight = viewportHeight - 150;
            const size = Math.min(availableWidth, availableHeight, 900);
            setMaxDisplaySize(Math.max(300, size));
        };

        updateSize();
        window.addEventListener('resize', updateSize);
        return () => window.removeEventListener('resize', updateSize);
    }, []);

    // Get table config and proper display size
    const config = getTableConfig(settings);
    const displaySize = getCanvasDisplaySize(config, {
        maxWidth: maxDisplaySize,
        maxHeight: maxDisplaySize
    });
    const corners = getCornerCoordinates(config);

    // Generate points for all visible layers
    const layerPaths = useMemo(() => {
        return layers
            .filter(layer => layer.visible !== false)
            .map((layer, index) => {
                const points = generateLayerPoints(layer);
                if (points.length === 0) return null;

                // Build path data, handling stroke breaks
                let pathData = '';
                let needsMove = true;

                for (const point of points) {
                    if (isNaN(point.x) || isNaN(point.y) || point.isBreak) {
                        needsMove = true;
                    } else {
                        const cmd = needsMove ? 'M' : 'L';
                        pathData += ` ${cmd} ${point.x.toFixed(4)} ${(-point.y).toFixed(4)}`;
                        needsMove = false;
                    }
                }

                return {
                    id: layer.id,
                    name: layer.name,
                    pathData,
                    color: COLORS[index % COLORS.length]
                };
            })
            .filter(Boolean);
    }, [layers]);

    return (
        <div className="pattern-preview-container">
            {/* Corner coordinates */}
            <div className="corner-label top-left">{formatCoordinate(corners.topLeft)}</div>
            <div className="corner-label top-right">{formatCoordinate(corners.topRight)}</div>
            <div className="corner-label bottom-left">{formatCoordinate(corners.bottomLeft)}</div>
            <div className="corner-label bottom-right">{formatCoordinate(corners.bottomRight)}</div>

            <svg
                viewBox="-1 -1 2 2"
                preserveAspectRatio="none"
                style={{
                    width: displaySize.width,
                    height: displaySize.height,
                    backgroundColor: '#0d0d0d',
                    borderRadius: '12px',
                    border: '3px solid #20c997',
                    boxShadow: '0 0 40px rgba(32, 201, 151, 0.2), 0 10px 40px rgba(0, 0, 0, 0.5)'
                }}
            >
                {/* Grid */}
                {[...Array(5)].map((_, i) => {
                    const pos = -1 + (i * 0.5);
                    return (
                        <g key={i}>
                            <line x1={pos} y1="-1" x2={pos} y2="1" stroke="#222" strokeWidth="0.005" />
                            <line x1="-1" y1={pos} x2="1" y2={pos} stroke="#222" strokeWidth="0.005" />
                        </g>
                    );
                })}

                {/* Origin crosshair */}

                {/* Origin crosshair */}
                <line x1="-0.15" y1="0" x2="0.15" y2="0" stroke="#444" strokeWidth="0.008" />
                <line x1="0" y1="-0.15" x2="0" y2="0.15" stroke="#444" strokeWidth="0.008" />

                {/* Pattern paths */}
                {layerPaths.map((layer) => (
                    <path
                        key={layer.id}
                        d={layer.pathData}
                        fill="none"
                        stroke={layer.color}
                        strokeWidth="0.008"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                ))}

                {/* No layers message */}
                {layerPaths.length === 0 && (
                    <text
                        x="0"
                        y="0"
                        textAnchor="middle"
                        fill="#555"
                        fontSize="0.12"
                    >
                        Add a layer to see preview
                    </text>
                )}
            </svg>
        </div>
    );
}

export default connect(mapStateToProps)(PatternPreview);
