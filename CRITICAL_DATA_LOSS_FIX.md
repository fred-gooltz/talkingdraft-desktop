# 🚨 CRITICAL DATA LOSS BUGS - UPDATED FIX

## Additional Bug Found: Clicking Outside Modal Loses Data

### The Problem:
If you record audio but DON'T hit spacebar to transcribe, then click outside the modal or navigate to another scene, **all your recorded audio is lost forever**.

This happens because `setScene()` clears `sessionBlobs = []` whenever it's called, even if there's unsaved work.

### The Fix:

We need to add **auto-save protection** to prevent accidental data loss.

---

## UPDATED FIX #4: Auto-Save Protection

**File: `resources/js/main.js`**

**Location: Line 469 in `setScene()` function**

**REPLACE THIS:**
```javascript
// Close modal if no scene
if (!scene?.id) {
    this.activeScene = {};
    this.audioURL = '';
    this.sessionBlobs = []; // Clear session blobs when closing
    return; 
}
```

**WITH THIS:**
```javascript
// Close modal if no scene
if (!scene?.id) {
    // ✅ FIX: Warn if there's unsaved work!
    if (this.sessionBlobs.length > 0) {
        const confirmed = confirm(
            `⚠️ WARNING: You have ${this.sessionBlobs.length} unsaved audio recording(s)!\n\n` +
            `If you close now, this work will be LOST.\n\n` +
            `Click "Cancel" to go back and hit SPACEBAR to transcribe.\n` +
            `Click "OK" only if you want to discard this work.`
        );
        
        if (!confirmed) {
            // User wants to go back and save
            return;
        }
        
        console.warn('⚠️  User discarded', this.sessionBlobs.length, 'unsaved audio recordings');
    }
    
    this.activeScene = {};
    this.audioURL = '';
    this.sessionBlobs = [];
    return; 
}
```

---

## UPDATED FIX #5: Auto-Save When Switching Scenes

**File: `resources/js/main.js`**

**Location: Line 484 in `setScene()` function (BEFORE loading new scene)**

**ADD THIS CODE:**
```javascript
this.loading++;
this.activeScene = scene;
this.audioURL = '';

// ✅ FIX: Auto-save any pending session blobs before switching scenes
if (this.sessionBlobs.length > 0 && story?.id) {
    const confirmed = confirm(
        `⚠️ WARNING: The previous scene has ${this.sessionBlobs.length} unsaved audio recording(s)!\n\n` +
        `Do you want to transcribe them now before opening this scene?\n\n` +
        `Click "OK" to transcribe (recommended)\n` +
        `Click "Cancel" to discard them`
    );
    
    if (confirmed) {
        // Save the current scene reference
        const sceneToLoad = scene;
        const idxToLoad = story.scenes.findIndex(s => s.id === scene.id);
        
        // Go back to previous scene to transcribe
        if (this.activeScene?.id) {
            this.activeScene = story.scenes.find(s => s.id === this.activeScene.id);
        }
        
        // Trigger transcription
        await this.batchTranscribeScene(story, this.activeScene);
        
        // Now load the scene they wanted
        this.activeScene = sceneToLoad;
        scene = sceneToLoad;
    } else {
        console.warn('⚠️  User discarded', this.sessionBlobs.length, 'unsaved audio recordings');
        this.sessionBlobs = [];
    }
} else {
    this.sessionBlobs = []; // Safe to clear if empty
}

// Continue with normal scene loading...
```

---

## BETTER SOLUTION: Use the Custom Modal System

Actually, the app already has a custom modal system! Let's use that instead of `confirm()`:

**REPLACE THE CONFIRM DIALOGS ABOVE WITH:**

```javascript
// In setScene() when closing modal:
if (!scene?.id) {
    // ✅ FIX: Warn if there's unsaved work!
    if (this.sessionBlobs.length > 0) {
        this.showConfirmModal(
            '⚠️ Unsaved Audio Recordings',
            `You have ${this.sessionBlobs.length} unsaved audio recording(s). ` +
            `If you close now, this work will be LOST. ` +
            `Go back and hit SPACEBAR to transcribe first.`,
            () => {
                // User confirmed they want to discard
                console.warn('⚠️  User discarded', this.sessionBlobs.length, 'unsaved audio recordings');
                this.activeScene = {};
                this.audioURL = '';
                this.sessionBlobs = [];
            }
        );
        return; // Stay on the scene until user decides
    }
    
    this.activeScene = {};
    this.audioURL = '';
    this.sessionBlobs = [];
    return; 
}
```

---

## Summary of All Fixes Needed:

1. ✅ **Backend error handling** (already created in main_FIXED.py)
2. ✅ **Graceful audio loading** (already in apply_fixes.py)
3. ✅ **Microphone permission fix** (already in apply_fixes.py)
4. ✅ **compileAudio safety check** (already in apply_fixes.py)
5. **NEW: Prevent data loss when closing modal**
6. **NEW: Prevent data loss when switching scenes**

I'll update the `apply_fixes.py` script to include these new fixes.
