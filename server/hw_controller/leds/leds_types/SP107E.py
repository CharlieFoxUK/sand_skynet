import asyncio
import threading
import time
import queue
import traceback
from bleak import BleakClient, BleakScanner

# SP107E Constants
WRITE_CHARACTERISTIC_UUID = "0000ffe1-0000-1000-8000-00805f9b34fb"
CMD_INIT = bytearray.fromhex("26625501")

class SP107E:
    def __init__(self, mac_address, logger=None):
        self.mac_address = mac_address
        self.logger = logger
        self._target_color = None
        self._current_color = None
        self._running = False
        self._connected = False
        self._thread = None
        self._loop = None
        self._client = None
        self._brightness = 1.0
        self._command_queue = queue.Queue()
        self._stop_event = threading.Event()  # Event to signal stop to async loop

        # Start the background thread
        self.start()

    def send_command(self, cmd_bytes):
        self._command_queue.put(cmd_bytes)

    def _notification_handler(self, sender, data):
        if self.logger: self.logger.info(f"SP107E: Notification from {sender}: {data.hex()}")
        
        # Packet 891: b7... (First notification)
        # Packet 893: 00... (Second notification)
        # Packet 934: ff00ff0c (Color command, 3s after Packet 893)
        
        # Check if this is the second notification (starts with 00)
        if data[0] == 0x00:
            if not hasattr(self, "_auto_test_sent"):
                self._auto_test_sent = True
                # Auto-test removed to respect saved settings
                if self.logger: self.logger.info("SP107E: Received 2nd notification. Ready for commands.")

    def start(self):
        if self._running: return
        self._running = True
        self._stop_event.clear()  # Clear the stop event before starting
        
        # Pre-establish Bluetooth connection via bluetoothctl before starting async loop
        # This is more reliable than depending solely on bleak's connection
        self._prepare_bluetooth_connection()
        
        self._thread = threading.Thread(target=self._run_loop, daemon=True)
        self._thread.start()
    
    def _prepare_bluetooth_connection(self):
        """Trust the device via bluetoothctl before starting the async loop.
        
        We only TRUST here, not connect. Bleak needs to make its own connection
        to properly manage GATT characteristics and send commands.
        """
        if not self.mac_address:
            return
        try:
            import subprocess
            import time
            
            if self.logger: self.logger.info(f"SP107E: Preparing Bluetooth for {self.mac_address}")
            
            # Trust the device first (required for BlueZ to allow connection)
            result = subprocess.run(
                ["bluetoothctl", "trust", self.mac_address],
                timeout=5,
                capture_output=True,
                text=True
            )
            if self.logger: self.logger.info(f"SP107E: Trust: {result.stdout.strip()}")
            
            # DON'T connect here - let bleak handle the connection
            # If we connect via bluetoothctl, bleak can't manage the GATT properly
            
        except Exception as e:
            if self.logger: self.logger.warning(f"SP107E: Failed to prepare Bluetooth connection: {e}")

    def stop(self):
        """Stop the SP107E driver and disconnect Bluetooth properly."""
        if not self._running:
            return
            
        if self.logger: self.logger.info("SP107E: Stopping driver...")
        self._running = False
        self._stop_event.set()  # Signal the async loop to stop
        
        # Wait for the thread to finish (with timeout)
        if self._thread and self._thread.is_alive():
            self._thread.join(timeout=10.0)
            if self._thread.is_alive():
                if self.logger: self.logger.warning("SP107E: Thread didn't terminate in time")
        
        # Force OS-level disconnect via bluetoothctl as a fallback
        self._force_bluetooth_disconnect()
        
        # Reset the Bluetooth adapter to clear any stale state
        self._reset_bluetooth_adapter()
        
        # Reset state to allow restart
        self._connected = False
        self._client = None
        self._thread = None
        self._loop = None
        
        if self.logger: self.logger.info("SP107E: Driver stopped")
    
    def _force_bluetooth_disconnect(self):
        """Force OS-level Bluetooth disconnect using bluetoothctl."""
        if not self.mac_address:
            return
        try:
            import subprocess
            # Disconnect the device
            result = subprocess.run(
                ["bluetoothctl", "disconnect", self.mac_address],
                timeout=5,
                capture_output=True,
                text=True
            )
            if self.logger: self.logger.info(f"SP107E: bluetoothctl disconnect: {result.stdout.strip()}")
            
            # Small delay to let BlueZ clean up
            import time
            time.sleep(1.0)
        except Exception as e:
            if self.logger: self.logger.warning(f"SP107E: Failed to force disconnect: {e}")
    
    def _reset_bluetooth_adapter(self):
        """Reset the Bluetooth adapter by turning it off and back on.
        
        This helps clear any stale connections or stuck states in the Bluetooth stack.
        """
        try:
            import subprocess
            import time
            
            if self.logger: self.logger.info("SP107E: Resetting Bluetooth adapter...")
            
            # Turn Bluetooth off
            result = subprocess.run(
                ["bluetoothctl", "power", "off"],
                timeout=5,
                capture_output=True,
                text=True
            )
            if self.logger: self.logger.info(f"SP107E: Bluetooth power off: {result.stdout.strip()}")
            
            # Wait for the adapter to fully power down
            time.sleep(2.0)
            
            # Turn Bluetooth back on
            result = subprocess.run(
                ["bluetoothctl", "power", "on"],
                timeout=5,
                capture_output=True,
                text=True
            )
            if self.logger: self.logger.info(f"SP107E: Bluetooth power on: {result.stdout.strip()}")
            
            # Wait for the adapter to be ready
            time.sleep(2.0)
            
            # Trust the device (required for BlueZ to allow connection)
            if self.mac_address:
                result = subprocess.run(
                    ["bluetoothctl", "trust", self.mac_address],
                    timeout=5,
                    capture_output=True,
                    text=True
                )
                if self.logger: self.logger.info(f"SP107E: Trust device: {result.stdout.strip()}")
                
                # Also try to pre-connect via bluetoothctl since bleak sometimes fails
                result = subprocess.run(
                    ["bluetoothctl", "connect", self.mac_address],
                    timeout=15,
                    capture_output=True,
                    text=True
                )
                if self.logger: self.logger.info(f"SP107E: Pre-connect via bluetoothctl: {result.stdout.strip()}")
            
            if self.logger: self.logger.info("SP107E: Bluetooth adapter reset complete")
        except Exception as e:
            if self.logger: self.logger.warning(f"SP107E: Failed to reset Bluetooth adapter: {e}")

    def deinit(self):
        self.stop()

    def _run_loop(self):
        # Create a new event loop for this thread
        self._loop = asyncio.new_event_loop()
        asyncio.set_event_loop(self._loop)
        self._loop.run_until_complete(self._async_main())
        self._loop.close()

    async def _async_main(self):
        if self.logger: self.logger.info(f"SP107E: Starting BLE loop for {self.mac_address}")
        while self._running and not self._stop_event.is_set():
            try:
                if not self._connected:
                    if self.logger: self.logger.info(f"SP107E: Connecting to {self.mac_address}...")
                    
                    # Try to find the device first (helps with connection stability)
                    device = await BleakScanner.find_device_by_address(self.mac_address, timeout=20.0)
                    if not device:
                        if self.logger: self.logger.warning(f"SP107E: Device {self.mac_address} not found during scan, trying direct connect...")
                        device = self.mac_address # Fallback to address string
                    
                    async with BleakClient(device) as client:
                        if self.logger: self.logger.info("SP107E: Connected")
                        self._connected = True
                        self._client = client # Keep a reference to the client if needed elsewhere, though the 'async with' pattern is usually self-contained
                        
                        # Subscribe to notifications
                        await client.start_notify(WRITE_CHARACTERISTIC_UUID, self._notification_handler)
                        if self.logger: self.logger.info("SP107E: Subscribed to notifications")

                        # Send init command
                        await client.write_gatt_char(WRITE_CHARACTERISTIC_UUID, CMD_INIT, response=True)
                        if self.logger: self.logger.info("SP107E: Sent init")

                        last_activity = time.time()

                        while self._running and client.is_connected and not self._stop_event.is_set():
                            # Check for updates from _target_color or command queue
                            if self._target_color != self._current_color:
                                await self._send_color_internal(client, self._target_color)
                                self._current_color = self._target_color
                                last_activity = time.time()
                            
                            # Process commands from the queue
                            while not self._command_queue.empty():
                                try:
                                    cmd = self._command_queue.get()
                                    # Unblocked pattern commands
                                    # if cmd[-1] == 0x0a:
                                    #    if self.logger: self.logger.warning(f"SP107E: BLOCKED interfering command {cmd.hex()}")
                                    #    continue
                                        
                                    if self.logger: self.logger.info(f"SP107E: Sending command {cmd.hex()}")
                                    await client.write_gatt_char(WRITE_CHARACTERISTIC_UUID, cmd, response=True)
                                    last_activity = time.time()
                                except Exception as e:
                                    if self.logger: self.logger.error(f"SP107E: Queue error: {e}")
                            
                            # Keep-alive (every 2 seconds)
                            if time.time() - last_activity > 2.0:
                                # Send a dummy command or re-send init to keep connection alive
                                # Using Init command as keep-alive based on capture behavior (or just to keep traffic flowing)
                                # if self.logger: self.logger.info("SP107E: Sending keep-alive")
                                # await client.write_gatt_char(WRITE_CHARACTERISTIC_UUID, CMD_INIT, response=True)
                                last_activity = time.time()
                            
                            await asyncio.sleep(0.1)
                        
                        self._connected = False
                        # Ensure we disconnect cleanly
                        if client.is_connected:
                            # Try to turn off LEDs (Soft Off) before disconnecting
                            # This might help the device reset its state
                            try:
                                if self.logger: self.logger.info("SP107E: Sending Soft Off (Black) before disconnect...")
                                await client.write_gatt_char(WRITE_CHARACTERISTIC_UUID, bytearray.fromhex("0000000c"), response=True)
                                await asyncio.sleep(0.5)
                            except Exception as e:
                                if self.logger: self.logger.warning(f"SP107E: Failed to send Soft Off: {e}")

                            if self.logger: self.logger.info("SP107E: Stopping notifications...")
                            try:
                                await client.stop_notify(WRITE_CHARACTERISTIC_UUID)
                            except Exception as e:
                                if self.logger: self.logger.warning(f"SP107E: Failed to stop notifications: {e}")

                            if self.logger: self.logger.info("SP107E: Disconnecting...")
                            await client.disconnect()
                            
                        # Force OS-level disconnect just in case
                        try:
                            import subprocess
                            subprocess.run(["bluetoothctl", "disconnect", self.mac_address], timeout=5, check=False)
                            if self.logger: self.logger.info("SP107E: Force disconnected via bluetoothctl")
                        except Exception as e:
                            if self.logger: self.logger.error(f"SP107E: Failed to force disconnect: {e}")

                        # Wait a bit for BlueZ to clean up (shortened for faster reconnect)
                        if not self._stop_event.is_set():
                            await asyncio.sleep(2.0)
                        
                        if self.logger: self.logger.info("SP107E: Disconnected loop end")
                        self._client = None # Clear client reference
                else:
                    # If already connected, check periodically and respond to stop
                    await asyncio.sleep(0.5)
            except Exception as e:
                if self.logger: 
                    self.logger.error(f"SP107E Error: {e}")
                    self.logger.error(traceback.format_exc())
                self._connected = False
                if self._client:
                    try:
                        await self._client.disconnect()
                    except:
                        pass
                self._client = None # Clear client reference on error
                if not self._stop_event.is_set():
                    await asyncio.sleep(5) # Wait before retrying

        if self._client and self._connected:
            await self._client.disconnect()

    async def _send_color_internal(self, client, color):
        if not client: return
        if color is None: return

        # Color is (r, g, b, w)
        r, g, b, w = color
        
        # Apply brightness
        r = int(r * self._brightness)
        g = int(g * self._brightness)
        b = int(b * self._brightness)

        # Construct command: R G B 0C
        # Based on packet capture: ff00ff0c, ff00000c, etc.
        cmd = bytearray([r, g, b, 0x0C])
        
        try:
            await client.write_gatt_char(WRITE_CHARACTERISTIC_UUID, cmd, response=True)
            # if self.logger: self.logger.debug(f"SP107E: Sent color {cmd.hex()}")
        except Exception as e:
            if self.logger: self.logger.error(f"SP107E: Failed to send color: {e}")
            raise e # Let the caller handle the disconnection

    def fill(self, color):
        # color is (r, g, b, w)
        self._target_color = color

    def fill_white(self):
        self.fill((0, 0, 0, 255)) # Or (255, 255, 255, 0) depending on strip

    def set_brightness(self, brightness):
        self._brightness = brightness
        # Re-send current color with new brightness
        # Trigger update by invalidating current color?
        # Or just let the next update handle it. 
        # But if color doesn't change, it won't update.
        # So we should force update.
        self._current_color = None 

    def increase_brightness(self):
        self._brightness = min(1.0, self._brightness + 0.1)
        self._current_color = None

    def decrease_brightness(self):
        self._brightness = max(0.0, self._brightness - 0.1)
        self._current_color = None

    def clear(self):
        self.fill((0,0,0,0))

    def is_connected(self):
        return self._connected
