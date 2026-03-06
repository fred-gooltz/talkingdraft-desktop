#!/usr/bin/env python3
"""
Story Migration Script - Old Firebase App → New Neutralino App
Migrates stories and audio from the old web app to the new desktop app
"""

import json
import shutil
from pathlib import Path
from datetime import datetime

# Source: Old app location
OLD_DATA_DIR = Path("/Users/FredGooltz/Documents/VIBE CODING EFFORTS/current_alpine_app/prod/data/users/BlTOnTDXVJW8Hj70UFW74LSaoHu1")

# Destination: New app location
NEW_DATA_DIR = Path.home() / "Documents" / "BespokeData"
NEW_STORIES_DIR = NEW_DATA_DIR / "stories"
NEW_AUDIO_DIR = NEW_DATA_DIR / "audio"

def setup_directories():
    """Create destination directories"""
    NEW_STORIES_DIR.mkdir(parents=True, exist_ok=True)
    NEW_AUDIO_DIR.mkdir(parents=True, exist_ok=True)
    print(f"✅ Created directories:")
    print(f"   📁 {NEW_STORIES_DIR}")
    print(f"   📁 {NEW_AUDIO_DIR}")

def migrate_stories(dry_run=True):
    """Migrate all stories from old to new format"""
    
    print("\n" + "="*60)
    print("STORY MIGRATION SCRIPT")
    print("="*60)
    print(f"Source: {OLD_DATA_DIR}")
    print(f"Destination: {NEW_DATA_DIR}")
    print("="*60 + "\n")
    
    if dry_run:
        print("🔍 DRY RUN MODE - No files will be modified")
        print("   Run with dry_run=False to actually migrate\n")
    
    # Find all story files
    story_files = list(OLD_DATA_DIR.glob("STORY-*.json"))
    
    if not story_files:
        print("❌ No story files found!")
        return
    
    print(f"📚 Found {len(story_files)} stories to migrate\n")
    
    migrated_count = 0
    skipped_count = 0
    error_count = 0
    
    for story_file in story_files:
        try:
            # Extract story ID from filename: STORY-{id}.json → {id}
            story_id = story_file.stem.replace("STORY-", "")
            
            print(f"📖 Processing: {story_file.name}")
            
            # Load story JSON
            with open(story_file, 'r') as f:
                story_data = json.load(f)
            
            story_name = story_data.get('name', 'Untitled')
            scene_count = len(story_data.get('scenes', []))
            
            print(f"   Title: {story_name}")
            print(f"   ID: {story_id}")
            print(f"   Scenes: {scene_count}")
            
            # Check if story already exists in new location
            new_story_file = NEW_STORIES_DIR / f"{story_id}.json"
            if new_story_file.exists() and not dry_run:
                print(f"   ⚠️  Story already exists - skipping")
                skipped_count += 1
                print()
                continue
            
            # Count audio files to migrate
            audio_files_to_migrate = []
            for scene in story_data.get('scenes', []):
                for tid in scene.get('trackOrder', []):
                    # Old format: audio/{storyId}-{sceneId}-{trackId}.webm
                    old_audio_path = OLD_DATA_DIR / "audio" / f"{story_id}-{scene['id']}-{tid}.webm"
                    if old_audio_path.exists():
                        audio_files_to_migrate.append((old_audio_path, tid))
            
            print(f"   🎵 Audio files: {len(audio_files_to_migrate)}")
            
            if not dry_run:
                # Copy story JSON
                with open(new_story_file, 'w') as f:
                    json.dump(story_data, f, indent=2)
                print(f"   ✅ Copied story JSON")
                
                # Create audio directory for this story
                story_audio_dir = NEW_AUDIO_DIR / story_id
                story_audio_dir.mkdir(exist_ok=True)
                
                # Copy audio files
                audio_copied = 0
                for old_audio, tid in audio_files_to_migrate:
                    new_audio = story_audio_dir / f"{tid}.webm"
                    shutil.copy2(old_audio, new_audio)
                    audio_copied += 1
                
                print(f"   ✅ Copied {audio_copied} audio files")
                migrated_count += 1
            else:
                print(f"   [DRY RUN] Would copy story + {len(audio_files_to_migrate)} audio files")
                migrated_count += 1
            
            print()
            
        except Exception as e:
            print(f"   ❌ ERROR: {e}")
            error_count += 1
            print()
    
    # Summary
    print("\n" + "="*60)
    print("MIGRATION SUMMARY")
    print("="*60)
    print(f"✅ Migrated: {migrated_count} stories")
    if skipped_count > 0:
        print(f"⚠️  Skipped: {skipped_count} stories (already exist)")
    if error_count > 0:
        print(f"❌ Errors: {error_count} stories")
    print("="*60 + "\n")
    
    if dry_run:
        print("🔍 This was a DRY RUN - no files were actually migrated")
        print("💡 To actually migrate, run: migrate_stories(dry_run=False)")
    else:
        print("✅ Migration complete!")
        print(f"\n📁 Your stories are now in: {NEW_STORIES_DIR}")
        print(f"🎵 Your audio is now in: {NEW_AUDIO_DIR}")
        print("\n🚀 You can now open the Bespoke app and see your stories!")

def create_backup():
    """Create a backup of the new data directory before migration"""
    if NEW_DATA_DIR.exists():
        backup_dir = NEW_DATA_DIR.parent / f"BespokeData_backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        print(f"💾 Creating backup: {backup_dir}")
        shutil.copytree(NEW_DATA_DIR, backup_dir)
        print(f"✅ Backup created")
        return backup_dir
    return None

if __name__ == "__main__":
    import sys
    
    print("\n🎬 BESPOKE STORY MIGRATION TOOL\n")
    
    # Check if source directory exists
    if not OLD_DATA_DIR.exists():
        print(f"❌ Source directory not found: {OLD_DATA_DIR}")
        sys.exit(1)
    
    # Setup destination directories
    setup_directories()
    
    # Run in dry-run mode first
    print("\n" + "="*60)
    print("STEP 1: DRY RUN (Preview)")
    print("="*60)
    migrate_stories(dry_run=True)
    
    # Ask user to confirm
    print("\n" + "="*60)
    response = input("\n🤔 Do you want to proceed with the actual migration? (yes/no): ").strip().lower()
    
    if response in ['yes', 'y']:
        # Create backup if data exists
        if NEW_DATA_DIR.exists() and list(NEW_STORIES_DIR.glob("*.json")):
            create_backup()
        
        # Run actual migration
        print("\n" + "="*60)
        print("STEP 2: ACTUAL MIGRATION")
        print("="*60)
        migrate_stories(dry_run=False)
    else:
        print("\n❌ Migration cancelled by user")
