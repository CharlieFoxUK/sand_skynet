#!/bin/bash
# Fast deploy script for SandTables
# Builds frontend locally and upgrades the Pi in seconds
# Usage: ./fast_deploy.sh

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

SKIP_BUILD=false
if [ "$1" == "--skip-build" ]; then
    SKIP_BUILD=true
    echo -e "${BLUE}⏩ Skipping frontend build...${NC}"
fi

if [ "$SKIP_BUILD" = false ]; then
    echo -e "${BLUE}🚀 Building frontend locally...${NC}"
    cd frontend
    # Ensure dependencies are installed if needed
    if [ ! -d "node_modules" ]; then
        echo "Installing dependencies..."
        yarn install
    fi

    NODE_OPTIONS="--openssl-legacy-provider" npm run build
    if [ $? -ne 0 ]; then
        echo "❌ Build failed"
        exit 1
    fi
    cd ..
fi

echo -e "${BLUE}📦 Syncing files to Pi...${NC}"
# Sync frontend build
echo "   - Syncing Frontend..."
rsync -avz --delete frontend/build/ pi@sandtable.local:/home/pi/sand_skynet/frontend/build/

# Sync backend server code
echo "   - Syncing Backend..."
rsync -avz --exclude '__pycache__' --exclude '*.pyc' --exclude 'server.egg-info' server/ pi@sandtable.local:/home/pi/sand_skynet/server/

echo -e "${GREEN}✅ Done!${NC}"
echo "Frontend: Refresh browser."
echo "Backend:  Changes are auto-reloaded (hot-code pushing enabled)."
