/**
 * TalkingStudio — app.js
 * Central app state + routing. Imports tab modules and wires them together.
 * All tab HTML is rendered into #v-{name} containers.
 * No Alpine. Vanilla JS with reactive state object.
 */

import { genId, api, utils } from './lib/utils.js';
import { renderDashboard }       from './tabs/dashboard.js';
import { renderTalkingDraft }    from './tabs/talking-draft.js';
import { renderTalkingStories }  from './tabs/talking-stories.js';
import { renderChemistry }       from './tabs/chemistry.js';

// ── Global state ─────────────────────────────────────────────────────────────

export const state = {
  activeStory:  null,   // full story object when a story is open
  activeScene:  null,   // scene object when recorder is open
  storyList:    [],     // for dashboard

  curTab:       'dash',
  layout:       '2col', // '2col' | '1col'  (SO + TD only)
  togUsed:      false,

  // Recorder state (shared between TalkingDraft and any modal)
  mode:         'setup', // 'setup' | 'active' | 'transcription'
  currnum:      undefined,
  prevnum:      undefined,
  audioURL:     '',
  timer:        0,
  timerDisplay: '00:00',
  sceneMax:     1200,   // 20 min default
  loading:      0,
  transcribing: 0,
  sessionBlobs: [],
  transcriptionProgress: { current: 0, total: 0 },
  devMode:      false,
  ppMode:       'pp',   // K: 'pp' | 'time' — global toggle for all scene card displays

  // Modal state
  modal: { show: false, type: '', title: '', message: '', inputValue: '', onConfirm: null },

  // Structure chooser
  pickedStructure: null,
};

// ── Structure data ────────────────────────────────────────────────────────────

export const STRUCTURES = [
  // Core / widely known
  { id:'Save the Cat',        desc:"Blake Snyder's 15-beat fan-favourite. Precise, commercial, battle-tested." },
  { id:'Eight Sequences',     desc:'Classic Hollywood: 8 sequences of escalating tension, each ~10–15 pages.' },
  { id:'Story Circle',        desc:"Dan Harmon's 8-stage hero journey. Cyclical, character-driven, sitcom-proven." },
  { id:'Four Act',            desc:'Four balanced acts: setup, confrontation, complication, resolution.' },
  { id:'9Cs',                 desc:'Nine C-words: Character, Catalyst, Clear Want, Conflict, Consciousness, Collision, Crisis, Climax, Change.' },
  { id:'Five Act',            desc:'Shakespearean five acts: exposition, rising action, climax, falling action, denouement.' },
  { id:'Five Act TV',         desc:'Standard TV structure with teaser and five acts. Used in most network drama.' },
  // Extended library (from StoryForge)
  { id:'The Paradigm',        desc:"Syd Field's classic Act structure from the 1970s. Plot points anchor the spine." },
  { id:'Six Stages',          desc:"Michael Hauge's character arc from living in fear to a courageous life." },
  { id:'Pixar',               desc:"The 'Once upon a time…' story spine. Elegant, emotionally precise." },
  { id:'HartChart',           desc:"James V. Hart's Guideposts — a goal-driven structure with clear turning points." },
  { id:'Seven Keys',          desc:"David Trottier's seven key plot points for a fully developed story." },
  { id:'The Debate',          desc:"Drew Yanno's format — story as a moral teachable moment. Question, debate, answer." },
  { id:'Life Torn Apart',     desc:"Peter Dunne's emotionally-driven structure built around co-protagonist dynamics." },
  { id:'Ki-Seung-Jeon-Gyeol',desc:'Classic East Asian four-part structure (Kishōtenketsu). Conflict-free storytelling.' },
  { id:'Twenty-Two Steps',    desc:"John Truby's 22 building blocks of a complete moral argument. The deepest framework." },
  { id:"Hero's Journey",      desc:"Joseph Campbell's monomyth — 12 stages from Ordinary World to Return with the Elixir." },
  // Open
  { id:'Free Form',           desc:'No fixed structure. Name and size your own sections. Total creative freedom.' },
];

// ── Bootstrap ─────────────────────────────────────────────────────────────────

async function boot() {
  console.log('🚀 TalkingStudio booting…');

  // Render all tab containers (static HTML)
  renderDashboard(document.getElementById('v-dash'));
  renderTalkingDraft(document.getElementById('v-td'));
  renderTalkingStories(document.getElementById('v-ts'));
  renderChemistry(document.getElementById('v-chem'));

  // Build structure modal grid
  buildStructureGrid();

  // Keyboard shortcuts
  document.addEventListener('keydown', onKeyDown);
  document.addEventListener('keyup',   onKeyUp);
  window.addEventListener('beforeunload', onBeforeUnload);

  // URL param: open story directly
  const qs = new URLSearchParams(window.location.search);
  if (qs.get('sid')) {
    await openStory(qs.get('sid'));
  } else {
    await loadStories();
  }

  console.log('✅ Boot complete');
}

