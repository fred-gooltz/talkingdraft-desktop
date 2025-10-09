#!/bin/bash

echo "🛑 Killing Bespoke backend servers..."

# Kill anything on port 5001
lsof -ti:5001 | xargs kill -9 2>/dev/null

if [ $? -eq 0 ]; then
    echo "✅ Backend server stopped"
else
    echo "✅ No backend server found (already stopped)"
fi

# Kill any Python processes running main.py
pkill -f "python main.py" 2>/dev/null

echo "✅ Cleanup complete - you can now launch Bespoke again"
