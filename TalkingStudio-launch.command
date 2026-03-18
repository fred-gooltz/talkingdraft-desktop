#!/bin/bash

cd "$(dirname "$0")"

echo "Killing any existing processes..."
lsof -ti:5001 | xargs kill -9 2>/dev/null || true
pkill -f "neutralino" 2>/dev/null || true
pkill -f "BESPOKE-APP" 2>/dev/null || true
sleep 1
echo "All clear."

# ── ALWAYS REBUILD before launch so source file edits take effect ─────────────
echo "Building resources..."
neu build
echo "Build complete."

# ── Backend ───────────────────────────────────────────────────────────────────
if [ ! -d "backend/venv" ]; then
    echo "Setting up Python environment..."
    cd backend
    python3 -m venv venv
    source venv/bin/activate
    pip install -r requirements.txt
    cd ..
fi

echo "Starting backend server..."
cd backend
source venv/bin/activate
python3 main_FIXED.py &
BACKEND_PID=$!
cd ..

echo "Waiting for backend..."
for i in {1..15}; do
    if curl -s http://127.0.0.1:5001/docs > /dev/null 2>&1; then
        echo "Backend ready."
        break
    fi
    sleep 1
done

# ── Launch ────────────────────────────────────────────────────────────────────
echo "Launching TalkingStudio..."
neu run

# ── Cleanup ───────────────────────────────────────────────────────────────────
echo "Shutting down..."
kill $BACKEND_PID 2>/dev/null || true
lsof -ti:5001 | xargs kill -9 2>/dev/null || true
pkill -f "BESPOKE-APP" 2>/dev/null || true
echo "Done."