// ── Tab routing ───────────────────────────────────────────────────────────────

function go(tab) {
  // Hide all views
  document.querySelectorAll('.view').forEach(v => v.classList.remove('on'));
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('tab-active'));

  state.curTab = tab;

  const viewEl = document.getElementById('v-' + tab);
  if (!viewEl) { console.error('go(): no view element for tab:', tab); return; }
  viewEl.classList.add('on');
  const tabEl = document.getElementById('t-' + tab);
  if (tabEl) tabEl.classList.add('tab-active');

  // Toggle button: only on TD
  const showTog = (tab === 'td');
  const togbtn  = document.getElementById('togbtn');
  togbtn.style.display = showTog ? '' : 'none';

  if (showTog) {
    applyLayout(tab);
    if (!state.togUsed) {
      togbtn.classList.remove('pulse');
      void togbtn.offsetWidth; // reflow to restart animation
      togbtn.classList.add('pulse');
    }
  }

  // Notify active tab module
  const evt = new CustomEvent('ts:tabenter', { detail: { tab } });
  document.dispatchEvent(evt);
}

function tclick(tab) {
  const tabEl = document.getElementById('t-' + tab);
  if (!state.activeStory) {
    // Shake to signal disabled
    if (tabEl) {
      tabEl.classList.remove('shake');
      void tabEl.offsetWidth;
      tabEl.classList.add('shake');
      tabEl.addEventListener('animationend', () => tabEl.classList.remove('shake'), { once: true });
    }
  } else {
    go(tab);
  }
}

function unlockTabs() {
  ['td','ts','chem'].forEach(id => {
    const el = document.getElementById('t-' + id);
    if (el) { el.classList.remove('tab-disabled'); el.classList.add('tab-locked'); el.classList.remove('tab-locked'); }
  });
}

function lockTabs() {
  ['td','ts','chem'].forEach(id => {
    const el = document.getElementById('t-' + id);
    if (el) { el.classList.add('tab-disabled'); el.classList.remove('tab-locked'); }
  });
}

// ── Layout toggle (SO + TD) ───────────────────────────────────────────────────

function applyLayout(tab) {
  const t = tab || state.curTab;
  const is2 = state.layout === '2col';
  document.getElementById('togbtn-label').textContent = is2 ? '1 Col' : '2 Col';

  const evt = new CustomEvent('ts:layout', { detail: { layout: state.layout, tab: t } });
  document.dispatchEvent(evt);
}

function toggleLayout() {
  state.layout = (state.layout === '2col') ? '1col' : '2col';
  state.togUsed = true;
  document.getElementById('togbtn').classList.remove('pulse');
  applyLayout();
}

// ── Story management ──────────────────────────────────────────────────────────

async function loadStories() {
  const fd = new FormData(); fd.append('cmd', 'listStories');
  const list = await utils.apiReq(fd);
  let tmp = (list || []).map(s => {
    if (s.updated && s.updated > 10000000000) s.updated /= 1000;
    return s;
  });
  tmp.sort((a,b) => (b.updated||0) - (a.updated||0));
  state.storyList = tmp;

  const evt = new CustomEvent('ts:stories', { detail: { list: tmp } });
  document.dispatchEvent(evt);
}

async function openStory(id) {
  try {
    const story = await api.getStory(id);
    state.activeStory = story;

    // Touch timestamp
    const fd = new FormData(); fd.append('cmd','touchStory'); fd.append('id', story.id);
    utils.apiReq(fd);

    unlockTabs();

    // Navigate to TalkingDraft
    go('td');

    const evt = new CustomEvent('ts:storyopen', { detail: { story } });
    document.dispatchEvent(evt);
  } catch(err) {
    utils.showAlert('Story not found: ' + err);
    window.history.replaceState({}, '', 'index.html');
  }
}

async function createStory(name, structure, pages) {
  try {
    const story = api.newStory(name, structure, pages * 2); // pages → minutes (2 min/page)
    await api.saveStory(story);
    window.location.replace('index.html?sid=' + story.id);
  } catch(err) {
    utils.showAlert(err);
  }
}

async function deleteStory(story) {
  showConfirmModal('Delete Story?',
    `Delete "${story.name}"? This cannot be undone.`,
    async () => {
      await api.deleteStory(story);
      if (state.activeStory?.id === story.id) {
        state.activeStory = null; lockTabs(); go('dash');
        window.history.replaceState({}, '', 'index.html');
      }
      await loadStories();
      utils.showAlert('Story deleted.', 2000, false, 'notice');
    }
  );
}

