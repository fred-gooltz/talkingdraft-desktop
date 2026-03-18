/**
 * TalkingStudio — tabs/talking-stories.js
 * Tab: TalkingStories (Produce)
 *
 * Left column:  editable screenplay — "{} editable" indicator in header
 *               Export + Import FDX (greyed) in left header
 *               Click any line = edit inline
 * Right column: Cast & Voices — full mockup design
 *               Re-record a line row with mic icon
 *               Character cards: photo placeholder + + mouseover, fake play button
 *               ▶ Publish Podcast [LOCKED] at bottom
 */

import { api, utils } from '../lib/utils.js';

// ── Render shell ──────────────────────────────────────────────────────────────

export function renderTalkingStories(container) {
  container.style.flexDirection = 'column';
  container.style.overflow = 'hidden';

  container.innerHTML = `
    <div style="flex:1;display:flex;overflow:hidden;">

      <!-- LEFT: editable screenplay -->
      <div style="flex:1;display:flex;flex-direction:column;overflow:hidden;border-right:1px solid rgba(255,255,255,0.06);">

        <div style="padding:7px 14px;border-bottom:1px solid rgba(255,255,255,0.06);background:var(--card);display:flex;align-items:center;gap:8px;flex-shrink:0;">
          <div style="flex:1;min-width:0;">
            <div style="font-family:'DM Mono',monospace;font-size:9px;color:var(--ghost);" id="ts-breadcrumb"></div>
            <div style="font-family:'Syne',sans-serif;font-size:14px;font-weight:700;margin-top:1px;" id="ts-scene-slug"></div>
          </div>
          <!-- {} editable indicator -->
          <div style="display:flex;align-items:center;gap:4px;font-family:'DM Mono',monospace;font-size:9px;color:var(--dim);">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg>
            editable
          </div>
          <!-- Import FDX — greyed -->
          <button class="ib ib-off" style="font-size:10px;" title="Upload an FDX or PDF script — coming soon">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v13"/></svg>
            Import FDX
          </button>
          <button class="ib" style="font-size:10px;" onclick="TS.exportTranscript()">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
            Export Transcript
          </button>
          <button class="ib" style="font-size:10px;" onclick="TS.prevScene()">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 19l-7-7 7-7"/></svg>
            Prev
          </button>
          <button class="ib" style="font-size:10px;" onclick="TS.nextScene()">
            Next
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 5l7 7-7 7"/></svg>
          </button>
        </div>

        <!-- Editable screenplay -->
        <div id="ts-script" style="flex:1;overflow-y:auto;padding:16px 24px 40px;"></div>

      </div>

      <!-- RIGHT: Cast & Voices -->
      <div style="width:400px;flex-shrink:0;display:flex;flex-direction:column;overflow:hidden;background:var(--base);">

        <!-- Right column header -->
        <div style="padding:9px 14px;border-bottom:1px solid rgba(255,255,255,0.06);background:var(--card);flex-shrink:0;display:flex;align-items:flex-start;justify-content:space-between;">
          <div>
            <div style="font-family:'Syne',sans-serif;font-size:13px;font-weight:700;">Cast &amp; Voices</div>
            <div style="font-family:'DM Mono',monospace;font-size:8px;color:rgba(255,216,0,0.5);margin-top:1px;">TalkingStories — coming soon</div>
            <div style="font-size:11px;color:var(--ghost);margin-top:6px;line-height:1.5;font-style:italic;">Re-record specific lines or run voice morph AI to create an audio drama.</div>
          </div>
          <!-- Export Pod — greyed -->
          <button class="ib ib-off" style="font-size:10px;flex-shrink:0;margin-left:8px;" title="Coming soon">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
            Export Pod
          </button>
        </div>

        <!-- Re-record a line row -->
        <div style="padding:8px 14px;border-bottom:1px solid rgba(255,255,255,0.06);display:flex;align-items:center;justify-content:space-between;flex-shrink:0;">
        <span style="font-family:'DM Mono',monospace;font-size:9px;color:var(--ghost);">Click a line to re-record it</span>
          <div style="width:28px;height:28px;border-radius:50%;background:rgba(186,232,232,0.05);border:1px solid rgba(186,232,232,0.15);opacity:0.4;display:flex;align-items:center;justify-content:center;">
            <svg width="12" height="14" viewBox="0 0 14 19" fill="var(--dim)"><path fill-rule="evenodd" clip-rule="evenodd" d="M7 12C8.7 12 10 10.7 10 9V3C10 1.3 8.7 0 7 0C5.3 0 4 1.3 4 3V9C4 10.7 5.3 12 7 12ZM12.3 9C12.3 12 9.8 14.1 7 14.1C4.2 14.1 1.7 12 1.7 9H0C0 12.4 2.7 15.2 6 15.7V19H8V15.7C11.3 15.2 14 12.4 14 9H12.3Z"/></svg>
          </div>
        </div>

        <!-- Character cards — scrollable -->
        <div id="ts-cast-rows" style="flex:1;overflow-y:auto;padding:10px 12px 16px;opacity:0.65;">
          <div style="font-size:10px;color:var(--ghost);font-style:italic;text-align:center;padding:20px 0;font-family:'DM Mono',monospace;">
            Open a story to see cast.
          </div>
        </div>

        <!-- Locked bottom section -->
        <div style="padding:10px 14px 14px;border-top:1px solid rgba(255,255,255,0.05);flex-shrink:0;">
          <button disabled style="width:100%;padding:10px;border-radius:5px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.1);color:rgba(255,255,255,0.22);font-family:'Syne',sans-serif;font-size:12px;font-weight:700;letter-spacing:0.05em;cursor:not-allowed;display:flex;align-items:center;justify-content:center;gap:7px;">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polygon points="10,8 16,12 10,16"/></svg>
            Publish Podcast
            <span style="font-family:'DM Mono',monospace;font-size:8px;border:1px solid currentColor;border-radius:2px;padding:0 3px;">LOCKED</span>
          </button>
          <div style="font-family:'DM Mono',monospace;font-size:8px;color:rgba(255,255,255,0.18);text-align:center;margin-top:5px;">Assign voices to all characters and approve to unlock</div>
        </div>

      </div>
    </div>
  `;

  document.addEventListener('ts:storyopen', (e) => _populate(e.detail.story));
  // Re-render cast rows when tab is entered (active scene may have changed in TalkingDraft)
  document.addEventListener('ts:tabenter', (e) => {
    if (e.detail.tab === 'ts') {
      const story = App.state.activeStory;
      if (story) _renderCastRows(story);
    }
  });
}

