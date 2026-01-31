import React, { useState, useEffect } from 'react';
import { Container, Table, Form, Button, InputGroup, Spinner, Alert, Accordion, Card } from 'react-bootstrap';
import { Save, ArrowClockwise } from 'react-bootstrap-icons';
import { GRBL_SETTINGS, getSettingsByCategory } from './grblSettingsDefinitions';

/**
 * GrblSettings - Component for viewing and modifying GRBL firmware parameters
 */
function GrblSettings() {
    const [settings, setSettings] = useState({}); // Map of id -> current value
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [editedValues, setEditedValues] = useState({}); // Map of id -> edited value
    const [savingId, setSavingId] = useState(null); // Track which setting is being saved

    // Fetch current settings from backend
    const fetchSettings = async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await fetch('/api/grbl/settings');
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            const data = await response.json();

            if (data.error) {
                throw new Error(data.error);
            }

            // Convert array to map: id -> value
            const settingsMap = {};
            data.settings.forEach(s => {
                settingsMap[s.id] = s.value;
            });

            setSettings(settingsMap);
            setEditedValues({}); // Clear any edits
        } catch (err) {
            setError(err.message);
            window.showToast && window.showToast(`Error loading GRBL settings: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    // Load settings on mount
    useEffect(() => {
        fetchSettings();
    }, []);

    // Handle input change
    const handleValueChange = (id, value) => {
        setEditedValues(prev => ({
            ...prev,
            [id]: value
        }));
    };

    // Save a single setting
    const handleSave = async (id) => {
        const newValue = editedValues[id] !== undefined ? editedValues[id] : settings[id];

        setSavingId(id);
        try {
            const response = await fetch('/api/grbl/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, value: newValue })
            });

            const data = await response.json();

            if (!response.ok || data.error) {
                throw new Error(data.error || 'Failed to update setting');
            }

            window.showToast && window.showToast(`$${id} updated successfully`);

            // Refresh all settings to confirm change
            await fetchSettings();

        } catch (err) {
            window.showToast && window.showToast(`Error: ${err.message}`);
        } finally {
            setSavingId(null);
        }
    };

    // Render a single setting row
    const renderSettingRow = (setting) => {
        const currentValue = settings[setting.id] || setting.defaultValue;
        const editedValue = editedValues[setting.id] !== undefined ? editedValues[setting.id] : currentValue;
        const hasEdit = editedValues[setting.id] !== undefined && editedValues[setting.id] !== currentValue;
        const isSaving = savingId === setting.id;

        return (
            <tr key={setting.id}>
                <td className="text-muted" style={{ width: '80px' }}>
                    <code>${setting.id}</code>
                </td>
                <td style={{ width: '200px' }}>
                    <strong>{setting.name}</strong>
                    <br />
                    <small className="text-muted">{setting.description}</small>
                </td>
                <td className="text-center" style={{ width: '100px' }}>
                    <code className="text-info">{currentValue}</code>
                    <br />
                    <small className="text-muted">{setting.unit}</small>
                </td>
                <td style={{ width: '250px' }}>
                    <InputGroup size="sm">
                        <Form.Control
                            type="text"
                            value={editedValue}
                            onChange={(e) => handleValueChange(setting.id, e.target.value)}
                            className="bg-dark text-white border-secondary"
                            disabled={isSaving}
                        />
                        <InputGroup.Append>
                            <Button
                                variant={hasEdit ? "success" : "outline-secondary"}
                                onClick={() => handleSave(setting.id)}
                                disabled={isSaving}
                                size="sm"
                            >
                                {isSaving ? <Spinner animation="border" size="sm" /> : <Save size={14} />}
                            </Button>
                        </InputGroup.Append>
                    </InputGroup>
                </td>
            </tr>
        );
    };

    // Render settings grouped by category
    const renderCategorySection = (category, categorySettings) => {
        return (
            <Card className="bg-dark border-secondary mb-3" key={category}>
                <Card.Header className="bg-secondary">
                    <strong>{category}</strong>
                </Card.Header>
                <Card.Body className="p-0">
                    <Table hover variant="dark" className="mb-0">
                        <thead>
                            <tr className="bg-secondary">
                                <th>ID</th>
                                <th>Parameter</th>
                                <th className="text-center">Current</th>
                                <th>New Value</th>
                            </tr>
                        </thead>
                        <tbody>
                            {categorySettings.map(renderSettingRow)}
                        </tbody>
                    </Table>
                </Card.Body>
            </Card>
        );
    };

    if (loading && Object.keys(settings).length === 0) {
        return (
            <Container className="text-center py-5">
                <Spinner animation="border" variant="primary" />
                <p className="mt-3">Loading GRBL settings...</p>
            </Container>
        );
    }

    if (error && Object.keys(settings).length === 0) {
        return (
            <Container className="py-3">
                <Alert variant="danger">
                    <Alert.Heading>Error Loading Settings</Alert.Heading>
                    <p>{error}</p>
                    <Button variant="outline-danger" onClick={fetchSettings}>
                        <ArrowClockwise className="mr-2" />
                        Retry
                    </Button>
                </Alert>
            </Container>
        );
    }

    const categorizedSettings = getSettingsByCategory();

    return (
        <Container className="py-3">
            <div className="d-flex justify-content-between align-items-center mb-3">
                <h5 className="mb-0">GRBL Firmware Parameters</h5>
                <Button variant="outline-primary" size="sm" onClick={fetchSettings} disabled={loading}>
                    <ArrowClockwise className={loading ? "spin" : ""} size={16} />
                    <span className="ml-2">Refresh</span>
                </Button>
            </div>

            <Alert variant="info" className="mb-3">
                <small>
                    <strong>Note:</strong> Changes are sent immediately to the firmware when you click Save.
                    Settings are stored in EEPROM and persist across reboots.
                    Exercise caution when modifying motion and axis settings.
                </small>
            </Alert>

            {Object.keys(categorizedSettings).map(category =>
                renderCategorySection(category, categorizedSettings[category])
            )}
        </Container>
    );
}

export default GrblSettings;
