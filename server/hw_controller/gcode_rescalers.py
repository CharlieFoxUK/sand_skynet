import math

# This class is the base class to create different types of stretching/clipping of the drawing to fit it on the table (because the drawing may be for a different table size)
# The base class can be extended to get different results
# Can rotate the drawings (angle in degrees)
class GcodeFilter():
    def __init__(self, dimensions, angle = 0.0):
        self.table_x = dimensions["table_x"]
        self.table_y = dimensions["table_y"]
        self.drawing_max_x = dimensions["drawing_max_x"]
        self.drawing_max_y = dimensions["drawing_max_y"]
        self.drawing_min_x = dimensions["drawing_min_x"]
        self.drawing_min_y = dimensions["drawing_min_y"]
        
        # New settings
        self.offset_x = dimensions.get("offset_x", 0)
        self.offset_y = dimensions.get("offset_y", 0)
        self.orientation_origin = dimensions.get("orientation_origin", "Bottom-Left")
        self.orientation_swap = dimensions.get("orientation_swap", False)

        self.angle = angle * math.pi /180.0
        self.last_x = 0
        self.last_y = 0

    def get_coords(self, line):
        l = line.split(" ")
        if "G0" in l[0] or "G1" in l[0]:
            x = None
            y = None
            for i in l:
                if len(i) > 1:
                    if i[0].upper()=="X":
                        try:
                            x = float(i[1:])
                        except: pass
                    elif i[0].upper()=="Y":
                        try:
                            y = float(i[1:])
                        except: pass
            
            if x is None:
                x = self.last_x
            if y is None:
                y = self.last_y
                
            self.last_x = x
            self.last_y = y
            return x, y
        return None, None

    # Method to overwrite to do the rescale/clipping or anything else
    def parse_line(self, line):
        x, y = self.get_coords(line)
        if x is not None and y is not None:
            x, y = self.rotate_coords(x,y, self.table_x/2, self.table_y/2)
        return line
    
    # ... existing rotate_coords ...
    def rotate_coords(self, x, y, center_x, center_y):
        r_x = math.cos(self.angle) * (x-center_x) - math.sin(self.angle) * (y-center_y) + center_x
        r_y = math.sin(self.angle) * (x-center_x) + math.cos(self.angle) * (y-center_y) + center_y
        return r_x, r_y
    
    def return_line(self, x, y):
        return "G1 X{:.3f} Y{:.3f}".format(x,y)


class Fit(GcodeFilter):
    def __init__(self, dimensions, angle = 0):
        super().__init__(dimensions, angle)
        self.width_raw = self.drawing_max_x - self.drawing_min_x
        self.height_raw = self.drawing_max_y - self.drawing_min_y
        
        if self.width_raw == 0: self.width_raw = 1
        if self.height_raw == 0: self.height_raw = 1

    def transform_point(self, x, y):
        # 1. Normalize to 0-1
        x_norm = (x - self.drawing_min_x) / self.width_raw
        y_norm = (y - self.drawing_min_y) / self.height_raw
        
        # 2. Orientation Mapping (Screen/Drawing Space -> Physical Space)
        x_mapped = x_norm
        y_mapped = y_norm
        
        # Origin Mapping
        if self.orientation_origin == "Top-Left":
            # x' = x, y' = 1 - y
            y_mapped = 1.0 - y_norm
        elif self.orientation_origin == "Top-Right":
            # x' = 1 - x, y' = 1 - y
            x_mapped = 1.0 - x_norm
            y_mapped = 1.0 - y_norm
        elif self.orientation_origin == "Bottom-Right":
            # x' = 1 - x, y' = y
            x_mapped = 1.0 - x_norm
        # Bottom-Left is default (x=x, y=y)

        # Swap Axes
        if self.orientation_swap:
            x_mapped, y_mapped = y_mapped, x_mapped

        # 3. Scale to Table (Safe Area)
        x_final = x_mapped * self.table_x
        y_final = y_mapped * self.table_y
        
        # 4. Offset
        x_final += self.offset_x
        y_final += self.offset_y
        
        # 5. Rotation (Optional legacy rotation)
        if self.angle != 0:
            x_final, y_final = self.rotate_coords(x_final, y_final, self.table_x/2 + self.offset_x, self.table_y/2 + self.offset_y)
            
        return x_final, y_final

    def parse_line(self, line):
        x, y = self.get_coords(line)
        if x is not None and y is not None:
            x_final, y_final = self.transform_point(x, y)
            return self.return_line(x_final, y_final)
        return line

class FitNoStretch(GcodeFilter):
    def __init__(self, dimensions, angle = 0):
        super().__init__(dimensions, angle)
        self.scale_x = self.table_x / (self.drawing_max_x - self.drawing_min_x)
        self.scale_y = self.table_y / (self.drawing_max_y - self.drawing_min_y)
        self.scale = max(self.scale_x, self.scale_y)

    def parse_line(self, line):
        x, y = self.get_coords(line)
        if x and y:
            x = x * self.scale
            y = y * self.scale
            x, y = self.rotate_coords(x,y, self.table_x/2, self.table_y/2)
            return self.return_line(x,y)
        return line

class Clip(GcodeFilter):

    def parse_line(self, line):
        x, y = self.get_coords(line)
        if x and y:
            x = self.clip(x, 0, self.table_x)
            y = self.clip(y, 0, self.table_y)
            x, y = self.rotate_coords(x,y, self.table_x/2, self.table_y/2)
            return self.return_line(x,y)
        return line
    
    def clip(self, n, min, max):
        return max(min(max, n), min)