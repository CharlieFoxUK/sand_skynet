"""
GRBL Alarm and Error Code Definitions
Reference: https://github.com/gnea/grbl/wiki/Grbl-v1.1-Alarms
           https://github.com/gnea/grbl/wiki/Grbl-v1.1-Errors
"""

# GRBL Alarm Codes - Critical issues that halt all motion
ALARM_CODES = {
    1: "Hard limit triggered. Machine position is likely lost due to sudden and immediate halt. Re-homing is highly recommended.",
    2: "Soft limit alarm. G-code motion target exceeds machine travel. Machine position safely retained. Alarm may be unlocked.",
    3: "Reset while in motion. Grbl cannot guarantee position. Lost steps are likely. Re-homing is highly recommended.",
    4: "Probe fail. Probe is not in the expected initial state before starting probe cycle when G38.2 and G38.3 is not triggered.",
    5: "Probe fail. Probe did not contact the workpiece within the programmed travel for G38.2 and G38.4.",
    6: "Homing fail. The active homing cycle was reset.",
    7: "Homing fail. Safety door was opened during homing cycle.",
    8: "Homing fail. Pull off travel failed to clear limit switch. Try increasing pull-off setting or check wiring.",
    9: "Homing fail. Could not find limit switch within search distances. Try increasing max travel, decreasing pull-off distance, or check wiring.",
}

# GRBL Error Codes - Command execution failures
ERROR_CODES = {
    1: "G-code words consist of a letter and a value. Letter was not found.",
    2: "Missing the expected G-code word value or numeric value format is not valid.",
    3: "Grbl '$' system command was not recognized or supported.",
    4: "Negative value received for an expected positive value.",
    5: "Homing cycle failure. Homing is not enabled in settings.",
    6: "Minimum step pulse time must be greater than 3 microseconds.",
    7: "EEPROM read failed. Auto-restoring affected EEPROM to default values.",
    8: "Grbl '$' command cannot be used unless Grbl is IDLE. Ensures smooth operation during a job.",
    9: "G-code commands are locked out during alarm or jog state.",
    10: "Soft limits cannot be enabled without homing also enabled.",
    11: "Max characters per line exceeded. Received command line was not executed.",
    12: "Grbl '$' setting value cause the step rate to exceed the maximum supported.",
    13: "Safety door detected as opened and door state initiated.",
    14: "Build info or startup line exceeded EEPROM line length limit. Line not stored.",
    15: "Jog target exceeds machine travel. Jog command has been ignored.",
    16: "Jog command has no '=' or contains prohibited g-code.",
    17: "Laser mode requires PWM output.",
    20: "Unsupported or invalid g-code command found in block.",
    21: "More than one g-code command from same modal group found in block.",
    22: "Feed rate has not yet been set or is undefined.",
    23: "G-code command in block requires an integer value.",
    24: "More than one g-code command that requires axis words found in block.",
    25: "Repeated g-code word found in block.",
    26: "No axis words found in command block for g-code command or current modal state which requires them.",
    27: "Line number value is invalid.",
    28: "G-code command is missing a required value word.",
    29: "G59.x work coordinate system is not supported.",
    30: "G53 only allowed with G0 and G1 motion modes.",
    31: "Axis words found in command block while no command or current modal state uses them.",
    32: "G2 and G3 arcs require at least one in-plane axis word.",
    33: "Motion command target is invalid.",
    34: "Arc radius value is invalid.",
    35: "G2 and G3 arcs require at least one in-plane offset word.",
    36: "Unused value words found in block.",
    37: "G43.1 dynamic tool length offset is not assigned to configured tool length axis.",
}


def get_alarm_description(code):
    """
    Get human-readable description for GRBL alarm code.
    
    Args:
        code: Integer alarm code
        
    Returns:
        String description or "Unknown alarm" if code not found
    """
    return ALARM_CODES.get(code, f"Unknown alarm code: {code}")


def get_error_description(code):
    """
    Get human-readable description for GRBL error code.
    
    Args:
        code: Integer error code
        
    Returns:
        String description or "Unknown error" if code not found
    """
    return ERROR_CODES.get(code, f"Unknown error code: {code}")


def get_alarm_severity(code):
    """
    Get severity level for alarm code.
    All alarms are critical as they halt motion.
    
    Returns:
        "critical"
    """
    return "critical"


def get_error_severity(code):
    """
    Get severity level for error code.
    
    Args:
        code: Integer error code
        
    Returns:
        "high", "medium", or "low"
    """
    # Critical errors that affect system state
    if code in [7, 8, 13]:
        return "high"
    # Homing and configuration errors
    elif code in [5, 10, 12, 17]:
        return "high"
    # G-code parsing errors
    else:
        return "medium"
