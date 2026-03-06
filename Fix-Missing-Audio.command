#!/bin/bash
# Fix Missing Audio - Easy Runner

cd "$(dirname "$0")"

echo "============================================"
echo "BESPOKE - FIX MISSING AUDIO"
echo "============================================"
echo ""
echo "This will remove references to missing audio files."
echo "Your original files will be backed up first."
echo ""
read -p "Press Enter to continue or Ctrl+C to cancel..."
echo ""

python3 fix_missing_audio.py

echo ""
echo "Done! Close this window and restart your Bespoke app."
read -p "Press Enter to exit..."
