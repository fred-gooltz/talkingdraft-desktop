"""
Bespoke Writing Suite - FastAPI Backend
Handles story management, audio storage, and Whisper batch transcription
"""

from fastapi import FastAPI, File, UploadFile, Form, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse
import json
import os
from pathlib import Path
from datetime import datetime
import shutil
import tempfile

# Try to import whisper, fall back to mock mode if not available
try:
    import whisper
    WHISPER_AVAILABLE = True
    print("✅ Whisper loaded - real transcription available")
except ImportError:
    WHISPER_AVAILABLE = False
    print("⚠️  Whisper not installed - using mock transcriptions")
    print("   Install with: pip install openai-whisper")

app = FastAPI()

# Enable CORS for Neutralino app
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Data directories
BASE_DIR = Path.home() / "Documents" / "BespokeData"
STORIES_DIR = BASE_DIR / "stories"
AUDIO_DIR = BASE_DIR / "audio"

# Create directories
STORIES_DIR.mkdir(parents=True, exist_ok=True)
AUDIO_DIR.mkdir(parents=True, exist_ok=True)

# Initialize Whisper model (lazy loading)
WHISPER_MODEL = None

def get_whisper_model():
    """Load Whisper model on first use"""
    global WHISPER_MODEL
    if WHISPER_MODEL is None and WHISPER_AVAILABLE:
        print("🧠 Loading Whisper model (base)... This may take a moment...")
        WHISPER_MODEL = whisper.load_model("base")
        print("✅ Whisper model loaded and ready")
    return WHISPER_MODEL

@app.post("/api")
async def api_handler(request: Request):
    """Main API endpoint"""
    
    cmd = None
    try:
        # Parse form data
        form = await request.form()
        cmd = form.get('cmd')
        
        if cmd == "listStories":
            return await list_stories()
        
        elif cmd == "getStory":
            return await get_story(form.get('id'))
        
        elif cmd == "saveStory":
            return await save_story(form.get('story'), form.get('audio'), form.get('tid'))
        
        elif cmd == "touchStory":
            return await touch_story(form.get('id'))
        
        elif cmd == "deleteStory":
            return await delete_story(form.get('id'))
        
        elif cmd == "getAudio":
            return await get_audio(form.get('id'))
        
        elif cmd == "copyAudio":
            return await copy_audio(form.get('newid'), form.get('tids'))
        
        elif cmd == "batchTranscribe":
            # Use real Whisper if available, otherwise mock
            if WHISPER_AVAILABLE:
                return await batch_transcribe_whisper(form)
            else:
                return await batch_transcribe_mock(form)
        
        else:
            raise HTTPException(status_code=400, detail=f"Unknown command: {cmd}")
            
    except HTTPException:
        # Re-raise HTTP exceptions as-is
        raise
    except Exception as e:
        # Log the full error with traceback
        import traceback
        error_msg = f"{type(e).__name__}: {str(e)}"
        print(f"❌ API Error in command '{cmd}': {error_msg}")
        print(f"❌ Traceback:\n{traceback.format_exc()}")
        return JSONResponse(
            status_code=500,
            content={"error": error_msg}
        )

async def list_stories():
    """List all stories"""
    stories = []
    
    for story_file in STORIES_DIR.glob("*.json"):
        try:
            with open(story_file, 'r') as f:
                story_data = json.load(f)
                stories.append(story_data)
        except Exception as e:
            print(f"Error loading story {story_file}: {e}")
    
    return stories

async def get_story(story_id: str):
    """Get story by ID"""
    story_file = STORIES_DIR / f"{story_id}.json"
    
    if not story_file.exists():
        raise HTTPException(status_code=404, detail="Story not found")
    
    with open(story_file, 'r') as f:
        return json.load(f)

async def save_story(story_json: str, audio_file: UploadFile = None, tid: str = None):
    """Save story and optionally audio"""
    try:
        story_data = json.loads(story_json)
        story_id = story_data.get('id')
        
        if not story_id:
            raise ValueError("Story ID required")
        
        story_data['updated'] = datetime.now().timestamp()
        
        # Save story JSON
        story_file = STORIES_DIR / f"{story_id}.json"
        with open(story_file, 'w') as f:
            json.dump(story_data, f, indent=2)
        
        # Legacy: Save single audio if provided
        if audio_file and tid:
            audio_path = AUDIO_DIR / f"{story_id}"
            audio_path.mkdir(exist_ok=True)
            
            audio_file_path = audio_path / f"{tid}.webm"
            with open(audio_file_path, 'wb') as f:
                content = await audio_file.read()
                f.write(content)
            print(f"✅ Saved audio: {tid}.webm")
        
        return {
            "id": story_id,
            "name": story_data.get('name'),
            "updated": story_data['updated']
        }
        
    except json.JSONDecodeError as e:
        raise HTTPException(status_code=400, detail=f"Invalid JSON: {e}")

