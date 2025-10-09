#!/bin/bash

echo "🚀 Installing Whisper for Bespoke Writing Suite"
echo ""

# Navigate to app directory
cd "/Users/FredGooltz/Documents/VIBE CODING EFFORTS/BESPOKE-APP"

# Check if Homebrew is installed
if ! command -v brew &> /dev/null; then
    echo "❌ Homebrew not found!"
    echo "   Install Homebrew first: https://brew.sh"
    echo "   Or run: /bin/bash -c \"\$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)\""
    exit 1
fi

echo "✅ Homebrew found"

# Install ffmpeg (required by Whisper)
echo ""
echo "📦 Installing ffmpeg..."
if brew list ffmpeg &> /dev/null; then
    echo "✅ ffmpeg already installed"
else
    brew install ffmpeg
    echo "✅ ffmpeg installed"
fi

# Activate virtual environment
echo ""
echo "🐍 Setting up Python environment..."
cd backend
source venv/bin/activate

# Install Python dependencies (including Whisper)
echo ""
echo "📦 Installing Whisper and dependencies..."
echo "   This will download ~1.5GB of files (model + dependencies)"
echo "   It may take 5-10 minutes..."
echo ""

pip install --upgrade pip
pip install -r requirements.txt

echo ""
echo "✅ Installation complete!"
echo ""
echo "🎉 Whisper is now installed and ready to use!"
echo ""
echo "Next steps:"
echo "1. Close this window"
echo "2. Open: resources/js/main.js"
echo "3. Change: devMode: true → devMode: false"
echo "4. Launch Bespoke.command"
echo ""
echo "Your app will now use real speech-to-text! 🎤"
