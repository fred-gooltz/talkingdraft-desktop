#!/bin/bash

cd "$(dirname "$0")"

echo "🔧 Fixing permissions..."

chmod +x Bespoke.command
chmod +x Kill-Backend.command
chmod +x Install-Whisper.command
chmod +x Check-Whisper.command
chmod +x Fix-Permissions.command

echo "✅ All scripts are now executable!"
