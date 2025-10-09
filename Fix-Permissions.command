#!/bin/bash

# Fix permissions for executable scripts
cd "/Users/FredGooltz/Documents/VIBE CODING EFFORTS/BESPOKE-APP"

echo "🔧 Fixing permissions..."

chmod +x Bespoke.command
chmod +x Kill-Backend.command
chmod +x Install-Whisper.command
chmod +x Fix-Permissions.command

echo "✅ All scripts are now executable!"
echo ""
echo "You can now double-click:"
echo "  • Bespoke.command (to launch app)"
echo "  • Kill-Backend.command (to kill stuck servers)"
echo "  • Install-Whisper.command (to add real STT)"
