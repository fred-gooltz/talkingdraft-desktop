/**
 * TalkingStudio — tabs/talking-draft.js
 * Tab 2: Scene list (left) + recorder panel (right)
 * Ports all recording logic from the old main.js.
 */

import { api, utils, genId, time2ms, storyDuration } from '../lib/utils.js';

// ── Recorder internals ────────────────────────────────────────────────────────

let mediaRecorder = null;
let mediaStream   = null;
let chunks        = [];
let timerIntervalID = null;

function getWavBytes(buffer, options) {
  const type = options.isFloat ? Float32Array : Uint16Array;
  const numFrames = buffer.byteLength / type.BYTES_PER_ELEMENT;
  const headerBytes = getWavHeader(Object.assign({}, options, { numFrames }));
  const wavBytes = new Uint8Array(headerBytes.length + buffer.byteLength);
  wavBytes.set(headerBytes, 0);
  wavBytes.set(new Uint8Array(buffer), headerBytes.length);
  return wavBytes;
}

function getWavHeader(options) {
  const numFrames   = options.numFrames;
  const numChannels = options.numChannels || 2;
  const sampleRate  = options.sampleRate  || 44100;
  const bytesPerSample = options.isFloat ? 4 : 2;
  const format      = options.isFloat ? 3 : 1;
  const blockAlign  = numChannels * bytesPerSample;
  const byteRate    = sampleRate * blockAlign;
  const dataSize    = numFrames * blockAlign;
  const buffer = new ArrayBuffer(44);
  const dv = new DataView(buffer);
  let p = 0;
  const ws = (s) => { for (let i=0;i<s.length;i++) dv.setUint8(p+i,s.charCodeAt(i)); p+=s.length; };
  const wu32 = (d) => { dv.setUint32(p,d,true); p+=4; };
  const wu16 = (d) => { dv.setUint16(p,d,true); p+=2; };
  ws('RIFF'); wu32(dataSize+36); ws('WAVE'); ws('fmt '); wu32(16);
  wu16(format); wu16(numChannels); wu32(sampleRate); wu32(byteRate);
  wu16(blockAlign); wu16(bytesPerSample*8); ws('data'); wu32(dataSize);
  return new Uint8Array(buffer);
}

// ── Render shell ──────────────────────────────────────────────────────────────

export function renderTalkingDraft(container) {
  container.innerHTML = `
    <div id="td-inner" style="display:flex;flex:1;overflow:hidden;"></div>
  `;

  document.addEventListener('ts:storyopen', (e) => initTD(e.detail.story));
  document.addEventListener('ts:openscene', (e) => openScene(e.detail.scene));
  document.addEventListener('ts:layout',    (e) => { if (e.detail.tab === 'td') applyTDLayout(e.detail.layout); });
  document.addEventListener('ts:tabenter',  (e) => { if (e.detail.tab === 'td') applyTDLayout(App.state.layout); });
  document.addEventListener('ts:keyup',     (e) => handleKey(e.detail));
}

// ── Build layout ──────────────────────────────────────────────────────────────

function initTD(story) {
  const inner = document.getElementById('td-inner');
  if (!inner) return;

  inner.innerHTML = `
    <!-- LEFT: scene list — width:40%;flex-shrink:0 — stable, never resizes with content -->
    <div id="td-left" style="width:40%;flex-shrink:0;display:flex;flex-direction:column;overflow:hidden;background:var(--deep);border-right:1px solid rgba(255,255,255,0.05);">
      <div style="padding:8px 12px;border-bottom:1px solid rgba(255,255,255,0.05);background:var(--card);flex-shrink:0;display:flex;align-items:center;justify-content:space-between;">
        <div>
          <div style="font-size:9px;color:var(--ghost);font-family:'DM Mono',monospace;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:1px;">TalkingDraft</div>
          <div id="td-breadcrumb" style="font-family:'DM Mono',monospace;font-size:9px;color:var(--ghost);"></div>
        </div>
        <button class="ib" style="font-size:10px;" onclick="TD.exportTranscript()">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          Export
        </button>
      </div>
      <div id="td-scene-list" style="flex:1;overflow-y:auto;padding:8px 8px 20px;"></div>
    </div>

    <!-- RIGHT: recorder — green left border, fixed header + scrollable body -->
    <div id="td-right" style="flex:1;display:flex;flex-direction:column;overflow:hidden;border-left:2px solid var(--green);">
      <!-- Static header — always visible, never scrolls -->
      <div id="td-rec-hdr" style="background:var(--card);border-bottom:1px solid rgba(255,255,255,0.06);padding:8px 16px;display:flex;align-items:center;gap:7px;flex-shrink:0;">
        <div style="flex:1;min-width:0;">
          <div style="font-family:'DM Mono',monospace;font-size:9px;color:var(--ghost);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" id="td-rec-bc">No scene selected</div>
          <div style="font-family:'Courier Prime',monospace;font-size:14px;font-weight:700;text-transform:uppercase;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" id="td-rec-slug">&nbsp;</div>
        </div>
        <button class="ib" style="font-size:10px;" onclick="TD.prevScene()" title="Previous scene">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 19l-7-7 7-7"/></svg> Prev
        </button>
        <button class="ib" style="font-size:10px;" onclick="TD.nextScene()" title="Next scene">
          Next <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 5l7 7-7 7"/></svg>
        </button>
      </div>
      <!-- Scrollable recorder body injected by openScene() -->
      <div id="td-recorder" style="flex:1;overflow-y:auto;display:flex;align-items:center;justify-content:center;">
        <div style="color:var(--ghost);font-size:13px;text-align:center;padding:20px;">
          Select a scene from the list to start recording.
        </div>
      </div>
    </div>
  `;

  renderSceneList(story);

  // Auto-select most recent scene
  if (story.scenes?.length > 0) {
    setTimeout(() => openScene(mostRecentScene(story)), 50);
  }
}

