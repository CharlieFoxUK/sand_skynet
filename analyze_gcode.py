#!/usr/bin/env python3
"""
G-code Bounds Analyzer
This script downloads G-code files from the Pi and analyzes their coordinate bounds.
"""

import re
import subprocess
import sys
from pathlib import Path

# Table bounds
TABLE_X_MIN = 0
TABLE_X_MAX = 500
TABLE_Y_MIN = 50
TABLE_Y_MAX = 560

def parse_gcode_bounds(filepath):
    """Parse a G-code file and find min/max X and Y coordinates."""
    x_coords = []
    y_coords = []
    
    with open(filepath, 'r') as f:
        for line in f:
            # Match G0 or G1 commands with X and/or Y coordinates
            x_match = re.search(r'X([-\d.]+)', line)
            y_match = re.search(r'Y([-\d.]+)', line)
            
            if x_match:
                x_coords.append(float(x_match.group(1)))
            if y_match:
                y_coords.append(float(y_match.group(1)))
    
    if not x_coords or not y_coords:
        return None
    
    return {
        'x_min': min(x_coords),
        'x_max': max(x_coords),
        'y_min': min(y_coords),
        'y_max': max(y_coords),
        'total_points': len(x_coords)
    }

def download_gcode_from_pi(remote_path, local_path):
    """Download a G-code file from the Pi."""
    try:
        subprocess.run(
            ['scp', f'pi@sandtable.local:{remote_path}', local_path],
            check=True,
            capture_output=True
        )
        return True
    except subprocess.CalledProcessError as e:
        print(f"Error downloading {remote_path}: {e}")
        return False

def check_bounds(bounds):
    """Check if coordinates are within table bounds."""
    issues = []
    
    if bounds['x_min'] < TABLE_X_MIN:
        issues.append(f"X minimum ({bounds['x_min']:.2f}) is below table minimum ({TABLE_X_MIN})")
    if bounds['x_max'] > TABLE_X_MAX:
        issues.append(f"X maximum ({bounds['x_max']:.2f}) exceeds table maximum ({TABLE_X_MAX})")
    if bounds['y_min'] < TABLE_Y_MIN:
        issues.append(f"Y minimum ({bounds['y_min']:.2f}) is below table minimum ({TABLE_Y_MIN})")
    if bounds['y_max'] > TABLE_Y_MAX:
        issues.append(f"Y maximum ({bounds['y_max']:.2f}) exceeds table maximum ({TABLE_Y_MAX})")
    
    return issues

def main():
    # Find G-code files on the Pi
    print("Finding G-code files on Pi...")
    try:
        result = subprocess.run(
            ['ssh', 'pi@sandtable.local', 'find /home/pi/sand_skynet -name "*.gcode" -type f'],
            capture_output=True,
            text=True,
            check=True
        )
        remote_files = [f.strip() for f in result.stdout.split('\n') if f.strip()]
    except subprocess.CalledProcessError:
        print("Error: Could not connect to Pi or find G-code files")
        sys.exit(1)
    
    if not remote_files:
        print("No G-code files found on Pi")
        sys.exit(0)
    
    print(f"Found {len(remote_files)} G-code file(s)\n")
    
    # Create temporary directory for downloads
    temp_dir = Path('/tmp/gcode_analysis')
    temp_dir.mkdir(exist_ok=True)
    
    # Analyze each file
    for remote_path in remote_files:
        filename = Path(remote_path).name
        local_path = temp_dir / filename
        
        print(f"\n{'='*80}")
        print(f"Analyzing: {filename}")
        print(f"Remote path: {remote_path}")
        print(f"{'='*80}")
        
        # Download file
        if not download_gcode_from_pi(remote_path, str(local_path)):
            continue
        
        # Parse bounds
        bounds = parse_gcode_bounds(local_path)
        if not bounds:
            print("  Warning: Could not parse coordinates from file")
            continue
        
        # Print bounds
        print(f"\nCoordinate Bounds:")
        print(f"  X: {bounds['x_min']:8.2f} to {bounds['x_max']:8.2f} (range: {bounds['x_max'] - bounds['x_min']:.2f})")
        print(f"  Y: {bounds['y_min']:8.2f} to {bounds['y_max']:8.2f} (range: {bounds['y_max'] - bounds['y_min']:.2f})")
        print(f"  Total points: {bounds['total_points']}")
        
        # Check against table bounds
        print(f"\nTable Bounds:")
        print(f"  X: {TABLE_X_MIN:8} to {TABLE_X_MAX:8}")
        print(f"  Y: {TABLE_Y_MIN:8} to {TABLE_Y_MAX:8}")
        
        issues = check_bounds(bounds)
        if issues:
            print(f"\n⚠️  ISSUES DETECTED:")
            for issue in issues:
                print(f"  - {issue}")
        else:
            print(f"\n✓ All coordinates are within table bounds")
    
    print(f"\n{'='*80}\n")

if __name__ == '__main__':
    main()
