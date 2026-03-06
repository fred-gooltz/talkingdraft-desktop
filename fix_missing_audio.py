#!/usr/bin/env python3
"""
Fix Missing Audio References - Direct Fix for Bespoke App
This script removes references to missing audio files from your story data.
"""

import json
from pathlib import Path
from datetime import datetime
import shutil

# Data directories from your backend/main.py
BASE_DIR = Path.home() / "Documents" / "BespokeData"
STORIES_DIR = BASE_DIR / "stories"
AUDIO_DIR = BASE_DIR / "audio"
BACKUP_DIR = BASE_DIR / "backups" / f"backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}"

def main():
    print("=" * 60)
    print("BESPOKE - FIX MISSING AUDIO REFERENCES")
    print("=" * 60)
    print()
    
    if not STORIES_DIR.exists():
        print(f"❌ ERROR: Stories directory not found: {STORIES_DIR}")
        return
    
    if not AUDIO_DIR.exists():
        print(f"❌ ERROR: Audio directory not found: {AUDIO_DIR}")
        return
    
    # Create backup directory
    BACKUP_DIR.mkdir(parents=True, exist_ok=True)
    print(f"📁 Backup directory: {BACKUP_DIR}")
    print()
    
    total_stories = 0
    stories_modified = 0
    total_tracks_removed = 0
    
    # Process all story files
    for story_file in sorted(STORIES_DIR.glob("*.json")):
        total_stories += 1
        
        try:
            # Read story
            with open(story_file, 'r', encoding='utf-8') as f:
                story = json.load(f)
            
            story_id = story.get('id')
            story_title = story.get('title', 'Untitled')
            audio_story_dir = AUDIO_DIR / str(story_id)
            
            modified = False
            removed_count = 0
            
            # Check each scene
            for scene in story.get('scenes', []):
                original_tracks = scene.get('tracks', [])
                
                # Filter: keep only tracks with existing audio
                valid_tracks = []
                for track in original_tracks:
                    track_id = track.get('id')
                    audio_file = audio_story_dir / f"{track_id}.webm"
                    
                    if audio_file.exists():
                        valid_tracks.append(track)
                    else:
                        removed_count += 1
                
                scene['tracks'] = valid_tracks
                
                if len(valid_tracks) < len(original_tracks):
                    modified = True
            
            if modified:
                # Create backup
                backup_file = BACKUP_DIR / story_file.name
                shutil.copy2(story_file, backup_file)
                
                # Save cleaned version
                with open(story_file, 'w', encoding='utf-8') as f:
                    json.dump(story, f, indent=2, ensure_ascii=False)
                
                print(f"✅ {story_title}")
                print(f"   Removed {removed_count} missing track(s)")
                
                stories_modified += 1
                total_tracks_removed += removed_count
                
        except Exception as e:
            print(f"❌ Error processing {story_file.name}: {e}")
    
    print()
    print("=" * 60)
    print("RESULTS:")
    print("=" * 60)
    print(f"Stories scanned:       {total_stories}")
    print(f"Stories modified:      {stories_modified}")
    print(f"Tracks removed:        {total_tracks_removed}")
    print(f"Backups saved to:      {BACKUP_DIR}")
    print()
    
    if stories_modified > 0:
        print("✅ DONE! Restart your Bespoke app.")
    else:
        print("✅ No issues found!")
    
    print("=" * 60)

if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