// ── Populate on story open ────────────────────────────────────────────────────

function _populate(story) {
  const bc = document.getElementById('ts-breadcrumb');
  if (bc) bc.textContent = story.name;
  _renderScript(story);
  _renderCastRows(story);
}

// ── Left: editable screenplay ─────────────────────────────────────────────────

function _renderScript(story) {
  const el = document.getElementById('ts-script');
  if (!el) return;
  const scenes = story.scenes || [];
  if (!scenes.length) {
    el.innerHTML = '<div style="color:var(--ghost);font-size:12px;font-style:italic;">No scenes yet. Record in TalkingDraft first.</div>';
    return;
  }

  el.innerHTML = scenes.map(scene => {
    const tracks = (scene.trackOrder || []).map(tid => {
      const t = scene.tracks[tid];
      if (!t) return '';
      if (t.name === 'ACTION') {
        return `<div class="spa tl"
          contenteditable="true"
          style="margin-bottom:6px;"
          onblur="TS._saveTrack('${scene.id}','${tid}','transcript',this.innerText)"
        >${t.transcript || ''}</div>`;
      }
      return `<div class="spc" style="margin-bottom:8px;">
        <div class="spn tl"
          contenteditable="true"
          onblur="TS._saveTrack('${scene.id}','${tid}','name',this.innerText)"
        >${t.name}</div>
        <div class="spl tl"
          contenteditable="true"
          onblur="TS._saveTrack('${scene.id}','${tid}','transcript',this.innerText)"
        >${t.transcript || ''}</div>
      </div>`;
    }).join('');

    return `
      <div id="tss-${scene.id}" style="margin-bottom:28px;">
        <div style="font-family:'Courier Prime',monospace;font-size:12px;color:var(--ghost);margin-bottom:14px;padding-bottom:6px;border-bottom:1px solid rgba(255,255,255,0.06);">
          ${scene.name}
        </div>
        ${tracks || '<div style="color:var(--ghost);font-size:11px;font-style:italic;">No transcript yet.</div>'}
      </div>`;
  }).join('');
}

