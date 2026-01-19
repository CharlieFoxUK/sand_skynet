from flask import request, jsonify, send_from_directory
from server import app
from server.preprocessing.drawing_creator import preprocess_drawing
from server.sockets_interface.socketio_callbacks import drawings_refresh
from server.database.models import UploadedFiles
import os

ALLOWED_EXTENSIONS = ["gcode", "nc", "thr"]

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

# Upload route for the dropzone to load new drawings
@app.route('/api/upload/', methods=['GET','POST'])
def api_upload():
    if request.method == "POST":
        if 'file' in request.files:
            file = request.files['file']
            if file and file.filename!= '' and allowed_file(file.filename):
                # create entry in the database and preview image
                id = preprocess_drawing(file.filename, file)

                # refreshing list of drawings for all the clients
                drawings_refresh()
                return jsonify(id)
@app.route('/api/rename/<int:id>', methods=['POST'])
def api_rename(id):
    try:
        data = request.get_json()
        new_name = data.get('name')
        if not new_name:
            return jsonify({"error": "No name provided"}), 400
            
        drawing = UploadedFiles.query.get(id)
        if not drawing:
            return jsonify({"error": "Drawing not found"}), 404

        # Sanitize new name
        new_name = "".join(x for x in new_name if x.isalnum() or x in "._- ")
        if not new_name.lower().endswith(".gcode"):
            new_name += ".gcode"

        # Rename file on disk
        folder = os.path.join(app.root_path, 'static', 'Drawings', str(id))
        
        # Note: The file on disk is usually named "id.gcode" (see download_drawing), 
        # but the database stores the 'display' filename.
        # Let's check how preprocess_drawing does it.
        # It seems the file on disk is saved as str(id) + extension?
        # download_drawing uses: filename = str(id) + ".gcode"
        # So the disk filename relies on ID, we don't need to rename the disk file!
        # We only need to update the DB filename.
        
        drawing.filename = new_name
        from server.database.models import db
        db.session.commit()
        
        drawings_refresh()
        return jsonify({"success": True, "name": new_name})
        
    except Exception as e:
        app.logger.error(f"Error renaming drawing: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/download/<int:id>')
def download_drawing(id):
    # Construct absolute path using app.root_path
    # app.root_path points to the 'server' directory
    folder = os.path.join(app.root_path, 'static', 'Drawings', str(id))
    filename = str(id) + ".gcode"
    
    app.logger.info(f"Download requested for ID: {id}")
    app.logger.info(f"Serving file from: {folder}/{filename}")
    
    if not os.path.exists(os.path.join(folder, filename)):
        app.logger.error(f"File not found: {os.path.join(folder, filename)}")
        return jsonify({"error": "File not found"}), 404
    
    # Get original filename from DB
    download_name = filename # Default fallback
    try:
        drawing = UploadedFiles.query.get(id)
        if drawing and drawing.filename:
            download_name = drawing.filename
            # Ensure extension
            if not download_name.lower().endswith(".gcode"):
                download_name += ".gcode"
    except Exception as e:
        app.logger.error(f"Error fetching filename from DB: {e}")

    return send_from_directory(folder, filename, as_attachment=True, download_name=download_name)