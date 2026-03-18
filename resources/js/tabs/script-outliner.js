/**
 * TalkingStudio — tabs/script-outliner.js
 * Tab 1: Section blocks + scene cards, 2-col / 1-col layout
 */

import { api, utils, time2ms, sectionBeats, storyDuration } from '../lib/utils.js';

// ── Render shell ──────────────────────────────────────────────────────────────

export function renderScriptOutliner(container) {
  container.innerHTML = `
    <div id="so-inner" style="display:flex;flex:1;overflow:hidden;width:100%;"></div>
  `;

  document.addEventListener('ts:storyopen',  (e) => init(e.detail.story));
  document.addEventListener('ts:storymeta',  (e) => refreshMeta(e.detail.story));
  document.addEventListener('ts:layout',     (e) => { if (e.detail.tab === 'so') applyLayout(e.detail.layout); });
  document.addEventListener('ts:tabenter',   (e) => { if (e.detail.tab === 'so') applyLayout(App.state.layout); });
}

// ── Init ──────────────────────────────────────────────────────────────────────

function init(story) {
  const inner = document.getElementById('so-inner');
  if (!inner) return;

  inner.innerHTML = `
    <!-- LEFT COLUMN — width:40%;flex-shrink:0 — never grows/shrinks with content -->
    <div id="so-left" style="width:40%;flex-shrink:0;display:flex;flex-direction:column;overflow:hidden;background:var(--deep);border-right:1px solid rgba(255,255,255,0.05);">
      <div style="padding:8px 12px;border-bottom:1px solid rgba(255,255,255,0.05);display:flex;align-items:center;justify-content:space-between;flex-shrink:0;">
        <div>
          <div style="font-family:'DM Mono',monospace;font-size:9px;color:var(--ghost);" id="so-breadcrumb"></div>
          <div id="so-struct-label" style="font-family:'DM Mono',monospace;font-size:9px;color:var(--yellow);cursor:pointer;margin-top:1px;"
               onclick="App.openStructureModal(App.state.activeStory?.sectionPreset, SO.migrateStructure)">Structure &#9660;</div>
        </div>
        <button class="ib" onclick="SO.exportModal()" style="font-size:10px;">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          Export
        </button>
      </div>
      <div id="so-sections" style="flex:1;overflow-y:auto;padding:8px 0 16px;"></div>
    </div>

    <!-- RIGHT COLUMN — flex:1 takes remaining space -->
    <div id="so-right" style="flex:1;display:flex;flex-direction:column;overflow:hidden;background:var(--raise);">
      <div id="so-right-hdr" style="background:var(--card);border-bottom:1px solid rgba(255,255,255,0.06);padding:7px 14px;display:flex;align-items:center;gap:8px;flex-shrink:0;">
        <div style="flex:1;min-width:0;">
          <div style="font-family:'DM Mono',monospace;font-size:9px;color:var(--ghost);" id="so-right-bc"></div>
          <div id="so-active-section" style="font-family:'Syne',sans-serif;font-size:13px;font-weight:700;color:var(--dim);margin-top:1px;"></div>
        </div>
        <button class="ab" onclick="SO.addScene()">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Add Scene
        </button>
        <button class="ib" onclick="SO.exportModal()" style="font-size:10px;">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          Export
        </button>
      </div>
      <div id="so-scenes" style="flex:1;overflow-y:auto;padding:12px 14px 20px;"></div>
    </div>
  `;

  refresh(story);
}

// ── State ─────────────────────────────────────────────────────────────────────

let _activeSectionIdx = 0;
let _dragSrcIdx = null;

// ── Refresh ───────────────────────────────────────────────────────────────────

function refresh(story) {
  if (!story) return;
  const pages = Math.round(story.minutes / 2);
  refreshBreadcrumb(story);
  refreshSections(story, pages);
  refreshScenes(story, _activeSectionIdx);
  refreshProgress(story);

  const lbl = document.getElementById('so-struct-label');
  if (lbl) lbl.textContent = (story.sectionPreset || 'Structure') + ' ▾';
}

