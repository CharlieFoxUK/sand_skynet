import json
import os

saved_path = "server/saves/saved_settings.json"
default_path = "server/saves/default_settings.json"

OVERWRITE_FIELDS = [
    "available_values",
    "depends_on",
    "depends_values",
    "tip",
    "label"
]

def match_dict(mod_dict, ref_dict):
    if type(ref_dict) is dict:
        if not type(mod_dict) is dict:
            return ref_dict
        
        new_dict = dict(mod_dict)
        for k in ref_dict.keys():
            if (not k in new_dict) or (k in OVERWRITE_FIELDS):
                new_dict[k] = ref_dict[k]
            else:
                new_dict[k] = match_dict(new_dict[k], ref_dict[k])
        return new_dict
    else:
        return mod_dict

with open(saved_path, 'r') as f:
    saved = json.load(f)

with open(default_path, 'r') as f:
    defaults = json.load(f)

merged = match_dict(saved, defaults)

with open(saved_path, 'w') as f:
    json.dump(merged, f, indent=4)

print("Merged settings successfully.")
