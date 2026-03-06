#!/bin/bash

# Navigate to app directory
cd "$(dirname "$0")"

# Kill any existing backend servers on port 5001
echo "Checking for existing backend servers..."
lsof -ti:5001 | xargs kill -9 2>/dev/null || true

# Create virtual env if needed
if [ ! -d "backend/venv" ]; then
    echo "Setting up Python environment..."
    cd backend
    python3 -m venv venv
    source venv/bin/activate
    pip install -r requirements.txt
    cd ..
fi

# Start backend
echo "Starting backend server..."
cd backend
source venv/bin/activate
python3 main_FIXED.py &
BACKEND_PID=$!
cd ..

# Wait for backend to be ready before launching UI
echo "Waiting for backend..."
for i in {1..15}; do
    if curl -s http://127.0.0.1:5001/docs > /dev/null 2>&1; then
        echo "Backend ready."
        break
    fi
    sleep 1
done

# Start Neutralino
echo "Launching TalkingDraft Desktop..."
neu run

# Cleanup when Neutralino closes
echo "Shutting down backend..."
kill $BACKEND_PID 2>/dev/null || true
lsof -ti:5001 | xargs kill -9 2>/dev/null || true

echo "Shutdown complete."
