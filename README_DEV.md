# Development Workflow for Sand Skynet

This guide explains how to develop on your Mac and have changes instantly reflect on the Raspberry Pi, without using VS Code Remote.

## Prerequisites

1.  **SSH Access**: You must be able to SSH into your Pi (e.g., `ssh pi@raspberrypi.local`).
2.  **Docker on Pi**: Docker and Docker Compose must be installed on the Pi.

## Setup

### 1. Setup SSH Access (One-time setup)

To avoid typing the password (`raspberry`) every time the script syncs, set up an SSH key:

```bash
# 1. Generate a key if you don't have one (press Enter for all prompts)
ssh-keygen -t rsa -b 4096

# 2. Copy the key to the Pi (enter 'raspberry' when prompted)
ssh-copy-id pi@sandtable
```

### 2. Start the File Sync (On your Mac)

Open a terminal in this project folder and run:

```bash
./dev_tools/sync_to_pi.sh
```

*   This defaults to connecting to `pi@sandtable`.
*   It will sync files to `~/sand_skynet` on the Pi.
*   Keep this terminal open. It will sync changes every 2 seconds.

### 3. Start the Dev Server (On the Pi)

Open a **new terminal** and SSH into your Pi:

```bash
ssh pi@sandtable
# Password is 'raspberry' (if you didn't set up keys)
```

Navigate to the folder (which should now be populated by the sync script):

```bash
cd ~/sand_skynet
```

Stop any running containers:

```bash
docker-compose -f docker/docker-compose.yml down
```

Start the **Development** container:

```bash
docker-compose -f docker/docker-compose.dev.yml up --build
```

## Workflow

### 1. Sync Changes (Mac)
When you have made changes and want to test them, run:
```bash
./dev_tools/sync_to_pi.sh
```
This will copy your current files to the Pi. **Run this every time you want to update the Pi.**

### 2. Build Frontend (Mac)
**Important:** If you make changes to the frontend code (`frontend/src`), you must rebuild it locally *before* syncing:
```bash
cd frontend
yarn build
```
Then run the sync script.

### 3. Start the Server (Pi)
On the Pi, run the development server:
```bash
ssh pi@sandtable "cd ~/sand_skynet && docker compose -f docker/docker-compose.dev.yml up --build"
```
This starts the server in "hot reload" mode.

## FAQ

### 1. Is Docker still being used?
**Yes**, but it runs in the background. You don't need to "manage" it much. It's just the engine that runs the server on the Pi. You'll use the `docker compose` command above to start/stop the server.

### 2. Are code changes automatically updated?
*   **Backend (Python):** **Yes, once synced.** If you change a Python file on your Mac and run the sync script, the server on the Pi will restart automatically.
*   **Frontend (React/Website):** **No.** You must run `yarn build` on your Mac, then run the sync script.

### 3. Should I still commit to git?
**Yes, absolutely!**
*   **Git** is your "Save Game" and history. It keeps your code safe and lets you go back if you mess up.
*   **The Sync Script** is just a "live link" for testing. It doesn't save history.
*   **Workflow:** Code -> Build (if frontend) -> Sync -> Test -> Happy? -> **Commit to Git**.

### 4. Modifying Settings (Important!)
The settings labels and defaults are controlled by the **Backend**, not the Frontend.
*   **Source of Truth:** `server/saves/default_settings.json`
*   **Do NOT edit:** `frontend/src/structure/tabs/settings/defaultSettings.js` (this is overwritten by the server).

**To change a setting label or default:**
1.  Edit `server/saves/default_settings.json`.
2.  Sync the file to the Pi.
3.  Restart the server on the Pi (`docker compose -f docker/docker-compose.dev.yml restart`).
