#!/bin/bash

# Configuration
PI_USER="pi"
# Default to sandtable, but allow override via argument
PI_HOST="${1:-sandtable}"
REMOTE_DIR="~/sand_skynet"

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}Starting Sync to ${PI_USER}@${PI_HOST}:${REMOTE_DIR}...${NC}"
echo "Press Ctrl+C to stop."

# Ensure we are in the project root
cd "$(dirname "$0")/.."

while true; do
    # Sync using rsync
    # -a: archive mode
    # -v: verbose
    # -z: compress
    # --delete: delete extraneous files from dest dirs
    rsync -avz --delete \
        --exclude 'frontend/node_modules' \
        --exclude '.git' \
        --exclude '.idea' \
        --exclude '.vscode' \
        --exclude '__pycache__' \
        --exclude '*.pyc' \
        --exclude 'env' \
        --exclude '.venv' \
        --exclude 'docker/database' \
        --exclude 'server/database/db' \
        ./ ${PI_USER}@${PI_HOST}:${REMOTE_DIR}

    echo -e "${GREEN}Sync complete. Waiting 2 seconds...${NC}"
    sleep 2
done