function refreshBreadcrumb(story) {
  const el = document.getElementById('so-breadcrumb');
  if (el) el.textContent = story.name + ' › ScriptOutliner';
}

function refreshMeta(story) {
  if (App.state.activeStory?.id === story?.id) refresh(story);
}

function refreshProgress(story) {
  const sections = story.sections || [];
  const beatFilled = sections.filter(s => s.value?.trim()).length;
  const beatPct = sections.length ? Math.round(beatFilled / sections.length * 100) : 0;

  const outlineFilled = sections.filter((s, i) => (story.scenes || []).some(sc => sc.sectionIdx === i)).length;
  const outlinePct = sections.length ? Math.round(outlineFilled / sections.length * 100) : 0;

  const pb = document.getElementById('so-pb-beat');
  const po = document.getElementById('so-pb-outline');
  if (pb) pb.style.width = beatPct + '%';
  if (po) po.style.width = outlinePct + '%';
}

function refreshSections(story, pages) {
  const container = document.getElementById('so-sections');
  if (!container) return;
  const preset = api.sectionPresets[story.sectionPreset];
  if (!preset) return;

  let lastAct = null;
  let html = '';

  preset.sections.forEach((sec, idx) => {
    const section    = story.sections[idx] || { value: '' };
    const beats      = sectionBeats(story.sectionPreset, idx, pages);
    const isActive   = idx === _activeSectionIdx;
    const sceneCount = (story.scenes || []).filter(s => s.sectionIdx === idx).length;

    if (sec.act && sec.act !== lastAct) {
      lastAct = sec.act;
      html += `<div style="padding:4px 10px 2px;font-family:'DM Mono',monospace;font-size:8px;letter-spacing:0.1em;text-transform:uppercase;color:rgba(255,255,255,0.18);">${sec.act}</div>`;
    }

    html += `
      <div class="sb${isActive ? ' sa' : ''}" id="so-sec-${idx}"
           ondragover="event.preventDefault()" ondrop="SO.dropOnSection(event,${idx})">
        <div class="sh" onclick="SO.selectSection(${idx})">
          <div style="display:flex;align-items:center;gap:6px;flex:1;min-width:0;">
            <svg class="chev${isActive ? ' op' : ''}" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M19 9l-7 7-7-7"/></svg>
            <span style="font-family:'DM Mono',monospace;font-size:8px;color:rgba(255,255,255,0.28);white-space:nowrap;">${sec.act || '—'}</span>
            <span class="sn${isActive ? ' ac' : ''}" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${sec.name}</span>
          </div>
          <div style="display:flex;align-items:center;gap:6px;flex-shrink:0;">
            ${sceneCount ? `<span style="font-size:9px;color:var(--ghost);font-family:'DM Mono',monospace;">${sceneCount}sc</span>` : ''}
            <span class="pg">${beats}</span>
          </div>
        </div>
        <div class="sbody" id="so-sbody-${idx}" style="display:${isActive ? 'block' : 'none'};overflow:hidden;">
          <textarea class="gta" rows="2" placeholder="${sec.desc || 'Write your beat here…'}"
                    oninput="SO.beatInput(this,${idx})"
                    onchange="SO.saveBeat(${idx},this.value)"
                    style="width:100%;box-sizing:border-box;"
          >${section.value || ''}</textarea>
          <div style="font-size:10px;color:var(--ghost);font-style:italic;margin-top:4px;white-space:normal;word-break:break-word;">${sec.desc || ''}</div>
        </div>
      </div>
    `;
  });

  container.innerHTML = html;
}