function renderSceneList(story) {
  const list = document.getElementById('td-scene-list');
  const bc   = document.getElementById('td-breadcrumb');
  if (!list) return;
  if (bc) bc.textContent = story.name + ' › TalkingDraft';

  const scenes = story.scenes || [];

  if (!scenes.length) {
    list.innerHTML = `<div style="color:var(--ghost);font-size:12px;padding:16px 0;">No scenes yet. Add scenes in ScriptOutliner.</div>`;
    return;
  }

  // Group by section
  const preset = api.sectionPresets?.[story.sectionPreset];
  if (!preset) {
    list.innerHTML = scenes.map((scene, absIdx) => sceneCard(scene, absIdx, story)).join('');
    return;
  }

  list.innerHTML = preset.sections.map((sec, idx) => {
    const sectionScenes = scenes
      .map((s, i) => ({ scene: s, absIdx: i }))
      .filter(({ scene }) => scene.sectionIdx === idx);

    const cards = sectionScenes.map(({ scene, absIdx }) => sceneCard(scene, absIdx, story)).join('');
    const hasScenes = sectionScenes.length > 0;

    return `
      <div style="margin:0 0 4px;">
        <div style="background:var(--surface);border-radius:${hasScenes ? '5px 5px 0 0' : '5px'};padding:5px 10px;display:flex;align-items:center;gap:5px;cursor:pointer;"
             onclick="TD._toggleTDSec(this)">
          <svg class="tdsec-chev" style="transition:transform .15s;flex-shrink:0;transform:rotate(180deg);" width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" stroke-width="2.5"><path d="M19 9l-7 7-7-7"/></svg>
          <span style="font-family:'DM Mono',monospace;font-size:8px;color:var(--ghost);">${sec.act || ''}</span>
          <span style="font-size:11px;font-weight:600;flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${sec.name}</span>
          <button class="ab" style="font-size:8px;padding:2px 6px;flex-shrink:0;" onclick="event.stopPropagation();TD.addSceneToSection(${idx})">
            <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 5v14M5 12h14"/></svg>
          </button>
        </div>
        ${hasScenes ? `<div class="tdsec-body" style="border:1px solid rgba(255,255,255,0.06);border-top:none;border-radius:0 0 5px 5px;padding:4px 4px 6px;">${cards}</div>` : ''}
      </div>`;
  }).join('');
}

function sceneCard(scene, absIdx, story) {
  const dur  = scene.duration || 0;
  const pp   = dur ? (Math.round(dur/2/60*10)/10).toFixed(1) + ' pp' : '';
  const isActive = App.state.activeScene?.id === scene.id;
  return `
    <div class="sc${isActive ? ' sc-a' : ''}" id="tdc-${scene.id}" onclick="TD.selectScene(${absIdx})" style="cursor:pointer;">
      <div class="sc-body">
        <div style="font-family:'DM Mono',monospace;font-size:11px;font-weight:500;margin-bottom:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${scene.name}</div>
        ${scene.desc ? `<div style="font-size:10px;color:var(--ghost);font-style:italic;">${scene.desc.substring(0,80)}${scene.desc.length>80?'…':''}</div>` : ''}
        ${pp ? `<div style="font-family:'DM Mono',monospace;font-size:8px;color:var(--dim);margin-top:3px;">${pp} dictated</div>` : ''}
      </div>
      <div style="display:flex;flex-direction:column;align-items:center;justify-content:space-between;padding:1px 0;gap:4px;">
        <svg class="dh" title="Drag to reorder" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 9l4-4 4 4m0 6l-4 4-4-4"/></svg>
        <svg class="tb" onclick="event.stopPropagation();TD.deleteScene(${absIdx})" title="Delete scene" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
      </div>
    </div>`;
}

// ── Open a scene in the recorder ──────────────────────────────────────────────

function mostRecentScene(story) {
  let best = story.scenes[0], bestTime = 0;
  for (const scene of story.scenes) {
    if (scene.lastModified && scene.lastModified > bestTime) { bestTime = scene.lastModified; best = scene; continue; }
    for (const tid of (scene.trackOrder || [])) {
      const t = parseInt(tid.substring(0, 13), 10);
      if (t > bestTime) { bestTime = t; best = scene; }
    }
    if (bestTime === 0) {
      const t = parseInt(scene.id?.substring(0, 13) || 0, 10);
      if (t > bestTime) { bestTime = t; best = scene; }
    }
  }
  return best;
}

