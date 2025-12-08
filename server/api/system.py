from flask import jsonify
from server import app
import subprocess

@app.route('/api/system/bluetooth/restart', methods=['POST'])
def restart_bluetooth():
    try:
        # Run sudo systemctl restart bluetooth
        # Note: The user running the server must have sudo privileges without password for this command
        subprocess.run(["sudo", "systemctl", "restart", "bluetooth"], check=True)
        app.logger.info("Bluetooth service restarted")
        return jsonify({"status": "ok"})
    except Exception as e:
        app.logger.error(f"Error restarting Bluetooth: {e}")
        return jsonify({"error": str(e)}), 500