function refreshScenes(story, sectionIdx) {
  const container = document.getElementById('so-scenes');
  const hdrEl     = document.getElementById('so-active-section');
  const bcEl      = document.getElementById('so-right-bc');
  if (!container) return;

  const preset  = api.sectionPresets[story.sectionPreset];
  const sec     = preset?.sections?.[sectionIdx];
  const scenes  = (story.scenes || []).filter(s => s.sectionIdx === sectionIdx);
  const pages   = Math.round(story.minutes / 2);
  const beats   = sectionBeats(story.sectionPreset, sectionIdx, pages);

  if (hdrEl) hdrEl.textContent = sec ? `${sec.name} · ${beats}` : '';
  if (bcEl)  bcEl.textContent  = story.name + (sec ? ` › ${sec.act || ''}` : '');

  if (!scenes.length) {
    container.innerHTML = `
      <div style="color:var(--ghost);font-size:12px;padding:24px 4px;text-align:center;">
        No scenes in this section yet.<br/>
        <button class="ab" style="margin-top:12px;" onclick="SO.addScene()">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Add First Scene
        </button>
      </div>`;
    return;
  }

  container.innerHTML = scenes.map((scene, localIdx) => {
    const absIdx = (story.scenes || []).findIndex(s => s.id === scene.id);
    const dur    = scene.duration || 0;
    const pp     = dur ? (Math.round(dur / 2 / 60 * 10) / 10).toFixed(1) + ' pp' : '';

    return `
      <div class="sc" id="sc-${scene.id}" draggable="true"
           ondragstart="SO.dragStart(event,${absIdx})"
           ondragover="event.preventDefault()"
           ondrop="SO.dropOnScene(event,${absIdx})">
        <div class="sc-body">
          <input class="gi" style="font-family:'DM Mono',monospace;font-size:12px;font-weight:600;margin-bottom:4px;"
                 value="${scene.name}"
                 onchange="SO.editSlug(${absIdx},this.value)"
                 onfocus="this.select()"/>
          <textarea class="gta" rows="2" placeholder="Scene description (max 100 words)…"
                    onchange="SO.editDesc(${absIdx},this.value)"
          >${scene.desc || ''}</textarea>
          ${pp ? `<div style="font-family:'DM Mono',monospace;font-size:9px;color:var(--dim);margin-top:4px;">${pp} ≈ dictated</div>` : ''}
        </div>
        <div class="sc-acts">
          <button class="tyd" onclick="SO.talkDraft(${absIdx})" title="Open in TalkingDraft">
            <svg width="9" height="11" viewBox="0 0 14 19" fill="currentColor">
              <path fill-rule="evenodd" clip-rule="evenodd" d="M7 12C8.7 12 10 10.7 10 9V3C10 1.3 8.7 0 7 0C5.3 0 4 1.3 4 3V9C4 10.7 5.3 12 7 12ZM12.3 9C12.3 12 9.8 14.1 7 14.1C4.2 14.1 1.7 12 1.7 9H0C0 12.4 2.7 15.2 6 15.7V19H8V15.7C11.3 15.2 14 12.4 14 9H12.3Z"/>
            </svg>
            Talk Your Draft
          </button>
          <svg class="dh" title="Drag to reorder" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 9l4-4 4 4m0 6l-4 4-4-4"/></svg>
          <svg class="tb" onclick="SO.deleteScene(${absIdx})" title="Delete scene" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
        </div>
      </div>
    `;
  }).join('');
}

// ── Layout ────────────────────────────────────────────────────────────────────

function applyLayout(layout) {
  const left  = document.getElementById('so-left');
  const right = document.getElementById('so-right');
  if (!left || !right) return;

  // Remove any existing 1-col overlay
  const existing = document.getElementById('so-onecol');
  if (existing) existing.remove();

  if (layout === '2col') {
    left.style.display  = 'flex';
    right.style.display = 'flex';
  } else {
    left.style.display  = 'none';
    right.style.display = 'none';
    renderOneCol();
  }
}

