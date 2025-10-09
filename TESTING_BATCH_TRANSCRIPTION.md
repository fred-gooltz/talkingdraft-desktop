# Testing Batch Transcription System

## 🔧 Dev Mode is Now Active

The batch transcription system is ready to test with **mock data**. Dev mode is enabled by default in `main.js`.

**What Dev Mode Does:**
- ✅ Saves audio files to backend (so they persist across sessions)
- ✅ Uses mock transcripts instead of calling Whisper
- ✅ Faster iteration for UI/UX development

---

## ✅ What Was Added

### 1. **Dev Mode Flag** (Line 92)
```javascript
devMode: true  // Set to false when backend is ready
```

### 2. **Mock Transcription Function** (Lines 178-203)
This function documents the exact API contract the backend must follow:
```javascript
mockTranscriptionResponse() {
    // Returns fake transcripts in the exact format expected
}
```

### 3. **Console Logging**
Extensive logging throughout the batch process to help you debug and understand the flow.

---

## 🧪 How to Test

### **Step 1: Open Browser Console**
1. Launch the Neutralino app
2. Open Developer Tools (F12 or Cmd+Option+I)
3. Go to Console tab
4. Look for: `🔧 DEV MODE: ENABLED (using mock transcription)`

### **Step 2: Record Some Audio**
1. Create or open a story
2. Click "Talk Your Draft" on any scene
3. Click the microphone to start recording
4. Press number keys (0-9) to switch between characters
5. Click microphone again to pause

### **Step 3: Watch the Console**
You should see detailed logging:

```
✅ Track abc123 added to session (1 total)
📋 Session blobs: [
  { tid: 'abc123', charName: 'JOHN', blobSize: 45678 }
]
```

### **Step 4: Trigger Batch Transcription**
When you click pause (microphone icon), watch for:

```
=== batchTranscribeScene START ===
Session blobs: 3
📋 Blobs to transcribe: [...]
🔧 DEV MODE: Using mock transcription
Progress: 1/3
Progress: 2/3
Progress: 3/3
📝 Using MOCK transcription response
📤 Mock response structure: {...}
📥 Transcription response received: {...}
✅ Track abc123 transcribed: { character: 'JOHN', transcript: '...' }
✅ Session blobs cleared
=== batchTranscribeScene COMPLETE ===
```

---

## 📋 What to Verify in Console

### ✅ **Before Recording**
- [ ] Dev mode enabled message appears
- [ ] `sessionBlobs: []` is empty

### ✅ **During Recording**
- [ ] Each character switch creates a new blob
- [ ] `sessionBlobs` array grows with each recording
- [ ] Blob metadata includes: `tid`, `charName`, `blobSize`

### ✅ **During Transcription**
- [ ] Mode changes to 'transcription'
- [ ] Progress updates appear (1/3, 2/3, 3/3)
- [ ] Mock response structure is logged
- [ ] Each track gets written to scene.tracks
- [ ] Session blobs are cleared at the end

### ✅ **After Transcription**
- [ ] Mode returns to 'setup'
- [ ] Transcripts appear in the UI
- [ ] Audio playback works
- [ ] Session blobs array is empty

---

## 📊 Understanding the API Contract

### **What Frontend Sends** (when devMode = false)

```javascript
FormData {
  cmd: 'batchTranscribe',
  storyId: 'story-123',
  sceneId: 'scene-456',
  count: 3,
  audio_0: Blob,
  tid_0: 'track-abc',
  charName_0: 'JOHN',
  audio_1: Blob,
  tid_1: 'track-def',
  charName_1: 'MARY',
  audio_2: Blob,
  tid_2: 'track-ghi',
  charName_2: 'ACTION'
}
```

### **What Backend Must Return**

```javascript
{
  success: true,
  transcripts: [
    { tid: 'track-abc', transcript: 'Hello, how are you?' },
    { tid: 'track-def', transcript: 'I am doing well, thank you.' },
    { tid: 'track-ghi', transcript: '[John walks to the door]' }
  ]
}
```

**Critical:** 
- Array order must match the order of blobs sent
- Each transcript must include the exact `tid` that was sent
- If no speech detected, return empty string or placeholder text

---

## 🐛 Common Issues to Check

### **Issue: sessionBlobs not populating**
**Check:**
```javascript
console.log('Session blobs:', Alpine.store('ui').sessionBlobs)
```

### **Issue: Transcripts not appearing**
**Check:**
```javascript
console.log('Scene tracks:', Alpine.store('ui').activeScene.tracks)
```

### **Issue: 500 Error when returning to scene**
**This should NOT happen anymore** - audio files are now saved in dev mode.
**If you see this:**
```javascript
// Check if files were actually saved
console.log('Story metadata:', Alpine.store('ui').activeStory)
```

### **Issue: Progress not updating**
**Check:**
```javascript
console.log('Progress:', Alpine.store('ui').transcriptionProgress)
```

---

## 🔄 Switching to Production Mode

When your Python backend is ready:

1. **In `main.js` line 92:**
   ```javascript
   devMode: false  // Switch to real backend
   ```

2. **Console will show:**
   ```
   🎯 PRODUCTION MODE: Calling real backend
   ```

3. **FormData will be sent to:**
   ```javascript
   Alpine.store('utils').apiReq(fd)
   ```

---

## 📝 Next Steps

1. ✅ **Test with mock** - Verify the full flow works
2. ✅ **Document any issues** - Note what doesn't work
3. ✅ **Validate API contract** - Make sure mock response structure is correct
4. ⏭️ **Build Python backend** - Match the documented API contract
5. ⏭️ **Switch to production** - Set `devMode: false`

---

## 💡 Useful Console Commands

While testing, you can inspect state directly:

```javascript
// Check dev mode status
Alpine.store('ui').devMode

// Check current mode
Alpine.store('ui').mode

// Check session blobs
Alpine.store('ui').sessionBlobs

// Check active scene
Alpine.store('ui').activeScene

// Manually trigger transcription (for debugging)
Alpine.store('ui').batchTranscribeScene(
  Alpine.store('ui').activeStory, 
  Alpine.store('ui').activeScene
)
```

---

## 🎯 Success Criteria

The test is successful when:

1. You can record multiple audio segments
2. Session blobs populate correctly
3. Mock transcription runs without errors
4. Transcripts appear in the UI
5. Session blobs are cleared after transcription
6. You can record again immediately

---

**Questions or issues?** Check the console logs first - they're very detailed!
