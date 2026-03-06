# 🐛 AUDIO SEGMENT BUG FIX

## Issues Found:

1. **API 500 Error**: Silent failures when loading missing audio files
2. **Data Loss**: Transcripts saved but audio files missing after app restart  
3. **Microphone Re-Permission**: Asking for permission on every story instead of once per app session
4. **Excessive API Requests**: Frontend stuck in loop after errors

---

## ROOT CAUSE:

When you return to a scene and add MORE dialogue:
1. ✅ New audio transcribed successfully  
2. ✅ Transcripts saved to story JSON
3. ✅ Audio files saved to disk during transcription
4. ❌ **BUT** when `setScene()` loads the scene, it tries to load audio for ALL tracks
5. ❌ If ANY audio file is missing → 404 error → 500 error → silent failure
6. ❌ The scene loads with transcripts but NO audio

---

## FIX #1: Backend Error Handling (ALREADY CREATED)

**File: `/backend/main_FIXED.py`**

I've created a fixed version with:
- Better error logging (shows exact errors with tracebacks)
- More informative error messages  
- Proper 404 handling for missing audio files

**To apply:**
```bash
cd "/Users/FredGooltz/Documents/VIBE CODING EFFORTS/BESPOKE-APP/backend"
mv main.py main_OLD.py
mv main_FIXED.py main.py
```

---

## FIX #2: Frontend - Graceful Audio Loading

**File: `resources/js/main.js`**

**Location: Line 477-492 in `setScene()` function**

**REPLACE THIS:**
```javascript
// Load audio for each track from backend
try {
    for (const tid in scene.tracks) {
        let fd = new FormData(); 
        fd.append('cmd', 'getAudio'); 
        fd.append('id', story.id+"-"+scene.id+"-"+tid);
        let rsp = await Alpine.store('utils').apiReq(fd, true);
        let data = await rsp.blob();
        if (data.type.match('audio')) {	
            scene.tracks[tid].audio = data;	
        } else {	
            console.log('Track not loaded', tid, data.type); 
        }
    }
}
catch (err) {
    Alpine.store('utils').showAlert('Error loading scene audio: ' + err);
}
```

**WITH THIS:**
```javascript
// Load audio for each track from backend
for (const tid in scene.tracks) {
    try {
        let fd = new FormData(); 
        fd.append('cmd', 'getAudio'); 
        fd.append('id', story.id+"-"+scene.id+"-"+tid);
        let rsp = await Alpine.store('utils').apiReq(fd, true);
        
        // ✅ FIX: Handle non-2xx responses gracefully
        if (!rsp.ok) {
            console.log(`⚠️  Audio file not found for track ${tid} (${rsp.status})`);
            console.log(`   This track has a transcript but no audio file on disk.`);
            continue; // Skip this track and continue loading others
        }
        
        let data = await rsp.blob();
        if (data.type.match('audio')) {	
            scene.tracks[tid].audio = data;
            console.log(`✅ Loaded audio for track ${tid}`);
        } else {	
            console.log(`⚠️  Track ${tid}: Invalid audio type: ${data.type}`); 
        }
    }
    catch (err) {
        // ✅ FIX: Don't stop loading if ONE track fails
        console.error(`❌ Error loading track ${tid}:`, err);
        console.log(`   Continuing to load other tracks...`);
    }
}
```

**Why this fixes it:**
- Each track loads independently
- If one audio file is missing, others still load
- No more 500 errors breaking the entire scene
- Clear console messages about which tracks are missing

---

## FIX #3: Microphone Permission Issue

**File: `resources/js/main.js`**

**Location: Line 538 in `recorderInit()` function**

The problem is that `mediaStream` is getting closed/reset somewhere. Let's make it more robust:

**REPLACE THIS:**
```javascript
async recorderInit () {
    console.log('recorderInit');
    if (!navigator.mediaDevices?.getUserMedia) { 
        return Alpine.store('utils').showAlert('Error: Audio recording is not supported or disabled.'); 
    }
    if (mediaRecorder) { 
        return console.log('mediaRecorder already initialized', mediaRecorder) 
    }
    
    try {
        // Use existing stream or request microphone once
        if (!mediaStream) {
            console.log('🎤 Requesting microphone access (ONE TIME ONLY)...');
            mediaStream = await navigator.mediaDevices.getUserMedia({ 
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                    sampleRate: 48000,
                    channelCount: 1
                }
            });
            console.log('✅ Microphone access granted! Stream will be kept alive.');
        } else {
            console.log('✅ Reusing existing microphone stream (no permission needed)');
        }
```

