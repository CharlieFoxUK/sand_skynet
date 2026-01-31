from threading import Thread, Lock
from dotmap import DotMap
from time import sleep

from server.utils import settings_utils

from server.hw_controller.leds.leds_types.dimmable import Dimmable
from server.hw_controller.leds.leds_types.RGB_neopixels import RGBNeopixels
from server.hw_controller.leds.leds_types.RGBW_neopixels import RGBWNeopixels
from server.hw_controller.leds.leds_types.WWA_neopixels import WWANeopixels
from server.hw_controller.leds.leds_types.SP107E import SP107E
from server.hw_controller.leds.light_sensors.tsl2591 import TSL2591

class LedsController:
    def __init__(self, app):
        self.app = app
        self.dimensions = None
        self.driver = None
        self.sensor = None
        self._mutex = Lock()
        self._should_update = False
        self._running = False
        self._color = (0,0,0,0)
        self._brightness = 0
        self._just_turned_on = True
        self.mac_address = None
        self.update_settings(settings_utils.load_settings())
        self.reset_lights()

    def is_available(self):
        return not self.driver is None

    def has_light_sensor(self):
        if not self.sensor is None:
            return self.sensor.is_connected()
        return False

    def get_status(self):
        status = {
            "available": self.is_available(),
            "type": self.leds_type,
            "connected": False
        }
        if self.driver and hasattr(self.driver, "is_connected"):
            status["connected"] = self.driver.is_connected()
        elif self.driver:
            # For other drivers (GPIO), assume connected if initialized
            status["connected"] = True
        return status

    def reconnect(self):
        """Force reconnection of the LED driver.
        
        This properly stops and cleans up the old driver before creating a new one,
        which is necessary for Bluetooth drivers like SP107E that need proper disconnect.
        """
        self.app.logger.info("LedsController: Force reconnecting...")
        
        # First, properly stop and deinitialize the old driver
        if self.driver is not None:
            self.app.logger.info("LedsController: Stopping old driver...")
            was_running = self._running
            
            # Stop the controller thread
            if self._running:
                self.stop()
            
            # Deinitialize the driver (this handles Bluetooth disconnect for SP107E)
            try:
                self.driver.deinit()
                self.app.logger.info("LedsController: Old driver deinitialized")
            except Exception as e:
                self.app.logger.error(f"LedsController: Error deinitializing driver: {e}")
            
            # Clear the driver reference
            self.driver = None
            
            # CRITICAL: Also clear cached settings so update_settings() will re-initialize
            # The check on line 230 compares these values to decide whether to create a new driver
            self.leds_type = None
            self.pin = None
            self.mac_address = None
        
        # Force re-initialization of the driver with fresh settings
        self.update_settings(settings_utils.load_settings())
        
        # Explicitly start the controller since update_settings() won't do it
        # (because we already set _running = False in stop())
        self.start()
        self.reset_lights()

    def start(self):
        if not self.driver is None:
            self._running = True
            self._th = Thread(target = self._thf, daemon=True)
            self._th.name = "leds_controller"
            self._th.start()
    
    def stop(self):
        if not self.driver is None:
            with self._mutex:
                self.driver.clear()
                self._running = False

    def decrease_brightness(self):
        if not self.driver is None:
            self.driver.decrease_brightness()

    def increase_brightness(self):
        if not self.driver is None:
            self.driver.increase_brightness()
    
    def fill(self, color):
        if not self.driver is None:
            self.driver.fill(color)

    def send_command(self, cmd_hex):
        if not self.driver is None and hasattr(self.driver, "send_command"):
            try:
                cmd_bytes = bytearray.fromhex(cmd_hex)
                self.driver.send_command(cmd_bytes)
                return True
            except Exception as e:
                self.app.logger.error(f"Error sending command: {e}")
        return False

    def reset_lights(self):
        if not self.driver is None:
            # Load startup settings
            startup_brightness = 0
            startup_color = "#FFFFFF"
            
            if hasattr(self, 'settings') and self.settings:
                try:
                    if 'leds' in self.settings:
                        if 'startup_brightness' in self.settings['leds']:
                            startup_brightness = float(self.settings['leds']['startup_brightness']['value'])
                        if 'startup_color' in self.settings['leds']:
                            startup_color = self.settings['leds']['startup_color']['value']
                except Exception as e:
                    self.app.logger.error(f"Error loading startup LED settings: {e}")

            # Apply startup settings
            self.set_color(startup_color)
            self.set_brightness(startup_brightness)
            
        self._just_turned_on = True
    
    def _thf(self):
        self.app.logger.info("Leds controller started")
        try:
            while(True):
                with self._mutex:
                    if self._should_update:
                        self.driver.fill(self._color)
                        self._should_update = False
                    if not self._running:
                        break
                sleep(0.01)
        except Exception as e:
            self.app.logger.exception(e)

        if not self.driver is None:
            self.driver.deinit()
        self.app.logger.info("Leds controller stopped")

    # sets a fixed color for the leds
    def set_color(self, color):
        r = int(color[1:3], 16)
        g = int(color[3:5], 16)
        b = int(color[5:7], 16)
        w = 0
        if len(color)>7:
            w = int(color[7:9], 16)
        with self._mutex:
            self._color = (r, g, b, w)
            self._should_update = True
        
        # Save color to settings
        if hasattr(self, 'settings') and self.settings:
            try:
                if 'leds' in self.settings:
                    if 'startup_color' not in self.settings['leds']:
                         self.settings['leds']['startup_color'] = {}
                    self.settings['leds']['startup_color']['value'] = color
                    settings_utils.save_settings(self.settings)
            except Exception as e:
                self.app.logger.error(f"Error saving LED color: {e}")

        if self._just_turned_on:
            self.app.logger.info("Turning on brightness")
            self.set_brightness(1)

    def set_brightness(self, brightness):
        self._just_turned_on = False
        if not self.driver is None:
            self.driver.set_brightness(brightness)
        
        # Save brightness to settings
        if hasattr(self, 'settings') and self.settings:
            try:
                if 'leds' in self.settings:
                    if 'startup_brightness' not in self.settings['leds']:
                         self.settings['leds']['startup_brightness'] = {}
                    self.settings['leds']['startup_brightness']['value'] = brightness
                    settings_utils.save_settings(self.settings)
            except Exception as e:
                self.app.logger.error(f"Error saving LED brightness: {e}")

    def start_animation(self, animation):
        # TODO add animations picker:
        # may add animations like:
        #  * a rainbow color moving around (may choose speed, saturation, direction, multiple rainbows etc)
        #  * random colors (maybe based on normalized 3d perlin noise and selection the nodes coordinates?)
        #  * custom gradients animations
        #  * custom colors sequences animations
        #  * "follow the ball" animation (may be quite difficult due to the delay between commands sent to the board and actual ball movement)
        pass

    # Updates dimensions of the led matrix
    # Updates the led driver object only if the dimensions are changed
    def update_settings(self, settings):
        # Store raw settings for persistence
        self.settings = settings
        
        # TODO check if the settings are changed and restart the driver only in that case
        restart = False
        if self._running:
            self.stop()
            restart = True
        settings = DotMap(settings_utils.get_only_values(settings))
        dims = (int(settings.leds.width), int(settings.leds.height), int(settings.leds.circumference))
        if self.dimensions != dims:
            self.dimensions = dims
            self.leds_type = None
            self.pin = None
        if (self.leds_type != settings.leds.type) or (self.pin != settings.leds.pin1) or (self.mac_address != settings.leds.get("mac_address", "")):
            self.pin = settings.leds.pin1
            self.leds_type = settings.leds.type
            self.mac_address = settings.leds.get("mac_address", "")
            try:
                # the leds number calculation depends on the type of table. 
                # If is square or rectangular should use a base and height, for round tables will use the total number of leds directly
                leds_number = (int(self.dimensions[0]) + int(self.dimensions[1]))*2 if settings.device.type == "Cartesian" else int(self.dimensions[2])
                leds_class = Dimmable
                if self.leds_type == "RGB":
                    leds_class = RGBNeopixels
                elif self.leds_type == "RGBW":
                    leds_class = RGBWNeopixels
                elif self.leds_type == "WWA":
                    leds_class = WWANeopixels
                elif self.leds_type == "SP107E":
                    leds_class = SP107E
                
                if self.leds_type == "SP107E":
                    # SP107E uses mac_address instead of pin
                    mac_address = settings.leds.get("mac_address", "")
                    self.driver = leds_class(mac_address, logger=self.app.logger)
                else:
                    self.driver = leds_class(leds_number, settings.leds.pin1, logger=self.app.logger)
            except Exception as e: 
                self.driver = None
                self.app.semits.show_toast_on_UI("Led driver type not compatible with current HW")
                self.app.logger.exception(e)
                self.app.logger.error("Cannot initialize leds controller")
            try: 
                if settings.leds.light_sensor == "TSL2591":
                    self.sensor = TSL2591(self.app)
                else:
                    if not self.sensor is None:
                        self.sensor.deinit()
            except Exception as e:
                if self.is_available():
                    self.app.semits.show_toast_on_UI("The select sensor is not compatible with the current setup")
                self.app.logger.error("Cannot initialize leds light sensor")
                self.app.logger.exception(e)

        if restart:
            self.start()
            self.reset_lights()
        