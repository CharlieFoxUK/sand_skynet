from flask import jsonify
from server import app
from server.hw_controller.leds.ble_scanner import scan_sync

@app.route('/api/leds/scan')
def scan_leds():
    try:
        devices = scan_sync()
        return jsonify(devices)
    except Exception as e:
        app.logger.error(f"Error scanning BLE devices: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/leds/status')
def leds_status():
    try:
        status = app.lmanager.get_status()
        return jsonify(status)
    except Exception as e:
        app.logger.error(f"Error getting LEDs status: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/leds/reconnect', methods=['POST'])
def leds_reconnect():
    try:
        app.lmanager.reconnect()
        return jsonify({"status": "ok"})
    except Exception as e:
        app.logger.error(f"Error reconnecting LEDs: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/leds/disconnect', methods=['POST'])
def leds_disconnect():
    try:
        app.lmanager.stop()
        return jsonify({"status": "ok"})
    except Exception as e:
        app.logger.error(f"Error disconnecting LEDs: {e}")
        return jsonify({"error": str(e)}), 500

from flask import request
@app.route('/api/leds/command', methods=['POST'])
def leds_command():
    try:
        data = request.get_json()
        cmd = data.get("command")
        if not cmd:
            return jsonify({"error": "Missing command"}), 400
        
        success = app.lmanager.send_command(cmd)
        if success:
            return jsonify({"status": "ok"})
        else:
            return jsonify({"error": "Failed to send command (driver not available or not supported)"}), 500
    except Exception as e:
        app.logger.error(f"Error sending LED command: {e}")
        return jsonify({"error": str(e)}), 500