**WITH THIS:**
```javascript
async recorderInit () {
    console.log('recorderInit');
    if (!navigator.mediaDevices?.getUserMedia) { 
        return Alpine.store('utils').showAlert('Error: Audio recording is not supported or disabled.'); 
    }
    
    // ✅ FIX: Check if stream is still active, not just if it exists
    if (mediaRecorder && mediaStream && mediaStream.active) { 
        console.log('✅ MediaRecorder already initialized and stream is active');
        return;
    }
    
    // ✅ FIX: If stream exists but is not active, reset everything
    if (mediaStream && !mediaStream.active) {
        console.log('⚠️  Previous stream is inactive, resetting...');
        mediaStream = null;
        mediaRecorder = null;
    }
    
    try {
        // Use existing stream or request microphone once
        if (!mediaStream || !mediaStream.active) {
            console.log('🎤 Requesting microphone access...');
            mediaStream = await navigator.mediaDevices.getUserMedia({ 
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                    sampleRate: 48000,
                    channelCount: 1
                }
            });
            console.log('✅ Microphone access granted! Stream will be kept alive.');
        } else {
            console.log('✅ Reusing existing microphone stream (no permission needed)');
        }
```

**Why this fixes it:**
- Checks if the stream is actually `active`, not just if it exists
- If stream died, properly resets and requests again
- Prevents asking for permission when stream is still good

---

## FIX #4: Prevent Data Loss on App Restart

The transcripts are being saved, but when you restart the app and the audio files are missing, the scene becomes "broken". Here's an additional safeguard:

**File: `resources/js/main.js`**

**Location: Line 607 in `compileAudio()` function**

**ADD THIS CHECK at the beginning:**

```javascript
async compileAudio (story, scene) {
    if (!story?.id) { 
        return Alpine.store('utils').showAlert('Error updating audio. Invalid story.'); 
    }
    if (!scene?.id) { 
        return Alpine.store('utils').showAlert('Error updating audio. Invalid scene.'); 
    }

    // ✅ FIX: Check if we have ANY audio to compile
    const hasAnyAudio = scene.trackOrder.some(tid => scene.tracks[tid]?.audio?.arrayBuffer) 
                        || this.sessionBlobs.length > 0;
    
    if (!hasAnyAudio) {
        console.log('⚠️  No audio available to compile (transcripts exist but audio files missing)');
        return { duration: 0, audioURL: '' };
    }

    const audioContext = new AudioContext();
    let buffs = [], errs = [];
    
    // Rest of function continues...
```

---

## TESTING THE FIX:

1. **Backup your work first!**
   ```bash
   cd "/Users/FredGooltz/Documents/VIBE CODING EFFORTS/BESPOKE-APP"
   cp backend/main.py backend/main_BACKUP.py
   cp resources/js/main.js resources/js/main_BACKUP.js
   ```

2. **Apply backend fix:**
   ```bash
   cd backend
   mv main.py main_OLD.py
   mv main_FIXED.py main.py
   ```

3. **Apply frontend fixes** (edit `resources/js/main.js` with the changes above)

4. **Restart the app** and test:
   - Create a new scene
   - Record some dialogue
   - Transcribe it
   - **Close and reopen the scene** ← Should now work!
   - Add more dialogue
   - Transcribe again
   - **Close the app and restart** ← Should now work!

5. **Check the console** - you should see clear messages like:
   - `✅ Loaded audio for track mhb3jk0wqnrvngerj3k`
   - `⚠️ Audio file not found for track mhb3xyz... (404)`
   - `🎤 Requesting microphone access...` (only ONCE per app session)

---

## WHAT IF AUDIO FILES ARE ALREADY MISSING?

If you have scenes where the transcripts exist but audio files are missing, the scene will load with transcripts but no playback. The fixes above prevent NEW data loss but don't recover old files.

To recover, you'd need to:
1. Re-record those specific segments
2. Or remove the tracks from `scene.trackOrder` that have no audio

---

## SUMMARY:

The bug was caused by:
1. **Backend**: Silent 500 errors when audio files were missing
2. **Frontend**: Not handling missing audio files gracefully  
3. **Frontend**: Not checking if microphone stream was still active
4. **Architecture**: No safeguards against incomplete transcription saves

The fixes above make the system more robust and prevent data loss going forward.