// ── Right: character cast cards ───────────────────────────────────────────────

function _renderCastRows(story) {
  const el = document.getElementById('ts-cast-rows');
  if (!el) return;

  const activeScene = App.state.activeScene;

  // Build frequency map across all scenes for sorting
  const charFreq = {};
  for (const scene of (story.scenes || [])) {
    for (const tid of (scene.trackOrder || [])) {
      const t = scene.tracks?.[tid];
      if (!t?.name || t.name === 'ACTION') continue;
      charFreq[t.name] = (charFreq[t.name] || 0) + 1;
    }
  }

  // SCENE CAST: characters assigned to numpad buttons in active scene
  // + characters who actually spoke (appear in trackOrder) in the active scene
  const sceneCharSet = new Set();
  if (activeScene) {
    // From numpad assignments (scene.chars[1..9])
    for (let i = 1; i <= 9; i++) {
      const name = activeScene.chars?.[i];
      if (name && name !== 'NAME-' + i) sceneCharSet.add(name);
    }
    // Also from transcript tracks in this scene
    for (const tid of (activeScene.trackOrder || [])) {
      const t = activeScene.tracks?.[tid];
      if (t?.name && t.name !== 'ACTION') sceneCharSet.add(t.name);
    }
  }

  // ENSEMBLE: all unique named characters across all scenes, sorted by frequency
  const allCharsInStory = new Set();
  for (const scene of (story.scenes || [])) {
    for (const tid of (scene.trackOrder || [])) {
      const t = scene.tracks?.[tid];
      if (t?.name && t.name !== 'ACTION') allCharsInStory.add(t.name);
    }
    for (let i = 1; i <= 9; i++) {
      const name = scene.chars?.[i];
      if (name && name !== 'NAME-' + i) allCharsInStory.add(name);
    }
  }
  // Ensemble = characters NOT in the current scene cast
  const ensembleSet = new Set([...allCharsInStory].filter(n => !sceneCharSet.has(n)));

  // Sort each group by frequency descending
  const sortByFreq = (arr) => [...arr].sort((a, b) => (charFreq[b] || 0) - (charFreq[a] || 0));

  const sceneSorted    = sortByFreq(sceneCharSet);
  const ensembleSorted = sortByFreq(ensembleSet);
  const chars = [
    ...sceneSorted,
    ...(ensembleSorted.length ? ['__DIVIDER__'] : []),
    ...ensembleSorted
  ];

  if (!chars.length || (chars.length === 1 && chars[0] === '__DIVIDER__')) {
    el.innerHTML = '<div style="font-size:10px;color:var(--ghost);font-style:italic;padding:8px 0;">No characters found. Record scenes in TalkingDraft first.</div>';
    return;
  }

  // Build scene cast header if there are scene characters
  let html = '';
  if (sceneCharSet.size) {
    html += '<div style="font-family:\'DM Mono\',monospace;font-size:8px;color:var(--yellow);letter-spacing:0.07em;padding:4px 0 6px;opacity:0.7;">SCENE CAST</div>';
  }

  el.innerHTML = html + chars.map(name => {
    if (name === '__DIVIDER__') {
      return `<div style="padding:8px 0 4px;font-family:'DM Mono',monospace;font-size:8px;color:var(--ghost);letter-spacing:0.07em;border-top:1px solid rgba(255,255,255,0.07);margin-top:4px;">ENSEMBLE</div>`;
    }
    return `
    <div style="display:flex;align-items:center;gap:10px;padding:9px 10px;background:var(--card);border-radius:7px;margin-bottom:7px;border:1px solid rgba(255,255,255,0.07);position:relative;"
      onmouseenter="this.querySelector('.char-plus').style.opacity='1'"
      onmouseleave="this.querySelector('.char-plus').style.opacity='0'">
      <div style="position:relative;width:44px;height:44px;flex-shrink:0;">
        <div style="width:44px;height:44px;border-radius:5px;background:var(--surface);display:flex;align-items:center;justify-content:center;border:1px solid rgba(255,255,255,0.1);">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(107,122,153,0.5)" stroke-width="1.5"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>
        </div>
        <div class="char-plus" style="position:absolute;bottom:-1px;right:-1px;background:var(--yellow);border-radius:2px;width:14px;height:14px;display:flex;align-items:center;justify-content:center;cursor:pointer;opacity:0;transition:opacity .12s;" title="Upload headshot">
          <svg width="7" height="7" viewBox="0 0 24 24" fill="none" stroke="var(--void)" stroke-width="2.5"><path d="M12 5v14M5 12h14"/></svg>
        </div>
      </div>
      <div style="flex:1;min-width:0;">
        <div style="font-family:'Syne',sans-serif;font-size:11px;font-weight:700;margin-bottom:5px;">${name}</div>
        <div style="display:flex;align-items:center;gap:5px;background:var(--surface);border-radius:4px;padding:4px 6px;cursor:pointer;border:1px dashed rgba(255,255,255,0.12);"
          onmouseover="this.style.borderColor='rgba(186,232,232,0.3)'"
          onmouseout="this.style.borderColor='rgba(255,255,255,0.12)'">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="rgba(186,232,232,0.5)"><polygon points="5,3 19,12 5,21"/></svg>
          <div style="flex:1;height:2px;background:rgba(255,255,255,0.1);border-radius:1px;"></div>
          <span style="font-family:'DM Mono',monospace;font-size:8px;color:rgba(107,122,153,0.7);">no voice assigned</span>
        </div>
      </div>
    </div>`;
  }).join('');
}