function renderOneCol() {
  const story = App.state.activeStory;
  if (!story) return;

  const inner = document.getElementById('so-inner');
  if (!inner) return;

  const preset = api.sectionPresets[story.sectionPreset];
  if (!preset) return;
  const pages = Math.round(story.minutes / 2);

  const sectionsHtml = preset.sections.map((sec, idx) => {
    const section    = story.sections[idx] || { value: '' };
    const beats      = sectionBeats(story.sectionPreset, idx, pages);
    const scenes     = (story.scenes || []).filter(s => s.sectionIdx === idx);
    const sceneCount = scenes.length;
    const hasBeat    = !!section.value?.trim();

    const scenesHtml = scenes.map(scene => {
      const absIdx = (story.scenes || []).findIndex(s => s.id === scene.id);
      const dur    = scene.duration || 0;
      const pp     = dur ? (Math.round(dur / 2 / 60 * 10) / 10).toFixed(1) + ' pp' : '';
      return `
        <div class="sc" id="sc1-${scene.id}" style="margin-bottom:5px;">
          <div class="sc-body">
            <input class="gi" style="font-family:'DM Mono',monospace;font-size:11px;font-weight:600;margin-bottom:3px;"
                   value="${scene.name}"
                   onchange="SO.editSlug(${absIdx},this.value)" onfocus="this.select()"/>
            <textarea class="gta" rows="2" placeholder="Scene description…"
                      onchange="SO.editDesc(${absIdx},this.value)">${scene.desc || ''}</textarea>
            ${pp ? `<div style="font-family:'DM Mono',monospace;font-size:9px;color:var(--dim);margin-top:3px;">${pp} dictated</div>` : ''}
          </div>
          <div class="sc-acts">
            <button class="tyd" onclick="SO.talkDraft(${absIdx})">
              <svg width="9" height="11" viewBox="0 0 14 19" fill="currentColor"><path fill-rule="evenodd" clip-rule="evenodd" d="M7 12C8.7 12 10 10.7 10 9V3C10 1.3 8.7 0 7 0C5.3 0 4 1.3 4 3V9C4 10.7 5.3 12 7 12ZM12.3 9C12.3 12 9.8 14.1 7 14.1C4.2 14.1 1.7 12 1.7 9H0C0 12.4 2.7 15.2 6 15.7V19H8V15.7C11.3 15.2 14 12.4 14 9H12.3Z"/></svg>
              Talk Your Draft
            </button>
            <svg class="dh" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 9l4-4 4 4m0 6l-4 4-4-4"/></svg>
            <svg class="tb" onclick="SO.deleteScene(${absIdx})" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
          </div>
        </div>`;
    }).join('');

    return `
      <div style="margin-bottom:8px;">
        <div style="background:var(--surface);border-radius:6px 6px ${sceneCount ? '0 0' : '6px 6px'};
          border:1px solid ${hasBeat ? 'rgba(186,232,232,0.25)' : 'rgba(255,255,255,0.07)'};
          padding:7px 12px;display:flex;align-items:center;justify-content:space-between;cursor:pointer;"
             onclick="SO._toggleSec1col(this)">
          <div style="display:flex;align-items:center;gap:8px;">
            <svg class="sec1-chev" style="transition:transform .15s;flex-shrink:0;" width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" stroke-width="2.5"><path d="M19 9l-7 7-7-7"/></svg>
            <span style="font-family:'DM Mono',monospace;font-size:8px;color:var(--ghost);">${sec.act || ''}</span>
            <span style="font-size:12px;font-weight:600;color:${hasBeat ? 'var(--dim)' : 'var(--white)'};">${sec.name}</span>
          </div>
          <div style="display:flex;align-items:center;gap:8px;">
            <span class="pg">${beats}</span>
            <button class="ab" style="font-size:8px;padding:2px 7px;" onclick="event.stopPropagation();SO.addSceneToSection(${idx})">
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 5v14M5 12h14"/></svg> Add Scene
            </button>
          </div>
        </div>
        <div style="border:1px solid rgba(255,255,255,0.06);border-top:none;border-radius:0 0 6px 6px;padding:8px 12px 10px;">
          <textarea class="gta" rows="2" style="margin-bottom:${sceneCount ? '8px' : '0'};"
                    placeholder="${sec.desc || 'Write your beat here…'}"
                    onchange="SO.saveBeat(${idx},this.value)">${section.value || ''}</textarea>
          ${sec.desc ? `<div style="font-size:10px;font-style:italic;color:var(--ghost);margin-bottom:${sceneCount ? '8px' : '0'};">${sec.desc}</div>` : ''}
          ${scenesHtml}
        </div>
      </div>`;
  }).join('');

  const oneCol = document.createElement('div');
  oneCol.id = 'so-onecol';
  oneCol.style.cssText = 'flex:1;display:flex;flex-direction:column;overflow:hidden;';
  oneCol.innerHTML = `
    <div style="padding:8px 14px;border-bottom:1px solid rgba(255,255,255,0.05);background:var(--card);display:flex;align-items:center;justify-content:space-between;flex-shrink:0;">
      <div>
        <div style="font-family:'DM Mono',monospace;font-size:9px;color:var(--ghost);">${story.name} › ScriptOutliner</div>
        <div style="font-family:'DM Mono',monospace;font-size:9px;color:var(--yellow);cursor:pointer;margin-top:1px;"
             onclick="App.openStructureModal(App.state.activeStory?.sectionPreset, SO.migrateStructure)">${story.sectionPreset} &#9660;</div>
      </div>
      <div style="display:flex;gap:7px;align-items:center;">
        <button class="ib" onclick="SO.exportModal()" style="font-size:10px;">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          Export
        </button>
      </div>
    </div>
    <div style="flex:1;overflow-y:auto;padding:10px 16px 28px;max-width:820px;margin:0 auto;width:100%;">${sectionsHtml}</div>
  `;

  inner.appendChild(oneCol);
}