async function copyStory(story) {
  showPromptModal('Copy Story', 'Enter name for copy:', story.name + ' COPY', async (name) => {
    if (!name?.trim()) return;
    const copy = JSON.parse(JSON.stringify(story));
    copy.id = genId(); copy.name = name.trim();
    copy.sections.forEach((s,i) => { s.id = genId(i); });
    const rcd = await api.saveStory(copy);
    if (!rcd?.id) return utils.showAlert('Error copying story');
    // Copy audio
    const tids = [];
    for (const scene of story.scenes)
      for (const tid of scene.trackOrder)
        tids.push(story.id + '-' + scene.id + '-' + tid);
    const fd = new FormData(); fd.append('cmd','copyAudio'); fd.append('newid', rcd.id); fd.append('tids', JSON.stringify(tids));
    await utils.apiReq(fd);
    window.location.replace('index.html?sid=' + rcd.id);
  });
}

async function renameStory(story) {
  showPromptModal('Rename Story', 'Enter new name:', story.name, async (newName) => {
    if (!newName?.trim()) return utils.showAlert('Please enter a story name.');
    story.name = newName.replace(/\n/g,' ').trim();
    await api.saveStory(story);
    await loadStories();
    const evt = new CustomEvent('ts:storymeta', { detail: { story } });
    document.dispatchEvent(evt);
  });
}

// ── Structure Modal ───────────────────────────────────────────────────────────

let _structureCallback = null;

function buildStructureGrid() {
  const grid = document.getElementById('sm-grid');
  // Use data-idx (numeric index) to avoid apostrophe bugs with names like "Hero's Journey"
  grid.innerHTML = STRUCTURES.map((s, i) => `
    <div class="st" data-idx="${i}">
      ${s.id}
    </div>`).join('');
  grid.addEventListener('mouseover', e => {
    const el = e.target.closest('.st');
    if (el) App.smHover(STRUCTURES[parseInt(el.dataset.idx)]?.id);
  });
  grid.addEventListener('mouseout', e => {
    if (!e.target.closest('.st')) App.smHover(null);
  });
  grid.addEventListener('click', e => {
    const el = e.target.closest('.st');
    if (el) App.smPick(STRUCTURES[parseInt(el.dataset.idx)]?.id);
  });
}

function openStructureModal(current, callback) {
  _structureCallback = callback;
  state.pickedStructure = current || null;
  // highlight current
  document.querySelectorAll('#sm-grid .st').forEach(el => {
    const idx = parseInt(el.dataset.idx);
    el.classList.toggle('picked', STRUCTURES[idx]?.id === current);
  });
  const descEl = document.getElementById('sm-desc-txt');
  descEl.textContent = 'Hover a structure to learn more. Click to select.';
  descEl.classList.remove('lit');
  document.getElementById('sm').classList.add('on');
}

function closeStructureModal() { document.getElementById('sm').classList.remove('on'); }

function smHover(id) {
  const descEl = document.getElementById('sm-desc-txt');
  if (!id) {
    descEl.textContent = 'Hover a structure to learn more. Click to select.';
    descEl.classList.remove('lit');
    return;
  }
  const s = STRUCTURES.find(x => x.id === id);
  if (s) { descEl.textContent = s.desc; descEl.classList.add('lit'); }
}

function smPick(id) {
  state.pickedStructure = id;
  document.querySelectorAll('#sm-grid .st').forEach(el => {
    const idx = parseInt(el.dataset.idx);
    el.classList.toggle('picked', STRUCTURES[idx]?.id === id);
  });
  setTimeout(() => {
    closeStructureModal();
    if (_structureCallback) _structureCallback(id);
  }, 250);
}

// ── Confirm / Prompt Modal ────────────────────────────────────────────────────

function showConfirmModal(title, message, onConfirm, okLabel) {
  state.modal = { show:true, type:'confirm', title, message, inputValue:'', onConfirm, okLabel };
  _renderModal();
}
function showPromptModal(title, message, defaultValue, onConfirm) {
  state.modal = { show:true, type:'prompt', title, message, inputValue: defaultValue||'', onConfirm };
  _renderModal();
}
function _renderModal() {
  const m = state.modal;
  document.getElementById('cm-title').textContent = m.title;
  document.getElementById('cm-msg').textContent   = m.message;
  const inp = document.getElementById('cm-input');
  if (m.type === 'prompt') {
    inp.style.display = '';
    inp.value = m.inputValue;
    setTimeout(() => { inp.focus(); inp.select(); }, 50);
  } else {
    inp.style.display = 'none';
  }
  document.getElementById('cm-ok').textContent = m.type === 'confirm' ? (m.okLabel || 'Delete') : 'OK';
  document.getElementById('cm').classList.add('on');
}
function confirmModal() {
  const m = state.modal;
  const val = m.type === 'prompt' ? document.getElementById('cm-input').value : null;
  document.getElementById('cm').classList.remove('on');
  if (m.onConfirm) m.onConfirm(val);
  state.modal.show = false;
}
function cancelModal() {
  document.getElementById('cm').classList.remove('on');
  state.modal.show = false;
}

