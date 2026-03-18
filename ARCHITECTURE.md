# TalkingStudio — Architecture Guide
# For human developers and AI coding agents (Goose/Qwen/Claude)
# Last updated: 2026-03-06

---

## What This App Is

TalkingStudio is a desktop creative suite for screenwriters. It is organized as discrete **Stages**, each with its own HTML page and JS module.

### The Stage Pipeline

| Stage | Name | Status | Description |
|-------|------|--------|-------------|
| 0 | Dashboard | 🔨 In progress | Project/story card array, no top nav |
| 1 | Outline | 🔨 In progress | Story structure sections, scene cards, beat sheet frameworks |
| 2 | Draft | 🔨 In progress | Voice dictation, Whisper STT, manual diarization |
| 3 | Characters | 📋 Planned | Enneagram-based character development, cast chemistry |
| 4 | Produce | 📋 Planned | Locked script → podcast-ready audio (TalkingStories) |

**Script lock** separates Stage 2 (Draft) from Stage 4 (Produce). Once locked, writing tools grey out and production tools activate.

---

## Platform Decision: Neutralino Now → Tauri v2 Later

### Current: Neutralino.js
TalkingStudio currently runs on Neutralino + FastAPI. This works for Stages 0–2.

**Known Neutralino limitations (do not work around, plan to migrate):**
- No native browser dialogs (confirmed `confirm()`, `prompt()` fail silently)
- No programmatic file downloads via `element.click()`
- No multi-window support for future stage panels
- Save dialog `defaultPath` parameter fails on macOS (documented bug)
- Not appropriate for audio timeline assembly, multi-sidecar management

### Target: Tauri v2
When Stage 4 (Produce) is ready to build, migrate to Tauri v2. This is the correct platform for the full suite because:
- Rust backend handles heavy file I/O without Python's GIL limitations
- First-class native OS dialogs, filesystem, multi-window support
- Multiple sidecar processes (Whisper + RVC + future) managed by Tauri's shell plugin
- Bundle size 4–8MB vs Electron's 80–150MB
- FastAPI backend continues as a named sidecar — no logic changes needed

**Tauri sidecar pattern (for future reference):**
```
sidecars:
  - whisper-stt     ← existing FastAPI backend, unchanged
  - rvc-voice-morph ← future Stage 4 voice conversion
```
Frontend posts to different ports; never changes based on which sidecar handles the request.

**When to migrate:** When Stage 1 (Draft) is bug-stable and you are no longer fixing regressions. The UI work done in Neutralino transfers 1:1 to Tauri — the Alpine.js + Tailwind frontend is platform-agnostic.

**Reference:** `ARCHIVE/StoryForge-Tauri` contains a working SQLite schema that should be consulted when designing the Tauri data layer.

---

## UI Layout: TLL (Top-Left-Left)

The full TalkingStudio layout is a professional studio layout used by Premiere Pro, Logic, Final Draft:

```
┌─────────────────────────────────────────────────────┐
│  [Logo]  [Outline] [Draft] [Characters] [Produce]   │  ← Top tab bar (Stages)
├────┬────┬────────────────────────────────────────────┤
│    │    │                                            │
│    │    │                                            │
│ L1 │ L2 │         MAIN CONTENT PANE                 │
│    │    │                                            │
│    │    │                                            │
│    │    │                                            │
└────┴────┴────────────────────────────────────────────┘
```

- **Top bar:** Stage tabs + account/settings icons
- **L1 (Left Sidebar 1):** Navigation within stage — story list, section list
- **L2 (Left Sidebar 2):** Context panel — characters, notes, beat descriptions
- **Main pane:** Active work area for the current stage

**Dashboard (Stage 0)** is the exception — no top nav, no sidebars. Full-screen card array of projects with visual completion indicators showing which stages are complete per story.

---

## File Structure (Current + Target)

### Current (Neutralino)
```
TalkingDraft-Desktop/
├── Bespoke.command          # Launch script
├── Kill-Backend.command     # Stop backend
├── neutralino.config.json
├── ARCHITECTURE.md          # This file
├── .goosehints              # AI agent context
├── backend/
│   ├── main_FIXED.py        # ✅ USE THIS — FastAPI app, port 5001
│   ├── main.py              # ❌ OLD stub, do not use
│   └── venv/
└── resources/
    ├── index.html           # Main shell (thin — loads views via x-if)
    ├── styles.css
    └── js/
        ├── main.js          # Alpine 'ui' component — registers all views
        ├── neutralino.js    # Neutralino runtime (do not modify)
        └── lib/
            ├── utils.js     # Alpine stores: alpineUtils + apiStore
            └── views/       # TARGET: one file per view/stage
                ├── dashboard.js
                ├── outliner.js
                ├── recorder.js
                └── modals.js
```

### Target (Tauri v2) — for reference when migrating
```
TalkingStudio-Tauri/
├── src-tauri/
│   ├── tauri.conf.json      # Sidecar config, window config, permissions
│   ├── Cargo.toml
│   └── src/main.rs          # Thin Rust shell — delegates to FastAPI sidecar
├── src/                     # Same Alpine.js frontend, barely changed
│   ├── index.html
│   └── js/ (identical to current resources/js/)
└── backend/                 # Unchanged FastAPI sidecar
    └── main_FIXED.py
```

---

