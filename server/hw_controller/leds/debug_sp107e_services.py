import asyncio
from bleak import BleakClient

MAC = "FC:58:FA:A6:10:3A"

async def run():
    print(f"Scanning for {MAC}...")
    device = None
    for i in range(5):
        print(f"Scan attempt {i+1}...")
        devices = await BleakScanner.discover(timeout=5.0)
        for d in devices:
            print(f"  Found: {d.name} ({d.address})")
            if d.address == MAC:
                device = d
                break
        if device:
            break
        await asyncio.sleep(1)

    if not device:
        print(f"Device {MAC} not found after retries.")
        # Try connecting by address anyway
        print("Trying to connect by address directly...")
        device = MAC

    print(f"Connecting to {device}...")
    async with BleakClient(device) as client:
        print("Connected")
        for service in client.services:
            print(f"[Service] {service}")
            for char in service.characteristics:
                print(f"  [Characteristic] {char} ({char.properties})")

if __name__ == "__main__":
    asyncio.run(run())