// ── Alert Toast ───────────────────────────────────────────────────────────────

let _alertTimer = null;
function showAlert(msg, timeout, modal, type) {
  const el = document.getElementById('alert-toast');
  if (!msg) { el.classList.remove('on','notice'); return; }
  el.textContent = msg;
  el.className   = 'on' + (type === 'notice' ? ' notice' : '');
  if (_alertTimer) clearTimeout(_alertTimer);
  if (!modal) _alertTimer = setTimeout(() => el.classList.remove('on','notice'), timeout || 3000);
}

// ── Help & Settings ──────────────────────────────────────────────────────────
function showHelp() { showAlert('Help coming soon.', 2500, false, 'notice'); }
function showSettings() { showAlert('Settings coming soon.', 2500, false, 'notice'); }

// ── Export Modal ─────────────────────────────────────────────────────────────

function openExportModal(ctx) {
  // Always show 3 options for all contexts
  const em = document.getElementById('em');
  if (!em) return;
  document.getElementById('em-title').textContent = 'Export';
  document.getElementById('em-sub').textContent   = 'Choose what to export:';
  const o1 = document.getElementById('em-opt1');
  const o2 = document.getElementById('em-opt2');
  const o3 = document.getElementById('em-opt3');
  if (o1) { o1.textContent = 'Beatsheet — section names + section notes'; o1.onclick = () => { closeExportModal(); _exportOutline('beatsheet'); }; }
  if (o2) { o2.textContent = 'Outline — section names + scene headings + scene notes'; o2.onclick = () => { closeExportModal(); _exportOutline('stepoutline'); }; }
  if (o3) { o3.textContent = 'Script — your dictated transcript so far'; o3.onclick = () => { closeExportModal(); _exportTranscript(); }; }
  em.classList.add('ov-on');
}
function closeExportModal() {
  document.getElementById('em').classList.remove('ov-on');
}

async function _exportOutline(type) {
  const story = state.activeStory;
  if (!story) { showAlert('No story open.'); return; }
  const preset = api.sectionPresets?.[story.sectionPreset];
  let out = story.name + '\n' + '='.repeat(story.name.length) + '\n\n';
  if (type === 'beatsheet') {
    (story.sections || []).forEach((sec, idx) => {
      const name = preset?.sections?.[idx]?.name || ('Section ' + (idx+1));
      out += name + '\n' + (sec.value?.trim() || '(empty)') + '\n\n';
    });
  } else {
    (story.sections || []).forEach((sec, idx) => {
      const name = preset?.sections?.[idx]?.name || ('Section ' + (idx+1));
      out += name + '\n';
      const scenes = (story.scenes || []).filter(s => s.sectionIdx === idx);
      scenes.forEach(sc => {
        out += '  ' + sc.name + '\n';
        if (sc.desc) out += '    ' + sc.desc + '\n';
      });
      out += '\n';
    });
  }
  try {
    if (typeof Neutralino !== 'undefined') {
      const p = await Neutralino.os.showSaveDialog('Save Outline');
      if (p) { await Neutralino.filesystem.writeFile(p.endsWith('.txt') ? p : p + '.txt', out); showAlert('Saved.', 2000, false, 'notice'); }
    }
  } catch(e) { if (e?.code !== 'NE_OS_DIACANC') showAlert('Save error: ' + e?.message); }
}

async function _exportTranscript() {
  const story = state.activeStory;
  if (!story?.scenes?.length) { showAlert('No transcript available.'); return; }
  let out = '';
  for (const scene of story.scenes) {
    out += scene.name + '\n\n';
    for (const tid of (scene.trackOrder || [])) {
      const t = scene.tracks[tid];
      if (!t?.transcript) continue;
      out += t.name === 'ACTION' ? ('\n' + t.transcript + '\n\n') : (t.name + '\n' + t.transcript + '\n\n');
    }
    out += '\n';
  }
  out = out.replace(/\n{3,}/g, '\n\n');
  if (!out.trim()) { showAlert('No transcript available.'); return; }
  try {
    if (typeof Neutralino !== 'undefined') {
      const p = await Neutralino.os.showSaveDialog('Save Transcript');
      if (p) { await Neutralino.filesystem.writeFile(p.endsWith('.txt') ? p : p + '.txt', out); showAlert('Saved.', 2000, false, 'notice'); }
    }
  } catch(e) { if (e?.code !== 'NE_OS_DIACANC') showAlert('Save error: ' + e?.message); }
}

// ── SceneDictation Modal (RM) ─────────────────────────────────────────────────

let _rmSelectedCharSrcIdx = null;

