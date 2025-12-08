import asyncio
from bleak import BleakScanner, BleakClient

async def main():
    print("Forcing direct connect to FC:58:FA:A6:10:3A...")
    try:
        async with BleakClient("FC:58:FA:A6:10:3A") as client:
            print(f"Connected to FC:58:FA:A6:10:3A")
            for service in client.services:
                print(f"[Service] {service}")
                for char in service.characteristics:
                    print(f"  [Characteristic] {char} (Handle: {char.handle})")
                    if "write" in char.properties:
                        print(f"    -> Writable")
                    if "notify" in char.properties:
                        print(f"    -> Notifiable")
    except Exception as e:
        print(f"Failed to connect directly: {e}")

if __name__ == "__main__":
    asyncio.run(main())
