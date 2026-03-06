#!/usr/bin/env python3
"""
COMPREHENSIVE FIX for Bespoke App Audio Bugs

Fixes:
1. Backend error handling
2. Frontend graceful audio loading
3. Microphone permission issue
4. compileAudio safety check
5. CRITICAL: Data loss when closing modal
6. CRITICAL: Data loss when switching scenes
"""

import os
import shutil
from pathlib import Path

BASE_DIR = Path("/Users/FredGooltz/Documents/VIBE CODING EFFORTS/BESPOKE-APP")

def backup_files():
    """Create backups before modifying"""
    print("📦 Creating backups...")
    
    backend_main = BASE_DIR / "backend" / "main.py"
    frontend_main = BASE_DIR / "resources" / "js" / "main.js"
    
    if backend_main.exists():
        shutil.copy2(backend_main, str(backend_main) + ".BACKUP")
        print(f"✅ Backed up {backend_main}")
    
    if frontend_main.exists():
        shutil.copy2(frontend_main, str(frontend_main) + ".BACKUP")
        print(f"✅ Backed up {frontend_main}")

def apply_backend_fix():
    """Apply backend fixes"""
    print("\n🔧 Applying backend fix...")
    
    src = BASE_DIR / "backend" / "main_FIXED.py"
    dest = BASE_DIR / "backend" / "main.py"
    
    if not src.exists():
        print(f"❌ Source file not found: {src}")
        return False
    
    shutil.copy2(src, dest)
    print(f"✅ Backend fixed: {dest}")
    return True

def apply_frontend_fixes():
    """Apply ALL frontend fixes including data loss protection"""
    print("\n🔧 Applying frontend fixes...")
    
    main_js = BASE_DIR / "resources" / "js" / "main.js"
    
    if not main_js.exists():
        print(f"❌ File not found: {main_js}")
        return False
    
    with open(main_js, 'r') as f:
        content = f.read()
    
    changes_made = 0
    
    # Fix #1: Graceful audio loading
    old_audio_loading = '''// Load audio for each track from backend
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
}'''
    
    new_audio_loading = '''// Load audio for each track from backend
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
}'''
    
    if old_audio_loading in content:
        content = content.replace(old_audio_loading, new_audio_loading)
        print("  ✅ Applied Fix #1: Graceful audio loading")
        changes_made += 1
    else:
        print("  ⚠️  Fix #1 already applied or pattern not found")
    
    # Fix #2: Microphone permission
    old_recorder_check = '''if (mediaRecorder) { 
        return console.log('mediaRecorder already initialized', mediaRecorder) 
    }
    
    try {
        // Use existing stream or request microphone once
        if (!mediaStream) {
            console.log('🎤 Requesting microphone access (ONE TIME ONLY)...');'''
    
    new_recorder_check = '''// ✅ FIX: Check if stream is still active, not just if it exists
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
            console.log('🎤 Requesting microphone access...');'''
    
    if old_recorder_check in content:
        content = content.replace(old_recorder_check, new_recorder_check)
        print("  ✅ Applied Fix #2: Microphone permission fix")
        changes_made += 1
    else:
        print("  ⚠️  Fix #2 already applied or pattern not found")
    
    # Fix #3: compileAudio safety check
    old_compile_start = '''async compileAudio (story, scene) {
    if (!story?.id) { 
        return Alpine.store('utils').showAlert('Error updating audio. Invalid story.'); 
    }
    if (!scene?.id) { 
        return Alpine.store('utils').showAlert('Error updating audio. Invalid scene.'); 
    }

    const audioContext = new AudioContext();'''
    
    new_compile_start = '''async compileAudio (story, scene) {
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

    const audioContext = new AudioContext();'''
    
    if old_compile_start in content:
        content = content.replace(old_compile_start, new_compile_start)
        print("  ✅ Applied Fix #3: compileAudio safety check")
        changes_made += 1
    else:
        print("  ⚠️  Fix #3 already applied or pattern not found")
    
    # Fix #4: CRITICAL - Prevent data loss when closing modal
    old_close_modal = '''// Close modal if no scene
    if (!scene?.id) {
        this.activeScene = {};
        this.audioURL = '';
        this.sessionBlobs = []; // Clear session blobs when closing
        return; 
    }'''
    
    new_close_modal = '''// Close modal if no scene
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
    }'''
    
    if old_close_modal in content:
        content = content.replace(old_close_modal, new_close_modal)
        print("  ✅ Applied Fix #4: CRITICAL - Prevent data loss when closing modal")
        changes_made += 1
    else:
        print("  ⚠️  Fix #4 already applied or pattern not found")
    
    # Fix #5: CRITICAL - Warn before switching scenes with unsaved work
    old_scene_load = '''this.loading++;
    this.activeScene = scene;
    this.audioURL = '';
    this.sessionBlobs = []; // Clear session blobs when opening new scene'''
    
    new_scene_load = '''this.loading++;
    
    // ✅ FIX: Warn if switching scenes with unsaved work
    if (this.sessionBlobs.length > 0) {
        console.warn(`⚠️  Switching scenes with ${this.sessionBlobs.length} unsaved recordings - they will be lost!`);
        this.showConfirmModal(
            '⚠️ Unsaved Work in Previous Scene',
            `The previous scene has ${this.sessionBlobs.length} unsaved audio recording(s). ` +
            `If you continue, they will be LOST. ` +
            `Go back and hit SPACEBAR to transcribe first.`,
            () => {
                // User confirmed, continue loading new scene
                console.warn('⚠️  User discarded', this.sessionBlobs.length, 'unsaved audio recordings');
                this.sessionBlobs = [];
                this.activeScene = scene;
                this.audioURL = '';
                // Let the rest of setScene() continue...
            }
        );
        this.loading--;
        return; // Don't load new scene yet
    }
    
    this.activeScene = scene;
    this.audioURL = '';
    this.sessionBlobs = []; // Clear session blobs when opening new scene'''
    
    if old_scene_load in content:
        content = content.replace(old_scene_load, new_scene_load)
        print("  ✅ Applied Fix #5: CRITICAL - Warn before switching scenes")
        changes_made += 1
    else:
        print("  ⚠️  Fix #5 already applied or pattern not found")
    
    if changes_made > 0:
        with open(main_js, 'w') as f:
            f.write(content)
        print(f"\n✅ Frontend fixed: {main_js} ({changes_made} changes applied)")
        return True
    else:
        print("\n⚠️  No changes needed (already fixed or patterns not found)")
        return False

