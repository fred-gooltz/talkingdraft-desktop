# 🎤 Whisper Installation Guide

## What is Whisper?

Whisper is OpenAI's powerful speech-to-text AI. It will replace the mock transcriptions with **real, accurate transcripts** of your recordings.

---

## 📋 Installation Steps (One-Time Setup)

### Step 1: Install Whisper

**Double-click:** `Install-Whisper.command`

This will:
- ✅ Install ffmpeg (audio processing library)
- ✅ Install Whisper Python package
- ✅ Download the Whisper "base" model (~1.5GB)
- ⏱️ Takes ~5-10 minutes

**Just let it run!** You'll see lots of text scrolling - that's normal.

---

### Step 2: Enable Production Mode

1. Open: `resources/js/main.js`
2. Find line ~91: `devMode: true`
3. Change to: `devMode: false`
4. Save the file

---

### Step 3: Done!

Launch the app normally:
- Double-click `Bespoke.command`
- Start recording
- Get **real transcriptions**!

---

## 🎯 How It Works

### With `devMode: true` (Current):
- ❌ Mock transcripts: "The quick brown fox..."
- ⚡ Instant (no processing)
- 📝 Good for testing the app

### With `devMode: false` (After Whisper):
- ✅ Real transcripts of what you actually said
- ⏱️ Takes ~5-30 seconds per scene (depending on length)
- 🎯 Accurate speech-to-text

---

## 📊 Whisper Models (Advanced)

The installer uses the **"base"** model by default:
- Size: ~140MB
- Speed: Fast
- Accuracy: Good for most use cases

**Want better accuracy?** Edit `backend/main.py` line ~53:
```python
WHISPER_MODEL = whisper.load_model("base")  # Change "base" to:
```

Available models:
- `tiny` - Fastest, least accurate (~40MB)
- `base` - **DEFAULT** - Good balance (~140MB)
- `small` - Better accuracy (~500MB)
- `medium` - Very accurate (~1.5GB)
- `large` - Best accuracy (~3GB)

**Note:** Larger models are slower but more accurate.

---

## 🔧 Troubleshooting

### "Homebrew not found"
You need to install Homebrew first:
```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

### "ffmpeg installation failed"
Try manually:
```bash
brew install ffmpeg
```

### "Whisper installation takes forever"
This is normal! It's downloading ~1.5GB of AI models. Be patient.

### "Transcription is slow"
- First transcription loads the model (~30 seconds)
- After that, each scene takes 5-30 seconds depending on length
- Use a smaller model for speed (see "Whisper Models" above)

---

## 📁 What Gets Installed

```
~/Documents/VIBE CODING EFFORTS/BESPOKE-APP/
└── backend/
    └── venv/
        └── lib/
            └── python3.x/
                └── site-packages/
                    ├── whisper/        ← Whisper code
                    └── ...

~/.cache/whisper/
└── base.pt                             ← Whisper model (~140MB)
```

---

## 🎬 Testing It Out

After installation:

1. Set `devMode: false`
2. Launch app
3. Record a short test: "Testing, one, two, three."
4. Wait for transcription (~10 seconds first time)
5. Check the transcript - it should say exactly what you spoke!

---

## 💡 Pro Tips

**Speed up transcription:**
- Use shorter scenes (1-2 minutes each)
- The "base" model is plenty accurate for dialogue
- First transcription is slowest (loading model)

**Improve accuracy:**
- Speak clearly and at normal pace
- Reduce background noise
- Use a good microphone
- Try the "small" or "medium" model

**Save processing time during development:**
- Keep `devMode: true` while writing/outlining
- Switch to `devMode: false` only when recording final dialogue

---

## 🆘 Need Help?

Check the Terminal output when running `Bespoke.command`:
- You'll see: `✅ Whisper loaded - real transcription available`
- Or: `⚠️ Whisper not installed - using mock transcriptions`

This tells you if Whisper is working.

---

**Ready? Run `Install-Whisper.command` now!** 🚀
