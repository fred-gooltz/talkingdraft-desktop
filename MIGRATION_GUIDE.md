# Story Migration Guide

## Overview

This guide explains how to migrate your stories from the old Firebase web app to the new Neutralino desktop app.

## Why Store Data Outside the App?

✅ **YES! This is the right approach!** Here's why:

### Benefits of External Data Storage

1. **App Updates Won't Delete Your Data**
   - When you update the app, your stories stay safe
   - Can delete/reinstall app without losing work

2. **Easy Backups**
   - Just backup `~/Documents/BespokeData/`
   - Can use Time Machine, Dropbox, etc.

3. **Data Portability**
   - Can share stories between computers
   - Easy to export/import

4. **Standard Practice**
   - VS Code stores settings in `~/.vscode/`
   - Obsidian stores vaults in `~/Documents/`
   - This is how professional apps work

5. **User Control**
   - You can browse your stories as plain JSON files
   - Can manually backup/restore specific stories
   - No vendor lock-in

## Data Structure Comparison

### Old System (Firebase Web App)
```
/current_alpine_app/prod/data/users/{userId}/
├── STORY-1658538526796390992.json
├── STORY-1680132660531383732.json
└── audio/
    ├── 1658538526796390992-1658963493368494270-mgeg0t87upz99go0rq.webm
    └── 1658538526796390992-1658963493368494270-mgeg0t88zolmfysy8kc.webm
```

### New System (Neutralino Desktop App)
```
~/Documents/BespokeData/
├── stories/
│   ├── 1658538526796390992.json
│   └── 1680132660531383732.json
└── audio/
    ├── 1658538526796390992/
    │   ├── mgeg0t87upz99go0rq.webm
    │   └── mgeg0t88zolmfysy8kc.webm
    └── 1680132660531383732/
        └── ...
```

## Good News!

✅ **The JSON structure is identical!** - No data transformation needed
✅ **Audio format is the same!** - WebM files work as-is
✅ **Story IDs are preserved!** - No ID conflicts

## Migration Options

### Option 1: Automated Migration Script (RECOMMENDED)

Use the Python script I created:

```bash
cd "/Users/FredGooltz/Documents/VIBE CODING EFFORTS/BESPOKE-APP"
python3 migrate_stories.py
```

**What it does:**
1. Shows you a preview (dry run)
2. Asks for confirmation
3. Creates a backup of existing data
4. Migrates all stories and audio
5. Shows detailed progress

**Safe features:**
- Dry run first (no changes)
- Creates automatic backups
- Skips already-migrated stories
- Detailed error reporting

### Option 2: Manual Migration

If you prefer to do it manually:

1. **Copy story files:**
   ```bash
   cd "/Users/FredGooltz/Documents/VIBE CODING EFFORTS/current_alpine_app/prod/data/users/BlTOnTDXVJW8Hj70UFW74LSaoHu1"
   
   # Copy each story, renaming from STORY-{id}.json to {id}.json
   cp STORY-1658538526796390992.json ~/Documents/BespokeData/stories/1658538526796390992.json
   ```

2. **Reorganize audio:**
   ```bash
   # For each story, create audio directory and copy files
   mkdir -p ~/Documents/BespokeData/audio/1658538526796390992
   
   # Copy audio files, extracting trackId from filename
   # Old: {storyId}-{sceneId}-{trackId}.webm
   # New: {storyId}/{trackId}.webm
   ```

This is tedious with 17 stories, so I recommend the script!

## Step-by-Step Migration

### Step 1: Backup Your Old Data (Safety First!)

```bash
cd "/Users/FredGooltz/Documents/VIBE CODING EFFORTS"
cp -r current_alpine_app/prod/data/users/BlTOnTDXVJW8Hj70UFW74LSaoHu1 current_alpine_app_BACKUP_$(date +%Y%m%d)
```

### Step 2: Run the Migration Script

```bash
cd "/Users/FredGooltz/Documents/VIBE CODING EFFORTS/BESPOKE-APP"
python3 migrate_stories.py
```

**What you'll see:**

```
🎬 BESPOKE STORY MIGRATION TOOL

✅ Created directories:
   📁 /Users/FredGooltz/Documents/BespokeData/stories
   📁 /Users/FredGooltz/Documents/BespokeData/audio

============================================================
STEP 1: DRY RUN (Preview)
============================================================

📚 Found 17 stories to migrate

📖 Processing: STORY-1658538526796390992.json
   Title: Wraith
   ID: 1658538526796390992
   Scenes: 16
   🎵 Audio files: 0
   [DRY RUN] Would copy story + 0 audio files

...

============================================================
MIGRATION SUMMARY
============================================================
✅ Migrated: 17 stories
============================================================

🤔 Do you want to proceed with the actual migration? (yes/no):
```

### Step 3: Review and Confirm

Type `yes` and press Enter to actually migrate.

### Step 4: Verify in the App

1. Open the Bespoke app
2. Click on the dashboard
3. You should see all 17 stories!

## Troubleshooting

### "Source directory not found"
Make sure the old app path is correct:
```bash
ls "/Users/FredGooltz/Documents/VIBE CODING EFFORTS/current_alpine_app/prod/data/users/BlTOnTDXVJW8Hj70UFW74LSaoHu1"
```

### "Stories don't appear in app"
Check if files were copied:
```bash
ls ~/Documents/BespokeData/stories/
ls ~/Documents/BespokeData/audio/
```

### "Permission denied"
Make sure directories are writable:
```bash
chmod -R u+w ~/Documents/BespokeData/
```

## What Gets Migrated

✅ **Story metadata** - Name, structure, sections
✅ **Scene data** - All scenes with descriptions
✅ **Audio files** - All recorded audio tracks
✅ **Transcripts** - All existing transcriptions
✅ **Character names** - Preserved exactly

## What Doesn't Get Migrated

❌ **User account info** - Desktop app is single-user
❌ **Usage statistics** - Not needed in desktop version
❌ **Firebase metadata** - Not applicable to desktop app

## Post-Migration

### Backup Strategy

**Recommended:**
1. Enable Time Machine (automatic)
2. Sync `~/Documents/BespokeData/` to cloud storage
3. Periodic manual backups before major edits

**Quick backup command:**
```bash
tar -czf bespoke_backup_$(date +%Y%m%d).tar.gz ~/Documents/BespokeData/
```

### Keep Both Systems?

You can keep both! They use different data locations:
- **Old web app**: `/current_alpine_app/prod/data/...`
- **New desktop app**: `~/Documents/BespokeData/`

They won't conflict.

## Future Improvements

The migration script could be enhanced to:
- ✅ Add a "rollback" feature
- ✅ Support selective migration (choose specific stories)
- ✅ Merge with existing stories (conflict resolution)
- ✅ Export to other formats (PDF, FDX, etc.)

## Questions?

If you encounter any issues during migration:
1. Check the error messages
2. Make sure you have the backup
3. Run the dry-run mode again to see what would happen
4. Check file permissions on both locations

## Summary

✅ **External data storage is the RIGHT approach**
✅ **Use the automated migration script**
✅ **Create backups before and after**
✅ **All 17 stories can be migrated safely**
✅ **No data transformation needed**
