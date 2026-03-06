#!/bin/bash

cd "$(dirname "$0")/backend"

echo "🚀 Installing Whisper for TalkingDraft Desktop"
echo ""

source venv/bin/activate

echo "📦 Installing Whisper and dependencies..."
pip install --upgrade pip
pip install -r requirements.txt

echo ""
echo "✅ Whisper installation complete!"
