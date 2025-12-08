from flask import Blueprint, jsonify, request, current_app
from server.utils import settings_utils
from server.utils import gcode_generator
from server.database.playlist_elements import DrawingElement

calibration = Blueprint('calibration', __name__)

class CalibrationElement:
    def __init__(self, gcode_lines):
        self.gcode_lines = gcode_lines
        self.total_lines = len(gcode_lines)
        self.drawing_id = "calibration" # Dummy ID

    def execute(self, logger):
        for line in self.gcode_lines:
            yield line
            
    def get_progress(self, feedrate):
        return 0 # TODO implement progress if needed

@calibration.route('/api/calibration/draw_boundaries', methods=['POST'])
def draw_boundaries():
    try:
        # Try to get settings from request body first (for unsaved changes)
        settings = request.get_json()
        if not settings:
            settings = settings_utils.load_settings()
        
        # Get dimensions
        phys_w = float(settings['device']['physical_width']['value'])
        phys_h = float(settings['device']['physical_height']['value'])
        draw_w = float(settings['device']['width']['value'])
        draw_h = float(settings['device']['height']['value'])
        off_x = float(settings['device']['offset_x']['value'])
        off_y = float(settings['device']['offset_y']['value'])
        
        orientation_origin = settings['device'].get('orientation_origin', {}).get('value', 'Bottom-Left')
        orientation_swap = settings['device'].get('orientation_swap', {}).get('value', False)

        gcode = []
        gcode.append("; TYPE: PRE-TRANSFORMED") # Tell feeder to skip transforms
        gcode.append("G28") # Home first
        
        # 1. Drawing Perimeter (Green in visualizer)
        gcode.extend(gcode_generator.generate_rect(off_x, off_y, draw_w, draw_h))
        
        # 2. Markers relative to Drawing Origin
        # We need to calculate where the Drawing Origin (0,0) is in Machine Coordinates
        # And the direction of axes
        origin_x = off_x
        origin_y = off_y
        axis_x_dir_x = 1
        axis_x_dir_y = 0
        axis_y_dir_x = 0
        axis_y_dir_y = 1
        
        if orientation_origin == "Top-Left":
            origin_y = off_y + draw_h
            axis_y_dir_y = -1
        elif orientation_origin == "Top-Right":
            origin_x = off_x + draw_w
            origin_y = off_y + draw_h
            axis_x_dir_x = -1
            axis_y_dir_y = -1
        elif orientation_origin == "Bottom-Right":
            origin_x = off_x + draw_w
            axis_x_dir_x = -1
            
        if orientation_swap:
            # Swap axes logic
            # Drawing X is Machine Y
            # Drawing Y is Machine X
            # We need to swap the direction vectors
            temp_xx = axis_x_dir_x; temp_xy = axis_x_dir_y
            axis_x_dir_x = axis_y_dir_x; axis_x_dir_y = axis_y_dir_y
            axis_y_dir_x = temp_xx; axis_y_dir_y = temp_xy

        # Draw a Diamond at Drawing Origin
        gcode.append(f"G0 X{gcode_generator.fmt(origin_x-2)} Y{gcode_generator.fmt(origin_y)}")
        gcode.append(f"G1 X{gcode_generator.fmt(origin_x)} Y{gcode_generator.fmt(origin_y+2)}")
        gcode.append(f"G1 X{gcode_generator.fmt(origin_x+2)} Y{gcode_generator.fmt(origin_y)}")
        gcode.append(f"G1 X{gcode_generator.fmt(origin_x)} Y{gcode_generator.fmt(origin_y-2)}")
        gcode.append(f"G1 X{gcode_generator.fmt(origin_x-2)} Y{gcode_generator.fmt(origin_y)}")
        
        # Draw "0" near Origin
        # Offset slightly by 5 units in the direction of both axes (or diagonal)
        # But simple offset is fine.
        gcode.extend(gcode_generator.generate_text("0", origin_x + 5*axis_x_dir_x + 5*axis_y_dir_x, origin_y + 5*axis_x_dir_y + 5*axis_y_dir_y, size=5))

        # Draw X Axis Arrow
        arrow_len = 30
        x_end_x = origin_x + arrow_len * axis_x_dir_x
        x_end_y = origin_y + arrow_len * axis_x_dir_y
        gcode.extend(gcode_generator.generate_arrow(origin_x, origin_y, x_end_x, x_end_y))
        gcode.extend(gcode_generator.generate_text("X", x_end_x + 5*axis_x_dir_x, x_end_y + 5*axis_x_dir_y, size=5))

        # Draw Y Axis Arrow
        y_end_x = origin_x + arrow_len * axis_y_dir_x
        y_end_y = origin_y + arrow_len * axis_y_dir_y
        gcode.extend(gcode_generator.generate_arrow(origin_x, origin_y, y_end_x, y_end_y))
        gcode.extend(gcode_generator.generate_text("Y", y_end_x + 5*axis_y_dir_x, y_end_y + 5*axis_y_dir_y, size=5))
        
        # Use start_element to run in background thread
        element = CalibrationElement(gcode)
        current_app.feeder.start_element(element)
        
        return jsonify({"status": "ok", "message": "Calibration pattern sent to table"})
        
    except Exception as e:
        current_app.logger.exception(e)
        return jsonify({"error": str(e)}), 500
