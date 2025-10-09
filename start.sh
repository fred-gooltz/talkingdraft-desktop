#!/bin/bash

# Bespoke App - Quick Start Script with Virtual Environment

echo "🚀 Starting Bespoke Writing Suite..."
echo ""

# Navigate to project root
cd "$(dirname "$0")"

# Check if virtual environment exists, create if not
if [ ! -d "backend/venv" ]; then
    echo "📦 Creating virtual environment..."
    cd backend
    python3 -m venv venv
    source venv/bin/activate
    pip install -r requirements.txt
    echo "✅ Virtual environment created"
    cd ..
else
    echo "✅ Virtual environment found"
fi

# Activate virtual environment and start backend
echo "🐍 Starting Python backend on port 5001..."
cd backend
source venv/bin/activate
python main.py &
BACKEND_PID=$!
cd ..

# Wait for backend to start
sleep 2

# Start Neutralino app
echo "🖥️  Starting Neutralino app..."
neu run

# Cleanup - kill backend when Neutralino closes
kill $BACKEND_PID
echo "✅ Shutdown complete"