function openRM(scene) {
  const story = state.activeStory;
  if (!story || !scene) return;
  state.activeScene = scene;

  const slug    = document.getElementById('rm-slug');
  const notes   = document.getElementById('rm-notes');
  const npd     = document.getElementById('rm-npd');
  const maxEl   = document.getElementById('rm-wave-max');
  const maxEl2  = document.getElementById('rm-max');

  if (slug)   slug.value   = scene.name;
  if (notes)  notes.value  = scene.desc || '';
  if (maxEl)  maxEl.textContent  = 'Transcribe up to a ' + Math.round(state.sceneMax/60*10)/10 + ' minute scene';
  if (maxEl2) maxEl2.textContent = _time2ms(state.sceneMax);

  // Build numpad
  if (npd) npd.innerHTML = _buildRMNumpad(scene);

  // Build kbd preview
  _rmRefreshKbdPreview();

  // Build reuse list
  _rmBuildReuseList(story, scene);

  // Reset transcript
  document.getElementById('rm-transcript').style.display = 'none';
  document.getElementById('rm-ts-btn').textContent = 'Show Transcript';

  // Reset wave
  _rmUpdateWave();

  document.getElementById('rm').classList.add('on');
}

function closeRM() {
  document.getElementById('rm').classList.remove('on');
  document.getElementById('rm-sa-menu').style.display = 'none';
  document.getElementById('rm-sa-plus').style.display  = '';
  document.getElementById('rm-sa-minus').style.display = 'none';
}

function _time2ms(s) {
  s = parseInt(s||0,10);
  const m = Math.floor(s/60), sec = s - m*60;
  return String(m).padStart(2,'0') + ':' + String(sec).padStart(2,'0');
}

function _buildRMNumpad(scene) {
  const layout = localStorage.getItem('td_kbd_layout') || 'numpad';
  const rows   = layout === 'numpad' ? [7,8,9,4,5,6,1,2,3] : [1,2,3,4,5,6,7,8,9];
  return rows.map(i => `
    <div class="cb" id="rm-cb-${i}" onclick="App.rmCharPress(${i})" title="Press ${i} on keyboard">
      <span class="cn-badge-c">${i}</span>
      <span style="overflow:hidden;font-size:10px;" id="rm-cbn-${i}">${scene.chars?.[i] || 'NAME-'+i}</span>
    </div>`).join('') + `
    <div class="acb" id="rm-cb-0" onclick="App.rmCharPress(0)">
      <span class="cn-badge-c">0</span> ACTION
    </div>
    <div style="display:flex;align-items:center;justify-content:center;">
      <div class="mb" id="rm-mic" onclick="App.rmToggleRecord()">
        <svg width="14" height="19" viewBox="0 0 14 19" fill="var(--yellow)"><path fill-rule="evenodd" clip-rule="evenodd" d="M7 12C8.7 12 10 10.7 10 9V3C10 1.3 8.7 0 7 0C5.3 0 4 1.3 4 3V9C4 10.7 5.3 12 7 12ZM12.3 9C12.3 12 9.8 14.1 7 14.1C4.2 14.1 1.7 12 1.7 9H0C0 12.4 2.7 15.2 6 15.7V19H8V15.7C11.3 15.2 14 12.4 14 9H12.3Z"/></svg>
      </div>
    </div>`;
}

function _rmRefreshKbdPreview() {
  const layout = localStorage.getItem('td_kbd_layout') || 'numpad';
  const rows   = layout === 'numpad' ? [7,8,9,4,5,6,1,2,3] : [1,2,3,4,5,6,7,8,9];
  const np = document.getElementById('rm-kbd-np');
  const nr = document.getElementById('rm-kbd-nr');
  if (np) np.classList.toggle('ib-on', layout === 'numpad');
  if (nr) nr.classList.toggle('ib-on', layout === 'row');
  const prev = document.getElementById('rm-kbd-preview');
  if (prev) prev.innerHTML = rows.map(i =>
    `<div style="background:var(--surface);border:1px solid rgba(255,255,255,0.15);border-radius:3px;display:flex;align-items:center;justify-content:center;font-family:'DM Mono',monospace;font-size:9px;color:var(--yellow);">${i}</div>`
  ).join('');
}

