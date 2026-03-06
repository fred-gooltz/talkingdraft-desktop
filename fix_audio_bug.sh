#!/bin/bash

echo "=========================================="
echo "🔧 APPLYING AUDIO SEGMENT BUG FIXES"
echo "=========================================="

cd "$(dirname "$0")"

# Run the Python fix script
python3 apply_fixes.py

echo ""
echo "Done! Check the output above for results."
