# Sandypi Developer Guide & Fast Deployment Workflow

This guide documents the modern development workflow for the Sandypi project, enabling rapid iteration and real-time updates on the Raspberry Pi without requiring slow Docker rebuilds.

## 🚀 Speed / Fast Deployment

We have moved away from the "rebuild Docker for every change" workflow. Instead, we use volume mounts and `rsync` to push code directly to the running container.

### The `fast_deploy.sh` Script

A utility script is available in the root directory: `./fast_deploy.sh`.
It handles building the frontend (if needed) and syncing both frontend and backend code to the Pi.

#### 1. Frontend Changes (React)
When you modify files in `frontend/src/`:

```bash
./fast_deploy.sh
```

**What it does:**
1.  Builds the React app locally on your machine (`npm run build`).
2.  Rsyncs the `build/` folder to the Pi.
3.  **Result:** Refresh your browser to see changes instantly. No server restart required.

#### 2. Backend Changes (Python)
When you modify files in `server/`:

```bash
./fast_deploy.sh --skip-build
```

**What it does:**
1.  Skips the slow React build.
2.  Rsyncs the `server/` source code to the Pi.
3.  **Result:** The Flask server (running in debug mode) detects the file change and auto-reloads within seconds.

---

## 🏗️ Architecture Explained

The `docker/docker-compose.yml` on the Pi has been modified to mount local directories into the container:

*   **Frontend**: `../frontend/build` (Host) -> `/sandypi/frontend/build` (Container)
*   **Backend**: `../server` (Host) -> `/sandypi/server` (Container)
    *   *Note:* `FLASK_DEBUG=1` is set to enable hot-reloading.

This means files on the Pi's filesystem are the "source of truth" for the running container. We simply keep the Pi's filesystem in sync with your local machine using `rsync`.

## ⚠️ Requirements & Troubleshooting

*   **Prerequisites**:
    *   `node` and `npm`/`yarn` installed locally.
    *   SSH access to `pi@sandtable.local` with key-based auth (for passwordless rsync).
    *   Dependencies installed (`cd frontend && yarn install`).

*   **First Run / Reset**:
    If the volume mounts seem broken (e.g., changes not reflecting), ensure the `docker-compose` setup is active:
    ```bash
    # On the Pi:
    cd ~/sand_skynet/docker
    docker compose down
    docker compose up -d
    ```

*   **Backend imports**: The container runs code from the mounted `/sandypi/server` directory, taking precedence over the installed `site-packages`.

---

*Verified Working: January 2026*