function _rmBuildReuseList(story, scene) {
  const list    = document.getElementById('rm-reuse-list');
  const preview = document.getElementById('rm-reuse-preview');
  const others  = (story.scenes || []).filter(s => s.id !== scene.id);
  _rmSelectedCharSrcIdx = others.length ? story.scenes.indexOf(others[0]) : null;

  function renderPreview(src) {
    if (!src || !preview) return;
    const layout = localStorage.getItem('td_kbd_layout') || 'numpad';
    const rows   = layout === 'numpad' ? [7,8,9,4,5,6,1,2,3] : [1,2,3,4,5,6,7,8,9];
    const chars  = src.chars || [];
    preview.innerHTML = rows.map(i =>
      `<div style="background:var(--surface);border:1px solid rgba(255,255,255,0.08);border-radius:3px;padding:3px 4px;text-align:center;">
        <div style="font-size:8px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${(chars[i]||'NAME-'+i).substring(0,9)}</div>
        <div style="font-size:6px;color:var(--yellow);opacity:0.7;">${i}</div>
      </div>`
    ).join('');
  }

  if (!others.length) {
    if (list) list.innerHTML = '<div style="padding:12px 10px;font-size:10px;color:var(--ghost);font-style:italic;">No other scenes yet.</div>';
    if (preview) preview.innerHTML = '';
    return;
  }

  // Render preview for first scene by default
  renderPreview(others[0]);

  if (list) list.innerHTML = others.map((s, si) => {
    const srcIdx = story.scenes.indexOf(s);
    const isFirst = si === 0;
    return `<div style="padding:7px 10px;border-bottom:1px solid rgba(255,255,255,0.05);cursor:pointer;background:${isFirst ? 'rgba(255,255,255,0.06)' : ''};color:${isFirst ? 'var(--white)' : 'var(--ghost)'};font-size:11px;font-weight:${isFirst ? '600' : '400'};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;transition:background .1s;"
      data-src="${srcIdx}"
      onmouseover="this.style.background='rgba(255,255,255,0.06)';this.style.color='var(--white)';App._rmHoverScene(${srcIdx})"
      onmouseout="this.style.background=this.dataset.selected==='1'?'rgba(255,255,255,0.06)':'';this.style.color=this.dataset.selected==='1'?'var(--white)':'var(--ghost)'"
      onclick="App._rmSelectScene(${srcIdx}, this)"
      ${isFirst ? 'data-selected="1"' : ''}>
      ${s.name}
    </div>`;
  }).join('');
}

function _rmHoverScene(srcIdx) {
  const story = state.activeStory;
  if (!story) return;
  const src = story.scenes[srcIdx];
  const preview = document.getElementById('rm-reuse-preview');
  if (!src || !preview) return;
  const layout = localStorage.getItem('td_kbd_layout') || 'numpad';
  const rows   = layout === 'numpad' ? [7,8,9,4,5,6,1,2,3] : [1,2,3,4,5,6,7,8,9];
  const chars  = src.chars || [];
  preview.innerHTML = rows.map(i =>
    `<div style="background:var(--surface);border:1px solid rgba(255,255,255,0.08);border-radius:3px;padding:3px 4px;text-align:center;">
      <div style="font-size:8px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${(chars[i]||'NAME-'+i).substring(0,9)}</div>
      <div style="font-size:6px;color:var(--yellow);opacity:0.7;">${i}</div>
    </div>`
  ).join('');
}

function _rmSelectScene(srcIdx, el) {
  _rmSelectedCharSrcIdx = srcIdx;
  document.querySelectorAll('#rm-reuse-list [data-src]').forEach(d => {
    d.dataset.selected = '0';
    d.style.background = '';
    d.style.color = 'var(--ghost)';
    d.style.fontWeight = '400';
  });
  el.dataset.selected = '1';
  el.style.background = 'rgba(255,255,255,0.06)';
  el.style.color = 'var(--white)';
  el.style.fontWeight = '600';
}

function rmLoadChars() {
  const story = state.activeStory;
  const scene = state.activeScene;
  if (_rmSelectedCharSrcIdx === null || !story || !scene) return;
  const src = story.scenes[_rmSelectedCharSrcIdx];
  if (!src?.chars) return;
  if (!scene.chars) scene.chars = ['ACTION','NAME-1','NAME-2','NAME-3','NAME-4','NAME-5','NAME-6','NAME-7','NAME-8','NAME-9'];
  for (let i = 1; i <= 9; i++) {
    scene.chars[i] = src.chars[i] || scene.chars[i];
    const lbl = document.getElementById('rm-cbn-' + i);
    if (lbl) lbl.textContent = scene.chars[i];
  }
  scene.lastModified = Date.now();
  api.saveStory(story);
  document.getElementById('rm-reuse-panel').style.display = 'none';
  showAlert('Characters copied from ' + src.name, 2000, false, 'notice');
}

function rmToggleReuse() {
  const panel = document.getElementById('rm-reuse-panel');
  if (!panel) return;
  const isOpen = panel.style.display !== 'none';
  panel.style.display = isOpen ? 'none' : 'block';
  if (!isOpen) {
    setTimeout(() => document.addEventListener('click', function closeIt(e) {
      if (!panel.contains(e.target) && e.target.id !== 'rm-reuse-panel') {
        panel.style.display = 'none';
        document.removeEventListener('click', closeIt);
      }
    }), 0);
  }
}

function rmToggleIns(btn) {
  const panel = document.getElementById('rm-ins-panel');
  const dn    = document.getElementById('rm-ins-dn');
  const up    = document.getElementById('rm-ins-up');
  if (!panel) return;
  const open = panel.style.display !== 'none';
  panel.style.display = open ? 'none' : 'block';
  if (dn) dn.style.display = open ? '' : 'none';
  if (up) up.style.display = open ? 'none' : '';
}

