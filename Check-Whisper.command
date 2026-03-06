#!/bin/bash

cd "$(dirname "$0")/backend"

echo "🔍 Checking Whisper installation..."
echo ""

source venv/bin/activate

echo "📦 Checking Python packages:"
python3 -c "import whisper; print('✅ Whisper installed:', whisper.__version__)" 2>/dev/null || echo "❌ Whisper NOT installed"
python3 -c "import ffmpeg; print('✅ ffmpeg-python installed')" 2>/dev/null || echo "❌ ffmpeg-python NOT installed"

echo ""
echo "🎬 Checking ffmpeg binary:"
if command -v ffmpeg &> /dev/null; then
    echo "✅ ffmpeg binary installed: $(ffmpeg -version | head -n1)"
else
    echo "❌ ffmpeg binary NOT installed"
fi
