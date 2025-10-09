# 🎯 TESTING CHECKLIST - Do This Now!

## ✅ Step-by-Step Testing Guide

### 1. Start the Backend (Terminal 1)
```bash
cd "/Users/FredGooltz/Documents/VIBE CODING EFFORTS/BESPOKE-APP/backend"
python3 main.py
```

**Expected output:**
```
INFO:     Started server process
INFO:     Uvicorn running on http://127.0.0.1:5001
```

✅ **Leave this terminal open!**

---

### 2. Start the App (Terminal 2 - NEW)
```bash
cd "/Users/FredGooltz/Documents/VIBE CODING EFFORTS/BESPOKE-APP"
neu run
```

**Expected:** Neutralino window opens

---

### 3. Create Your First Story

✅ App shows "Start a New Story" screen
✅ Enter story name: `Test Story`
✅ Select structure: `Save the Cat`
✅ Minutes: `90`
✅ Click **Create Story**

**Expected:** Story screen opens with sections

---

### 4. Add a Scene

✅ Click **"Add Scene"** button in first section
✅ Scene modal opens
✅ Scene name shows: `EXT. LOCATION-1`

---

### 5. Set Up Characters

✅ Click numbered button `1`
✅ Enter character name: `JOHN`
✅ Click Save
✅ Button now shows `JOHN`

✅ Repeat for button `2`: `MARY`

---

### 6. Test Recording

✅ Click **microphone icon** (bottom right)
✅ **Expected:** 
   - Timer starts: `00:00`
   - Progress bar appears
   - Pause icon shows (green)

✅ Click `JOHN` button (or press `1`)
✅ Speak: "Hello, how are you?"
✅ Click `MARY` button (or press `2`)  
✅ Speak: "I'm doing great!"

---

### 7. Test Batch Transcription

✅ Click **pause icon** (to stop recording)

**Expected sequence:**
1. Timer stops
2. Shows: `TRANSCRIPTION IN PROGRESS...` (animated)
3. Backend terminal shows API request
4. After ~2 seconds: Audio player appears
5. Transcripts show `[Whisper transcription pending - track 0]` etc.

---

### 8. Check Transcript

✅ Click **"Show Transcript"** button

**Expected:**
- Scene name at top
- Tracks listed:
  - `JOHN`
  - `[Whisper transcription pending - track 0]`
  - `MARY`
  - `[Whisper transcription pending - track 1]`

---

### 9. Verify Data Storage

```bash
ls ~/Documents/BespokeData/stories/
ls ~/Documents/BespokeData/audio/
```

**Expected:**
- One `.json` file in stories/
- One folder in audio/ with `.webm` files

---

### 10. Test Story List

✅ Click story name (top left)
✅ Dropdown shows your story
✅ Click **"New Story"** 
✅ Can create another story

---

## 🐛 Common Issues & Fixes

### Issue: Blue screen
**Fix:** 
- Check backend is running (Terminal 1)
- Right-click app → Inspect → Check Console tab

### Issue: "API request failed"
**Fix:**
- Verify `http://localhost:5001/docs` works in browser
- Restart backend

### Issue: No audio saves
**Fix:**
- Check mic permissions
- Check browser console

### Issue: Transcription doesn't complete
**Expected!** Whisper not integrated yet
- Should show placeholder text
- Backend logs should show request

---

## ✨ Success Criteria

Your app is working if:
- ✅ No blue screen
- ✅ Can create stories
- ✅ Recording UI works (timer, buttons)
- ✅ Tracks queue with "Pending Whisper..."
- ✅ Batch request sent when paused
- ✅ Audio player appears
- ✅ Files saved in ~/Documents/BespokeData/

---

## 📸 Take Screenshots

If everything works, take screenshots of:
1. Story dashboard
2. Recording in progress (timer active)
3. Transcription in progress message
4. Transcript view with pending tracks

---

## 🚨 If Something Breaks

1. **Check both terminals** for errors
2. **Check browser console** (right-click → Inspect)
3. **Restart everything:**
   ```bash
   # Kill both terminals (Ctrl+C)
   # Start backend again (Terminal 1)
   # Start app again (Terminal 2)
   ```

---

## 🎉 Next After Testing

Once basic flow works:
1. **Implement Whisper** - Replace placeholder in backend
2. **Test story migration** - Switch between structures
3. **Use Windsurf** - Add more features with IDE AI

---

**GO TEST IT NOW! 🚀**