// ── Save track edit ───────────────────────────────────────────────────────────

function _saveTrack(sceneId, tid, field, value) {
  const story = App.state.activeStory;
  if (!story) return;
  const scene = story.scenes.find(s => s.id === sceneId);
  if (!scene?.tracks?.[tid]) return;
  value = value?.trim() || '';
  if (field === 'name')       scene.tracks[tid].name = value ? value.toUpperCase() : 'NAME';
  if (field === 'transcript') scene.tracks[tid].transcript = value;
  scene.lastModified = Date.now();
  api.saveStory(story);
}

// ── Global TS actions ─────────────────────────────────────────────────────────

window.TS = {

  _saveTrack(sceneId, tid, field, value) {
    _saveTrack(sceneId, tid, field, value);
  },

  prevScene() {
    const story = App.state.activeStory;
    const scene = App.state.activeScene;
    if (!story || !scene) return;
    const idx = story.scenes.findIndex(s => s.id === scene.id);
    if (idx > 0) {
      App.state.activeScene = story.scenes[idx - 1];
      const el = document.getElementById('tss-' + App.state.activeScene.id);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      const slug = document.getElementById('ts-scene-slug');
      if (slug) slug.textContent = App.state.activeScene.name;
      _renderCastRows(story);
    }
  },

  nextScene() {
    const story = App.state.activeStory;
    const scene = App.state.activeScene;
    if (!story || !scene) return;
    const idx = story.scenes.findIndex(s => s.id === scene.id);
    if (idx < story.scenes.length - 1) {
      App.state.activeScene = story.scenes[idx + 1];
      const el = document.getElementById('tss-' + App.state.activeScene.id);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      const slug = document.getElementById('ts-scene-slug');
      if (slug) slug.textContent = App.state.activeScene.name;
      _renderCastRows(story);
    }
  },

  async exportTranscript() {
    const story = App.state.activeStory;
    if (!story?.scenes?.length) { App.showAlert('No transcript available.'); return; }
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