function rmSetKbd(layout) {
  localStorage.setItem('td_kbd_layout', layout);
  _rmRefreshKbdPreview();
  const npd = document.getElementById('rm-npd');
  if (npd) npd.innerHTML = _buildRMNumpad(state.activeScene);
  // Also update 2-col if open
  const npd2 = document.getElementById('rec-npd');
  if (npd2 && typeof TD !== 'undefined') {
    const np = document.getElementById('kbd-numpad-btn');
    const nr = document.getElementById('kbd-row-btn');
    if (np) np.classList.toggle('ib-on', layout === 'numpad');
    if (nr) nr.classList.toggle('ib-on', layout === 'row');
  }
}

function togSA() {
  const menu  = document.getElementById('rm-sa-menu');
  const plus  = document.getElementById('rm-sa-plus');
  const minus = document.getElementById('rm-sa-minus');
  const open  = menu.style.display === 'none' || menu.style.display === '';
  menu.style.display  = open ? 'block' : 'none';
  plus.style.display  = open ? 'none' : '';
  minus.style.display = open ? '' : 'none';
  if (open) {
    setTimeout(() => document.addEventListener('click', function cl() {
      menu.style.display = 'none';
      plus.style.display = '';
      minus.style.display = 'none';
      document.removeEventListener('click', cl);
    }), 10);
  }
}

function rmAddScene() {
  const story = state.activeStory;
  const scene = state.activeScene;
  if (!story || !scene) return;
  const sIdx = scene.sectionIdx || 0;
  api.addScene(story, sIdx, null, scene.chars ? [].concat(scene.chars) : []);
  api.saveStory(story);
  if (typeof TD !== 'undefined') {
    const layout = state.layout || '2col';
    if (layout === '2col') { const ev = new CustomEvent('ts:storyopen', {detail:{story}}); document.dispatchEvent(ev); }
    else document.dispatchEvent(new CustomEvent('ts:storyopen', {detail:{story}}));
  }
  document.getElementById('rm-sa-menu').style.display = 'none';
  showAlert('Scene added.', 1500, false, 'notice');
}

function rmDeleteScene() {
  const story = state.activeStory;
  const scene = state.activeScene;
  if (!story || !scene) return;
  showConfirmModal('Delete Scene?', `Delete "${scene.name}"? This cannot be undone.`, () => {
    const idx = story.scenes.findIndex(s => s.id === scene.id);
    if (idx >= 0) { story.scenes.splice(idx, 1); api.saveStory(story); }
    closeRM();
    if (typeof TD !== 'undefined') document.dispatchEvent(new CustomEvent('ts:storyopen', {detail:{story}}));
  });
}

function rmPrev() {
  const story = state.activeStory;
  const scene = state.activeScene;
  if (!story || !scene) return;
  const idx = story.scenes.findIndex(s => s.id === scene.id);
  if (idx > 0) openRM(story.scenes[idx - 1]);
}

function rmNext() {
  const story = state.activeStory;
  const scene = state.activeScene;
  if (!story || !scene) return;
  const idx = story.scenes.findIndex(s => s.id === scene.id);
  if (idx < story.scenes.length - 1) openRM(story.scenes[idx + 1]);
}

function rmToggleTranscript() {
  const el  = document.getElementById('rm-transcript');
  const btn = document.getElementById('rm-ts-btn');
  const body = document.getElementById('rm-transcript-body');
  const open = el.style.display === 'none';
  el.style.display = open ? 'block' : 'none';
  btn.textContent  = open ? 'Hide Transcript' : 'Show Transcript';
  if (open && body) {
    const scene = state.activeScene;
    if (!scene) return;
    body.innerHTML = (scene.trackOrder || []).map(tid => {
      const t = scene.tracks[tid];
      if (!t) return '';
      const goTS = `ondblclick="App.closeRM();App.go('ts');"` ;
      if (t.name === 'ACTION') {
        return `<div class="spa" style="cursor:default;" ${goTS}>${t.transcript || ''}</div>`;
      }
      return `<div class="spc">
        <div class="spn" style="cursor:default;">${t.name}</div>
        <div class="spl" style="cursor:default;" ${goTS}>${t.transcript || ''}</div>
      </div>`;
    }).join('') || '<div style="color:var(--ghost);font-size:11px;font-style:italic;">No transcript yet.</div>';
  }
}

function rmCharPress(n) {
  // Rename character (setup mode) or switch speaker (active mode)
  const scene = state.activeScene;
  const story = state.activeStory;
  if (!scene || !story) return;
  if (n === 0) return;
  const current = scene.chars?.[n] || 'NAME-' + n;
  showPromptModal('Rename Character', `Enter name for button ${n}:`, current, (newName) => {
    if (!newName?.trim()) return;
    if (!scene.chars) scene.chars = ['ACTION','NAME-1','NAME-2','NAME-3','NAME-4','NAME-5','NAME-6','NAME-7','NAME-8','NAME-9'];
    scene.chars[n] = newName.trim().toUpperCase();
    scene.lastModified = Date.now();
    api.saveStory(story);
    const lbl = document.getElementById('rm-cbn-' + n);
    if (lbl) lbl.textContent = scene.chars[n];
  });
}

