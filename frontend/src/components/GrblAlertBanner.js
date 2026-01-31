import React, { useState, useEffect } from 'react';
import { Alert } from 'react-bootstrap';
import { XCircle, ExclamationTriangle } from 'react-bootstrap-icons';
import { socket } from '../sockets/sCallbacks';
import './GrblAlertBanner.css';

/**
 * GrblAlertBanner - Displays GRBL alarm and error notifications in header
 * 
 * Listens to socket events for GRBL alarms and errors and displays them
 * as dismissible banners. Alarms shown in red, errors in yellow/orange.
 */
function GrblAlertBanner() {
    const [alarm, setAlarm] = useState(null);
    const [error, setError] = useState(null);

    useEffect(() => {
        // Listen for GRBL alarm events
        const handleAlarm = (data) => {
            console.log('GRBL Alarm received:', data);
            setAlarm(data);
            // Clear any existing error when alarm occurs (alarm takes priority)
            setError(null);
        };

        // Listen for GRBL error events
        const handleError = (data) => {
            console.log('GRBL Error received:', data);
            // Only show error if no alarm is active (alarms are more critical)
            if (!alarm) {
                setError(data);
            }
        };

        socket.on('grbl_alarm', handleAlarm);
        socket.on('grbl_error', handleError);

        return () => {
            socket.off('grbl_alarm', handleAlarm);
            socket.off('grbl_error', handleError);
        };
    }, [alarm]);

    const handleDismissAlarm = () => {
        setAlarm(null);
    };

    const handleDismissError = () => {
        setError(null);
    };

    // Don't render anything if no alarms or errors
    if (!alarm && !error) {
        return null;
    }

    return (
        <div className="grbl-alert-banner-container">
            {alarm && (
                <Alert
                    variant="danger"
                    dismissible
                    onClose={handleDismissAlarm}
                    className="grbl-alert-banner grbl-alarm mb-0"
                >
                    <div className="d-flex align-items-center">
                        <XCircle size={20} className="mr-2 flex-shrink-0" />
                        <div className="flex-grow-1">
                            <strong>ALARM {alarm.code}:</strong> {alarm.description}
                        </div>
                    </div>
                </Alert>
            )}
            {error && !alarm && (
                <Alert
                    variant="warning"
                    dismissible
                    onClose={handleDismissError}
                    className="grbl-alert-banner grbl-error mb-0"
                >
                    <div className="d-flex align-items-center">
                        <ExclamationTriangle size={20} className="mr-2 flex-shrink-0" />
                        <div className="flex-grow-1">
                            <strong>ERROR {error.code}:</strong> {error.description}
                        </div>
                    </div>
                </Alert>
            )}
        </div>
    );
}

export default GrblAlertBanner;
