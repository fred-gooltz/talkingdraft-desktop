#!/bin/bash

# Navigate to app directory
cd "/Users/FredGooltz/Documents/VIBE CODING EFFORTS/BESPOKE-APP"

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
python main.py &
BACKEND_PID=$!
cd ..

sleep 2

# Start Neutralino
echo "Launching Bespoke..."
neu run

# Cleanup when Neutralino closes
echo "Shutting down backend..."
kill $BACKEND_PID 2>/dev/null || true

# Double-check port is freed
lsof -ti:5001 | xargs kill -9 2>/dev/null || true

echo "Shutdown complete."