async function openScene(scene) {
  const story = App.state.activeStory;
  if (!story || !scene) return;

  App.state.activeScene  = scene;
  App.state.sessionBlobs = [];
  App.state.audioURL     = '';

  const rec = document.getElementById('td-recorder');
  if (!rec) return;

  // Update static header
  const slugEl = document.getElementById('td-rec-slug');
  const bcEl   = document.getElementById('td-rec-bc');
  const preset = api.sectionPresets?.[story.sectionPreset];
  const sceneSecIdx = scene.sectionIdx ?? 0;
  const sec = preset?.sections?.[sceneSecIdx];
  if (slugEl) slugEl.textContent = scene.name;
  if (bcEl)   bcEl.textContent   = story.name + (sec ? ` › ${sec.act || ''} › ${sec.name}` : '');

  // Update active highlight in scene list
  document.querySelectorAll('[id^="tdc-"]').forEach(el => el.classList.remove('sc-a'));
  const card = document.getElementById('tdc-' + scene.id);
  if (card) card.classList.add('sc-a');

  rec.style.display        = 'flex';
  rec.style.flexDirection  = 'column';
  rec.style.alignItems     = '';
  rec.style.justifyContent = '';

  rec.innerHTML = `
    <div style="width:100%;max-width:680px;padding:16px 20px 24px;display:flex;flex-direction:column;gap:12px;margin:0 auto;">

      <!-- Character numpad -->
      <div class="npd" id="rec-npd">
        ${buildNumpad(scene)}
      </div>

      <!-- Waveform / progress bar -->
      <div id="rec-wave-area" style="display:flex;align-items:center;gap:8px;">
        ${buildWaveArea()}
      </div>

      <!-- Transcript toggle + export -->
      <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
        <button class="ib" onclick="TD.toggleTranscript()">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
          </svg>
          <span id="rec-tview-label">Show Transcript</span>
        </button>
        <button class="ib" onclick="TD.exportTranscript()">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          Export Transcript
        </button>
      </div>

      <!-- Transcript (hidden by default) -->
      <div id="rec-transcript" style="display:none;max-height:220px;overflow-y:auto;border:1px solid rgba(255,255,255,0.1);border-radius:7px;padding:10px 12px;"></div>

    </div>
  `;

  updateWaveArea();
  await loadSceneAudio(story, scene);
}

function buildNumpad(scene) {
  const rows = [7,8,9,4,5,6,1,2,3];
  return rows.map(i => `
    <div class="cb" id="cb-${i}" onclick="TD.charPress(${i})" title="Press ${i} on keyboard">
      <span style="overflow:hidden;" id="cbn-${i}">${scene.chars?.[i] || 'NAME-'+i}</span>
      <span class="cn">${i}</span>
    </div>
  `).join('') + `
    <div class="acb" id="cb-0" onclick="TD.charPress(0)" title="Press 0 on keyboard">
      ACTION <span class="cn" style="bottom:2px;right:3px;">0</span>
    </div>
    <div style="display:flex;align-items:center;justify-content:center;">
      <div class="mb" id="rec-mic" onclick="TD.toggleRecord()">
        ${micSVG()}
      </div>
    </div>
  `;
}

function buildWaveArea() {
  return `
    <div id="rec-wave-setup" style="flex:1;text-align:center;font-size:11px;color:var(--ghost);display:flex;align-items:center;justify-content:center;gap:8px;">
      Tap the mic to begin
    </div>
    <div id="rec-wave-active" style="flex:1;display:none;align-items:center;gap:6px;">
      <span class="rt" id="rec-timer">00:00</span>
      <div class="rw">
        <div class="rf" id="rec-progress" style="width:0%"></div>
        <div class="rc"></div>
        <canvas id="viscanvas" style="position:absolute;top:0;left:0;width:100%;height:100%;"></canvas>
      </div>
      <span class="rt" id="rec-max">${time2ms(App.state.sceneMax)}</span>
    </div>
    <div id="rec-wave-transcribing" style="flex:1;display:none;align-items:center;justify-content:center;gap:8px;">
      <div class="spinner" style="width:16px;height:16px;border:2px solid var(--yellow);border-top-color:transparent;border-radius:50%;animation:spin .7s linear infinite;"></div>
      <span style="font-size:11px;color:var(--ghost);">Transcribing… <span id="rec-trans-pct">0%</span></span>
    </div>
    <audio id="rec-audio" controls style="flex:1;display:none;height:28px;"></audio>
  `;
}

function micSVG(active) {
  if (active) {
    return `<svg width="18" height="18" viewBox="0 0 512 512" fill="var(--green)">
      <path d="M224 432h-80V80h80zM368 432h-80V80h80z"/>
    </svg>`;
  }
  return `<svg width="14" height="19" viewBox="0 0 14 19" fill="var(--yellow)">
    <path fill-rule="evenodd" clip-rule="evenodd" d="M7 12C8.7 12 10 10.7 10 9V3C10 1.3 8.7 0 7 0C5.3 0 4 1.3 4 3V9C4 10.7 5.3 12 7 12ZM12.3 9C12.3 12 9.8 14.1 7 14.1C4.2 14.1 1.7 12 1.7 9H0C0 12.4 2.7 15.2 6 15.7V19H8V15.7C11.3 15.2 14 12.4 14 9H12.3Z"/>
  </svg>`;
}