// ── SO actions (global) ───────────────────────────────────────────────────────

window.SO = {

  selectSection(idx) {
    const story = App.state.activeStory;
    if (!story) return;

    const body   = document.getElementById('so-sbody-' + idx);
    const chev   = document.querySelector('#so-sec-' + idx + ' .chev');
    const secEl  = document.getElementById('so-sec-' + idx);
    const sn     = secEl?.querySelector('.sn');
    const isOpen = body && body.style.display !== 'none';

    // Collapse previous section if switching to a new one
    if (idx !== _activeSectionIdx) {
      const prevBody  = document.getElementById('so-sbody-' + _activeSectionIdx);
      const prevChev  = document.querySelector('#so-sec-' + _activeSectionIdx + ' .chev');
      const prevSecEl = document.getElementById('so-sec-' + _activeSectionIdx);
      const prevSn    = prevSecEl?.querySelector('.sn');
      if (prevBody)  prevBody.style.display = 'none';
      if (prevChev)  prevChev.classList.remove('op');
      if (prevSecEl) prevSecEl.classList.remove('sa');
      if (prevSn)    prevSn.classList.remove('ac');
    }

    if (isOpen && idx === _activeSectionIdx) {
      // Toggle: collapse current
      body.style.display = 'none';
      if (chev)  chev.classList.remove('op');
      if (secEl) secEl.classList.remove('sa');
      if (sn)    sn.classList.remove('ac');
      return;
    }

    // Expand this section
    _activeSectionIdx = idx;
    if (body)  body.style.display = 'block';
    if (chev)  chev.classList.add('op');
    if (secEl) secEl.classList.add('sa');
    if (sn)    sn.classList.add('ac');
    refreshScenes(story, idx);
  },

  // Toggle open/close for 1-col section rows
  _toggleSec1col(headerEl) {
    const body = headerEl.nextElementSibling;
    const chev = headerEl.querySelector('.sec1-chev');
    if (!body) return;
    const isOpen = body.style.display !== 'none';
    body.style.display = isOpen ? 'none' : 'block';
    if (chev) chev.style.transform = isOpen ? '' : 'rotate(180deg)';
  },

  beatInput(el, idx) {
    // height capped by CSS max-height — no JS resize
  },

  saveBeat(idx, value) {
    const story = App.state.activeStory;
    if (!story) return;
    story.sections[idx].value = value;
    api.saveStory(story);
    refreshProgress(story);
  },

  addScene() {
    const story = App.state.activeStory;
    if (!story || !App.checkStuff()) return;
    api.addScene(story, _activeSectionIdx, null, []);
    api.saveStory(story);
    refreshScenes(story, _activeSectionIdx);
    refreshProgress(story);
  },

  addSceneToSection(sectionIdx) {
    const story = App.state.activeStory;
    if (!story || !App.checkStuff()) return;
    api.addScene(story, sectionIdx, null, []);
    api.saveStory(story);
    renderOneCol();
    refreshProgress(story);
  },

  editSlug(absIdx, value) {
    const story = App.state.activeStory;
    if (!story) return;
    value = value.toString();
    if (!value) { App.showAlert('Please enter a scene location'); return; }
    if (!value.match(/^(INT|EXT|I\/E)(\.| |-)/i)) value = 'EXT. ' + value;
    story.scenes[absIdx].name = value.replace(/\n/g, ' ').trim().toUpperCase();
    story.scenes[absIdx].lastModified = Date.now();
    api.saveStory(story);
  },

  editDesc(absIdx, value) {
    const story = App.state.activeStory;
    if (!story) return;
    if (value.split(/\s/).length > 100) App.showAlert('Scene notes should be less than 100 words.');
    story.scenes[absIdx].desc = value;
    story.scenes[absIdx].lastModified = Date.now();
    api.saveStory(story);
  },

  deleteScene(absIdx) {
    const story = App.state.activeStory;
    if (!story || !App.checkStuff()) return;
    const scene = story.scenes[absIdx];
    if (!scene) return;
    App.showConfirmModal('Delete Scene?',
      `Delete "${scene.name}"? This cannot be undone.`,
      () => {
        story.scenes.splice(absIdx, 1);
        api.saveStory(story);
        refreshScenes(story, _activeSectionIdx);
        refreshProgress(story);
      });
  },

  talkDraft(absIdx) {
    const story = App.state.activeStory;
    if (!story) return;
    App.state.activeScene = story.scenes[absIdx];
    App.go('td');
    document.dispatchEvent(new CustomEvent('ts:openscene', { detail: { scene: story.scenes[absIdx] } }));
  },

  dragStart(event, absIdx) {
    _dragSrcIdx = absIdx;
    event.dataTransfer.setData('text/plain', absIdx);
  },

  dropOnScene(event, targetAbsIdx) {
    event.stopPropagation();
    const story = App.state.activeStory;
    if (!story || _dragSrcIdx === null) return;
    if (_dragSrcIdx === targetAbsIdx) return;

    const src    = story.scenes[_dragSrcIdx];
    const target = story.scenes[targetAbsIdx];
    src.sectionIdx = target.sectionIdx;
    src.lastModified = Date.now();
    story.scenes.splice(targetAbsIdx, 0, story.scenes.splice(_dragSrcIdx, 1)[0]);
    _dragSrcIdx = null;
    api.saveStory(story);
    refreshScenes(story, _activeSectionIdx);
  },

  dropOnSection(event, sectionIdx) {
    const story = App.state.activeStory;
    if (!story || _dragSrcIdx === null) return;
    story.scenes[_dragSrcIdx].sectionIdx = sectionIdx;
    story.scenes[_dragSrcIdx].lastModified = Date.now();
    _dragSrcIdx = null;
    api.saveStory(story);
    refresh(story);
  },

  migrateStructure(val) {
    const story = App.state.activeStory;
    if (!story || !App.checkStuff()) return;
    const hasContent = story.sections.some(s => s.value) || story.scenes.length;
    if (hasContent) {
      App.showConfirmModal('Switch Structure?',
        'Switching structure will reorganise your outline. Consider making a backup copy first.',
        () => { doMigrate(story, val); }, 'Switch');
    } else {
      doMigrate(story, val);
    }
  },

  exportModal() {
    App.showAlert('Export: Beatsheet / Step Outline — coming soon.', 2500, false, 'notice');
  },
};


function doMigrate(story, val) {
  try {
    api.migratePreset(story, val);
    story.sectionPreset = val;
    api.saveStory(story);
    _activeSectionIdx = 0;
    refresh(story);
  } catch(err) { App.showAlert(err); }
}
