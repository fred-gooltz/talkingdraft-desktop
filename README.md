# 🎬 Bespoke Writing Suite - Quick Reference

## 🚀 Ready to Use NOW

Your app is **fully functional** right now with mock transcriptions!

**To Launch:**
- Double-click: `Bespoke.command`

**To Shut Down:**
- Close the Terminal window (this stops everything cleanly)

**If Backend Gets Stuck:**
- Double-click: `Kill-Backend.command`

---

## 📚 Documentation

- **HOW_TO_USE.md** - Complete user guide
- **WHISPER_SETUP.md** - Install real speech-to-text *(when ready)*

---

## 🎯 Current Status

### ✅ Working Now:
- Full story outlining & scene management
- Audio recording (high quality 48kHz)
- Character-based dialogue recording
- Keyboard shortcuts (0-9 to switch characters)
- Mock transcriptions (instant fake text)
- Export transcripts
- One-time microphone permission

### 🔜 Ready When You Are:
- **Real Whisper Transcription** - Follow `WHISPER_SETUP.md`

---

## 🎤 Upgrade to Real Transcription

When you're ready for actual speech-to-text:

1. Double-click: `Install-Whisper.command` *(~10 minutes)*
2. Edit `resources/js/main.js`: Change `devMode: true` → `devMode: false`
3. Launch normally with `Bespoke.command`

**See WHISPER_SETUP.md for complete instructions.**

---

## 📁 Your Data

Everything saves to:
```
~/Documents/BespokeData/
├── stories/  ← Story JSON files
└── audio/    ← Audio recordings
```

**Backup tip:** Copy this folder regularly!

---

## 🎨 App Features

- **Logo Header** - Your branding on every screen
- **Favicon Icon** - Shows in dock/taskbar
- **Dark Theme** - Easy on the eyes
- **Keyboard Shortcuts** - Fast workflow
- **Drag & Drop** - Reorder scenes easily
- **Audio Playback** - Review your recordings

---

## 🔧 Troubleshooting

**App won't launch:**
- Run `Kill-Backend.command`
- Try again

**Microphone not working:**
- Allow permission when prompted
- Reload app (Cmd+R)

**Need help?**
- Check Terminal output for errors
- View console: Right-click → Inspect → Console

---

## 📞 Files You Can Double-Click

1. **Bespoke.command** - Launch the app *(use this daily)*
2. **Kill-Backend.command** - Fix stuck servers *(emergency only)*
3. **Install-Whisper.command** - Add real STT *(one-time setup)*

---

**Start creating! Double-click `Bespoke.command` now** 🎬