// ── Audio loading ─────────────────────────────────────────────────────────────

async function loadSceneAudio(story, scene) {
  App.state.loading++;
  try {
    for (const tid in scene.tracks) {
      const fd = new FormData();
      fd.append('cmd', 'getAudio');
      fd.append('id', story.id + '-' + scene.id + '-' + tid);
      const rsp  = await utils.apiReq(fd, true);
      const data = await rsp.blob();
      if (data.type.match('audio')) scene.tracks[tid].audio = data;
    }
    const result = await compileAudio(story, scene);
    scene.duration = result.duration ?? scene.duration;
    App.state.audioURL = result.audioURL || '';
    updateWaveArea();
  } catch(err) {
    App.showAlert('Error loading audio: ' + err);
  } finally {
    App.state.loading--;
  }
}

// ── Audio compile ─────────────────────────────────────────────────────────────

async function compileAudio(story, scene) {
  const audioContext = new AudioContext();
  const buffs = [], errs = [];

  for (const tid of (scene.trackOrder || [])) {
    if (!scene.tracks[tid]?.audio?.arrayBuffer) continue;
    try {
      const ab = await scene.tracks[tid].audio.arrayBuffer();
      buffs.push(await audioContext.decodeAudioData(ab));
    } catch(e) { errs.push(e); }
  }

  for (const item of App.state.sessionBlobs) {
    if (!item.blob?.arrayBuffer) continue;
    try {
      const ab = await item.blob.arrayBuffer();
      buffs.push(await audioContext.decodeAudioData(ab));
    } catch(e) { errs.push(e); }
  }

  if (!buffs.length) return {};

  const channels = buffs.map(b => b.numberOfChannels);
  const nCh      = channels.reduce((a, b) => Math.min(a, b));
  const total    = buffs.reduce((a, b) => a + b.length, 0);
  const tmp      = audioContext.createBuffer(nCh, total, audioContext.sampleRate);

  for (let ch = 0; ch < nCh; ch++) {
    const channel = tmp.getChannelData(ch);
    let offset = 0;
    for (const b of buffs) { channel.set(b.getChannelData(ch), offset); offset += b.length; }
  }

  const [left, right] = [tmp.getChannelData(0), tmp.getChannelData(0)];
  const interleaved   = new Float32Array(left.length + right.length);
  for (let src=0, dst=0; src < left.length; src++, dst+=2) {
    interleaved[dst] = left[src]; interleaved[dst+1] = right[src];
  }

  const wavBytes = getWavBytes(interleaved.buffer, { isFloat:true, numChannels:2, sampleRate: audioContext.sampleRate });
  return { duration: tmp.duration, audioURL: URL.createObjectURL(new Blob([wavBytes], { type:'audio/wav' })) };
}

// ── Wave area state management ─────────────────────────────────────────────────

function updateWaveArea() {
  const s    = App.state;
  const area = document.getElementById('rec-wave-setup');
  const act  = document.getElementById('rec-wave-active');
  const trans = document.getElementById('rec-wave-transcribing');
  const audio = document.getElementById('rec-audio');
  const mic   = document.getElementById('rec-mic');

  if (!area) return;

  if (mic) mic.innerHTML = micSVG(s.mode === 'active');
  if (mic) mic.classList.toggle('rec-on', s.mode === 'active');

  if (s.mode === 'active') {
    area.style.display  = 'none';
    trans.style.display = 'none';
    if (audio) audio.style.display = 'none';
    if (act)  { act.style.display  = 'flex'; }
  } else if (s.mode === 'transcription') {
    area.style.display  = 'none';
    if (act) act.style.display   = 'none';
    if (audio) audio.style.display = 'none';
    trans.style.display = 'flex';
  } else {
    if (act)  act.style.display  = 'none';
    trans.style.display = 'none';
    if (s.audioURL) {
      area.style.display  = 'none';
      if (audio) { audio.src = s.audioURL; audio.style.display = ''; }
    } else {
      area.style.display  = 'flex';
      if (audio) audio.style.display = 'none';
    }
  }
}

// ── Recorder init ─────────────────────────────────────────────────────────────

async function recorderInit() {
  if (mediaRecorder) return;
  if (!navigator.mediaDevices?.getUserMedia) {
    App.showAlert('Audio recording not supported.'); return;
  }
  try {
    if (!mediaStream) {
      mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation:true, noiseSuppression:true, autoGainControl:true, sampleRate:48000, channelCount:1 }
      });
    }
    const options = { audioBitsPerSecond: 128000 };
    if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus'))   options.mimeType = 'audio/webm;codecs=opus';
    else if (MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')) options.mimeType = 'audio/ogg;codecs=opus';

    mediaRecorder = new MediaRecorder(mediaStream, options);
    mediaRecorder.ondataavailable = (e) => { chunks.push(e.data); };
    mediaRecorder.onstop = () => { addTrack(); };
  } catch(err) {
    App.showAlert('Microphone access denied. Please allow microphone and reload.', 5000);
  }
}

