from PIL import Image, ImageDraw
from math import cos, sin, pi, sqrt
from dotmap import DotMap
from server.hw_controller.gcode_rescalers import Fit

class ImageFactory:
    # straight lines gcode commands
    straight_lines = ["G01", "G1", "G0", "G00"]

    # Args:
    #  - device: dict with the following values
    #     * type: device type (values: "Cartesian", "Polar", "Scara")
    #     * radius: for polar and scara needs the maximum radius of the device
    #     * offset_angle_1: for polar and scara needs an offset angle to rotate the view of the drawing (homing position angle) in motor units
    #     * offset_angle_2: for scara only: homing angle of the second part of the arm with respect to the first arm (alpha offset) in motor units
    #     * angle_conversion_factor (scara and polar): conversion value between motor units and radians (default for polar is pi, for scara is 6)
    #  - final_width (default: 800): final image width in px
    #  - final_height (default: 800): final image height in px
    #  - bg_color (default: (0,0,0)): tuple of the rgb color for the background
    #  - final_border_px (default: 20): the border to leave around the picture in px
    #  - line_width (default: 5): line thickness (px)
    #  - verbose (boolean) (default: False): if True prints the coordinates and other stuff in the command line
    def __init__(self, device, final_width=800, final_height=800, bg_color=(0,0,0), line_color=(255,255,255), final_border_px=20, line_width=1, verbose=False):
        self.final_width = final_width
        self.final_height = final_height
        self.bg_color = bg_color if len(bg_color) == 4 else (*bg_color, 0)  # color argument requires also alpha value
        self.line_color = line_color
        self.final_border_px = final_border_px
        self.line_width = line_width
        self.verbose = verbose
        self.update_device(device)

    def update_device(self, device):
        device["type"] = device["type"].upper()
        self.device = device
        
        # Store dimensions for scaling
        self.width = float(device.get("width", 500))
        self.height = float(device.get("height", 500))
        self.offset_x = float(device.get("offset_x", 0))
        self.offset_y = float(device.get("offset_y", 0))
        self.orientation_origin = device.get("orientation_origin", "Bottom-Left")
        self.orientation_swap = device.get("orientation_swap", False)

        if self.is_scara():
            # scara robot conversion factor
            # should be 2*pi/6 *1/2 (conversion between radians and motor units * 1/2 coming out of the theta alpha semplification)
            self.pi_conversion = pi/float(device["angle_conversion_factor"])    # for scara robots follow https://forum.v1engineering.com/t/sandtrails-a-polar-sand-table/16844/61
            self.device_radius = float(device["radius"])
            self.offset_1 = float(device["offset_angle_1"]) * 2                   # *2 for the conversion factor (will spare one operation in the loop)
            self.offset_2 = float(device["offset_angle_2"]) * 2                 # *2 for the conversion factor (will spare one operation in the loop)
        elif self.is_polar():
            self.pi_conversion = 2.0*pi/float(device["angle_conversion_factor"])
            self.device_radius = float(device["radius"])
            self.offset_1 = float(device["offset_angle_1"])

    def is_cartesian(self):
        return self.device["type"] == "CARTESIAN"

    def is_polar(self):
        return self.device["type"] == "POLAR"
    
    def is_scara(self):
        return self.device["type"] == "SCARA"

    # converts a gcode file to an image
    # requires: gcode file (not filepath)
    # return the image file
    def gcode_to_coords(self, file):
        # First pass: read raw coordinates to find bounds
        raw_coords = []
        xmin =  100000
        xmax = -100000
        ymin =  100000
        ymax = -100000
        old_X = 0
        old_Y = 0
        
        # Read file content once
        lines = file.readlines()
        
        for line in lines:
            # skipping comments
            if line.startswith(";"):  
                continue
            
            # remove inline comments
            if ";" in line:
                line = line.split(";")[0]

            if len(line) <3:
                continue

            # parsing line
            params = line.split(" ")
            if not (params[0] in self.straight_lines):       # TODO include also G2 and other curves command?
                continue

            com_X = old_X               # command X value
            com_Y = old_Y               # command Y value
            # selecting values
            for p in params:
                if len(p) > 1:
                    if p[0].upper()=="X":
                        try:
                            com_X = float(p[1:])
                        except: pass
                    if p[0].upper()=="Y":
                        try:
                            com_Y = float(p[1:])
                        except: pass
            
            # Store raw coord
            raw_coords.append((com_X, com_Y))
            
            if com_X < xmin: xmin = com_X
            if com_X > xmax: xmax = com_X
            if com_Y < ymin: ymin = com_Y
            if com_Y > ymax: ymax = com_Y
            
            old_X = com_X
            old_Y = com_Y

        # Setup Fit filter
        
        # Heuristic: If dimensions are large (> 2), assume Absolute MM -> 1:1 Scale
        # If dimensions are small (<= 2), assume Normalized -> Stretch to Fill
        if (xmax - xmin > 2) or (ymax - ymin > 2) or (xmax > 2) or (ymax > 2):
            # Absolute MM: Set input bounds to Table Size (0 to width)
            d_min_x, d_max_x = 0, self.width
            d_min_y, d_max_y = 0, self.height
        else:
            # Normalized: Set input bounds to actual bounds (Stretch to fill)
            d_min_x, d_max_x = xmin if xmin != 100000 else 0, xmax if xmax != -100000 else 1
            d_min_y, d_max_y = ymin if ymin != 100000 else 0, ymax if ymax != -100000 else 1

        dims = {
            "table_x": self.width,
            "table_y": self.height,
            "drawing_max_x": d_max_x,
            "drawing_max_y": d_max_y,
            "drawing_min_x": d_min_x,
            "drawing_min_y": d_min_y,
            "offset_x": self.offset_x,
            "offset_y": self.offset_y,
            "orientation_origin": self.orientation_origin,
            "orientation_swap": self.orientation_swap
        }
        
        fit = Fit(dims)
        
        # Second pass: transform coordinates
        transformed_coords = []
        total_lenght = 0
        last_pt = None
        
        # If no coords found, return empty
        if not raw_coords:
             return {"total_lenght": 0, "xmin": 0, "xmax": self.width, "ymin": 0, "ymax": self.height}, []

        # Transform first point
        start_x, start_y = fit.transform_point(raw_coords[0][0], raw_coords[0][1])
        transformed_coords.append((start_x, start_y))
        last_pt = (start_x, start_y)
        
        for i in range(1, len(raw_coords)):
            rx, ry = raw_coords[i]
            tx, ty = fit.transform_point(rx, ry)
            
            # Calculate length
            dist = sqrt((tx - last_pt[0])**2 + (ty - last_pt[1])**2)
            total_lenght += dist
            
            transformed_coords.append((tx, ty))
            last_pt = (tx, ty)

        if self.verbose:
            print("Transformed Coordinates generated")

        # Return fixed bounds to represent the full table
        drawing_infos = {
            "total_lenght": total_lenght,
            "xmin": 0,
            "xmax": self.width + (self.offset_x * 2 if self.offset_x < 0 else 0), # Simple bounds 0 to width? 
                                                                                  # Actually, Fit scales to table_x and adds offset_x.
                                                                                  # So the points will be in range [offset_x, width + offset_x].
                                                                                  # If we want the thumbnail to show the "Safe Area" relative to the physical table?
                                                                                  # Or just the Safe Area?
                                                                                  # User said: "thumbnail canvas to be the size of the dawing area"
                                                                                  # "representative scale and location within that canvas"
                                                                                  # If "canvas" = "Safe Drawing Area", then bounds should be 0 to width.
                                                                                  # But Fit adds offset!
                                                                                  # If offset is used to shift the drawing area on the PHYSICAL table, 
                                                                                  # then the thumbnail should probably show the PHYSICAL table if we want to show "location".
                                                                                  # BUT, usually the UI shows the "Drawing Area".
                                                                                  # If I set bounds to [0, width], and points are at [offset_x, ...], they might be out of bounds if offset > 0?
                                                                                  # Wait, offset is usually to align the 0,0 of drawing to 0,0 of table?
                                                                                  # No, offset shifts the drawing.
                                                                                  # If I have a 500x500 table, and I set offset 50,50.
                                                                                  # The drawing (0-1) becomes 50-550.
                                                                                  # If I want to see this in the thumbnail, the thumbnail should probably cover 0-600?
                                                                                  # Or should the thumbnail represent the "Physical Table"?
                                                                                  # User said: "thumbnail canvas to be the size of the dawing area"
                                                                                  # If they mean "Device Width/Height" setting, then that's the drawing area.
                                                                                  # If points are outside this because of offset, they will be clipped in thumbnail.
                                                                                  # Let's assume the thumbnail should represent the coordinate space the machine uses.
                                                                                  # The machine uses 0 to width (usually).
                                                                                  # If offset is added, it's added to the final G-code.
                                                                                  # If the user sets offset, they probably expect the machine to move to that offset.
                                                                                  # So the coordinate system is effectively shifted.
                                                                                  # Let's try setting bounds to include the offset?
                                                                                  # Or better: The thumbnail should show the "Physical Table" if we have those dims?
                                                                                  # We have `physical_width` in settings?
                                                                                  # `ImageFactory` only gets `device` settings.
                                                                                  # `device` has `physical_width`!
                                                                                  # Let's try to use physical dimensions if available, otherwise fall back to width/height.
            "ymin": 0,
            "ymax": self.height
        }
        
        # Try to use physical dimensions for the canvas if available
        phys_w = self.device.get("physical_width", 0)
        phys_h = self.device.get("physical_height", 0)
        
        if phys_w > 0 and phys_h > 0:
             drawing_infos["xmax"] = float(phys_w)
             drawing_infos["ymax"] = float(phys_h)
        else:
             # If no physical dims, maybe expand bounds to include offsets?
             # If offset is 50, and width is 500, max x is 550.
             # If we set xmax=500, we lose the right part.
             # Let's ensure bounds cover the transformed points?
             # No, user wants "representative scale". If I auto-scale to points, I lose the relative size.
             # I must fix the frame.
             # If I don't have physical dims, I should probably use width + max(0, offset).
             # But really, physical dims should be there.
             pass

        return drawing_infos, transformed_coords


    # draws an image with the given coordinates (array of tuple of points) and the extremes of the points
    def draw_image(self, coords, drawing_infos):
        limits = DotMap(drawing_infos)
        # Make the image larger than needed so can apply antialiasing
        factor = 5.0
        img_width = self.final_width*factor
        img_height = self.final_height*factor
        border_px = self.final_border_px*factor
        image = Image.new('RGB', (int(img_width), int(img_height)), color=self.bg_color)
        d = ImageDraw.Draw(image)
        rangex = limits.xmax-limits.xmin
        rangey = limits.ymax-limits.ymin
        
        if rangex == 0: rangex = 1
        if rangey == 0: rangey = 1

        scaleX = float(img_width  - border_px*2)/rangex
        scaleY = float(img_height - border_px*2)/rangey
        scale = min(scaleX, scaleY)

        def remapx(value):
            return int((value-limits.xmin)*scale + border_px)
        
        def remapy(value):
            return int(img_height-((value-limits.ymin)*scale + border_px))
        
        if len(coords) > 0:
            p_1 = coords[0]
            self.circle(d, (remapx(p_1[0]), remapy(p_1[1])), self.line_width*factor/2, self.line_color)        # draw a circle to make round corners
            for p in coords[1:]:                                                                # create the line between two consecutive coordinates
                d.line([remapx(p_1[0]), remapy(p_1[1]), remapx(p[0]), remapy(p[1])], \
                fill=self.line_color, width=int(self.line_width*factor))
                if self.verbose:
                    print("coord: {} _ {}".format(remapx(p_1[0]), remapy(p_1[1])))
                p_1 = p
                self.circle(d, (remapx(p_1[0]), remapy(p_1[1])), self.line_width*factor/2, self.line_color)    # draw a circle to make round corners

        # Resize the image to the final dimension to use antialiasing
        image = image.resize((int(self.final_width), int(self.final_height)), Image.ANTIALIAS)
        return image

    def circle(self, d, c, r, color):
        d.ellipse([c[0]-r, c[1]-r, c[0]+r, c[1]+r], fill=color, outline=None)

    def thr_to_image(self, file):
        pass

if __name__ == "__main__":
    # testing scara
    device = {
        "type": "Scara",
        "angle_conversion_factor": 6.0,
        "radius": 200,
        "offset_angle": -1.5,
        "offset_angle_2": 1.5
    }
    factory = ImageFactory(device, verbose=True)
    with open('server/utils/test_scara.gcode') as file:
        im = factory.gcode_to_image(file)
        im.show()
    
    # testing cartesian
    device = {
        "type": "Cartesian"
    }
    factory = ImageFactory(device, verbose=True)
    with open('server/utils/test_cartesian.gcode') as file:
        im = factory.gcode_to_image(file)
        im.show()