function rmToggleRecord() {
  // Delegate to TD.toggleRecord — the recorder state machine lives in talking-draft.js
  // The modal uses the same state.mode / mediaRecorder shared state
  if (typeof TD !== 'undefined') TD.toggleRecord();
}

function _rmUpdateWave() {
  const s     = state;
  const setup = document.getElementById('rm-wave-setup');
  const act   = document.getElementById('rm-wave-active');
  const trans = document.getElementById('rm-wave-transcribing');
  const audio = document.getElementById('rm-audio');
  const mic   = document.getElementById('rm-mic');
  if (!setup) return;
  if (s.mode === 'active') {
    setup.style.display = 'none'; if(trans) trans.style.display='none'; if(audio) audio.style.display='none';
    if(act) act.style.display='flex';
    if(mic) mic.innerHTML = `<svg width="18" height="18" viewBox="0 0 512 512" fill="var(--green)"><path d="M224 432h-80V80h80zM368 432h-80V80h80z"/></svg>`;
    if(mic) mic.classList.add('rec-on');
  } else if (s.mode === 'transcription') {
    setup.style.display='none'; if(act) act.style.display='none'; if(audio) audio.style.display='none';
    if(trans) trans.style.display='flex';
  } else {
    if(act) act.style.display='none'; if(trans) trans.style.display='none';
    if(s.audioURL) {
      setup.style.display='none';
      if(audio) { audio.src=s.audioURL; audio.style.display=''; }
    } else {
      setup.style.display='flex'; if(audio) audio.style.display='none';
    }
    if(mic) { mic.innerHTML=`<svg width="14" height="19" viewBox="0 0 14 19" fill="var(--yellow)"><path fill-rule="evenodd" clip-rule="evenodd" d="M7 12C8.7 12 10 10.7 10 9V3C10 1.3 8.7 0 7 0C5.3 0 4 1.3 4 3V9C4 10.7 5.3 12 7 12ZM12.3 9C12.3 12 9.8 14.1 7 14.1C4.2 14.1 1.7 12 1.7 9H0C0 12.4 2.7 15.2 6 15.7V19H8V15.7C11.3 15.2 14 12.4 14 9H12.3Z"/></svg>`; mic.classList.remove('rec-on'); }
  }
}

// ── Guard ─────────────────────────────────────────────────────────────────────
function checkStuff() {
  if (state.mode === 'active')        { showAlert('Recording in progress');    return false; }
  if (state.mode === 'transcription') { showAlert('Transcription in progress'); return false; }
  if (state.loading > 0)              { showAlert('Loading in progress');       return false; }
  return true;
}

// ── Keyboard ──────────────────────────────────────────────────────────────────
function onKeyDown(e) {
  if (e.metaKey || e.ctrlKey) return;
  if (state.mode === 'active') {
    const k = e.key;
    if ((k >= '0' && k <= '9') || k === ' ' || e.code === 'NumpadDecimal') {
      e.preventDefault(); e.stopPropagation();
    }
  }
}
function onKeyUp(e) {
  // Recorder key events — forwarded to talking-draft module via custom event
  if (state.mode === 'active' || state.mode === 'setup') {
    document.dispatchEvent(new CustomEvent('ts:keyup', { detail: { key: e.key, code: e.code } }));
  }
}
function onBeforeUnload(e) {
  // I: covers transcription and active recording
  if (state.transcribing || state.mode === 'transcription' || state.mode === 'active') {
    e.preventDefault(); e.returnValue = '';
  }
}

// ── Expose global App object ──────────────────────────────────────────────────
window.App = {
  go, tclick, toggleLayout, showHelp, showSettings,
  openStructureModal, closeStructureModal, smHover, smPick,
  showConfirmModal, showPromptModal, confirmModal, cancelModal, showAlert, checkStuff,
  openStory, createStory, loadStories, deleteStory, copyStory, renameStory,
  // Export modal
  openExportModal, closeExportModal,
  // SceneDictation modal
  openRM, closeRM, rmPrev, rmNext, togSA, rmAddScene, rmDeleteScene,
  rmToggleTranscript, rmToggleIns, rmToggleReuse, rmLoadChars,
  rmCharPress, rmToggleRecord, rmSetKbd,
  _rmHoverScene, _rmSelectScene,
  state, api, utils, genId, STRUCTURES,
};

// ── Wire utils.showAlert to global toast ─────────────────────────────────────
utils.showAlert = showAlert;

// ── Run ───────────────────────────────────────────────────────────────────────
boot().catch(console.error);
