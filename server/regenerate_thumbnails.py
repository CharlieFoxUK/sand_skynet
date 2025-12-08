from server import app
from server.utils import settings_utils
from server.utils.gcode_converter import ImageFactory
import os

def regenerate_all():
    print("Loading settings...")
    settings = settings_utils.load_settings()
    device_settings = settings_utils.get_only_values(settings["device"])
    
    print(f"Device settings: {device_settings}")
    factory = ImageFactory(device_settings)
    
    upload_folder = app.config['UPLOAD_FOLDER']
    print(f"Scanning {upload_folder}...")
    
    count = 0
    for root, dirs, files in os.walk(upload_folder):
        for file in files:
            if file.endswith(".gcode"):
                gcode_path = os.path.join(root, file)
                drawing_id = os.path.basename(root) # Folder name is ID
                jpg_path = os.path.join(root, f"{drawing_id}.jpg")
                
                print(f"Regenerating thumbnail for {drawing_id}...")
                try:
                    with open(gcode_path) as f:
                        dimensions, coords = factory.gcode_to_coords(f)
                        image = factory.draw_image(coords, dimensions)
                        image.save(jpg_path)
                        count += 1
                except Exception as e:
                    print(f"Failed to regenerate {drawing_id}: {e}")

    print(f"Done. Regenerated {count} thumbnails.")

if __name__ == "__main__":
    regenerate_all()
