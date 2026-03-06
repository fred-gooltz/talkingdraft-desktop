#!/usr/bin/env python3
"""
Diagnostic script to check Bespoke app data directories
"""

import os
from pathlib import Path
import json

# Check data directory
BASE_DIR = Path.home() / "Documents" / "BespokeData"
STORIES_DIR = BASE_DIR / "stories"
AUDIO_DIR = BASE_DIR / "audio"

print("="*60)
print("BESPOKE APP - DIRECTORY DIAGNOSTIC")
print("="*60)

print(f"\n📁 Base directory: {BASE_DIR}")
print(f"   Exists: {BASE_DIR.exists()}")
if BASE_DIR.exists():
    print(f"   Writable: {os.access(BASE_DIR, os.W_OK)}")
    print(f"   Readable: {os.access(BASE_DIR, os.R_OK)}")

print(f"\n📚 Stories directory: {STORIES_DIR}")
print(f"   Exists: {STORIES_DIR.exists()}")
if STORIES_DIR.exists():
    print(f"   Writable: {os.access(STORIES_DIR, os.W_OK)}")
    print(f"   Readable: {os.access(STORIES_DIR, os.R_OK)}")
    
    # Count stories
    story_files = list(STORIES_DIR.glob("*.json"))
    print(f"   Stories found: {len(story_files)}")
    
    if story_files:
        print(f"\n   📖 Story list:")
        for story_file in story_files[:10]:  # Show first 10
            try:
                with open(story_file, 'r') as f:
                    story_data = json.load(f)
                    print(f"      - {story_data.get('name', 'Untitled')} ({story_file.name})")
            except Exception as e:
                print(f"      - ERROR reading {story_file.name}: {e}")

print(f"\n🎵 Audio directory: {AUDIO_DIR}")
print(f"   Exists: {AUDIO_DIR.exists()}")
if AUDIO_DIR.exists():
    print(f"   Writable: {os.access(AUDIO_DIR, os.W_OK)}")
    print(f"   Readable: {os.access(AUDIO_DIR, os.R_OK)}")
    
    # Count audio subdirectories
    audio_dirs = [d for d in AUDIO_DIR.iterdir() if d.is_dir()]
    print(f"   Story audio folders: {len(audio_dirs)}")

print("\n" + "="*60)
print("FIXES")
print("="*60)

# Create directories if they don't exist
if not BASE_DIR.exists():
    print(f"\n❌ Base directory doesn't exist")
    print(f"   Creating: {BASE_DIR}")
    BASE_DIR.mkdir(parents=True, exist_ok=True)
    print(f"   ✅ Created")

if not STORIES_DIR.exists():
    print(f"\n❌ Stories directory doesn't exist")
    print(f"   Creating: {STORIES_DIR}")
    STORIES_DIR.mkdir(parents=True, exist_ok=True)
    print(f"   ✅ Created")

if not AUDIO_DIR.exists():
    print(f"\n❌ Audio directory doesn't exist")
    print(f"   Creating: {AUDIO_DIR}")
    AUDIO_DIR.mkdir(parents=True, exist_ok=True)
    print(f"   ✅ Created")

# Check permissions
if BASE_DIR.exists():
    if not os.access(BASE_DIR, os.W_OK):
        print(f"\n❌ Base directory not writable!")
        print(f"   Run: chmod -R u+w '{BASE_DIR}'")
    if not os.access(STORIES_DIR, os.W_OK):
        print(f"\n❌ Stories directory not writable!")
        print(f"   Run: chmod -R u+w '{STORIES_DIR}'")
    if not os.access(AUDIO_DIR, os.W_OK):
        print(f"\n❌ Audio directory not writable!")
        print(f"   Run: chmod -R u+w '{AUDIO_DIR}'")

print("\n" + "="*60)
print("✅ Diagnostic complete")
print("="*60)
print("\nIf all directories exist and are writable, the app should work.")
print("If you still have issues, check the backend logs for errors.\n")
