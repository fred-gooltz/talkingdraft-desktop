#!/bin/bash

# TalkingStudio — Quick Start Script

echo "🚀 Starting TalkingStudio..."

cd "$(dirname "$0")"

# Rebuild venv if broken or missing
if [ ! -f "backend/venv/lib/python3.13/site-packages/fastapi/__init__.py" ]; then
    echo "📦 Setting up Python environment..."
    cd backend
    rm -rf venv
    python3 -m venv venv
    source venv/bin/activate
    pip install --quiet fastapi uvicorn python-multipart
    echo "✅ Python environment ready"
    cd ..
else
    echo "✅ Python environment found"
fi

# Start backend
echo "🐍 Starting backend on port 5001..."
cd backend
source venv/bin/activate
python3 main_FIXED.py &
BACKEND_PID=$!
cd ..

# Wait for backend
sleep 2

# Verify backend started
if ! curl -s http://127.0.0.1:5001/health > /dev/null 2>&1; then
    echo "⚠️  Backend may still be starting..."
fi

# Start Neutralino
echo "🖥️  Starting TalkingStudio window..."
neu run

# Cleanup
kill $BACKEND_PID 2>/dev/null
echo "✅ Shutdown complete"
