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

### 1. Start the Sync (Mac)
Open a terminal in your project folder and run:
```bash
./dev_tools/sync_to_pi.sh
```
This script watches for changes and copies them to the Pi every 2 seconds. **Keep this terminal open.**

### 2. Build Frontend (Mac)
**Important:** If you make changes to the frontend code (`frontend/src`), you must rebuild it locally for changes to appear on the Pi:
```bash
cd frontend
yarn build
```
The sync script will automatically copy the new build to the Pi.

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
*   **Backend (Python):** **Yes!** If you change a Python file on your Mac, it syncs to the Pi, and the server restarts automatically.
*   **Frontend (React/Website):** **No, not automatically.** You must run `yarn build` on your Mac. The *result* of that build will then automatically sync to the Pi.

### 3. Should I still commit to git?
**Yes, absolutely!**
*   **Git** is your "Save Game" and history. It keeps your code safe and lets you go back if you mess up.
*   **The Sync Script** is just a "live link" for testing. It doesn't save history.
*   **Workflow:** Code -> Test (via sync) -> Happy? -> **Commit to Git**.

