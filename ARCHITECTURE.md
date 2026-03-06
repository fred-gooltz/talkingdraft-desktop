# TalkingStudio — Architecture Guide
# For human developers and AI coding agents (Goose/Qwen)
# Last updated: 2026-03-05

## What This App Is

TalkingStudio is a desktop app for screenwriters. It is a two-stage pipeline:

**Stage 1 — Write**
- Input: voice dictation
- Output: formatted screenplay/stageplay
- Tools: Whisper STT, character keyboard shortcuts, scene management, beat sheet frameworks

**Stage 2 — Produce** (future)
- Input: locked script from Stage 1
- Output: podcast-ready audio file
- Tools: Voice Morph sidecar, audio assembly, take management, podcast export

Script lock separates the stages. Once locked, writing tools grey out and production tools activate.

---

## Tech Stack

| Layer | Technology | Notes |
|-------|-----------|-------|
| Desktop shell | Neutralino.js | Lightweight, no Node/Electron overhead |
| Frontend | Alpine.js 3.10.1 | Loaded as ES module from unpkg CDN |
| Styling | Tailwind CSS | Loaded from CDN, no build step |
| Backend | FastAPI/Python (main_FIXED.py) | Port 5001, single POST /api endpoint |
| STT | OpenAI Whisper (local) | Lazy-loaded on first transcription use |
| Data | JSON files on disk | ~/Documents/BespokeData/stories/ |
| Audio | WebM files on disk | ~/Documents/BespokeData/audio/ |

---

## Directory Structure

```
TalkingDraft-Desktop/
├── Bespoke.command          # Launch script — starts backend then Neutralino
├── Kill-Backend.command     # Kill script — stops backend on port 5001
├── neutralino.config.json   # Neutralino configuration
├── .goosehints              # Goose AI agent context for this project
├── backend/
│   ├── main_FIXED.py        # ✅ USE THIS — full FastAPI app
│   ├── main.py              # ❌ OLD — single-route stub, do not use
│   ├── requirements.txt     # Python dependencies
│   └── venv/                # Python virtual environment (not in git)
└── resources/
    ├── index.html           # Main UI — all Alpine.js components live here
    ├── styles.css           # Custom styles
    └── js/
        ├── main.js          # Alpine.js app logic — registers 'ui' component
        ├── neutralino.js    # Neutralino runtime (do not modify)
        └── lib/
            ├── utils.js     # alpineUtils store + apiStore (story structures)
            └── components.js # (currently unused)
```

---

## Backend Architecture

**Single endpoint:** `POST http://localhost:5001/api`

All commands sent as FormData with a `cmd` field:

| cmd | Parameters | Returns |
|-----|-----------|---------|
| listStories | (none) | Array of story summaries |
| getStory | id | Full story JSON |
| saveStory | story (JSON), tid?, audio? | {updated: timestamp} |
| deleteStory | id | {success: true} |
| touchStory | id | {updated: timestamp} |
| batchTranscribe | tids[], audio files | {transcripts: [{tid, transcript}]} |
| getAudio | id | Audio file binary |
| copyAudio | newid, tids | {success: true} |

**Rule: Never add REST routes.** Always add new functionality as a new `cmd` in the existing POST /api handler.

---

## Frontend Architecture

### Alpine.js Setup (index.html)

```javascript
ENV = {
    API_URL: 'http://localhost:5001/api'
};
```

Alpine is loaded as an ES module. The `ui` Alpine component is registered in `main.js`.
The `utils` and `api` stores are registered in `main.js` via `Alpine.store()`.

### Stores

**`$store.utils`** (alphaUtils in utils.js)
- `apiUrl` — backend URL
- `apiReq(fd)` — makes POST request to backend
- `showAlert(msg)` — shows alert banner
- `iconBtn`, `baseBtn`, `menuItem` — shared Tailwind class objects

**`$store.api`** (apiStore in utils.js)
- `sectionPresets` — all story structure frameworks (Save the Cat, Story Circle, etc.)
- `defaultStory()`, `newStory()`, `addScene()` — story factory functions
- `saveStory()`, `getStory()`, `deleteStory()` — API calls
- `migratePreset()` — migrate scenes between story structure frameworks

### UI Component (`ui` in main.js)

Key state variables:
```javascript
activeStory: {}      // currently open story
activeScene: {}      // currently open scene (opens recording modal)
storyList: []        // dashboard story list
newOpen: 1           // 1=show dashboard, 0=show story outliner
mode: 'setup'        // 'setup' | 'active' | 'transcription'
```

Key methods:
```javascript
loadStories()        // fetches story list from backend
loadStory(id)        // fetches and opens a single story
newOpenStory()       // creates or opens a story
setScene()           // opens/closes the recording modal
activateRecording()  // starts/stops microphone recording
```

---

## Data Model

### Story JSON
```json
{
  "id": "unique-id",
  "name": "Story Name",
  "sectionPreset": "Save the Cat",
  "minutes": 90,
  "sections": [
    {"id": "section-id", "value": "notes text"}
  ],
  "scenes": [
    {
      "id": "scene-id",
      "sectionIdx": 0,
      "name": "EXT. LOCATION-1",
      "desc": "scene description",
      "duration": 0,
      "chars": ["ACTION", "NAME-1", "NAME-2", ...],
      "trackOrder": ["tid1", "tid2"],
      "tracks": {
        "tid1": {
          "name": "CHARACTER-NAME",
          "transcript": "transcribed text"
        }
      }
    }
  ],
  "updated": 1234567890
}
```

---

## Colors / Branding

| Element | Value |
|---------|-------|
| App name | TalkingStudio |
| Background | `#2D334A` (dark blue-grey) |
| Text | `#FFFFFE` (off-white) |
| Accent yellow | `#FFD905` |
| Accent green (recording) | `#2CD83D` |
| Header bg | `#0E0726` (near black) |

---

## Rules for AI Agents (Goose/Qwen)

1. **Never touch** `~/Documents/BespokeData/` — that's the user's live story data
2. **Never touch** the `BESPOKE-APP` folder — that's the user's personal daily driver
3. **Always use** `backend/main_FIXED.py` — never `backend/main.py`
4. **Never add REST routes** — add new `cmd` handlers to POST /api only
5. **Never use** native browser dialogs (`confirm()`, `prompt()`, `alert()`) in Neutralino — use Alpine.js modals
6. **Always show a diff** before applying edits to existing files
7. **Commit before** any significant change: `git add -A && git commit -m "checkpoint: [description]"`
8. **Never hardcode paths** — use `$(dirname "$0")` in shell scripts
9. **Use `python3`** not `python`
10. **Always activate venv**: `source backend/venv/bin/activate`

---

## Launch Procedure

```bash
cd ~/Documents/FRED-DEV/TALKINGDRAFT/desktop/TalkingDraft-Desktop
./Bespoke.command
# Wait for "Backend ready." before interacting with the app
```

Backend health check: `curl http://localhost:5001/docs`

---

## Roadmap (Stage 2 — Produce)

Not yet built. When we get here:
- Script lock mechanism (writing tools grey out)
- Per-line audio isolation (split scene audio into individual track files)
- Voice Morph sidecar integration (RVC local)
- Take management (multiple recordings per line)
- Audio assembly and podcast export
- Scenester integration (push project to web for actor casting)