function addTrack() {
  const story = App.state.activeStory;
  const scene = App.state.activeScene;
  if (!story?.id || !scene?.id) return;

  const tid      = genId();
  const mimeType = mediaRecorder?.mimeType || 'audio/webm;codecs=opus';
  const blob     = new Blob(chunks, { type: mimeType });
  chunks = [];

  App.state.sessionBlobs.push({
    tid,
    blob,
    charName: scene.chars?.[App.state.prevnum] || 'ACTION',
  });

  if (mediaRecorder?.state === 'inactive') {
    compileAudio(story, scene).then(r => {
      scene.duration = r.duration;
      App.state.audioURL = r.audioURL || '';
      updateWaveArea();
    });
  }
}

// ── Start / stop recording ────────────────────────────────────────────────────

function startStopRecording(n, theEnd) {
  n = parseInt(n, 10);
  if (isNaN(n) || n < 0 || n > 9 || App.state.mode === 'setup') return;
  if (!mediaRecorder) return;

  if (mediaRecorder.state === 'recording' && (App.state.currnum !== n || theEnd)) {
    App.state.prevnum  = App.state.currnum;
    App.state.currnum  = undefined;
    mediaRecorder.stop();
    updateCharButtons();
  }
  if (mediaRecorder.state === 'inactive' && !theEnd) {
    App.state.currnum = n;
    mediaRecorder.start();
    updateCharButtons();
  }
}

function updateCharButtons() {
  for (let i = 0; i <= 9; i++) {
    const el = document.getElementById('cb-' + i);
    if (!el) continue;
    el.classList.toggle('cba', App.state.currnum === i && App.state.mode === 'active');
  }
}

function trackTimer() {
  if (App.state.mode === 'active' && App.state.timer >= App.state.sceneMax) {
    TD.toggleRecord(); return;
  }
  App.state.timer++;
  App.state.timerDisplay = time2ms(App.state.timer);
  const timerEl = document.getElementById('rec-timer');
  if (timerEl) timerEl.textContent = App.state.timerDisplay;
  const pct = Math.min(App.state.timer / App.state.sceneMax * 100, 100);
  const bar = document.getElementById('rec-progress');
  if (bar) bar.style.width = pct + '%';
}

function visualizer(canvas) {
  if (!canvas || !mediaStream) return;
  const audioCtx   = new AudioContext();
  const canvasCtx  = canvas.getContext('2d');
  const source     = audioCtx.createMediaStreamSource(mediaStream);
  const analyser   = audioCtx.createAnalyser();
  analyser.fftSize = 2048;
  const bufferLength = analyser.frequencyBinCount;
  const dataArray    = new Uint8Array(bufferLength);
  source.connect(analyser);

  function draw() {
    if (mediaRecorder?.state !== 'recording') return;
    requestAnimationFrame(draw);
    analyser.getByteTimeDomainData(dataArray);
    const W = canvas.width, H = canvas.height;
    canvasCtx.clearRect(0, 0, W, H);
    canvasCtx.lineWidth = 2;
    canvasCtx.strokeStyle = '#146c1d';
    canvasCtx.beginPath();
    const sw = W / bufferLength;
    let x = 0;
    for (let i = 0; i < bufferLength; i++) {
      const y = (dataArray[i] / 128) * H / 2;
      i === 0 ? canvasCtx.moveTo(x, y) : canvasCtx.lineTo(x, y);
      x += sw;
    }
    canvasCtx.lineTo(W, H/2);
    canvasCtx.stroke();
  }
  draw();
}

// ── Batch transcription ───────────────────────────────────────────────────────

async function batchTranscribe(story, scene) {
  if (!App.state.sessionBlobs.length) return;
  App.state.mode = 'transcription';
  App.state.transcriptionProgress = { current: 0, total: App.state.sessionBlobs.length };
  updateWaveArea();

  try {
    const fd = new FormData();
    fd.append('cmd', 'batchTranscribe');
    fd.append('storyId', story.id);
    fd.append('sceneId', scene.id);
    App.state.sessionBlobs.forEach((item, idx) => {
      fd.append(`audio_${idx}`, item.blob);
      fd.append(`tid_${idx}`, item.tid);
      fd.append(`charName_${idx}`, item.charName);
    });
    fd.append('count', App.state.sessionBlobs.length);

    const total     = App.state.sessionBlobs.length;
    const estMs     = total * 4000;
    const interval  = 100;
    const inc       = total / (estMs / interval);
    const progTimer = setInterval(() => {
      const pct = document.getElementById('rec-trans-pct');
      App.state.transcriptionProgress.current = Math.min(App.state.transcriptionProgress.current + inc, total - 0.5);
      if (pct) pct.textContent = Math.round(App.state.transcriptionProgress.current / total * 100) + '%';
    }, interval);

    const data = await utils.apiReq(fd);
    clearInterval(progTimer);
    App.state.transcriptionProgress.current = total;

    if (data.error) throw new Error(data.error);

    if (data.transcripts) {
      data.transcripts.forEach((item, idx) => {
        const sb = App.state.sessionBlobs[idx];
        scene.tracks[item.tid] = { name: sb.charName, audio: sb.blob, transcript: item.transcript || '[No speech detected]' };
        scene.trackOrder.push(item.tid);
      });
    }

    await api.saveStory(story);
    App.state.sessionBlobs = [];

    const result = await compileAudio(story, scene);
    scene.duration = result.duration;
    App.state.audioURL = result.audioURL || '';
    renderTranscript(scene);

  } catch(err) {
    App.showAlert('Transcription error: ' + err);
    console.error(err);
  } finally {
    App.state.mode = 'setup';
    updateWaveArea();
  }
}