## Backend Architecture (Unchanged in Both Platforms)

**Single endpoint:** `POST http://localhost:5001/api`

All commands sent as FormData with a `cmd` field:

| cmd | Parameters | Returns |
|-----|-----------|---------|
| listStories | — | Array of story summaries |
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
ENV = { API_URL: 'http://localhost:5001/api' };
```
Alpine is loaded as an ES module from unpkg CDN. The `ui` Alpine component is registered in `main.js`. Stores registered in `main.js` via `Alpine.store()`.

### Stores
**`$store.utils`** — API requests, alerts, button classes  
**`$store.api`** — Story structure presets, migration maps, story/scene CRUD

### UI Component (`ui` in main.js)
Key state:
```javascript
activeStory: {}       // currently open story
activeScene: {}       // currently open scene (opens recording modal)
storyList: []         // dashboard story list
newOpen: 1            // 1=dashboard, 0=story outliner
mode: 'setup'         // 'setup' | 'active' | 'transcription'
_pendingSceneLoad: null  // queue for concurrent scene load requests
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
      "lastModified": 1234567890000,
      "chars": ["ACTION", "NAME-1", ...],
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

### ID Format Note
Desktop `genId()` uses base-36 encoding: `Date.now().toString(36) + Math.random().toString(36)`  
Web `genId()` uses decimal: `Date.now().toString() + Math.ceil(Math.random() * 1000000)`  
Both are unique. When story JSON crosses platforms, IDs are opaque strings — no conflict. If sync is ever built, normalize to one format at that time.

---

## Colors / Branding

| Element | Value | Usage |
|---------|-------|-------|
| App name | TalkingStudio | Desktop app |
| Background | `#2D334A` | Main bg |
| Text | `#FFFFFE` | Primary text |
| Accent yellow | `#FFD905` | Buttons, icons, hover states |
| Accent green | `#2CD83D` | Active recording state |
| Header / Stage bar bg | `#0E0726` | Near-black |

---

## Story Structure Frameworks

7 frameworks are implemented. All use percentage-based section timing (`st` and `en` fields, 0.0–1.0) so page ranges calculate from any story length.

All act labels use standardized values: `"Act 1"`, `"Act 2"`, `"Act 3"`, `"Act 4"` — **not** `"Act 2b"` or `"Act 2a"`. The web app uses `"Act 2b"` in some places; TalkingStudio normalizes to simple act numbers. This is a deliberate divergence — the web app will be updated to match.

Migration maps are complete for all framework ↔ framework conversions including 9Cs (added 2026-03-06).

---

## Product Suite Context

TalkingStudio is one of four products in the suite:

| Product | Purpose | Revenue model |
|---------|---------|---------------|
| TalkingDraft Web | SaaS writing tool | $9.99/mo subscription |
| TalkingStudio | Desktop creative suite | $149 one-time |
| Scenester | Voice actor casting marketplace | Platform fees |
| Songster | Musical/song adaptation | Creator tools |

TalkingStudio outputs (FDX, audio) feed into Scenester for professional casting. Story JSON format must remain compatible across all products.

---

## Rules for AI Agents (Goose/Qwen/Claude)

1. **Never touch** `~/Documents/BespokeData/` — live user story data
2. **Never touch** the `BESPOKE-APP` folder — user's personal daily driver
3. **Always use** `backend/main_FIXED.py` — never `backend/main.py`
4. **Never add REST routes** — add new `cmd` handlers to POST /api only
5. **Never use** native browser dialogs (`confirm()`, `prompt()`, `alert()`) in Neutralino — use Alpine.js modals
6. **Always show a diff** before applying edits to existing files
7. **Commit before** any significant change: `git add -A && git commit -m "checkpoint: [description]"`
8. **Never hardcode paths** — use `$(dirname "$0")` in shell scripts
9. **Use `python3`** not `python`
10. **Always activate venv**: `source backend/venv/bin/activate`
11. **Do not migrate to Tauri yet** — that is a planned future step, not current work

---

## Launch Procedure

```bash
cd ~/Documents/FRED-DEV/TALKINGDRAFT/desktop/TalkingDraft-Desktop
./Bespoke.command
# Wait for "Backend ready." before interacting
```

Backend health check: `curl http://localhost:5001/docs`

---

## Roadmap

### Immediate (Neutralino)
- [ ] Refactor `index.html` into modular view files under `resources/js/views/`
- [ ] Implement TLL layout (top Stage tabs, two left sidebars, main pane)
- [ ] Dashboard with visual story completion indicators
- [ ] Visual skin polish (studio-grade, not prototype)

### Stage 3 — Characters (Neutralino or Tauri)
- [ ] Enneagram type assignment per character
- [ ] Cast chemistry report
- [ ] FDX import → automatic character extraction
- [ ] Character bio generation for audition breakdowns

### Stage 4 — Produce / TalkingStories (Tauri)
- [ ] Script lock mechanism
- [ ] Per-line audio isolation
- [ ] RVC voice morph sidecar
- [ ] Take management
- [ ] Audio assembly and podcast export
- [ ] Scenester push (professional casting handoff)

### Future
- [ ] Tauri v2 migration
- [ ] FDX import for Stages 2 and 4
- [ ] TTS as placeholder take-1 before human recording
- [ ] Sync between TalkingStudio and TalkingDraft Web
