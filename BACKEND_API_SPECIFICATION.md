# Backend API Specification: Batch Transcription

This document defines the exact API contract that the Python backend must implement for the batch transcription system to work.

---

## 📡 Endpoint

**Command:** `batchTranscribe`

**Method:** POST (FormData)

**Purpose:** Receive multiple audio blobs and return transcriptions from Whisper

---

## 📥 Request Format

### **FormData Structure**

```
cmd: 'batchTranscribe'
storyId: <string>          // Story ID for file organization
sceneId: <string>          // Scene ID for file organization
count: <number>            // Number of audio blobs being sent

// For each blob (index 0 to count-1):
audio_<index>: <Blob>      // Audio file (audio/ogg; codecs=opus)
tid_<index>: <string>      // Track ID (unique identifier)
charName_<index>: <string> // Character name (e.g., 'JOHN', 'MARY', 'ACTION')
```

### **Example Request**

```javascript
// 3 audio segments from a recording session
FormData {
  cmd: 'batchTranscribe',
  storyId: 'story-abc123',
  sceneId: 'scene-xyz789',
  count: 3,
  
  audio_0: Blob { size: 45678, type: 'audio/ogg; codecs=opus' },
  tid_0: 'track-001',
  charName_0: 'JOHN',
  
  audio_1: Blob { size: 52341, type: 'audio/ogg; codecs=opus' },
  tid_1: 'track-002',
  charName_1: 'MARY',
  
  audio_2: Blob { size: 38912, type: 'audio/ogg; codecs=opus' },
  tid_2: 'track-003',
  charName_2: 'ACTION'
}
```

---

## 📤 Response Format

### **Success Response**

```json
{
  "success": true,
  "transcripts": [
    {
      "tid": "track-001",
      "transcript": "Hello, how are you doing today?"
    },
    {
      "tid": "track-002", 
      "transcript": "I'm doing great, thanks for asking!"
    },
    {
      "tid": "track-003",
      "transcript": "[John walks over to the window and looks outside]"
    }
  ]
}
```

### **Error Response**

```json
{
  "success": false,
  "error": "Error message here"
}
```

---

## ⚠️ Critical Requirements

### 1. **Array Order MUST Be Preserved**
The transcripts array MUST be in the same order as the audio blobs were sent:
- `transcripts[0]` corresponds to `audio_0`
- `transcripts[1]` corresponds to `audio_1`
- etc.

### 2. **Track IDs MUST Match**
Each transcript object MUST include the exact `tid` that was sent:
```javascript
// CORRECT
{ tid: 'track-001', transcript: '...' }

// WRONG - different tid
{ tid: 'different-id', transcript: '...' }
```

### 3. **All Blobs MUST Get Responses**
If 5 blobs are sent, 5 transcripts must be returned, even if some are empty:
```json
{
  "success": true,
  "transcripts": [
    { "tid": "track-001", "transcript": "Hello" },
    { "tid": "track-002", "transcript": "" },  // No speech detected
    { "tid": "track-003", "transcript": "Goodbye" },
    { "tid": "track-004", "transcript": "[silence]" },  // Or use placeholder
    { "tid": "track-005", "transcript": "See you later" }
  ]
}
```

---

## 🐍 Python Backend Implementation Guide

### **Step 1: Receive FormData**

```python
from fastapi import FastAPI, File, UploadFile, Form
from typing import List
import whisper

app = FastAPI()

@app.post("/api")
async def handle_request(
    cmd: str = Form(...),
    storyId: str = Form(...),
    sceneId: str = Form(...),
    count: int = Form(...)
):
    if cmd != 'batchTranscribe':
        return {"error": "Unknown command"}
    
    # Collect all audio blobs and metadata
    audio_blobs = []
    for i in range(count):
        audio_file = request.files.get(f'audio_{i}')
        tid = request.form.get(f'tid_{i}')
        charName = request.form.get(f'charName_{i}')
        
        audio_blobs.append({
            'audio': audio_file,
            'tid': tid,
            'charName': charName,
            'index': i
        })
    
    # Process with Whisper
    transcripts = await process_batch(audio_blobs, storyId, sceneId)
    
    return {
        "success": True,
        "transcripts": transcripts
    }
```

### **Step 2: Process Audio Sequentially**