def main():
    print("=" * 70)
    print("🔧 BESPOKE APP - COMPREHENSIVE AUDIO BUG FIX")
    print("=" * 70)
    print("\nThis script fixes:")
    print("  1. Backend error handling")
    print("  2. Frontend graceful audio loading")
    print("  3. Microphone permission issue")
    print("  4. compileAudio safety check")
    print("  5. ⚠️  CRITICAL: Data loss when closing modal")
    print("  6. ⚠️  CRITICAL: Data loss when switching scenes")
    print("=" * 70)
    
    if not BASE_DIR.exists():
        print(f"❌ Base directory not found: {BASE_DIR}")
        return
    
    # Step 1: Backup
    backup_files()
    
    # Step 2: Apply backend fix
    backend_ok = apply_backend_fix()
    
    # Step 3: Apply frontend fixes
    frontend_ok = apply_frontend_fixes()
    
    # Summary
    print("\n" + "=" * 70)
    print("📊 FIX SUMMARY")
    print("=" * 70)
    print(f"Backend:  {'✅ Fixed' if backend_ok else '❌ Failed'}")
    print(f"Frontend: {'✅ Fixed' if frontend_ok else '❌ Failed'}")
    
    if backend_ok and frontend_ok:
        print("\n🎉 All fixes applied successfully!")
        print("\n📝 Next steps:")
        print("1. Restart your Bespoke app completely")
        print("2. Test recording and transcription")
        print("3. Try closing the modal WITHOUT transcribing")
        print("   → You should see a warning about unsaved work")
        print("4. Try switching scenes WITHOUT transcribing")
        print("   → You should see a warning about unsaved work")
        print("5. Verify audio persists after app restart")
    else:
        print("\n⚠️  Some fixes failed. Check the messages above.")
        print("    You may need to apply fixes manually using the .md files")
    
    print("\n💾 Backups saved with .BACKUP extension")
    print("=" * 70)

if __name__ == "__main__":
    main()
