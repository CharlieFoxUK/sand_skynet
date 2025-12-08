import asyncio
from bleak import BleakClient, BleakScanner

MAC = "FC:58:FA:A6:10:3A"
# UUIDs to try
UUIDS = [
    "0000ffe1-0000-1000-8000-00805f9b34fb",
    "0000ffe0-0000-1000-8000-00805f9b34fb"
]

async def run():
    print(f"Scanning for {MAC}...")
    device = None
    for i in range(3):
        print(f"Scan attempt {i+1}...")
        devices = await BleakScanner.discover(timeout=10.0)
        for d in devices:
            print(f"  Found: {d.name} ({d.address}) RSSI: {d.rssi}")
            if d.address == MAC:
                device = d
                # Don't break immediately, let's see what else is there
        if device:
            break
        await asyncio.sleep(2)

    if not device:
        print(f"Device {MAC} not found after retries.")
        # Try connecting by address anyway
        print("Trying to connect by address directly...")
        device = MAC

    print(f"Connecting to {device}...")
    async with BleakClient(device) as client:
        print("Connected!")
        
        # List services to be sure
        for service in client.services:
            print(f"[Service] {service.uuid}")
            for char in service.characteristics:
                print(f"  [Char] {char.uuid} ({char.properties})")

        target_uuid = UUIDS[0]
        # Check if target_uuid exists
        found_char = False
        for service in client.services:
            for char in service.characteristics:
                if char.uuid == target_uuid:
                    found_char = True
                    break
        
        if not found_char:
            print(f"Warning: Target UUID {target_uuid} not found! Using first writable char...")
            for service in client.services:
                for char in service.characteristics:
                    if "write" in char.properties or "write-without-response" in char.properties:
                        target_uuid = char.uuid
                        print(f"Selected alternative char: {target_uuid}")
                        found_char = True
                        break
                if found_char: break

        
        print("Starting Brute Force Sequence...")
        
        # Sequence 1: Standard SP107E OFF
        print("1. Sending Standard OFF (38 00 00 00 83)")
        await client.write_gatt_char(target_uuid, bytearray([0x38, 0x00, 0x00, 0x00, 0x83]), response=False)
        await asyncio.sleep(2)

        # Sequence 2: Standard SP107E ON (White)
        print("2. Sending Standard ON (38 FF FF FF 83)")
        await client.write_gatt_char(target_uuid, bytearray([0x38, 0xFF, 0xFF, 0xFF, 0x83]), response=False)
        await asyncio.sleep(2)

        # Sequence 3: Alternative Header BB
        print("3. Sending BB Header OFF (BB 00 00 00 BB)")
        await client.write_gatt_char(target_uuid, bytearray([0xBB, 0x00, 0x00, 0x00, 0xBB]), response=False)
        await asyncio.sleep(2)

        # Sequence 4: Raw RGB
        print("4. Sending Raw RGB (00 00 00)")
        await client.write_gatt_char(target_uuid, bytearray([0x00, 0x00, 0x00]), response=False)
        await asyncio.sleep(2)

        print("Done.")

if __name__ == "__main__":
    asyncio.run(run())
