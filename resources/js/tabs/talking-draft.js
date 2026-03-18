/**
 * TalkingStudio — tabs/talking-draft.js
 * Tab 2 (merged): ScriptOutliner (1-col) + TalkingDraft recorder (2-col)
 *
 * 1-col = ScriptOutliner view: sections + scene cards with beat fields + Talk Your Draft buttons
 * 2-col = TalkingDraft view:   scene list (left) + recorder panel (right)
 *
 * Build plan A-K implemented:
 *   A  Record button: correct CSS selectors + 3-level HTML structure
 *   B  Scene card textarea: onfocus loads scene (not stopPropagation)
 *   C  Scene name editable input in 2-col cards
 *   D  Manual completion checkbox (scene.done) replaces automated transcript label
 *   E  Keyboard SVG in Instructions panel — corrected layout and SVG
 *   F  allChars() dropdown in character rename modal
 *   G  Drag-to-reorder scenes wired up
 *   I  Before-unload warning covers active recording mode
 *   J  2-col discovery hint (pulse + tooltip, localStorage counter)
 *   K  pp/time global toggle on scene cards
 */

import { api, utils, genId, time2ms, storyDuration, sectionBeats } from '../lib/utils.js';

// ── Recorder internals ────────────────────────────────────────────────────────

let mediaRecorder   = null;
let mediaStream     = null;
let chunks          = [];
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
  const numFrames      = options.numFrames;
  const numChannels    = options.numChannels || 2;
  const sampleRate     = options.sampleRate  || 44100;
  const bytesPerSample = options.isFloat ? 4 : 2;
  const format         = options.isFloat ? 3 : 1;
  const blockAlign     = numChannels * bytesPerSample;
  const byteRate       = sampleRate * blockAlign;
  const dataSize       = numFrames * blockAlign;
  const buffer = new ArrayBuffer(44);
  const dv = new DataView(buffer);
  let p = 0;
  const ws   = (s) => { for (let i=0;i<s.length;i++) dv.setUint8(p+i,s.charCodeAt(i)); p+=s.length; };
  const wu32 = (d) => { dv.setUint32(p,d,true); p+=4; };
  const wu16 = (d) => { dv.setUint16(p,d,true); p+=2; };
  ws('RIFF'); wu32(dataSize+36); ws('WAVE'); ws('fmt '); wu32(16);
  wu16(format); wu16(numChannels); wu32(sampleRate); wu32(byteRate);
  wu16(blockAlign); wu16(bytesPerSample*8); ws('data'); wu32(dataSize);
  return new Uint8Array(buffer);
}

// ── Collapse/expand state ─────────────────────────────────────────────────────
let _allOpen2col = true;
let _allOpen1col = true;

// ── Drag state ────────────────────────────────────────────────────────────────
let _dragFromIdx = null;

// ── Helpers ───────────────────────────────────────────────────────────────────

const isFreeForm = (story) => story?.sectionPreset === 'Free Form';

function secPP(story, sectionIdx) {
  const dur = (story.scenes || [])
    .filter(s => s.sectionIdx === sectionIdx)
    .reduce((sum, s) => sum + (s.duration || 0), 0);
  return dur ? (Math.round(dur / 120 * 10) / 10).toFixed(1) + ' pp' : '';
}

// ── allChars: unique non-default names across all scenes, sorted by frequency ──

function _allCharsSorted(story) {
  const freq = {};
  for (const scene of (story.scenes || [])) {
    // From numpad assignments
    for (let i = 1; i <= 9; i++) {
      const n = scene.chars?.[i];
      if (n && !n.match(/^NAME-\d$/)) freq[n] = (freq[n] || 0) + 1;
    }
    // From transcript tracks
    for (const tid of (scene.trackOrder || [])) {
      const t = scene.tracks?.[tid];
      if (t?.name && t.name !== 'ACTION' && !t.name.match(/^NAME-\d$/)) {
        freq[t.name] = (freq[t.name] || 0) + 1;
      }
    }
  }
  return Object.keys(freq).sort((a,b) => freq[b] - freq[a]);
}

// ── Render shell ──────────────────────────────────────────────────────────────

export function renderTalkingDraft(container) {
  container.innerHTML = '<div id="td-inner" style="display:flex;flex:1;overflow:hidden;"></div>';

  document.addEventListener('ts:storyopen', (e) => initTD(e.detail.story));
  document.addEventListener('ts:openscene', (e) => openScene(e.detail.scene));
  document.addEventListener('ts:layout',    (e) => { if (e.detail.tab === 'td') applyTDLayout(e.detail.layout); });
  document.addEventListener('ts:tabenter',  (e) => { if (e.detail.tab === 'td') applyTDLayout(App.state.layout); });
  document.addEventListener('ts:keyup',     (e) => handleKey(e.detail));

  // J: extend before-unload to cover active recording (item I)
  window.addEventListener('beforeunload', (e) => {
    if (App.state.mode === 'active' || App.state.mode === 'transcription') {
      e.preventDefault(); e.returnValue = '';
    }
  });
}

// ── Init 2-col shell ──────────────────────────────────────────────────────────

function initTD(story) {
  const inner = document.getElementById('td-inner');
  if (!inner) return;

  if (!(story.scenes?.length)) {
    api.addScene(story, 0, null, []);
    api.saveStory(story);
  }

  // J: 2-col discovery hint counter
  const seenCount = parseInt(localStorage.getItem('td_tog_seen') || '0', 10);
  const showPulse = seenCount < 6;
  if (showPulse) localStorage.setItem('td_tog_seen', String(seenCount + 1));

  inner.innerHTML = [
    '<!-- LEFT -->',
    '<div id="td-left" style="flex:1;display:flex;flex-direction:column;overflow:hidden;background:var(--deep);border-right:1px solid rgba(255,255,255,0.05);">',
    '  <div style="padding:8px 12px;border-bottom:1px solid rgba(255,255,255,0.05);background:var(--card);flex-shrink:0;">',
    '    <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">',
    '      <div style="font-size:9px;color:var(--ghost);font-family:\'DM Mono\',monospace;letter-spacing:0.06em;flex-shrink:0;">ScriptOutliner</div>',
    '      <div style="position:relative;flex:1;min-width:0;" id="td-story-nav">',
    '        <div style="display:flex;align-items:center;gap:5px;cursor:pointer;" onclick="TD._toggleStoryNav()">',
    '          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--yellow)" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m.75 12 3 3m0 0 3-3m-3 3v-6m-1.5-9H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" /></svg>',
    '          <span id="td-story-name" style="font-family:\'Syne\',sans-serif;font-size:13px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:200px;"></span>',
    '          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" stroke-width="2"><path d="M19 9l-7 7-7-7"/></svg>',
    '        </div>',
    '        <div id="td-story-menu" style="display:none;position:absolute;top:calc(100% + 4px);left:0;min-width:200px;background:var(--card);border:1px solid rgba(255,255,255,0.15);border-radius:7px;box-shadow:0 8px 32px rgba(0,0,0,0.7);z-index:200;overflow:hidden;" onclick="event.stopPropagation()">',
    '          <div style="padding:5px 0;border-bottom:1px solid rgba(255,255,255,0.08);">',
    '            <div class="ib" style="border:none;border-radius:0;justify-content:flex-start;font-size:11px;" onclick="TD._closeStoryNav();App.renameStory(App.state.activeStory)">Rename Story</div>',
    '            <div class="ib" style="border:none;border-radius:0;justify-content:flex-start;font-size:11px;" onclick="TD._closeStoryNav();App.copyStory(App.state.activeStory)">Copy Story</div>',
    '            <div class="ib" style="border:none;border-radius:0;justify-content:flex-start;font-size:11px;" onclick="TD._closeStoryNav();App.openExportModal(\'td\')">Export\u2026</div>',
    '            <div class="ib" style="border:none;border-radius:0;justify-content:flex-start;font-size:11px;color:#f87171;" onclick="TD._closeStoryNav();App.deleteStory(App.state.activeStory)">Delete Story</div>',
    '          </div>',
    '          <div id="td-other-stories" style="max-height:140px;overflow-y:auto;padding:4px 0;">',
    '            <div style="padding:4px 10px;font-size:9px;color:var(--ghost);font-family:\'DM Mono\',monospace;letter-spacing:0.05em;">YOUR STORIES</div>',
    '          </div>',
    '        </div>',
    '      </div>',
    '      <div style="display:flex;gap:5px;flex-shrink:0;">',
    '        <button class="ib" style="font-size:9px;" onclick="TD._collapseAll()" id="td-collapse-btn">Hide All</button>',
    '        <button class="ib" style="font-size:9px;" onclick="App.openExportModal(\'td\')"><svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> Export</button>',
    '      </div>',
    '    </div>',
    '    <div style="display:flex;align-items:center;gap:8px;">',
    '      <span style="font-size:10px;color:var(--ghost);">Structure</span>',
    '      <button id="td-struct-btn" class="ib" style="font-size:10px;flex:1;justify-content:flex-start;" onclick="App.openStructureModal(App.state.activeStory?.sectionPreset, TD._onStructureChange)"></button>',
    '      <span style="font-size:10px;color:var(--ghost);">Pages</span>',
    '      <input id="td-pages-input" type="number" class="fi" style="width:52px;text-align:center;font-size:11px;" min="1" max="999" onchange="TD._onPagesChange(this.value)" onfocus="this.select()"/>',
    '    </div>',
    '  </div>',
    '  <div id="td-scene-list" style="flex:1;overflow-y:auto;padding:8px 8px 20px;"></div>',
    '</div>',
    '<!-- RIGHT -->',
    '<div id="td-right" style="width:38%;min-width:400px;flex-shrink:0;display:flex;flex-direction:column;overflow:hidden;">',
    '  <div id="td-rec-hdr" style="background:var(--card);border-bottom:1px solid rgba(255,255,255,0.06);padding:8px 16px;display:flex;align-items:center;gap:7px;flex-shrink:0;">',
    '    <div style="flex:1;min-width:0;">',
    '      <div style="font-size:9px;color:var(--ghost);font-family:\'DM Mono\',monospace;letter-spacing:0.06em;margin-bottom:1px;">SceneDictation</div>',
    '      <div style="font-family:\'DM Mono\',monospace;font-size:9px;color:var(--ghost);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" id="td-rec-bc">No scene selected</div>',
    '      <div style="font-family:\'Courier Prime\',monospace;font-size:14px;font-weight:700;text-transform:uppercase;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" id="td-rec-slug">&nbsp;</div>',
    '    </div>',
    '    <button class="ib" style="font-size:10px;" onclick="TD.prevScene()" title="Previous scene"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 19l-7-7 7-7"/></svg> Prev</button>',
    '    <button class="ib" style="font-size:10px;" onclick="TD.nextScene()" title="Next scene">Next <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 5l7 7-7 7"/></svg></button>',
    '  </div>',
    '  <div id="td-recorder" style="flex:1;overflow-y:auto;display:flex;align-items:center;justify-content:center;border:2px solid var(--ghost);border-right:none;border-radius:8px 0 0 8px;">',
    '    <div style="color:var(--ghost);font-size:13px;text-align:center;padding:20px;">Select a scene to start recording.</div>',
    '  </div>',
    '</div>'
  ].join('\n');

  renderSceneList(story);
  setTimeout(() => openScene(mostRecentScene(story)), 50);

  // J: show discovery tooltip briefly if first few sessions
  if (showPulse) {
    const togBtn = document.getElementById('togbtn');
    if (togBtn) {
      togBtn.classList.remove('pulse');
      void togBtn.offsetWidth;
      togBtn.classList.add('pulse');
    }
  }
}

