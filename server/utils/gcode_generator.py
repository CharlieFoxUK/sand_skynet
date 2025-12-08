import math

def fmt(val):
    """Formats a number to 3 decimal places to avoid scientific notation."""
    return "{:.3f}".format(val)

def generate_rect(x, y, w, h):
    """Generates G-code for a rectangle."""
    gcode = []
    gcode.append(f"G0 X{fmt(x)} Y{fmt(y)}")
    gcode.append(f"G1 X{fmt(x+w)} Y{fmt(y)}")
    gcode.append(f"G1 X{fmt(x+w)} Y{fmt(y+h)}")
    gcode.append(f"G1 X{fmt(x)} Y{fmt(y+h)}")
    gcode.append(f"G1 X{fmt(x)} Y{fmt(y)}")
    return gcode

def generate_arrow(x1, y1, x2, y2, head_len=10):
    """Generates G-code for an arrow."""
    gcode = []
    gcode.append(f"G0 X{fmt(x1)} Y{fmt(y1)}")
    gcode.append(f"G1 X{fmt(x2)} Y{fmt(y2)}")
    
    angle = math.atan2(y2 - y1, x2 - x1)
    p1_x = x2 - head_len * math.cos(angle - math.pi / 6)
    p1_y = y2 - head_len * math.sin(angle - math.pi / 6)
    p2_x = x2 - head_len * math.cos(angle + math.pi / 6)
    p2_y = y2 - head_len * math.sin(angle + math.pi / 6)
    
    gcode.append(f"G1 X{fmt(p1_x)} Y{fmt(p1_y)}")
    gcode.append(f"G0 X{fmt(x2)} Y{fmt(y2)}")
    gcode.append(f"G1 X{fmt(p2_x)} Y{fmt(p2_y)}")
    
    return gcode

def generate_text(text, x, y, size=10):
    """Generates simple vector G-code for text (X, Y, 0)."""
    gcode = []
    
    # Simple vector font definitions (normalized to 1x1)
    font = {
        'X': [(0,0, 1,1), (0,1, 1,0)],
        'Y': [(0,1, 0.5,0.5), (1,1, 0.5,0.5), (0.5,0.5, 0.5,0)],
        '0': [(0,0, 1,0), (1,0, 1,1), (1,1, 0,1), (0,1, 0,0), (0,0, 1,1)] # Box with diagonal
    }
    
    offset_x = x
    for char in text:
        if char in font:
            strokes = font[char]
            for stroke in strokes:
                x1, y1, x2, y2 = stroke
                # Scale and translate
                sx1 = offset_x + x1 * size
                sy1 = y + y1 * size
                sx2 = offset_x + x2 * size
                sy2 = y + y2 * size
                
                gcode.append(f"G0 X{fmt(sx1)} Y{fmt(sy1)}")
                gcode.append(f"G1 X{fmt(sx2)} Y{fmt(sy2)}")
            offset_x += size * 1.2 # Spacing
            
    return gcode

def generate_circle(cx, cy, r, segments=16):
    """Generates G-code for a circle."""
    gcode = []
    for i in range(segments + 1):
        angle = 2 * math.pi * i / segments
        x = cx + r * math.cos(angle)
        y = cy + r * math.sin(angle)
        if i == 0:
            gcode.append(f"G0 X{fmt(x)} Y{fmt(y)}")
        else:
            gcode.append(f"G1 X{fmt(x)} Y{fmt(y)}")
    return gcode
