#!/bin/bash

cd "/Users/FredGooltz/Documents/VIBE CODING EFFORTS/BESPOKE-APP/backend"

echo "🔍 Checking Whisper installation..."
echo ""

# Activate venv
source venv/bin/activate

# Check Python packages
echo "📦 Checking Python packages:"
python3 -c "import whisper; print('✅ Whisper installed:', whisper.__version__)" 2>/dev/null || echo "❌ Whisper NOT installed"
python3 -c "import ffmpeg; print('✅ ffmpeg-python installed')" 2>/dev/null || echo "❌ ffmpeg-python NOT installed"

echo ""

# Check ffmpeg binary
echo "🎬 Checking ffmpeg binary:"
if command -v ffmpeg &> /dev/null; then
    echo "✅ ffmpeg binary installed: $(ffmpeg -version | head -n1)"
else
    echo "❌ ffmpeg binary NOT installed"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Determine what needs to be done
WHISPER_INSTALLED=$(python3 -c "import whisper" 2>/dev/null && echo "yes" || echo "no")
FFMPEG_INSTALLED=$(command -v ffmpeg &> /dev/null && echo "yes" || echo "no")

if [ "$WHISPER_INSTALLED" = "yes" ] && [ "$FFMPEG_INSTALLED" = "yes" ]; then
    echo "🎉 READY FOR PRODUCTION!"
    echo ""
    echo "Everything is installed. To enable Whisper:"
    echo "1. Open: resources/js/main.js"
    echo "2. Line 87: Change 'devMode: true,' to 'devMode: false,'"
    echo "3. Save and launch the app"
else
    echo "⚠️  INSTALLATION NEEDED"
    echo ""
    if [ "$FFMPEG_INSTALLED" = "no" ]; then
        echo "Install ffmpeg:"
        echo "  brew install ffmpeg"
        echo ""
    fi
    if [ "$WHISPER_INSTALLED" = "no" ]; then
        echo "Install Whisper:"
        echo "  cd backend"
        echo "  source venv/bin/activate"
        echo "  pip install openai-whisper ffmpeg-python"
        echo ""
    fi
fi