// ── Transcript display ────────────────────────────────────────────────────────

let _tviewOpen = false;

function renderTranscript(scene) {
  const el = document.getElementById('rec-transcript');
  if (!el) return;
  if (!(scene.trackOrder || []).length) { el.innerHTML = '<div style="color:var(--ghost);font-size:11px;">No transcript yet.</div>'; return; }

  el.innerHTML = `
    <div style="font-size:9px;color:rgba(186,232,232,0.35);font-style:italic;margin-bottom:8px;text-align:center;">
      Click any line to edit in TalkingStories
    </div>
    ${(scene.trackOrder || []).map(tid => {
      const t = scene.tracks[tid];
      if (!t) return '';
      if (t.name === 'ACTION') {
        return `<div class="spa tl" contenteditable="true" onblur="TD.editTrack('${tid}','transcript',this.innerText)">${t.transcript || ''}</div>`;
      }
      return `<div class="spc">
        <div class="spn tl" contenteditable="true" onblur="TD.editTrack('${tid}','name',this.innerText)">${t.name}</div>
        <div class="spl tl" contenteditable="true" onblur="TD.editTrack('${tid}','transcript',this.innerText)">${t.transcript || ''}</div>
      </div>`;
    }).join('')}
  `;
}

// ── Layout ────────────────────────────────────────────────────────────────────

function applyTDLayout(layout) {
  const left  = document.getElementById('td-left');
  const right = document.getElementById('td-right');
  if (!left || !right) return;

  // Remove 1-col overlay if present
  const existing = document.getElementById('td-onecol');
  if (existing) existing.remove();

  if (layout === '2col') {
    left.style.display  = 'flex';
    right.style.display = 'flex';
    right.style.flex    = '1';
  } else {
    left.style.display  = 'none';
    right.style.display = 'none';
    renderTDOneCol();
  }
}

function renderTDOneCol() {
  const story = App.state.activeStory;
  if (!story) return;

  const inner = document.getElementById('td-inner');
  if (!inner) return;

  const preset = api.sectionPresets?.[story.sectionPreset];
  if (!preset) return;

  const activeId = App.state.activeScene?.id;

  const sectionsHtml = preset.sections.map((sec, idx) => {
    const scenes = (story.scenes || []).filter(s => s.sectionIdx === idx);
    const sceneCount = scenes.length;

    const scenesHtml = scenes.map(scene => {
      const absIdx = (story.scenes || []).findIndex(s => s.id === scene.id);
      const dur    = scene.duration || 0;
      const pp     = dur ? (Math.round(dur/2/60*10)/10).toFixed(1) + ' pp' : '';
      const isActive = scene.id === activeId;
      return `
        <div class="sc${isActive ? ' sc-a' : ''}" id="tdc1-${scene.id}"
             style="margin-bottom:5px;cursor:pointer;">
          <div class="sc-body">
            <div style="font-family:'DM Mono',monospace;font-size:11px;font-weight:600;margin-bottom:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${scene.name}</div>
            ${scene.desc ? `<div style="font-size:10px;color:var(--ghost);font-style:italic;">${scene.desc.substring(0,80)}${scene.desc.length>80?'…':''}</div>` : ''}
            ${pp ? `<div style="font-size:9px;color:var(--dim);font-family:'DM Mono',monospace;margin-top:3px;">${pp} dictated</div>` : ''}
          </div>
          <div class="sc-acts">
            <button class="tyd" onclick="event.stopPropagation();TD._open1ColScene(${absIdx})" title="Open in recorder">
              <svg width="9" height="11" viewBox="0 0 14 19" fill="currentColor"><path fill-rule="evenodd" clip-rule="evenodd" d="M7 12C8.7 12 10 10.7 10 9V3C10 1.3 8.7 0 7 0C5.3 0 4 1.3 4 3V9C4 10.7 5.3 12 7 12ZM12.3 9C12.3 12 9.8 14.1 7 14.1C4.2 14.1 1.7 12 1.7 9H0C0 12.4 2.7 15.2 6 15.7V19H8V15.7C11.3 15.2 14 12.4 14 9H12.3Z"/></svg>
              Talk Your Draft
            </button>
            <svg class="dh" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 9l4-4 4 4m0 6l-4 4-4-4"/></svg>
            <svg class="tb" onclick="event.stopPropagation();TD.deleteScene(${absIdx})" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg>
          </div>
        </div>`;
    }).join('');

    return `
      <div style="margin-bottom:8px;">
        <div style="background:var(--surface);border-radius:6px 6px ${sceneCount ? '0 0' : '6px 6px'};
          border:1px solid rgba(255,255,255,0.07);
          padding:7px 10px;display:flex;align-items:center;justify-content:space-between;cursor:pointer;"
             onclick="TD._toggle1ColSec(this)">
          <div style="display:flex;align-items:center;gap:8px;min-width:0;">
            <svg class="td1-chev" style="transition:transform .15s;flex-shrink:0;transform:rotate(180deg);" width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" stroke-width="2.5"><path d="M19 9l-7 7-7-7"/></svg>
            <span style="font-size:9px;color:var(--ghost);font-family:'DM Mono',monospace;white-space:nowrap;flex-shrink:0;">${sec.act || '—'}</span>
            <span style="font-family:'Syne',sans-serif;font-size:11px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${sec.name}</span>
          </div>
          <div style="display:flex;align-items:center;gap:6px;flex-shrink:0;">
            ${sceneCount ? `<span style="font-size:9px;color:var(--ghost);font-family:'DM Mono',monospace;">${sceneCount}sc</span>` : ''}
            <button class="ab" style="font-size:8px;padding:2px 7px;" onclick="event.stopPropagation();TD.addSceneToSection(${idx})">
              <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 5v14M5 12h14"/></svg> Add
            </button>
          </div>
        </div>
        ${scenesHtml ? `
          <div class="td1sec-body" style="border:1px solid rgba(255,255,255,0.06);border-top:none;border-radius:0 0 6px 6px;padding:5px 6px 6px;">${scenesHtml}</div>` : ''}
      </div>`;
  }).join('');

  const overlay = document.createElement('div');
  overlay.id = 'td-onecol';
  overlay.style.cssText = 'flex:1;display:flex;flex-direction:column;overflow:hidden;';
  overlay.innerHTML = `
    <div style="padding:8px 12px;border-bottom:1px solid rgba(255,255,255,0.06);background:var(--card);flex-shrink:0;display:flex;align-items:center;justify-content:space-between;">
      <div>
        <div style="font-size:9px;color:var(--ghost);font-family:'DM Mono',monospace;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:1px;">TalkingDraft — Scene Browser</div>
        <div style="font-family:'DM Mono',monospace;font-size:9px;color:var(--ghost);">${story.name} › ${story.sectionPreset}</div>
      </div>
      <button class="ib" onclick="TD.exportTranscript()">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        Export
      </button>
    </div>
    <div style="flex:1;overflow-y:auto;padding:8px 12px 20px;">${sectionsHtml}</div>
  `;

  inner.appendChild(overlay);
}

