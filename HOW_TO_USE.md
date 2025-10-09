# 🎬 Bespoke Writing Suite - How To Use

## ⚡ Quick Start (Double-Click to Launch)

**Just double-click:** `Bespoke.command`

That's it! This launches everything:
- ✅ Backend server (handles saving your stories)
- ✅ App window (the writing interface)

---

## 🛑 How To Properly Shut Down

### Method 1: Recommended (Automatic Cleanup)
**Close the Terminal window** that opened when you launched `Bespoke.command`
- This closes both the app AND the backend server
- Everything shuts down cleanly

### Method 2: Close App Window
You can close the app window (Cmd+Q or right-click dock → Quit)
- The backend will auto-cleanup when Terminal window closes

### ⚠️ If Backend Gets Stuck

If you get "address already in use" error:
1. Double-click: `Kill-Backend.command`
2. Then launch `Bespoke.command` again

This force-kills any stuck servers.

---

## 📝 How It Works Right Now

### Current State: **DEV MODE** ✅

The app is fully functional with **mock transcriptions**:

1. **Record your dialogue** - Click microphone, speak your lines
2. **Switch characters** - Press 0-9 on keyboard (no error beep!)
3. **Get instant mock transcripts** - When you pause, it transcribes with fake text
4. **Save your stories** - Everything saves to `~/Documents/BespokeData/`

### What's Mocked:
- 🔧 Speech-to-text returns placeholder text like:
  - "This is a mock transcription of the recorded audio."
  - "The quick brown fox jumps over the lazy dog."

### What's Real:
- ✅ Audio recording (high quality, 48kHz)
- ✅ Character switching
- ✅ Story organization
- ✅ Scene management
- ✅ Audio playback
- ✅ Export transcripts

---

## 🎤 Using the App

### Starting a New Story
1. Launch `Bespoke.command`
2. Enter story name
3. Choose structure (Save the Cat, etc.)
4. Set duration (90 minutes default)
5. Click "Create Story"

### Recording Dialogue
1. Click scene → "Talk Your Draft"
2. **First time only:** Allow microphone access
3. Assign character names (click numbered buttons)
4. Click microphone to start recording
5. Press number keys 0-9 to switch between characters
   - **0** = ACTION (scene direction)
   - **1-9** = Character dialogue
6. Click pause when done
7. Wait for "transcription" (instant with mock data)

### Keyboard Shortcuts (While Recording)
- **0-9** = Switch characters (silent, no beep!)
- **Space** = Pause recording
- **Numpad .** = Start/pause recording

---

## 📁 Where Your Data Lives

All stories save to:
```
~/Documents/BespokeData/
├── stories/     (JSON files with your outlines)
└── audio/       (Audio recordings by story)
```

---

## 🚀 When You're Ready for Real Whisper Transcription

### To Enable Real STT:

1. Open: `resources/js/main.js`
2. Find line ~91: `devMode: true`
3. Change to: `devMode: false`
4. Install Whisper on backend (instructions in `BACKEND_API_SPECIFICATION.md`)

### What Changes:
- ❌ Mock transcripts stop
- ✅ Real Whisper transcriptions start
- ⏱️ Slightly slower (processing time)
- 🎯 Much more accurate

---

## 🔧 Troubleshooting

### "Microphone access denied"
- Allow microphone when prompted
- Reload app (Cmd+R in window)

### Backend errors (500)
- Make sure `Bespoke.command` is running
- Check terminal for errors

### No audio playback
- Browser may block autoplay
- Click play button manually

---

## 🎨 App Customization

Your logo is already set!
- Window title: "Bespoke Writing Suite"
- App icon: Your LONG-Logo_mic-white-SMALL.png

---

## 📊 Current Features

✅ **Working Now:**
- Multi-scene story outlining
- Character-based dialogue recording
- Batch transcription (mock mode)
- Audio playback with skip buttons
- Export transcripts
- Drag-and-drop scene reordering
- Character name reuse across scenes

✅ **Keyboard Fixes:**
- Silent character switching
- One-time microphone permission

✅ **Audio Quality:**
- 48kHz sample rate
- 128kbps bitrate
- Noise suppression
- Echo cancellation

---

## 💾 Backup Your Work

Your stories are in:
```
~/Documents/BespokeData/stories/
```

**Backup tip:** Copy this folder to external drive or cloud storage regularly!

---

**Need help?** Check the console (View → Developer → JavaScript Console) for detailed logs.
