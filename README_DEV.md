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

## How it Works

*   **Sync**: The `sync_to_pi.sh` script watches your Mac folder and pushes changes to the Pi every 2 seconds.
*   **Hot Reload**: The `docker-compose.dev.yml` file mounts the source code directory into the container.
*   **Flask Debug**: The `FLASK_DEBUG=1` environment variable tells the Python server to restart whenever it sees a file change.

## Editing

1.  Edit files on your Mac using your preferred editor.
2.  Save the file.
3.  The sync script pushes it to the Pi.
4.  The Docker container sees the change and reloads the server.
5.  Refresh your browser to see the changes.
