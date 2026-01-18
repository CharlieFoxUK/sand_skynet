import React, { useRef, useState, useCallback, useEffect } from 'react';
import './EtchASketch.scss';

/**
 * RotaryDial - A touch-enabled circular dial component
 * Rotates by dragging/touching and outputs continuous values
 * Supports multi-touch - each dial tracks its own touch independently
 */
function RotaryDial({
    label = 'X',
    onChange,
    size = 150,
    sensitivity = 0.5,
    color = '#20c997'
}) {
    const dialRef = useRef(null);
    const [rotation, setRotation] = useState(0);
    const [isDragging, setIsDragging] = useState(false);
    const lastAngleRef = useRef(0);
    // Track the specific touch ID this dial is responding to
    const activeTouchIdRef = useRef(null);

    // Calculate angle from center of dial to point
    const getAngleFromCenter = useCallback((clientX, clientY) => {
        if (!dialRef.current) return 0;
        const rect = dialRef.current.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        const deltaX = clientX - centerX;
        const deltaY = clientY - centerY;
        return Math.atan2(deltaY, deltaX) * (180 / Math.PI);
    }, []);

    // Handle rotation change
    const handleRotation = useCallback((currentAngle) => {
        let delta = currentAngle - lastAngleRef.current;

        // Handle wrap-around (crossing 180/-180 boundary)
        if (delta > 180) delta -= 360;
        if (delta < -180) delta += 360;

        setRotation(prev => prev + delta * sensitivity);
        lastAngleRef.current = currentAngle;

        // Convert rotation to position change
        const positionDelta = delta * sensitivity * 0.1; // Scale for reasonable movement
        if (onChange && Math.abs(positionDelta) > 0.001) {
            onChange(positionDelta);
        }
    }, [sensitivity, onChange]);

    // Mouse start
    const onMouseDown = useCallback((e) => {
        e.preventDefault();
        setIsDragging(true);
        lastAngleRef.current = getAngleFromCenter(e.clientX, e.clientY);
    }, [getAngleFromCenter]);

    // Touch start - capture the specific touch for this dial
    const onTouchStart = useCallback((e) => {
        // Don't preventDefault - let the event continue for other elements
        // Find a touch that started on this element
        for (let i = 0; i < e.changedTouches.length; i++) {
            const touch = e.changedTouches[i];
            // Check if this touch is within our dial
            if (dialRef.current) {
                const rect = dialRef.current.getBoundingClientRect();
                if (touch.clientX >= rect.left && touch.clientX <= rect.right &&
                    touch.clientY >= rect.top && touch.clientY <= rect.bottom) {
                    // Claim this touch
                    activeTouchIdRef.current = touch.identifier;
                    setIsDragging(true);
                    lastAngleRef.current = getAngleFromCenter(touch.clientX, touch.clientY);
                    e.preventDefault(); // Prevent scrolling only when we claim this touch
                    return;
                }
            }
        }
    }, [getAngleFromCenter]);

    // Touch move - only respond to our tracked touch
    const onTouchMove = useCallback((e) => {
        if (activeTouchIdRef.current === null) return;

        // Find our specific touch
        for (let i = 0; i < e.touches.length; i++) {
            const touch = e.touches[i];
            if (touch.identifier === activeTouchIdRef.current) {
                const currentAngle = getAngleFromCenter(touch.clientX, touch.clientY);
                handleRotation(currentAngle);
                e.preventDefault(); // Prevent scrolling while rotating
                return;
            }
        }
    }, [getAngleFromCenter, handleRotation]);

    // Touch end - release if our touch ended
    const onTouchEnd = useCallback((e) => {
        if (activeTouchIdRef.current === null) return;

        // Check if our touch ended
        for (let i = 0; i < e.changedTouches.length; i++) {
            if (e.changedTouches[i].identifier === activeTouchIdRef.current) {
                activeTouchIdRef.current = null;
                setIsDragging(false);
                return;
            }
        }
    }, []);

    // Mouse move/end handlers
    const onMouseMove = useCallback((e) => {
        if (!isDragging || activeTouchIdRef.current !== null) return; // Ignore if touch is active
        const currentAngle = getAngleFromCenter(e.clientX, e.clientY);
        handleRotation(currentAngle);
    }, [isDragging, getAngleFromCenter, handleRotation]);

    const onMouseUp = useCallback(() => {
        if (activeTouchIdRef.current !== null) return; // Ignore if touch is active
        setIsDragging(false);
    }, []);

    // Add global listeners for mouse (touch is handled locally)
    useEffect(() => {
        if (isDragging && activeTouchIdRef.current === null) {
            // Only add mouse listeners when dragging with mouse (not touch)
            window.addEventListener('mousemove', onMouseMove);
            window.addEventListener('mouseup', onMouseUp);
        }

        return () => {
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
        };
    }, [isDragging, onMouseMove, onMouseUp]);

    // Add touch listeners directly to the element
    useEffect(() => {
        const element = dialRef.current;
        if (!element) return;

        // Use passive: false to allow preventDefault
        element.addEventListener('touchmove', onTouchMove, { passive: false });
        element.addEventListener('touchend', onTouchEnd, { passive: false });
        element.addEventListener('touchcancel', onTouchEnd, { passive: false });

        return () => {
            element.removeEventListener('touchmove', onTouchMove);
            element.removeEventListener('touchend', onTouchEnd);
            element.removeEventListener('touchcancel', onTouchEnd);
        };
    }, [onTouchMove, onTouchEnd]);

    // Generate tick marks
    const ticks = [];
    for (let i = 0; i < 12; i++) {
        const angle = (i * 30) * (Math.PI / 180);
        const isMajor = i % 3 === 0;
        const innerRadius = isMajor ? 0.7 : 0.8;
        const outerRadius = 0.9;
        ticks.push({
            x1: Math.cos(angle) * innerRadius * (size / 2),
            y1: Math.sin(angle) * innerRadius * (size / 2),
            x2: Math.cos(angle) * outerRadius * (size / 2),
            y2: Math.sin(angle) * outerRadius * (size / 2),
            isMajor
        });
    }

    return (
        <div
            className={`rotary-dial ${isDragging ? 'active' : ''}`}
            ref={dialRef}
            onMouseDown={onMouseDown}
            onTouchStart={onTouchStart}
            style={{
                width: size,
                height: size,
                '--dial-color': color,
                touchAction: 'none' // Important: disable browser touch handling
            }}
        >
            <svg
                viewBox={`${-size / 2} ${-size / 2} ${size} ${size}`}
                style={{ width: '100%', height: '100%' }}
            >
                {/* Outer ring */}
                <circle
                    cx={0}
                    cy={0}
                    r={size / 2 - 5}
                    fill="none"
                    stroke={color}
                    strokeWidth="3"
                    opacity="0.3"
                />

                {/* Inner circle (grip area) */}
                <circle
                    cx={0}
                    cy={0}
                    r={size / 2 - 15}
                    fill="#1a1a1a"
                    stroke={color}
                    strokeWidth="2"
                />

                {/* Tick marks */}
                {ticks.map((tick, i) => (
                    <line
                        key={i}
                        x1={tick.x1}
                        y1={tick.y1}
                        x2={tick.x2}
                        y2={tick.y2}
                        stroke={color}
                        strokeWidth={tick.isMajor ? 3 : 1}
                        opacity={tick.isMajor ? 1 : 0.5}
                    />
                ))}

                {/* Rotation indicator (knob pointer) */}
                <g transform={`rotate(${rotation})`}>
                    <line
                        x1={0}
                        y1={0}
                        x2={0}
                        y2={-(size / 2 - 25)}
                        stroke={color}
                        strokeWidth="4"
                        strokeLinecap="round"
                    />
                    <circle
                        cx={0}
                        cy={-(size / 2 - 35)}
                        r={8}
                        fill={color}
                    />
                </g>

                {/* Center hub */}
                <circle
                    cx={0}
                    cy={0}
                    r={15}
                    fill="#333"
                    stroke={color}
                    strokeWidth="2"
                />
            </svg>

            {/* Label */}
            <div className="dial-label" style={{ color }}>
                {label}
            </div>
        </div>
    );
}

export default RotaryDial;
