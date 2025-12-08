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
                if self._loop:
                    # Wait 3.2s to match capture delta (3.25s)
                    asyncio.run_coroutine_threadsafe(self._delayed_auto_test(), self._loop)

    async def _delayed_auto_test(self):
        if self.logger: self.logger.info("SP107E: Received 2nd notification. Waiting 3.2s before auto-test...")
        await asyncio.sleep(3.2)
        # Send Magenta (ff00ff0c) to match capture exactly
        cmd = bytearray.fromhex("ff00ff0c")
        if self.logger: self.logger.info(f"SP107E: Auto-sending Magenta Test ({cmd.hex()})")
        
        if self._client and self._client.is_connected:
             try:
                 await self._client.write_gatt_char(WRITE_CHARACTERISTIC_UUID, cmd, response=True)
                 if self.logger: self.logger.info("SP107E: Auto-test sent successfully")
             except Exception as e:
                 if self.logger: self.logger.error(f"SP107E: Auto-test failed: {e}")

    def start(self):
        if self._running: return
        self._running = True
        self._thread = threading.Thread(target=self._run_loop, daemon=True)
        self._thread.start()

    def stop(self):
        self._running = False
        if self._thread and self._thread.is_alive():
            self._thread.join(timeout=5.0) # Wait for thread to finish

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
        while self._running:
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

                        while self._running and client.is_connected:
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

                        # Wait a bit for BlueZ to clean up
                        await asyncio.sleep(5.0)
                        
                        if self.logger: self.logger.info("SP107E: Disconnected loop end")
                        self._client = None # Clear client reference
                else:
                    await asyncio.sleep(1) # If already connected, just wait
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
