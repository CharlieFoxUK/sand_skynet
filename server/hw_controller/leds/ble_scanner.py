import asyncio
from bleak import BleakScanner

async def scan_devices(timeout=5.0):
    devices = await BleakScanner.discover(timeout=timeout)
    results = []
    for d in devices:
        results.append({
            "name": d.name or "Unknown",
            "address": d.address,
            "rssi": d.rssi
        })
    return results

def scan_sync(timeout=5.0):
    return asyncio.run(scan_devices(timeout))

if __name__ == "__main__":
    print(scan_sync())
