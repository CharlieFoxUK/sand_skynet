from flask import request, jsonify
from server import app
import time
import re

# ENDPOINT: GET /api/grbl/settings - Fetch all GRBL settings
@app.route('/api/grbl/settings', methods=['GET'])
def get_grbl_settings():
    """
    Fetches all GRBL settings by sending $$ command
    Returns JSON with list of settings: [{id: 0, value: "10"}, ...]
    """
    try:
        if not app.feeder.is_connected():
            return jsonify({"error": "Hardware not connected"}), 503


        
        # Prevent sending $$ while running to avoid Error 8: Grbl '$' command cannot be used unless Grbl is IDLE
        if app.feeder.is_running():
            return jsonify({"error": "Machine is running - cannot fetch settings"}), 503
        
        # Storage for responses
        responses = []
        
        # Define callback to capture responses
        def capture_response(line):
            responses.append(line)
        
        # Temporarily override the hw_command_line_message to capture output
        original_emit = app.semits.hw_command_line_message
        app.semits.hw_command_line_message = capture_response
        
        try:
            # Send $$ command to get all settings
            app.feeder.send_gcode_command("$$")
            
            # Wait for responses (GRBL typically responds quickly)
            time.sleep(0.5)
            
        finally:
            # Restore original emit
            app.semits.hw_command_line_message = original_emit
        
        # Parse responses
        # GRBL returns lines like: $0=10
        settings = []
        for line in responses:
            match = re.match(r'\$(\d+)=([\d.]+)', line.strip())
            if match:
                setting_id = int(match.group(1))
                value = match.group(2)
                settings.append({
                    "id": setting_id,
                    "value": value
                })
        
        app.logger.info(f"Fetched {len(settings)} GRBL settings")
        return jsonify({"settings": settings})
        
    except Exception as e:
        app.logger.error(f"Error fetching GRBL settings: {e}")
        return jsonify({"error": str(e)}), 500


# ENDPOINT: POST /api/grbl/settings - Update a GRBL setting
@app.route('/api/grbl/settings', methods=['POST'])
def set_grbl_setting():
    """
    Updates a GRBL setting by sending $x=val command
    Expects JSON: {id: 0, value: "10"}
    """
    try:
        if not app.feeder.is_connected():
            return jsonify({"error": "Hardware not connected"}), 503

        # Prevent sending $x=val while running
        if app.feeder.is_running():
            return jsonify({"error": "Machine is running - cannot update settings"}), 503
        
        data = request.get_json()
        setting_id = data.get('id')
        value = data.get('value')
        
        if setting_id is None or value is None:
            return jsonify({"error": "Missing id or value"}), 400
        
        # Validate setting_id is a number
        try:
            setting_id = int(setting_id)
        except ValueError:
            return jsonify({"error": "Invalid setting ID"}), 400
        
        # Send command: $x=val
        command = f"${setting_id}={value}"
        app.logger.info(f"Setting GRBL parameter: {command}")
        
        # Storage for responses
        responses = []
        
        # Define callback to capture responses
        def capture_response(line):
            responses.append(line)
        
        # Temporarily override the hw_command_line_message to capture output
        original_emit = app.semits.hw_command_line_message
        app.semits.hw_command_line_message = capture_response
        
        try:
            app.feeder.send_gcode_command(command)
            
            # Wait for response
            time.sleep(0.3)
            
        finally:
            # Restore original emit
            app.semits.hw_command_line_message = original_emit
        
        # Check for "ok" or "error" in responses
        success = any("ok" in r.lower() for r in responses)
        error = any("error" in r.lower() for r in responses)
        
        if error:
            error_msg = next((r for r in responses if "error" in r.lower()), "Unknown error")
            app.logger.error(f"GRBL setting error: {error_msg}")
            return jsonify({"error": error_msg}), 400
        
        if success:
            app.logger.info(f"GRBL setting ${setting_id} updated to {value}")
            return jsonify({"success": True, "id": setting_id, "value": value})
        
        # If no clear success/error, assume timeout or unknown state
        return jsonify({"error": "No response from hardware"}), 504
        
    except Exception as e:
        app.logger.error(f"Error setting GRBL parameter: {e}")
        return jsonify({"error": str(e)}), 500