// ── 2-col scene list ──────────────────────────────────────────────────────────

function renderSceneList(story) {
  const list = document.getElementById('td-scene-list');
  if (!list) return;
  const nameEl = document.getElementById('td-story-name');
  if (nameEl) nameEl.textContent = story.name;
  const structBtn = document.getElementById('td-struct-btn');
  if (structBtn) structBtn.textContent = story.sectionPreset || 'Choose structure\u2026';
  const pagesInput = document.getElementById('td-pages-input');
  if (pagesInput) pagesInput.value = Math.round((story.minutes || 180) / 2);
  _populateOtherStories();

  const scenes = story.scenes || [];
  const preset = api.sectionPresets?.[story.sectionPreset];
  const ff     = isFreeForm(story);

  if (!preset) {
    list.innerHTML = scenes.map((scene, absIdx) => sceneCard2col(scene, absIdx)).join('');
    return;
  }

  const pages = Math.round((story.minutes || 90) / 2);

  list.innerHTML = preset.sections.map((sec, idx) => {
    const sectionScenes = scenes.map((s, i) => ({ scene: s, absIdx: i })).filter(({ scene }) => scene.sectionIdx === idx);
    const cards   = sectionScenes.map(({ scene, absIdx }) => sceneCard2col(scene, absIdx)).join('');
    const _beats  = ff ? '' : sectionBeats(story.sectionPreset, idx, pages);
    const beats   = (_beats && _beats !== '\u2014 pp') ? _beats : '';
    const cumulPP = secPP(story, idx);
    const secDescSafe = (sec.desc || '').replace(/"/g, '&quot;');
    const beatVal = (story.sections?.[idx]?.value || '').replace(/</g,'&lt;').replace(/>/g,'&gt;');

    return '<div style="margin:0 0 8px;" id="tdsec-wrap-' + idx + '">' +
      '<div class="tdsec-hdr" style="background:var(--surface);border-radius:5px 5px 0 0;padding:5px 8px;display:flex;align-items:center;gap:4px;cursor:pointer;" title="' + secDescSafe + '" onclick="TD._toggleTDSec(this)">' +
        '<svg class="tdsec-chev" style="transition:transform .15s;flex-shrink:0;transform:rotate(180deg);" width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" stroke-width="2.5"><path d="M19 9l-7 7-7-7"/></svg>' +
        '<span style="font-size:11px;font-weight:600;flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + sec.name + '</span>' +
        '<span style="font-family:\'DM Mono\',monospace;font-size:8px;color:var(--ghost);flex-shrink:0;">' + (beats || '') + '</span>' +
        (cumulPP ? '<span class="pp-toggle" style="font-family:\'DM Mono\',monospace;font-size:8px;color:var(--dim);flex-shrink:0;" onclick="event.stopPropagation();TD.togglePPMode()" title="Toggle pp/time">\u2248' + _ppDisplay(cumulPP) + '</span>' : '') +
        (sectionScenes.length ? '<span style="font-family:\'DM Mono\',monospace;font-size:8px;color:var(--ghost);flex-shrink:0;">' + sectionScenes.length + 'sc</span>' : '') +
      '</div>' +
      '<div class="tdsec-body" style="border:1px solid rgba(255,255,255,0.06);border-top:none;border-radius:0 0 5px 5px;padding:6px 6px 2px;">' +
        '<textarea class="gta" rows="2" style="margin-bottom:5px;font-size:11px;" placeholder="' + secDescSafe + '" onchange="TD.saveBeat(' + idx + ',this.value)">' + beatVal + '</textarea>' +
        cards +
        '<button class="ib" style="width:100%;font-size:9px;margin:4px 0 5px;justify-content:center;" onclick="TD.addSceneToSection(' + idx + ')">' +
          '<svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 5v14M5 12h14"/></svg> Add Scene' +
        '</button>' +
      '</div>' +
    '</div>';
  }).join('') + (ff ?
    '<button class="ab" style="width:100%;margin-top:6px;font-size:10px;justify-content:center;" onclick="TD.addSection()">' +
      '<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 5v14M5 12h14"/></svg> Add Section' +
    '</button>' : '');
}

// ── pp/time display helper ─────────────────────────────────────────────────────

function _ppDisplay(ppStr) {
  // ppStr is like "3.2 pp". In time mode, convert seconds to mm:ss
  const mode = App.state.ppMode || 'pp';
  if (mode === 'pp') return ppStr;
  // Convert pp back to duration: pp * 120 seconds
  const pp = parseFloat(ppStr);
  if (isNaN(pp)) return ppStr;
  return time2ms(Math.round(pp * 120));
}

function _scenePPDisplay(scene) {
  const dur = scene.duration || 0;
  const mode = App.state.ppMode || 'pp';
  if (!dur) return mode === 'pp' ? '0 pp' : '0:00';
  if (mode === 'pp') return (Math.round(dur/120*10)/10).toFixed(1) + ' pp';
  return time2ms(dur);
}

// ── 2-col scene card ──────────────────────────────────────────────────────────

function sceneCard2col(scene, absIdx) {
  const isActive = App.state.activeScene?.id === scene.id;
  const isDone   = scene.done === true;
  const display  = _scenePPDisplay(scene);
  const ppColor  = scene.duration ? 'var(--dim)' : 'rgba(107,122,153,0.45)';
  const border   = isActive ? 'border:2px solid var(--yellow);box-shadow:0 0 8px rgba(255,216,0,0.25);' : '';
  const descVal  = (scene.desc || '').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const nameVal  = scene.name.replace(/"/g,'&quot;');

  // B+C: outer card onclick loads scene; name input onfocus loads scene; textarea onfocus loads scene
  return '<div class="sc' + (isActive ? ' sc-a' : '') + '" id="tdc-' + scene.id + '" ' +
    'onclick="TD.selectScene(' + absIdx + ')" ' +
    'draggable="true" ' +
    'ondragstart="TD._dragStart(event,' + absIdx + ')" ' +
    'ondragover="TD._dragOver(event)" ' +
    'ondrop="TD._dragDrop(event,' + absIdx + ')" ' +
    'ondragleave="TD._dragLeave(event)" ' +
    'style="cursor:pointer;margin-bottom:6px;' + border + '">' +
    '<div style="display:flex;flex-direction:column;gap:4px;padding:6px 8px;flex:1;min-width:0;">' +
      // C: editable name input
      '<input class="gi" style="font-family:\'DM Mono\',monospace;font-size:11px;font-weight:600;" ' +
        'value="' + nameVal + '" ' +
        'onchange="TD.editSceneName(' + absIdx + ',this.value)" ' +
        'onfocus="TD.selectScene(' + absIdx + ');this.select()" ' +
        'onclick="event.stopPropagation()"/>' +
      // B: textarea onfocus loads scene
      '<textarea class="gta" rows="2" style="font-size:10px;" ' +
        'placeholder="Scene notes. Max 100 words." ' +
        'onchange="TD.editSceneDesc(' + absIdx + ',this.value)" ' +
        'onfocus="TD.selectScene(' + absIdx + ')">' + descVal + '</textarea>' +
      '<div style="display:flex;align-items:center;gap:6px;">' +
        // K: pp/time toggle
        '<span class="pp-toggle" style="font-family:\'DM Mono\',monospace;font-size:8px;color:' + ppColor + ';" ' +
          'onclick="event.stopPropagation();TD.togglePPMode()" title="Click to toggle pp / time">' + display + '</span>' +
      '</div>' +
    '</div>' +
    '<div style="display:flex;flex-direction:column;align-items:center;justify-content:flex-start;padding:6px 4px 6px 0;gap:8px;flex-shrink:0;">' +
      // D: manual completion checkbox
      '<div class="sc-done' + (isDone ? ' done' : '') + '" ' +
        'title="Mark scene complete" ' +
        'onclick="event.stopPropagation();TD.toggleDone(' + absIdx + ')"></div>' +
      '<svg class="dh" title="Drag to reorder" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" onclick="event.stopPropagation()"><path d="M8 9l4-4 4 4m0 6l-4 4-4-4"/></svg>' +
      '<svg class="tb" onclick="event.stopPropagation();TD.deleteScene(' + absIdx + ')" title="Delete" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>' +
    '</div>' +
  '</div>';
}

// ── 1-col ScriptOutliner view ─────────────────────────────────────────────────

function renderTDOneCol() {
  const story = App.state.activeStory;
  if (!story) return;

  const inner = document.getElementById('td-inner');
  if (!inner) return;

  document.getElementById('td-onecol')?.remove();
  const tdLeft  = document.getElementById('td-left');
  const tdRight = document.getElementById('td-right');
  if (tdLeft)  tdLeft.style.display  = 'none';
  if (tdRight) tdRight.style.display = 'none';

  const preset = api.sectionPresets?.[story.sectionPreset];
  if (!preset) return;

  const pages    = Math.round((story.minutes || 90) / 2);
  const ff       = isFreeForm(story);
  const activeId = App.state.activeScene?.id;

  const sectionsHtml = preset.sections.map((sec, idx) => {
    const section    = story.sections?.[idx] || { value: '' };
    const _beats     = ff ? '' : sectionBeats(story.sectionPreset, idx, pages);
    const beats      = (_beats && _beats !== '\u2014 pp') ? _beats : '';
    const scenes     = (story.scenes || []).filter(s => s.sectionIdx === idx);
    const sceneCount = scenes.length;
    const cumulPP    = secPP(story, idx);

    const scenesHtml = scenes.map(scene => {
      const absIdx   = (story.scenes || []).findIndex(s => s.id === scene.id);
      const display  = _scenePPDisplay(scene);
      const ppColor  = scene.duration ? 'var(--dim)' : 'rgba(107,122,153,0.45)';
      const isActive = scene.id === activeId;
      const isDone   = scene.done === true;
      const descVal  = (scene.desc || '').replace(/</g,'&lt;').replace(/>/g,'&gt;');
      return '<div class="sc' + (isActive ? ' sc-a' : '') + '" id="tdc1-' + scene.id + '" ' +
        'draggable="true" ' +
        'ondragstart="TD._dragStart(event,' + absIdx + ')" ' +
        'ondragover="TD._dragOver(event)" ' +
        'ondrop="TD._dragDrop(event,' + absIdx + ')" ' +
        'ondragleave="TD._dragLeave(event)" ' +
        'style="margin-bottom:5px;">' +
        '<div class="sc-body">' +
          '<input class="gi" style="font-family:\'DM Mono\',monospace;font-size:11px;font-weight:600;margin-bottom:3px;" ' +
            'value="' + scene.name.replace(/"/g,'&quot;') + '" ' +
            'onchange="TD.editSceneName(' + absIdx + ',this.value)" onfocus="this.select()"/>' +
          '<textarea class="gta" rows="2" placeholder="Scene notes. Max 100 words." ' +
            'onchange="TD.editSceneDesc(' + absIdx + ',this.value)">' + descVal + '</textarea>' +
          '<div style="display:flex;align-items:center;gap:6px;margin-top:3px;">' +
            '<span class="pp-toggle" style="font-family:\'DM Mono\',monospace;font-size:8px;color:' + ppColor + ';" ' +
              'onclick="event.stopPropagation();TD.togglePPMode()" title="Click to toggle pp / time">' + display + '</span>' +
          '</div>' +
        '</div>' +
        '<div class="sc-acts">' +
          // D: manual checkbox in 1-col
          '<div class="sc-done' + (isDone ? ' done' : '') + '" title="Mark scene complete" ' +
            'onclick="event.stopPropagation();TD.toggleDone(' + absIdx + ')"></div>' +
          '<button class="tyd" onclick="event.stopPropagation();App.openRM(App.state.activeStory?.scenes?.[' + absIdx + '])" title="Open SceneDictation">' +
            '<svg width="9" height="11" viewBox="0 0 14 19" fill="currentColor"><path fill-rule="evenodd" clip-rule="evenodd" d="M7 12C8.7 12 10 10.7 10 9V3C10 1.3 8.7 0 7 0C5.3 0 4 1.3 4 3V9C4 10.7 5.3 12 7 12ZM12.3 9C12.3 12 9.8 14.1 7 14.1C4.2 14.1 1.7 12 1.7 9H0C0 12.4 2.7 15.2 6 15.7V19H8V15.7C11.3 15.2 14 12.4 14 9H12.3Z"/></svg>' +
            ' Talk Your Draft' +
          '</button>' +
          '<svg class="dh" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" onclick="event.stopPropagation()"><path d="M8 9l4-4 4 4m0 6l-4 4-4-4"/></svg>' +
          '<svg class="tb" onclick="event.stopPropagation();TD.deleteScene(' + absIdx + ')" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg>' +
        '</div>' +
      '</div>';
    }).join('');

    const secNameHtml = (ff && idx > 0)
      ? '<input class="gi" style="font-family:\'Syne\',sans-serif;font-size:12px;font-weight:600;flex:1;" value="' + (sec.name||'').replace(/"/g,'&quot;') + '" onchange="TD.editSectionName(' + idx + ',this.value)" onfocus="this.select()"/>'
      : '<span style="font-family:\'Syne\',sans-serif;font-size:12px;font-weight:600;flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + sec.name + '</span>';

    const secDescPlaceholder = ff
      ? (idx === 0 ? 'Starts the story, however long it takes.' : 'Describe this section, act, sequence, beat, etc.')
      : (sec.desc || 'Write your beat here\u2026');

    const beatVal = (section.value || '').replace(/</g,'&lt;').replace(/>/g,'&gt;');

    return '<div style="margin-bottom:10px;" id="td1sec-wrap-' + idx + '">' +
      '<div style="background:var(--surface);border-radius:6px 6px 0 0;border:1px solid rgba(255,255,255,0.07);padding:7px 10px;display:flex;align-items:center;gap:6px;cursor:pointer;" ' +
        'title="' + (sec.desc || '').replace(/"/g,'&quot;') + '" onclick="TD._toggle1ColSec(this)">' +
        '<svg class="td1-chev" style="transition:transform .15s;flex-shrink:0;transform:rotate(180deg);" width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" stroke-width="2.5"><path d="M19 9l-7 7-7-7"/></svg>' +
        secNameHtml +
        '<span style="font-family:\'DM Mono\',monospace;font-size:8px;color:var(--ghost);flex-shrink:0;">' + (beats || '') + '</span>' +
        (cumulPP ? '<span class="pp-toggle" style="font-family:\'DM Mono\',monospace;font-size:8px;color:var(--dim);flex-shrink:0;" onclick="event.stopPropagation();TD.togglePPMode()" title="Toggle pp/time">\u2248' + _ppDisplay(cumulPP) + '</span>' : '') +
        (sceneCount ? '<span style="font-family:\'DM Mono\',monospace;font-size:8px;color:var(--ghost);flex-shrink:0;">' + sceneCount + 'sc</span>' : '') +
      '</div>' +
      '<div class="td1sec-body" style="border:1px solid rgba(255,255,255,0.06);border-top:none;border-radius:0 0 6px 6px;padding:8px 8px 0;">' +
        '<textarea class="gta" rows="2" style="margin-bottom:4px;" placeholder="' + secDescPlaceholder.replace(/"/g,'&quot;') + '" onchange="TD.saveBeat(' + idx + ',this.value)">' + beatVal + '</textarea>' +
        (section.value?.trim() && sec.desc ? '<div style="font-size:9px;color:var(--ghost);font-style:italic;margin-bottom:6px;border-left:2px solid rgba(255,255,255,0.1);padding-left:6px;">' + sec.desc + '</div>' : '') +
        scenesHtml +
        '<button class="ib" style="width:100%;font-size:9px;margin:4px 0 6px;justify-content:center;" onclick="TD.addSceneToSection(' + idx + ')">' +
          '<svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 5v14M5 12h14"/></svg> Add Scene' +
        '</button>' +
      '</div>' +
    '</div>';
  }).join('') + (ff ?
    '<button class="ab" style="width:100%;margin-top:4px;font-size:10px;justify-content:center;" onclick="TD.addSection()">' +
      '<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 5v14M5 12h14"/></svg> Add Section' +
    '</button>' : '');

  const overlay = document.createElement('div');
  overlay.id = 'td-onecol';
  overlay.style.cssText = 'flex:1;display:flex;flex-direction:column;overflow:hidden;';
  overlay.innerHTML =
    '<div style="padding:8px 12px;border-bottom:1px solid rgba(255,255,255,0.06);background:var(--card);flex-shrink:0;display:flex;align-items:center;justify-content:space-between;">' +
      '<div>' +
        '<div style="font-size:9px;color:var(--ghost);font-family:\'DM Mono\',monospace;letter-spacing:0.06em;margin-bottom:1px;">ScriptOutliner</div>' +
        '<div style="font-family:\'DM Mono\',monospace;font-size:9px;color:var(--ghost);">' + story.name + ' \u203a ' + story.sectionPreset + '</div>' +
      '</div>' +
      '<div style="display:flex;gap:5px;align-items:center;">' +
        '<button class="ib" style="font-size:9px;" id="td1-collapse-btn" onclick="TD._collapseAll1col()" title="Collapse all sections">' +
          '<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 15l-6-6-6 6"/></svg> Hide All' +
        '</button>' +
        '<button class="ib" style="font-size:10px;" onclick="App.openExportModal(\'td\')">' +
          '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> Export' +
        '</button>' +
      '</div>' +
    '</div>' +
    '<div style="flex:1;overflow-y:auto;padding:8px 12px 24px;">' + sectionsHtml + '</div>';

  inner.appendChild(overlay);
}

// ── Open a scene in the recorder ──────────────────────────────────────────────

function mostRecentScene(story) {
  const scenes = story.scenes || [];
  if (!scenes.length) return null;
  let best = scenes[0], bestTime = 0;
  for (const scene of scenes) {
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

  // Update header
  const slugEl = document.getElementById('td-rec-slug');
  const bcEl   = document.getElementById('td-rec-bc');
  const preset = api.sectionPresets?.[story.sectionPreset];
  const sec    = preset?.sections?.[scene.sectionIdx ?? 0];
  if (slugEl) slugEl.textContent = scene.name;
  if (bcEl)   bcEl.textContent   = sec ? sec.name : '';

  // Highlight active card — clear all, then set yellow on active
  document.querySelectorAll('[id^="tdc-"]').forEach(el => {
    el.classList.remove('sc-a');
    el.style.border    = '';
    el.style.boxShadow = '';
  });
  const card = document.getElementById('tdc-' + scene.id);
  if (card) {
    card.classList.add('sc-a');
    card.style.border    = '2px solid var(--yellow)';
    card.style.boxShadow = '0 0 8px rgba(255,216,0,0.25)';
    card.scrollIntoView({ block: 'nearest' });
  }

  rec.style.cssText = 'flex:1;overflow-y:auto;display:flex;flex-direction:column;align-items:initial;justify-content:initial;border:2px solid var(--yellow);border-right:none;border-radius:8px 0 0 8px;';

  const sceneMaxMin = (Math.round((App.state.sceneMax / 60 + Number.EPSILON) * 10) / 10);
  const descDisplay = scene.desc || '<span style="color:var(--ghost);font-style:italic;font-size:10px;">Scene notes. Max 100 words.</span>';

  // E: keyboard SVG — corrected proportions
  // Layout: [Numpad btn] [Number Row btn] on the left, keyboard SVG on the right (same row)
  // Below both: instruction list full width
  const kbdLayout = localStorage.getItem('td_kbd_layout') || 'numpad';
  const kbdSVG = _buildKbdSVG(kbdLayout);

  rec.innerHTML = '<div style="width:100%;max-width:680px;padding:16px 20px 24px;display:flex;flex-direction:column;gap:12px;margin:0 auto;">' +

    '<div style="font-size:11px;color:var(--ghost);font-style:italic;line-height:1.4;min-height:18px;">' + descDisplay + '</div>' +

    '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;">' +
      '<button class="ib" onclick="TD._toggleIns(this)" style="font-size:10px;">' +
        '<svg id="ins-chev-dn" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M19 9l-7 7-7-7"/></svg>' +
        '<svg id="ins-chev-up" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="display:none;"><path d="M5 15l7-7 7 7"/></svg>' +
        ' Instructions' +
      '</button>' +
      '<div style="position:relative;" id="reuse-wrap">' +
        '<button class="ib" style="font-size:10px;" onclick="TD._toggleReusePanel()">' +
          '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>' +
          ' Reuse characters from\u2026' +
        '</button>' +
        '<div id="reuse-panel" style="display:none;position:absolute;top:32px;right:0;width:280px;background:var(--raise);border:1px solid rgba(255,255,255,0.15);border-radius:8px;box-shadow:0 8px 32px rgba(0,0,0,0.7);z-index:100;overflow:hidden;">' +
          '<div style="padding:8px 10px;border-bottom:1px solid rgba(255,255,255,0.08);font-size:9px;color:var(--ghost);font-family:\'DM Mono\',monospace;letter-spacing:0.05em;">SELECT A SCENE TO COPY ITS CHARACTERS</div>' +
          '<div id="reuse-scene-list" style="max-height:180px;overflow-y:auto;">' +
            ((story.scenes || []).filter(s => s.id !== scene.id).map(s => {
              const srcIdx = story.scenes.indexOf(s);
              const chars  = s.chars || ['ACTION','NAME-1','NAME-2','NAME-3','NAME-4','NAME-5','NAME-6','NAME-7','NAME-8','NAME-9'];
              const layout = localStorage.getItem('td_kbd_layout') || 'numpad';
              const rows   = layout === 'numpad' ? [7,8,9,4,5,6,1,2,3] : [1,2,3,4,5,6,7,8,9];
              const mini   = rows.map(i => '<div style="background:var(--surface);border:1px solid rgba(255,255,255,0.08);border-radius:3px;padding:2px 3px;font-size:7px;text-align:center;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + (chars[i]||'NAME-'+i).substring(0,8) + '<span style="display:block;font-size:6px;color:var(--yellow);opacity:0.7;">' + i + '</span></div>').join('');
              return '<div style="padding:7px 10px;border-bottom:1px solid rgba(255,255,255,0.06);cursor:pointer;transition:background .1s;" onmouseover="this.style.background=\'rgba(255,255,255,0.05)\'" onmouseout="this.style.background=\'\'" onclick="TD._reuseCharsFrom(' + srcIdx + ')">' +
                '<div style="font-size:10px;font-weight:600;margin-bottom:5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + s.name + '</div>' +
                '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:2px;margin-bottom:4px;">' + mini + '</div>' +
                '<div style="background:var(--surface);border:1px solid rgba(255,255,255,0.08);border-radius:3px;padding:2px 4px;font-size:7px;color:var(--ghost);text-align:center;">ACTION</div>' +
              '</div>';
            }).join('') || '<div style="padding:12px 10px;font-size:10px;color:var(--ghost);font-style:italic;">No other scenes yet.</div>') +
          '</div>' +
        '</div>' +
      '</div>' +
    '</div>' +

    // E: Instructions panel — KEY LAYOUT buttons left, SVG right, instructions below both
    '<div id="rec-ins" style="display:none;margin-top:4px;padding:10px 12px;background:var(--card);border-radius:6px;border:1px solid rgba(255,255,255,0.07);">' +
      '<div style="font-size:9px;color:var(--ghost);font-family:\'DM Mono\',monospace;letter-spacing:0.05em;margin-bottom:8px;">KEY LAYOUT</div>' +
      // top row: buttons on the left, SVG keyboard on the right
      '<div style="display:flex;gap:16px;align-items:flex-start;margin-bottom:12px;">' +
        '<div style="display:flex;flex-direction:column;gap:6px;">' +
          '<div style="display:flex;gap:6px;">' +
            '<button id="kbd-numpad-btn" class="ib' + (kbdLayout==='numpad' ? ' ib-on' : '') + '" style="font-size:9px;" onclick="TD._setKbdLayout(\'numpad\')">Numpad</button>' +
            '<button id="kbd-row-btn" class="ib' + (kbdLayout==='row' ? ' ib-on' : '') + '" style="font-size:9px;" onclick="TD._setKbdLayout(\'row\')">Number Row</button>' +
          '</div>' +
          '<div style="font-size:9px;color:var(--ghost);font-style:italic;">Choose how you prefer to type character numbers</div>' +
        '</div>' +
        // E: Keyboard SVG
        '<div id="kbd-svg-wrap" style="flex-shrink:0;">' + kbdSVG + '</div>' +
      '</div>' +
      // instruction steps below full-width
      '<div style="border-top:1px solid rgba(255,255,255,0.08);padding-top:8px;">' +
        '<div style="font-family:\'DM Mono\',monospace;font-size:9px;color:var(--yellow);margin-bottom:8px;letter-spacing:0.05em;">TAP 0\u20139 ON YOUR KEYBOARD TO CHANGE CHARACTERS WHILE SPEAKING</div>' +
        '<div style="margin-bottom:4px;"><span style="color:var(--yellow);font-weight:700;">1. </span><span style="font-size:11px;">Click the numbered buttons to assign character names.</span></div>' +
        '<div style="margin-bottom:4px;"><span style="color:var(--yellow);font-weight:700;">2. </span><span style="font-size:11px;">Click the microphone to start transcribing. (It becomes \u201cpause\u201d)</span></div>' +
        '<div style="margin-bottom:4px;"><span style="color:var(--yellow);font-weight:700;">3. </span><span style="font-size:11px;">Tap a character button then talk their lines. (Action lines = \u2205)</span></div>' +
        '<div style="margin-bottom:10px;"><span style="color:var(--yellow);font-weight:700;">4. </span><span style="font-size:11px;">Click pause to stop transcribing.</span></div>' +
      '</div>' +
    '</div>' +

    '<div class="npd" id="rec-npd">' + buildNumpad(scene) + '</div>' +

    '<div id="rec-wave-area" style="display:flex;align-items:center;gap:8px;">' + buildWaveArea(sceneMaxMin) + '</div>' +

    '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">' +
      '<button class="ib" onclick="App.go(\'ts\')" style="font-size:10px;">' +
        '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>' +
        ' Edit Transcript' +
      '</button>' +
      '<button class="ib" onclick="App.openExportModal(\'td\')" style="font-size:10px;">' +
        '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>' +
        ' Export' +
      '</button>' +
    '</div>' +

  '</div>';

  updateWaveArea();
  await loadSceneAudio(story, scene);
}

// ── E: Keyboard SVG builder ────────────────────────────────────────────────────

function _buildKbdSVG(layout) {
  // Keyboard diagram showing key positions
  // Main body: QWERTY label + number row (1-0) across the top
  // Numpad on the right, full height
  // All keys same size: 18x18px with 2px gap
  const K = 18; // key size
  const G = 2;  // gap
  const S = K + G; // step

  // Number row: 0 is on the RIGHT side of 1-9 (standard keyboard 1-0)
  const numRowKeys = layout === 'numpad' ? [] : ['1','2','3','4','5','6','7','8','9','0'];
  const numpadKeys = layout === 'numpad' ? [['7','8','9'],['4','5','6'],['1','2','3'],['','0','']] : [];

  if (layout === 'numpad') {
    // Show: main keyboard body with QWERTY + numpad on the right
    const bodyW = 8 * S + K; // ~8 keys wide for QWERTY suggestion
    const padX  = bodyW + 8;
    const rows  = [['7','8','9'],['4','5','6'],['1','2','3'],['','0','']];
    const totalH = 4 * S + K;
    const totalW = padX + 3 * S + K;

    let svg = '<svg width="' + totalW + '" height="' + totalH + '" viewBox="0 0 ' + totalW + ' ' + totalH + '" xmlns="http://www.w3.org/2000/svg">';
    // Main keyboard body
    svg += '<rect x="0" y="0" width="' + bodyW + '" height="' + totalH + '" rx="3" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.12)" stroke-width="1"/>';
    // QWERTY label centered in body
    svg += '<text x="' + (bodyW/2) + '" y="' + (totalH/2 + 4) + '" text-anchor="middle" font-family="\'DM Mono\',monospace" font-size="11" fill="rgba(255,255,255,0.25)">QWERTY</text>';
    // Numpad keys
    rows.forEach((row, ri) => {
      row.forEach((label, ci) => {
        if (!label) return;
        const x = padX + ci * S;
        const y = ri * S;
        const isActive = label !== '';
        svg += '<rect x="' + x + '" y="' + y + '" width="' + K + '" height="' + K + '" rx="2" fill="' + (isActive ? 'rgba(255,216,0,0.12)' : 'rgba(255,255,255,0.03)') + '" stroke="rgba(255,216,0,' + (isActive ? '0.4' : '0.1') + ')" stroke-width="1"/>';
        svg += '<text x="' + (x + K/2) + '" y="' + (y + K/2 + 4) + '" text-anchor="middle" font-family="\'DM Mono\',monospace" font-size="9" fill="var(--yellow)">' + label + '</text>';
      });
    });
    svg += '</svg>';
    return svg;
  } else {
    // Number row mode: show full keyboard outline with number row 1-0 highlighted at top
    const numW = 10 * S + K; // 10 keys wide (1-0)
    const bodyH = 3 * S + K; // 3 more rows below number row
    const totalH = S + bodyH; // number row + body
    const totalW = numW;

    let svg = '<svg width="' + totalW + '" height="' + totalH + '" viewBox="0 0 ' + totalW + ' ' + totalH + '" xmlns="http://www.w3.org/2000/svg">';
    // Number row keys (highlighted)
    numRowKeys.forEach((label, i) => {
      const x = i * S;
      svg += '<rect x="' + x + '" y="0" width="' + K + '" height="' + K + '" rx="2" fill="rgba(255,216,0,0.12)" stroke="rgba(255,216,0,0.4)" stroke-width="1"/>';
      svg += '<text x="' + (x + K/2) + '" y="' + (K/2 + 4) + '" text-anchor="middle" font-family="\'DM Mono\',monospace" font-size="9" fill="var(--yellow)">' + label + '</text>';
    });
    // Keyboard body below
    svg += '<rect x="0" y="' + S + '" width="' + numW + '" height="' + bodyH + '" rx="3" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.12)" stroke-width="1"/>';
    svg += '<text x="' + (numW/2) + '" y="' + (S + bodyH/2 + 4) + '" text-anchor="middle" font-family="\'DM Mono\',monospace" font-size="11" fill="rgba(255,255,255,0.25)">QWERTY</text>';
    svg += '</svg>';
    return svg;
  }
}

// ── Character numpad ──────────────────────────────────────────────────────────

function buildNumpad(scene) {
  const layout = localStorage.getItem('td_kbd_layout') || 'numpad';
  const rows   = layout === 'numpad' ? [7,8,9,4,5,6,1,2,3] : [1,2,3,4,5,6,7,8,9];
  return rows.map(i =>
    '<div class="cb" id="cb-' + i + '" onclick="TD.charPress(' + i + ')" title="Press ' + i + ' on keyboard">' +
      '<span class="cn-badge-c">' + i + '</span>' +
      '<span style="overflow:hidden;font-size:10px;" id="cbn-' + i + '">' + (scene.chars?.[i] || 'NAME-'+i) + '</span>' +
    '</div>'
  ).join('') +
  '<div class="acb" id="cb-0" onclick="TD.charPress(0)" title="Press 0 on keyboard">' +
    '<span class="cn-badge-c">0</span> ACTION' +
  '</div>' +
  // A: Record button — correct 3-level structure matching webapp exactly
  // wrapper.resting > container > content
  '<div id="rec-mic" onclick="TD.toggleRecord()" class="record-button-wrapper resting" style="cursor:pointer;">' +
    '<div class="record-button-container">' +
      '<div class="record-button-content" style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;">' +
        '<div class="mic-icon-wrapper">' +
          '<svg class="mic-icon" viewBox="0 0 14 19" fill="none"><path fill-rule="evenodd" clip-rule="evenodd" d="M7 12C8.7 12 10 10.7 10 9V3C10 1.3 8.7 0 7 0C5.3 0 4 1.3 4 3V9C4 10.7 5.3 12 7 12ZM12.3 9C12.3 12 9.8 14.1 7 14.1C4.2 14.1 1.7 12 1.7 9H0C0 12.4 2.7 15.2 6 15.7V19H8V15.7C11.3 15.2 14 12.4 14 9H12.3Z"/></svg>' +
        '</div>' +
        '<span class="button-text">TRANSCRIBE</span>' +
      '</div>' +
    '</div>' +
  '</div>';
}

function buildWaveArea(sceneMaxMin) {
  return '<div id="rec-wave-setup" style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;">' +
    '<span style="font-size:11px;color:var(--ghost);">Tap the mic to begin</span>' +
    '<span style="font-size:9px;color:rgba(107,122,153,0.6);font-family:\'DM Mono\',monospace;">Transcribe up to a ' + sceneMaxMin + ' minute scene</span>' +
  '</div>' +
  '<div id="rec-wave-active" style="flex:1;display:none;align-items:center;gap:6px;">' +
    '<span class="rt" id="rec-timer">00:00</span>' +
    '<div class="rw">' +
      '<div class="rf" id="rec-progress" style="width:0%"></div>' +
      '<div class="rc"></div>' +
      '<canvas id="viscanvas" style="position:absolute;top:0;left:0;width:100%;height:100%;"></canvas>' +
    '</div>' +
    '<span class="rt" id="rec-max">' + time2ms(App.state.sceneMax) + '</span>' +
  '</div>' +
  '<div id="rec-wave-transcribing" style="flex:1;display:none;align-items:center;justify-content:center;gap:8px;">' +
    '<div class="spinner" style="width:16px;height:16px;border:2px solid var(--yellow);border-top-color:transparent;border-radius:50%;animation:spin .7s linear infinite;"></div>' +
    '<span style="font-size:11px;color:var(--ghost);">Transcribing\u2026 <span id="rec-trans-pct">0%</span></span>' +
  '</div>' +
  '<audio id="rec-audio" controls style="flex:1;display:none;height:28px;"></audio>';
}

function micSVG(active) {
  if (active) {
    return '<svg width="18" height="18" viewBox="0 0 512 512" fill="var(--green)"><path d="M224 432h-80V80h80zM368 432h-80V80h80z"/></svg>';
  }
  return '<svg width="14" height="19" viewBox="0 0 14 19" fill="var(--yellow)"><path fill-rule="evenodd" clip-rule="evenodd" d="M7 12C8.7 12 10 10.7 10 9V3C10 1.3 8.7 0 7 0C5.3 0 4 1.3 4 3V9C4 10.7 5.3 12 7 12ZM12.3 9C12.3 12 9.8 14.1 7 14.1C4.2 14.1 1.7 12 1.7 9H0C0 12.4 2.7 15.2 6 15.7V19H8V15.7C11.3 15.2 14 12.4 14 9H12.3Z"/></svg>';
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

// ── Wave area state ───────────────────────────────────────────────────────────

function updateWaveArea() {
  const s     = App.state;
  const area  = document.getElementById('rec-wave-setup');
  const act   = document.getElementById('rec-wave-active');
  const trans = document.getElementById('rec-wave-transcribing');
  const audio = document.getElementById('rec-audio');
  const mic   = document.getElementById('rec-mic');
  if (!area) return;

  // A: swap the full 3-level record button HTML between resting and recording state
  if (mic) {
    if (s.mode === 'active') {
      mic.className = 'record-button-wrapper recording';
      mic.innerHTML =
        '<div class="record-button-container">' +
          '<div class="record-button-content" style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;">' +
            '<div class="mic-icon-wrapper-active">' +
              '<svg class="mic-icon-active" viewBox="0 0 512 512"><path d="M224 432h-80V80h80zM368 432h-80V80h80z"/></svg>' +
            '</div>' +
            '<span class="button-text-active">STOP</span>' +
          '</div>' +
        '</div>';
    } else {
      mic.className = 'record-button-wrapper resting';
      mic.innerHTML =
        '<div class="record-button-container">' +
          '<div class="record-button-content" style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;">' +
            '<div class="mic-icon-wrapper">' +
              '<svg class="mic-icon" viewBox="0 0 14 19" fill="none"><path fill-rule="evenodd" clip-rule="evenodd" d="M7 12C8.7 12 10 10.7 10 9V3C10 1.3 8.7 0 7 0C5.3 0 4 1.3 4 3V9C4 10.7 5.3 12 7 12ZM12.3 9C12.3 12 9.8 14.1 7 14.1C4.2 14.1 1.7 12 1.7 9H0C0 12.4 2.7 15.2 6 15.7V19H8V15.7C11.3 15.2 14 12.4 14 9H12.3Z"/></svg>' +
            '</div>' +
            '<span class="button-text">TRANSCRIBE</span>' +
          '</div>' +
        '</div>';
    }
  }

  if (s.mode === 'active') {
    area.style.display = 'none';
    if (trans) trans.style.display = 'none';
    if (audio) audio.style.display = 'none';
    if (act)   act.style.display   = 'flex';
  } else if (s.mode === 'transcription') {
    area.style.display = 'none';
    if (act)   act.style.display   = 'none';
    if (audio) audio.style.display = 'none';
    if (trans) trans.style.display = 'flex';
  } else {
    if (act)   act.style.display   = 'none';
    if (trans) trans.style.display = 'none';
    if (s.audioURL) {
      area.style.display = 'none';
      if (audio) { audio.src = s.audioURL; audio.style.display = ''; }
    } else {
      area.style.display = 'flex';
      if (audio) audio.style.display = 'none';
    }
  }
}

// ── Recorder init ─────────────────────────────────────────────────────────────

async function recorderInit() {
  if (mediaRecorder) return;
  if (!navigator.mediaDevices?.getUserMedia) { App.showAlert('Audio recording not supported.'); return; }
  try {
    if (!mediaStream) {
      mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation:true, noiseSuppression:true, autoGainControl:true, sampleRate:48000, channelCount:1 }
      });
    }
    const options = { audioBitsPerSecond: 128000 };
    if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus'))    options.mimeType = 'audio/webm;codecs=opus';
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
  App.state.sessionBlobs.push({ tid, blob, charName: scene.chars?.[App.state.prevnum] || 'ACTION' });
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
    App.state.prevnum = App.state.currnum;
    App.state.currnum = undefined;
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
  if (App.state.mode === 'active' && App.state.timer >= App.state.sceneMax) { TD.toggleRecord(); return; }
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
  const audioCtx    = new AudioContext();
  const canvasCtx   = canvas.getContext('2d');
  const source      = audioCtx.createMediaStreamSource(mediaStream);
  const analyser    = audioCtx.createAnalyser();
  analyser.fftSize  = 2048;
  const bufferLength = analyser.frequencyBinCount;
  const dataArray    = new Uint8Array(bufferLength);
  source.connect(analyser);
  function draw() {
    if (mediaRecorder?.state !== 'recording') return;
    requestAnimationFrame(draw);
    analyser.getByteTimeDomainData(dataArray);
    const W = canvas.width, H = canvas.height;
    canvasCtx.clearRect(0, 0, W, H);
    canvasCtx.lineWidth   = 2;
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
      fd.append('audio_' + idx, item.blob);
      fd.append('tid_' + idx, item.tid);
      fd.append('charName_' + idx, item.charName);
    });
    fd.append('count', App.state.sessionBlobs.length);

    const total     = App.state.sessionBlobs.length;
    const estMs     = total * 4000;
    const interval  = 100;
    const inc       = total / (estMs / interval);
    const progTimer = setInterval(() => {
      App.state.transcriptionProgress.current = Math.min(App.state.transcriptionProgress.current + inc, total - 0.5);
      const pct = document.getElementById('rec-trans-pct');
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
    renderSceneList(story);

  } catch(err) {
    App.showAlert('Transcription error: ' + err);
    console.error(err);
  } finally {
    App.state.mode = 'setup';
    updateWaveArea();
  }
}

// ── Layout ────────────────────────────────────────────────────────────────────

function applyTDLayout(layout) {
  const left  = document.getElementById('td-left');
  const right = document.getElementById('td-right');
  if (!left || !right) return;

  document.getElementById('td-onecol')?.remove();

  if (layout === '2col') {
    left.style.display  = 'flex';
    right.style.display = 'flex';
    right.style.flex    = '';
    right.style.width   = '38%';
  } else {
    left.style.display  = 'none';
    right.style.display = 'none';
    renderTDOneCol();
  }
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

// ── Story nav helpers ────────────────────────────────────────────────────────

function _populateOtherStories() {
  const container = document.getElementById('td-other-stories');
  if (!container) return;
  const story  = App.state.activeStory;
  const list   = App.state.storyList || [];
  const others = list.filter(s => s.id !== story?.id);
  const label  = '<div style="padding:4px 10px;font-size:9px;color:var(--ghost);font-family:\'DM Mono\',monospace;letter-spacing:0.05em;">YOUR STORIES</div>';
  const items  = others.length
    ? others.map(s => '<div class="ib" style="border:none;border-radius:0;justify-content:flex-start;font-size:11px;" onclick="TD._closeStoryNav();App.openStory(\'' + s.id + '\')">' + s.name + '</div>').join('')
    : '<div style="padding:5px 10px;font-size:10px;color:var(--ghost);font-style:italic;">No other stories.</div>';
  container.innerHTML = label + items;
}

// ── Global TD actions ─────────────────────────────────────────────────────────

window.TD = {

  selectScene(absIdx) {
    const story = App.state.activeStory;
    if (!story) return;
    const scene = story.scenes[absIdx];
    if (!scene) return;
    // Don't re-open if already the active scene (avoids audio reload on every focus)
    if (App.state.activeScene?.id === scene.id) return;
    App.state.activeScene = scene;
    openScene(scene);
  },

  _open1ColScene(absIdx) {
    const story = App.state.activeStory;
    if (!story) return;
    const scene = story.scenes[absIdx];
    if (!scene) return;
    App.state.layout = '2col';
    document.dispatchEvent(new CustomEvent('ts:layout', { detail: { tab: 'td', layout: '2col' } }));
    const lbl = document.querySelector('#togbtn-label');
    if (lbl) lbl.textContent = '1 Col';
    App.state.activeScene = scene;
    openScene(scene);
  },

  _toggleTDSec(headerEl) {
    const body = headerEl.nextElementSibling;
    const chev = headerEl.querySelector('.tdsec-chev');
    if (!body || !body.classList.contains('tdsec-body')) return;
    const isOpen = body.style.display !== 'none';
    body.style.display = isOpen ? 'none' : '';
    if (chev) chev.style.transform = isOpen ? '' : 'rotate(180deg)';
  },

  _toggle1ColSec(headerEl) {
    const body = headerEl.nextElementSibling;
    const chev = headerEl.querySelector('.td1-chev');
    if (!body || !body.classList.contains('td1sec-body')) return;
    const isOpen = body.style.display !== 'none';
    body.style.display = isOpen ? 'none' : '';
    if (chev) chev.style.transform = isOpen ? '' : 'rotate(180deg)';
  },

  _collapseAll() {
    const bodies = document.querySelectorAll('.tdsec-body');
    const chevs  = document.querySelectorAll('.tdsec-chev');
    const btn    = document.getElementById('td-collapse-btn');
    _allOpen2col = !_allOpen2col;
    bodies.forEach(b => b.style.display = _allOpen2col ? '' : 'none');
    chevs.forEach(c => c.style.transform = _allOpen2col ? 'rotate(180deg)' : '');
    if (btn) {
      const icon = _allOpen2col
        ? '<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 15l-6-6-6 6"/></svg>'
        : '<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M6 9l6 6 6-6"/></svg>';
      btn.innerHTML = icon + (_allOpen2col ? ' Hide All' : ' Show All');
    }
  },

  _collapseAll1col() {
    const bodies = document.querySelectorAll('#td-onecol .td1sec-body');
    const chevs  = document.querySelectorAll('#td-onecol .td1-chev');
    const btn    = document.getElementById('td1-collapse-btn');
    _allOpen1col = !_allOpen1col;
    bodies.forEach(b => b.style.display = _allOpen1col ? '' : 'none');
    chevs.forEach(c => c.style.transform = _allOpen1col ? 'rotate(180deg)' : '');
    if (btn) {
      const icon = _allOpen1col
        ? '<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 15l-6-6-6 6"/></svg>'
        : '<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M6 9l6 6 6-6"/></svg>';
      btn.innerHTML = icon + (_allOpen1col ? ' Hide All' : ' Show All');
    }
  },

  _toggleIns(btn) {
    const panel = document.getElementById('rec-ins');
    const dn    = document.getElementById('ins-chev-dn');
    const up    = document.getElementById('ins-chev-up');
    if (!panel) return;
    const open = panel.style.display !== 'none';
    panel.style.display = open ? 'none' : 'block';
    if (dn) dn.style.display = open ? '' : 'none';
    if (up) up.style.display = open ? 'none' : '';
  },

  _setKbdLayout(layout) {
    localStorage.setItem('td_kbd_layout', layout);
    const np = document.getElementById('kbd-numpad-btn');
    const nr = document.getElementById('kbd-row-btn');
    if (np) np.classList.toggle('ib-on', layout === 'numpad');
    if (nr) nr.classList.toggle('ib-on', layout === 'row');
    // Rebuild numpad
    const npd = document.getElementById('rec-npd');
    if (npd) npd.innerHTML = buildNumpad(App.state.activeScene);
    // Update keyboard SVG
    const svgWrap = document.getElementById('kbd-svg-wrap');
    if (svgWrap) svgWrap.innerHTML = _buildKbdSVG(layout);
    // Also update modal numpad if open
    const rm_npd = document.getElementById('rm-npd');
    if (rm_npd && typeof App.rmSetKbd === 'function') App.rmSetKbd(layout);
  },

  _toggleReusePanel() {
    const panel = document.getElementById('reuse-panel');
    if (!panel) return;
    const isOpen = panel.style.display !== 'none';
    panel.style.display = isOpen ? 'none' : 'block';
    if (!isOpen) {
      setTimeout(() => {
        document.addEventListener('click', function closePanel(e) {
          const wrap = document.getElementById('reuse-wrap');
          if (wrap && !wrap.contains(e.target)) {
            panel.style.display = 'none';
            document.removeEventListener('click', closePanel);
          }
        });
      }, 0);
    }
  },

  _reuseCharsFrom(srcIdx) {
    const story = App.state.activeStory;
    const scene = App.state.activeScene;
    if (isNaN(srcIdx) || !story || !scene) return;
    const src = story.scenes[srcIdx];
    if (!src?.chars) return;
    if (!scene.chars) scene.chars = ['ACTION','NAME-1','NAME-2','NAME-3','NAME-4','NAME-5','NAME-6','NAME-7','NAME-8','NAME-9'];
    for (let i = 1; i <= 9; i++) {
      scene.chars[i] = src.chars[i] || scene.chars[i];
      const lbl = document.getElementById('cbn-' + i);
      if (lbl) lbl.textContent = scene.chars[i];
    }
    scene.lastModified = Date.now();
    api.saveStory(story);
    const panel = document.getElementById('reuse-panel');
    if (panel) panel.style.display = 'none';
    App.showAlert('Characters copied from ' + src.name, 2000, false, 'notice');
  },

  addSceneToSection(sectionIdx) {
    const story = App.state.activeStory;
    if (!story || !App.checkStuff()) return;
    api.addScene(story, sectionIdx, null, []);
    api.saveStory(story);
    const layout = App.state.layout || '2col';
    if (layout === '2col') {
      renderSceneList(story);
      const newScene = [...(story.scenes || [])].reverse().find(s => s.sectionIdx === sectionIdx);
      if (newScene) setTimeout(() => openScene(newScene), 30);
    } else {
      renderTDOneCol();
    }
  },

  addSection() {
    const story = App.state.activeStory;
    if (!story || !isFreeForm(story) || !App.checkStuff()) return;
    App.showPromptModal('New Section', 'Section name:', 'New Section', (name) => {
      if (!name?.trim()) return;
      if (!story.sections) story.sections = [];
      story.sections.push({ id: genId(), value: '' });
      const preset = api.sectionPresets?.[story.sectionPreset];
      if (preset) preset.sections.push({ name: name.trim(), act: '', desc: '' });
      api.saveStory(story);
      const layout = App.state.layout || '2col';
      if (layout === '2col') renderSceneList(story);
      else renderTDOneCol();
    });
  },

  editSceneName(absIdx, value) {
    const story = App.state.activeStory;
    if (!story) return;
    value = value.toString().trim();
    if (!value) { App.showAlert('Please enter a scene name'); return; }
    if (!value.match(/^(INT|EXT|I\/E)(\.| |-)/i)) value = 'EXT. ' + value;
    story.scenes[absIdx].name = value.replace(/\n/g,' ').trim().toUpperCase();
    story.scenes[absIdx].lastModified = Date.now();
    api.saveStory(story);
    // Update right column slug if this is the active scene
    if (story.scenes[absIdx]?.id === App.state.activeScene?.id) {
      const slugEl = document.getElementById('td-rec-slug');
      if (slugEl) slugEl.textContent = story.scenes[absIdx].name;
    }
  },

  editSceneDesc(absIdx, value) {
    const story = App.state.activeStory;
    if (!story) return;
    if (value.split(/\s/).length > 100) App.showAlert('Scene notes should be less than 100 words.');
    story.scenes[absIdx].desc = value;
    story.scenes[absIdx].lastModified = Date.now();
    api.saveStory(story);
    if (story.scenes[absIdx]?.id === App.state.activeScene?.id) {
      const descEl = document.querySelector('#td-recorder > div > div:first-child');
      if (descEl) descEl.innerHTML = value || '<span style="color:var(--ghost);font-style:italic;font-size:10px;">Scene notes. Max 100 words.</span>';
    }
  },

  editSectionName(idx, value) {
    const story = App.state.activeStory;
    if (!story || !isFreeForm(story)) return;
    const preset = api.sectionPresets?.[story.sectionPreset];
    if (preset?.sections?.[idx]) preset.sections[idx].name = value.trim();
    api.saveStory(story);
  },

  saveBeat(idx, value) {
    const story = App.state.activeStory;
    if (!story) return;
    if (!story.sections[idx]) story.sections[idx] = {};
    story.sections[idx].value = value;
    api.saveStory(story);
  },

  // D: manual completion toggle
  toggleDone(absIdx) {
    const story = App.state.activeStory;
    if (!story) return;
    const scene = story.scenes[absIdx];
    if (!scene) return;
    scene.done = !scene.done;
    scene.lastModified = Date.now();
    api.saveStory(story);
    // Update checkbox in DOM without full re-render
    const cb2 = document.querySelector('#tdc-' + scene.id + ' .sc-done');
    const cb1 = document.querySelector('#tdc1-' + scene.id + ' .sc-done');
    [cb2, cb1].forEach(el => {
      if (el) el.classList.toggle('done', scene.done);
    });
  },

  // K: global pp/time mode toggle
  togglePPMode() {
    App.state.ppMode = (App.state.ppMode === 'pp') ? 'time' : 'pp';
    // Re-render all pp-toggle spans in both views
    const story = App.state.activeStory;
    if (!story) return;
    const layout = App.state.layout || '2col';
    if (layout === '2col') {
      renderSceneList(story);
      // Re-open active scene to avoid losing recorder state
      if (App.state.activeScene) {
        const card = document.getElementById('tdc-' + App.state.activeScene.id);
        if (card) {
          card.classList.add('sc-a');
          card.style.border = '2px solid var(--yellow)';
          card.style.boxShadow = '0 0 8px rgba(255,216,0,0.25)';
        }
      }
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
      'Delete "' + scene.name + '"? This cannot be undone.',
      () => {
        if (App.state.activeScene?.id === scene.id) App.state.activeScene = null;
        story.scenes.splice(absIdx, 1);
        api.saveStory(story);
        renderSceneList(story);
      });
  },

  // F: character rename with allChars dropdown sorted by frequency
  charPress(n) {
    if (App.state.mode === 'active') { startStopRecording(n, false); return; }
    const story = App.state.activeStory;
    const scene = App.state.activeScene;
    if (!story || !scene) return;
    const current = scene.chars?.[n] || (n === 0 ? 'ACTION' : 'NAME-' + n);
    if (n === 0) return;

    const chars = _allCharsSorted(story);

    // Build a custom modal-like prompt with a dropdown
    App.showPromptModal('Rename Character', 'Enter name for button ' + n + ':', current, (newName) => {
      if (!newName?.trim()) return;
      if (!scene.chars) scene.chars = ['ACTION','NAME-1','NAME-2','NAME-3','NAME-4','NAME-5','NAME-6','NAME-7','NAME-8','NAME-9'];
      scene.chars[n] = newName.trim().toUpperCase();
      scene.lastModified = Date.now();
      api.saveStory(story);
      const lbl = document.getElementById('cbn-' + n);
      if (lbl) lbl.textContent = scene.chars[n];
    });

    // Inject a select below the input in the confirm modal
    setTimeout(() => {
      const inp = document.getElementById('cm-input');
      if (!inp || !chars.length) return;
      const existing = document.getElementById('cm-char-select');
      if (existing) return; // already injected
      const sel = document.createElement('select');
      sel.id = 'cm-char-select';
      sel.className = 'fi';
      sel.style.cssText = 'width:100%;margin-top:6px;font-size:11px;';
      sel.innerHTML = '<option value="">— pick existing character —</option>' +
        chars.map(c => '<option value="' + c.replace(/"/g,'&quot;') + '">' + c + '</option>').join('');
      sel.onchange = () => { if (sel.value) inp.value = sel.value; };
      inp.parentNode.insertBefore(sel, inp.nextSibling);
    }, 30);
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

  // G: drag handlers
  _dragStart(event, absIdx) {
    _dragFromIdx = absIdx;
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', String(absIdx));
    event.currentTarget.style.opacity = '0.5';
  },

  _dragOver(event) {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    event.currentTarget.style.boxShadow = '0 0 0 2px var(--dim)';
  },

  _dragLeave(event) {
    event.currentTarget.style.boxShadow = '';
  },

  _dragDrop(event, toIdx) {
    event.preventDefault();
    event.currentTarget.style.boxShadow = '';
    if (_dragFromIdx === null || _dragFromIdx === toIdx) { _dragFromIdx = null; return; }
    const story = App.state.activeStory;
    if (!story) return;
    // Adopt the sectionIdx of the drop target
    story.scenes[_dragFromIdx].sectionIdx = story.scenes[toIdx].sectionIdx;
    story.scenes[_dragFromIdx].lastModified = Date.now();
    // Splice into position
    const moved = story.scenes.splice(_dragFromIdx, 1)[0];
    const insertAt = (_dragFromIdx < toIdx) ? toIdx : toIdx;
    story.scenes.splice(insertAt, 0, moved);
    _dragFromIdx = null;
    api.saveStory(story);
    const layout = App.state.layout || '2col';
    if (layout === '2col') renderSceneList(story);
    else renderTDOneCol();
  },

  _toggleStoryNav() {
    const menu = document.getElementById('td-story-menu');
    if (!menu) return;
    const isOpen = menu.style.display !== 'none';
    menu.style.display = isOpen ? 'none' : 'block';
    if (!isOpen) {
      App.loadStories().then(() => _populateOtherStories());
      setTimeout(() => document.addEventListener('click', function cl(e) {
        const nav = document.getElementById('td-story-nav');
        if (nav && !nav.contains(e.target)) { menu.style.display='none'; document.removeEventListener('click',cl); }
      }), 10);
    }
  },

  _closeStoryNav() {
    const menu = document.getElementById('td-story-menu');
    if (menu) menu.style.display = 'none';
  },

  _onStructureChange(newPreset) {
    const story = App.state.activeStory;
    if (!story || newPreset === story.sectionPreset) return;
    const hasMap = !!(App.api.migrationMap?.[story.sectionPreset]?.[newPreset]);
    const msg = hasMap
      ? 'Change structure from "' + story.sectionPreset + '" to "' + newPreset + '"? Your beat notes will be migrated.'
      : 'Change structure to "' + newPreset + '"? Beat notes cannot be migrated automatically and will be cleared.';
    App.showConfirmModal('Change Structure?', msg, () => {
      try {
        if (hasMap) App.api.migratePreset(story, newPreset);
        else {
          story.sectionPreset = newPreset;
          story.sections = App.api.sectionPresets[newPreset].sections.map((_,i) => ({ id: App.genId(i), value:'' }));
        }
        App.api.saveStory(story);
        document.dispatchEvent(new CustomEvent('ts:storyopen', { detail: { story } }));
      } catch(err) { App.showAlert('Structure change failed: ' + err); }
    }, 'Change Structure');
  },

  _onPagesChange(val) {
    const story = App.state.activeStory;
    if (!story) return;
    const pages = parseInt(val, 10);
    if (!pages || pages < 1) return;
    story.minutes = pages * 2;
    App.api.saveStory(story);
    const btn = document.getElementById('td-struct-btn');
    if (btn) btn.textContent = story.sectionPreset;
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