async def touch_story(story_id: str):
    """Update only the timestamp of a story without modifying content"""
    if not story_id:
        raise HTTPException(status_code=400, detail="Story ID required")
    
    story_file = STORIES_DIR / f"{story_id}.json"
    
    if not story_file.exists():
        raise HTTPException(status_code=404, detail="Story not found")
    
    try:
        # Read existing story
        with open(story_file, 'r') as f:
            story_data = json.load(f)
        
        # Update only the timestamp
        story_data['updated'] = datetime.now().timestamp()
        
        # Save back
        with open(story_file, 'w') as f:
            json.dump(story_data, f, indent=2)
        
        print(f"✅ Touched story: {story_id} at {datetime.now()}")
        
        return {
            "id": story_id,
            "updated": story_data['updated']
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to touch story: {str(e)}")

async def delete_story(story_id: str):
    """Delete story and audio"""
    print(f"🗑️  DELETE_STORY called with story_id: {story_id}")
    
    if not story_id:
        print("❌ DELETE_STORY ERROR: No story_id provided")
        raise HTTPException(status_code=400, detail="No story ID provided")
    
    try:
        story_file = STORIES_DIR / f"{story_id}.json"
        print(f"📁 Story file path: {story_file}")
        print(f"📁 Story file exists: {story_file.exists()}")
        
        if story_file.exists():
            print(f"🗑️  Deleting story file: {story_file}")
            story_file.unlink()
            print(f"✅ Story file deleted successfully")
        else:
            print(f"⚠️  Story file not found (will continue to delete audio)")
        
        audio_path = AUDIO_DIR / story_id
        print(f"🎵 Audio path: {audio_path}")
        print(f"🎵 Audio path exists: {audio_path.exists()}")
        
        if audio_path.exists():
            print(f"🗑️  Deleting audio directory: {audio_path}")
            shutil.rmtree(audio_path)
            print(f"✅ Audio directory deleted successfully")
        else:
            print(f"⚠️  Audio directory not found (nothing to delete)")
        
        print(f"✅ DELETE_STORY completed successfully for story_id: {story_id}")
        return {"success": True}
        
    except Exception as e:
        print(f"❌ DELETE_STORY EXCEPTION: {type(e).__name__}: {str(e)}")
        import traceback
        print(f"❌ Traceback: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Delete failed: {str(e)}")

async def get_audio(audio_id: str):
    """Get audio file - format: storyId-sceneId-trackId"""
    parts = audio_id.split('-', 2)
    if len(parts) < 3:
        print(f"❌ Invalid audio ID format: {audio_id}")
        raise HTTPException(status_code=400, detail="Invalid audio ID")
    
    story_id = parts[0]
    track_id = parts[2]
    
    audio_file = AUDIO_DIR / story_id / f"{track_id}.webm"
    
    if not audio_file.exists():
        print(f"⚠️  Audio file not found: {audio_file}")
        raise HTTPException(status_code=404, detail=f"Audio not found: {track_id}")
    
    return FileResponse(audio_file, media_type="audio/webm")

async def copy_audio(new_story_id: str, tids_json: str):
    """Copy audio files to new story"""
    try:
        tids = json.loads(tids_json)
        
        for tid in tids:
            parts = tid.split('-', 2)
            if len(parts) < 3:
                continue
            
            old_story_id = parts[0]
            track_id = parts[2]
            
            old_audio = AUDIO_DIR / old_story_id / f"{track_id}.webm"
            
            if old_audio.exists():
                new_audio_dir = AUDIO_DIR / new_story_id
                new_audio_dir.mkdir(exist_ok=True)
                
                new_audio = new_audio_dir / f"{track_id}.webm"
                shutil.copy2(old_audio, new_audio)
        
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

async def batch_transcribe_mock(form):
    """Mock batch transcription for dev mode"""
    try:
        story_id = form.get('storyId')
        scene_id = form.get('sceneId')
        count = int(form.get('count', 0))
        
        if not story_id or not scene_id:
            raise HTTPException(status_code=400, detail="storyId and sceneId required")
        
        # Create audio directory for this story
        audio_dir = AUDIO_DIR / story_id
        audio_dir.mkdir(exist_ok=True)
        
        print(f"🔧 Mock batch transcription: {count} files for story {story_id}, scene {scene_id}")
        
        mock_texts = [
            "This is a mock transcription of the recorded audio.",
            "The quick brown fox jumps over the lazy dog.",
            "Testing the batch transcription system.",
            "Mock transcript for development purposes.",
            "Simulated speech-to-text output."
        ]
        
        transcripts = []
        for i in range(count):
            tid = form.get(f'tid_{i}')
            audio_file = form.get(f'audio_{i}')
            
            if tid and audio_file:
                # ✅ CRITICAL: Save the audio file to permanent storage (even in dev mode!)
                permanent_audio_path = audio_dir / f"{tid}.webm"
                content = await audio_file.read()
                with open(permanent_audio_path, 'wb') as f:
                    f.write(content)
                print(f"💾 Mock saved audio: {story_id}/{tid}.webm")
                
                transcripts.append({
                    "tid": tid,
                    "transcript": mock_texts[i % len(mock_texts)]
                })
        
        print(f"✅ Mock transcription complete: {len(transcripts)} files processed")
        
        return {
            "success": True,
            "transcripts": transcripts
        }
        
    except Exception as e:
        print(f"❌ Batch transcribe error: {e}")
        import traceback
        print(f"❌ Traceback:\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=str(e))

async def batch_transcribe_whisper(form):
    """Real batch transcription using Whisper"""
    try:
        story_id = form.get('storyId')
        scene_id = form.get('sceneId')
        count = int(form.get('count', 0))
        model = get_whisper_model()
        
        if model is None:
            raise HTTPException(status_code=500, detail="Whisper model not available")
        
        if not story_id or not scene_id:
            raise HTTPException(status_code=400, detail="storyId and sceneId required")
        
        # Create audio directory for this story
        audio_dir = AUDIO_DIR / story_id
        audio_dir.mkdir(exist_ok=True)
        
        print(f"🎵 Batch transcription started: {count} files for story {story_id}, scene {scene_id}")
        
        transcripts = []
        
        # Process each audio file
        for i in range(count):
            tid = form.get(f'tid_{i}')
            audio_file = form.get(f'audio_{i}')
            
            if not tid or not audio_file:
                print(f"Skipping index {i}: missing tid or audio")
                continue
            
            # Save uploaded file temporarily for Whisper
            with tempfile.NamedTemporaryFile(delete=False, suffix='.webm') as tmp_file:
                content = await audio_file.read()
                tmp_file.write(content)
                tmp_path = tmp_file.name
            
            try:
                # Transcribe with Whisper
                print(f"🎤 Transcribing {tid}...")
                result = model.transcribe(tmp_path, fp16=False)
                transcript_text = result["text"].strip()
                
                transcripts.append({
                    "tid": tid,
                    "transcript": transcript_text
                })
                
                print(f"✅ {tid}: {transcript_text[:50]}...")
                
                # ✅ CRITICAL: Save the audio file to permanent storage
                permanent_audio_path = audio_dir / f"{tid}.webm"
                with open(permanent_audio_path, 'wb') as f:
                    # Re-read from temp file since we already read it once
                    with open(tmp_path, 'rb') as tmp_f:
                        f.write(tmp_f.read())
                print(f"💾 Saved audio: {story_id}/{tid}.webm")
                
            except Exception as e:
                print(f"❌ Error transcribing {tid}: {e}")
                import traceback
                print(f"❌ Traceback:\n{traceback.format_exc()}")
                transcripts.append({
                    "tid": tid,
                    "transcript": "[Transcription failed]"
                })
            finally:
                # Clean up temp file
                try:
                    os.unlink(tmp_path)
                except:
                    pass
        
        print(f"✅ Batch transcription complete: {len(transcripts)} files processed")
        
        return {
            "success": True,
            "transcripts": transcripts
        }
        
    except Exception as e:
        print(f"❌ Batch transcribe error: {e}")
        import traceback
        print(f"❌ Traceback:\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=5001)
