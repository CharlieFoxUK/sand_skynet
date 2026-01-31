// GRBL Settings Definitions
// Reference: https://github.com/gnea/grbl/wiki/Grbl-v1.1-Configuration

export const GRBL_SETTINGS = [
    // Step Pulse Settings (0-6)
    {
        id: 0,
        name: "Step pulse time",
        unit: "microseconds",
        description: "Duration of step pulse sent to stepper motors. Shortest pulse your motors can reliably recognize.",
        category: "Step Configuration",
        defaultValue: 10
    },
    {
        id: 1,
        name: "Step idle delay",
        unit: "milliseconds",
        description: "Time to keep motors powered after motion completes. 255 keeps motors always enabled.",
        category: "Step Configuration",
        defaultValue: 25
    },
    {
        id: 2,
        name: "Step port invert",
        unit: "mask",
        description: "Inverts step pulse signal for specific axes (bitmask: X=1, Y=2, Z=4).",
        category: "Step Configuration",
        defaultValue: 0
    },
    {
        id: 3,
        name: "Direction port invert",
        unit: "mask",
        description: "Inverts direction signal for axes. Use when axis moves opposite to expected (bitmask).",
        category: "Step Configuration",
        defaultValue: 0
    },
    {
        id: 4,
        name: "Step enable invert",
        unit: "boolean",
        description: "Inverts step enable pin logic. 0=normal, 1=inverted.",
        category: "Step Configuration",
        defaultValue: 0
    },
    {
        id: 5,
        name: "Limit pins invert",
        unit: "boolean",
        description: "Inverts limit switch logic. 0=normally high, 1=normally low.",
        category: "Step Configuration",
        defaultValue: 0
    },
    {
        id: 6,
        name: "Probe pin invert",
        unit: "boolean",
        description: "Inverts probe pin logic. 0=normally high, 1=normally low.",
        category: "Step Configuration",
        defaultValue: 0
    },

    // Status & Motion (10-13)
    {
        id: 10,
        name: "Status report",
        unit: "mask",
        description: "Configures real-time data in status reports (position, work position, buffer).",
        category: "Status & Motion",
        defaultValue: 1
    },
    {
        id: 11,
        name: "Junction deviation",
        unit: "mm",
        description: "Cornering speed control. Higher=faster corners, lower=slower/careful.",
        category: "Status & Motion",
        defaultValue: 0.01
    },
    {
        id: 12,
        name: "Arc tolerance",
        unit: "mm",
        description: "Maximum deviation when approximating arcs with line segments.",
        category: "Status & Motion",
        defaultValue: 0.002
    },
    {
        id: 13,
        name: "Report in inches",
        unit: "boolean",
        description: "Report positions in inches (1) or millimeters (0).",
        category: "Status & Motion",
        defaultValue: 0
    },

    // Safety & Limits (20-27)
    {
        id: 20,
        name: "Soft limits enable",
        unit: "boolean",
        description: "Prevents travel beyond max limits. Requires homing and accurate max travel settings.",
        category: "Safety & Limits",
        defaultValue: 0
    },
    {
        id: 21,
        name: "Hard limits enable",
        unit: "boolean",
        description: "Uses physical switches to halt motion if limits triggered. Critical safety feature.",
        category: "Safety & Limits",
        defaultValue: 0
    },
    {
        id: 22,
        name: "Homing cycle enable",
        unit: "boolean",
        description: "Enables homing cycle for accurate home position. Requires limit switches.",
        category: "Safety & Limits",
        defaultValue: 0
    },
    {
        id: 23,
        name: "Homing dir invert",
        unit: "mask",
        description: "Inverts homing direction for specific axes (bitmask).",
        category: "Safety & Limits",
        defaultValue: 0
    },
    {
        id: 24,
        name: "Homing feed rate",
        unit: "mm/min",
        description: "Slower feed rate for precise homing after initial switch trigger.",
        category: "Safety & Limits",
        defaultValue: 25
    },
    {
        id: 25,
        name: "Homing seek rate",
        unit: "mm/min",
        description: "Faster rate to initially find limit switches during homing.",
        category: "Safety & Limits",
        defaultValue: 500
    },
    {
        id: 26,
        name: "Homing debounce",
        unit: "milliseconds",
        description: "Delay to account for switch noise/bouncing during homing.",
        category: "Safety & Limits",
        defaultValue: 250
    },
    {
        id: 27,
        name: "Homing pull-off",
        unit: "mm",
        description: "Distance to move off limit switches after homing completes.",
        category: "Safety & Limits",
        defaultValue: 1
    },

    // Spindle/Laser (30-32)
    {
        id: 30,
        name: "Max spindle speed",
        unit: "RPM",
        description: "Maximum spindle/laser speed for PWM output scaling.",
        category: "Spindle/Laser",
        defaultValue: 1000
    },
    {
        id: 31,
        name: "Min spindle speed",
        unit: "RPM",
        description: "Minimum spindle/laser speed for PWM output scaling.",
        category: "Spindle/Laser",
        defaultValue: 0
    },
    {
        id: 32,
        name: "Laser mode enable",
        unit: "boolean",
        description: "Enables laser mode for continuous motion with instant PWM updates.",
        category: "Spindle/Laser",
        defaultValue: 0
    },

    // X-Axis Configuration (100, 110, 120, 130)
    {
        id: 100,
        name: "X-axis steps/mm",
        unit: "steps/mm",
        description: "Stepper steps needed to move X-axis 1mm. Critical calibration setting.",
        category: "X-Axis",
        defaultValue: 250
    },
    {
        id: 110,
        name: "X-axis max rate",
        unit: "mm/min",
        description: "Maximum travel speed for X-axis.",
        category: "X-Axis",
        defaultValue: 500
    },
    {
        id: 120,
        name: "X-axis acceleration",
        unit: "mm/sec²",
        description: "X-axis acceleration. Lower=smoother, higher=quicker.",
        category: "X-Axis",
        defaultValue: 10
    },
    {
        id: 130,
        name: "X-axis max travel",
        unit: "mm",
        description: "Maximum travel distance for X-axis. Used by soft limits.",
        category: "X-Axis",
        defaultValue: 200
    },

    // Y-Axis Configuration (101, 111, 121, 131)
    {
        id: 101,
        name: "Y-axis steps/mm",
        unit: "steps/mm",
        description: "Stepper steps needed to move Y-axis 1mm. Critical calibration setting.",
        category: "Y-Axis",
        defaultValue: 250
    },
    {
        id: 111,
        name: "Y-axis max rate",
        unit: "mm/min",
        description: "Maximum travel speed for Y-axis.",
        category: "Y-Axis",
        defaultValue: 500
    },
    {
        id: 121,
        name: "Y-axis acceleration",
        unit: "mm/sec²",
        description: "Y-axis acceleration. Lower=smoother, higher=quicker.",
        category: "Y-Axis",
        defaultValue: 10
    },
    {
        id: 131,
        name: "Y-axis max travel",
        unit: "mm",
        description: "Maximum travel distance for Y-axis. Used by soft limits.",
        category: "Y-Axis",
        defaultValue: 200
    },

    // Z-Axis Configuration (102, 112, 122, 132)
    {
        id: 102,
        name: "Z-axis steps/mm",
        unit: "steps/mm",
        description: "Stepper steps needed to move Z-axis 1mm. Critical calibration setting.",
        category: "Z-Axis",
        defaultValue: 250
    },
    {
        id: 112,
        name: "Z-axis max rate",
        unit: "mm/min",
        description: "Maximum travel speed for Z-axis.",
        category: "Z-Axis",
        defaultValue: 500
    },
    {
        id: 122,
        name: "Z-axis acceleration",
        unit: "mm/sec²",
        description: "Z-axis acceleration. Lower=smoother, higher=quicker.",
        category: "Z-Axis",
        defaultValue: 10
    },
    {
        id: 132,
        name: "Z-axis max travel",
        unit: "mm",
        description: "Maximum travel distance for Z-axis. Used by soft limits.",
        category: "Z-Axis",
        defaultValue: 200
    }
];

// Group settings by category
export const getSettingsByCategory = () => {
    const categories = {};
    GRBL_SETTINGS.forEach(setting => {
        if (!categories[setting.category]) {
            categories[setting.category] = [];
        }
        categories[setting.category].push(setting);
    });
    return categories;
};

// Get setting definition by ID
export const getSettingById = (id) => {
    return GRBL_SETTINGS.find(s => s.id === id);
};