// ── Key handling ──────────────────────────────────────────────────────────────

function handleKey(detail) {
  const { key, code } = detail;
  if (App.state.mode === 'active') {
    if (key === ' ' || code === 'NumpadDecimal') { TD.toggleRecord(); return; }
    startStopRecording(key, false);
  } else if (App.state.mode === 'setup') {
    if (code === 'NumpadDecimal') TD.toggleRecord();
  }
}

// ── Global TD actions ─────────────────────────────────────────────────────────

window.TD = {

  selectScene(absIdx) {
    const story = App.state.activeStory;
    if (!story) return;
    const scene = story.scenes[absIdx];
    if (!scene) return;
    App.state.activeScene = scene;
    document.querySelectorAll('[id^="tdc-"]').forEach(el => el.classList.remove('sc-a'));
    const card = document.getElementById('tdc-' + scene.id);
    if (card) card.classList.add('sc-a');
    openScene(scene);
  },

  // Open a scene from 1-col view — switch to 2-col first then open
  _open1ColScene(absIdx) {
    const story = App.state.activeStory;
    if (!story) return;
    const scene = story.scenes[absIdx];
    if (!scene) return;
    // Switch to 2-col layout
    App.state.layout = '2col';
    document.dispatchEvent(new CustomEvent('ts:layout', { detail: { tab: 'td', layout: '2col' } }));
    // Update toggle button state
    const btn = document.getElementById('layout-btn');
    if (btn) {
      const lbl = btn.querySelector('#toglbl');
      if (lbl) lbl.textContent = '1 Col';
    }
    // Open the scene
    App.state.activeScene = scene;
    openScene(scene);
  },

  // Toggle section collapse in TD left column (2-col mode)
  _toggleTDSec(headerEl) {
    const body = headerEl.nextElementSibling;
    const chev = headerEl.querySelector('.tdsec-chev');
    if (!body || !body.classList.contains('tdsec-body')) return;
    const isOpen = body.style.display !== 'none';
    body.style.display = isOpen ? 'none' : 'block';
    if (chev) chev.style.transform = isOpen ? '' : 'rotate(180deg)';
  },

  // Toggle section collapse in TD 1-col view
  _toggle1ColSec(headerEl) {
    const body = headerEl.nextElementSibling;
    const chev = headerEl.querySelector('.td1-chev');
    if (!body || !body.classList.contains('td1sec-body')) return;
    const isOpen = body.style.display !== 'none';
    body.style.display = isOpen ? 'none' : 'block';
    if (chev) chev.style.transform = isOpen ? '' : 'rotate(180deg)';
  },

  addSceneToSection(sectionIdx) {
    const story = App.state.activeStory;
    if (!story || !App.checkStuff()) return;
    api.addScene(story, sectionIdx, null, []);
    api.saveStory(story);
    // Re-render appropriate view
    const layout = App.state.layout || '2col';
    if (layout === '2col') {
      renderSceneList(story);
    } else {
      renderTDOneCol();
    }
  },

  prevScene() {
    const story = App.state.activeStory;
    const scene = App.state.activeScene;
    if (!story || !scene) return;
    const idx = story.scenes.findIndex(s => s.id === scene.id);
    if (idx > 0) this.selectScene(idx - 1);
  },

  nextScene() {
    const story = App.state.activeStory;
    const scene = App.state.activeScene;
    if (!story || !scene) return;
    const idx = story.scenes.findIndex(s => s.id === scene.id);
    if (idx < story.scenes.length - 1) this.selectScene(idx + 1);
  },

  deleteScene(absIdx) {
    const story = App.state.activeStory;
    if (!story) return;
    const scene = story.scenes[absIdx];
    if (!scene) return;
    App.showConfirmModal('Delete Scene?',
      `Delete "${scene.name}"? This cannot be undone.`,
      () => {
        if (App.state.activeScene?.id === scene.id) App.state.activeScene = null;
        story.scenes.splice(absIdx, 1);
        api.saveStory(story);
        renderSceneList(story);
      });
  },

  charPress(n) {
    if (App.state.mode === 'active') { startStopRecording(n, false); return; }
    const story = App.state.activeStory;
    const scene = App.state.activeScene;
    if (!story || !scene) return;
    const current = scene.chars?.[n] || (n === 0 ? 'ACTION' : 'NAME-' + n);
    if (n === 0) return;
    App.showPromptModal(
      'Rename Character',
      `Enter name for button ${n}:`,
      current,
      (newName) => {
        if (!newName?.trim()) return;
        if (!scene.chars) scene.chars = ['ACTION','NAME-1','NAME-2','NAME-3','NAME-4','NAME-5','NAME-6','NAME-7','NAME-8','NAME-9'];
        scene.chars[n] = newName.trim().toUpperCase();
        scene.lastModified = Date.now();
        api.saveStory(story);
        const lbl = document.getElementById('cbn-' + n);
        if (lbl) lbl.textContent = scene.chars[n];
      }
    );
  },

  async toggleRecord() {
    const story = App.state.activeStory;
    const scene = App.state.activeScene;
    if (!story || !scene) { App.showAlert('Select a scene first.'); return; }
    if (App.state.loading) { App.showAlert('Loading in progress'); return; }

    if (!mediaRecorder) { await recorderInit(); if (!mediaRecorder) return; }

    if (App.state.mode === 'setup') {
      if ((scene.duration || 0) >= App.state.sceneMax) { App.showAlert('Maximum scene length reached.'); return; }
      App.state.mode    = 'active';
      App.state.timer   = scene.duration || 0;
      App.state.currnum = 0;
      mediaRecorder.start();
      timerIntervalID = setInterval(trackTimer, 1000);
      visualizer(document.getElementById('viscanvas'));
      updateWaveArea(); updateCharButtons();
    } else if (App.state.mode === 'active') {
      await new Promise(resolve => {
        const orig = mediaRecorder.onstop;
        mediaRecorder.onstop = async (e) => { await orig?.call(this, e); mediaRecorder.onstop = orig; resolve(); };
        startStopRecording(App.state.currnum, true);
      });
      clearInterval(timerIntervalID);
      await batchTranscribe(story, scene);
    }
  },

  toggleTranscript() {
    _tviewOpen = !_tviewOpen;
    const el    = document.getElementById('rec-transcript');
    const label = document.getElementById('rec-tview-label');
    if (el) el.style.display = _tviewOpen ? 'block' : 'none';
    if (label) label.textContent = _tviewOpen ? 'Hide Transcript' : 'Show Transcript';
    if (_tviewOpen) renderTranscript(App.state.activeScene);
  },

  editTrack(tid, field, value) {
    const scene = App.state.activeScene;
    const story = App.state.activeStory;
    if (!scene?.tracks?.[tid]) return;
    value = value?.trim() || '';
    if (field === 'name')       scene.tracks[tid].name = value ? value.toUpperCase() : 'NAME';
    if (field === 'transcript') scene.tracks[tid].transcript = value;
    scene.lastModified = Date.now();
    api.saveStory(story);
  },

  async exportTranscript() {
    const story = App.state.activeStory;
    if (!story?.scenes?.length) { App.showAlert('No transcript available.'); return; }

    let out = '';
    for (const scene of story.scenes) {
      out += scene.name + '\n\n';
      for (const tid of (scene.trackOrder || [])) {
        const t = scene.tracks[tid];
        if (!t?.transcript || t.transcript === 'Pending transcription') continue;
        out += t.name === 'ACTION' ? ('\n' + t.transcript + '\n\n') : (t.name + '\n' + t.transcript + '\n\n');
      }
      out += '\n';
    }
    out = out.replace(/\n{3,}/g, '\n\n');
    if (!out.trim()) { App.showAlert('No transcript available.'); return; }

    try {
      if (typeof Neutralino !== 'undefined' && Neutralino.os) {
        const savePath = await Neutralino.os.showSaveDialog('Save Transcript');
        if (savePath) {
          let p = savePath;
          if (!p.toLowerCase().endsWith('.txt')) p += '.txt';
          await Neutralino.filesystem.writeFile(p, out);
          App.showAlert('Transcript saved.', 2000, false, 'notice');
        }
      }
    } catch(err) {
      if (err?.code !== 'NE_OS_DIACANC') App.showAlert('Save error: ' + (err?.message || err));
    }
  },
};