```python
import whisper
import tempfile
import os

# Load Whisper model (do this once at startup)
model = whisper.load_model("base")  # or "small", "medium", "large"

async def process_batch(audio_blobs, story_id, scene_id):
    transcripts = []
    
    # Process each audio blob in order
    for blob in audio_blobs:
        # Save blob to temporary file
        with tempfile.NamedTemporaryFile(delete=False, suffix='.ogg') as tmp:
            tmp.write(blob['audio'].read())
            tmp_path = tmp.name
        
        try:
            # Transcribe with Whisper
            result = model.transcribe(tmp_path)
            transcript_text = result['text'].strip()
            
            # Add to results (PRESERVE ORDER!)
            transcripts.append({
                'tid': blob['tid'],
                'transcript': transcript_text
            })
            
        except Exception as e:
            # Still add entry, but with error or empty transcript
            transcripts.append({
                'tid': blob['tid'],
                'transcript': f'[Transcription error: {str(e)}]'
            })
            
        finally:
            # Clean up temp file
            os.unlink(tmp_path)
    
    return transcripts
```

### **Step 3: (Optional) Save Audio Files**

```python
def save_audio_permanently(story_id, scene_id, tid, audio_file):
    """
    Save audio to permanent storage for later playback
    """
    audio_dir = f"./audio_files/{story_id}/{scene_id}"
    os.makedirs(audio_dir, exist_ok=True)
    
    filepath = f"{audio_dir}/{tid}.ogg"
    with open(filepath, 'wb') as f:
        f.write(audio_file.read())
    
    return filepath
```

---

## 📊 Performance Considerations

### **Sequential Processing**
Process audio blobs one at a time to:
- Preserve order (critical for matching with tracks)
- Control memory usage
- Avoid overwhelming Whisper

### **Progress Updates (Optional Enhancement)**
For long sessions, consider WebSocket updates:
```python
async def process_batch_with_progress(audio_blobs, websocket):
    for i, blob in enumerate(audio_blobs):
        # Transcribe
        result = model.transcribe(...)
        
        # Send progress update
        await websocket.send_json({
            'type': 'progress',
            'current': i + 1,
            'total': len(audio_blobs)
        })
```

---

## 🧪 Testing the Backend

### **Test Request (cURL)**

```bash
curl -X POST http://localhost:8000/api \
  -F "cmd=batchTranscribe" \
  -F "storyId=test-story" \
  -F "sceneId=test-scene" \
  -F "count=2" \
  -F "audio_0=@test1.ogg" \
  -F "tid_0=track-001" \
  -F "charName_0=JOHN" \
  -F "audio_1=@test2.ogg" \
  -F "tid_1=track-002" \
  -F "charName_1=MARY"
```

### **Expected Response**

```json
{
  "success": true,
  "transcripts": [
    { "tid": "track-001", "transcript": "..." },
    { "tid": "track-002", "transcript": "..." }
  ]
}
```

---

## 🔒 Error Handling

### **Missing Files**
```python
if not audio_file:
    transcripts.append({
        'tid': blob['tid'],
        'transcript': '[Audio file missing]'
    })
```

### **Whisper Errors**
```python
try:
    result = model.transcribe(tmp_path)
except Exception as e:
    transcripts.append({
        'tid': blob['tid'],
        'transcript': f'[Error: {str(e)}]'
    })
```

### **Empty/Silent Audio**
```python
if not result['text'].strip():
    transcripts.append({
        'tid': blob['tid'],
        'transcript': '[No speech detected]'
    })
```

---

## 📋 Checklist Before Going Live

- [ ] Whisper model loaded and working
- [ ] FormData parsing handles all fields correctly
- [ ] Audio blobs are processed sequentially (preserves order)
- [ ] Each transcript includes correct `tid`
- [ ] Array length matches input count
- [ ] Error handling returns proper structure
- [ ] Temporary files are cleaned up
- [ ] Response time is acceptable (test with 5+ blobs)

---

## 🎯 Integration Test

Once backend is ready:

1. **Set devMode to false** in main.js
2. **Record 3-5 audio segments** in the app
3. **Click pause** to trigger batch
4. **Check console logs** for API request/response
5. **Verify transcripts** appear in UI
6. **Confirm audio playback** works

---

## 💡 Whisper Model Selection

**Recommended for development:**
- `base` - Fast, good enough for testing (74M params)

**Recommended for production:**
- `small` - Balance of speed and accuracy (244M params)
- `medium` - Better accuracy, slower (769M params)

**Installation:**
```bash
pip install openai-whisper
```

**First run downloads the model:**
```python
model = whisper.load_model("base")  # Downloads ~74MB
```

---

## 🚀 Next Steps

1. ✅ Frontend validated with mock mode
2. ⏭️ Install Whisper: `pip install openai-whisper`
3. ⏭️ Implement endpoint following this spec
4. ⏭️ Test with cURL or Postman
5. ⏭️ Switch frontend to production mode
6. ⏭️ Test end-to-end flow

---

**Questions?** The mock response in `main.js` (lines 178-203) shows exactly what the frontend expects!
