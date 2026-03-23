/**
 * TalkingStudio — tabs/dashboard.js
 * Tab 0: Story grid + new story form
 */

import { time2ms, storyDuration } from '../lib/utils.js';

// ── Render ────────────────────────────────────────────────────────────────────

export function renderDashboard(container) {
  container.style.flexDirection = 'column';
  container.style.overflow = 'hidden';
  container.innerHTML = `
    <div id="dash-body" style="flex:1;overflow-y:auto;padding:20px 20px 40px;">

      <!-- New Story Form -->
      <div style="margin-bottom:28px;">
        <div style="font-family:'Syne',sans-serif;font-size:22px;font-weight:800;margin-bottom:12px;">
          Start a New Story
        </div>
        <div style="background:var(--card);border:1px solid rgba(255,255,255,0.08);border-radius:10px;padding:16px;">
          <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end;">

            <!-- Story name -->
            <div style="flex:2;min-width:180px;">
              <div style="font-size:10px;color:var(--ghost);margin-bottom:4px;font-family:'DM Mono',monospace;text-transform:uppercase;letter-spacing:0.06em;">Story Name</div>
              <input id="ns-name" class="fi" style="width:100%;" placeholder="e.g. The Roman Affair"
                     onkeyup="if(event.key==='Enter')Dash.create()"/>
            </div>

            <!-- Structure picker -->
            <div style="flex:1;min-width:160px;">
              <div style="font-size:10px;color:var(--ghost);margin-bottom:4px;font-family:'DM Mono',monospace;text-transform:uppercase;letter-spacing:0.06em;">Story Structure</div>
              <button id="ns-struct-btn" class="fi" style="width:100%;text-align:left;cursor:pointer;color:var(--ghost);"
                      onclick="App.openStructureModal(null, Dash.onStructurePicked)">
                Choose structure…
              </button>
              <div id="ns-struct-err" style="color:#f87171;font-size:10px;font-style:italic;margin-top:3px;display:none;">
                Please choose a structure
              </div>
            </div>

            <!-- Pages -->
            <div style="width:90px;">
              <div style="font-size:10px;color:var(--ghost);margin-bottom:4px;font-family:'DM Mono',monospace;text-transform:uppercase;letter-spacing:0.06em;">Pages</div>
              <div style="display:flex;align-items:center;gap:5px;">
                <input id="ns-pages" class="fi" type="number" value="90" min="1" max="999" style="width:55px;"/>
                <span style="color:var(--ghost);font-size:11px;">pp</span>
              </div>
            </div>

            <!-- Create button -->
            <button class="ab" style="height:34px;" onclick="Dash.create()">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
              Create Story
            </button>

          </div>
        </div>
      </div>

      <!-- Story List header -->
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
        <div style="font-family:'Syne',sans-serif;font-size:22px;font-weight:800;">
          Stories <span id="dash-count" style="font-size:14px;color:var(--ghost);font-family:'DM Mono',monospace;"></span>
        </div>
      </div>

      <!-- Progress bars row -->
      <div id="dash-progress" style="display:grid;grid-template-columns:repeat(5,1fr);gap:6px;margin-bottom:18px;background:var(--card);border:1px solid rgba(255,255,255,0.06);border-radius:8px;padding:10px 14px;display:none;">
        <!-- filled by JS when a story is active -->
      </div>

      <!-- Story cards grid -->
      <div id="dash-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:12px;"></div>

    </div>
  `;

  // Listen for story list updates
  document.addEventListener('ts:stories', (e) => renderCards(e.detail.list));

  // Reload stories whenever dashboard tab is entered
  document.addEventListener('ts:tabenter', (e) => {
    if (e.detail.tab === 'dash') App.loadStories();
  });
}

// ── State ─────────────────────────────────────────────────────────────────────

let _pickedStructure = null;

// ── Cards ─────────────────────────────────────────────────────────────────────

const PROGRESS_TOOLTIPS = {
  'Beatsheet': 'Sections with beat notes written',
  'Outline':   'Sections that have at least one scene',
  'Script':    'Scenes with dictated audio recorded',
};

function progressRow(label, pct) {
  const tip = PROGRESS_TOOLTIPS[label] || label;
  return `<div style="display:flex;align-items:center;gap:8px;" title="${tip}">
    <span style="font-family:'DM Mono',monospace;font-size:8px;letter-spacing:0.07em;text-transform:uppercase;color:var(--ghost);width:60px;flex-shrink:0;cursor:default;" title="${tip}">${label}</span>
    <div class="pt" title="${tip}"><div class="pf" style="width:${pct}%"></div></div>
    <span style="font-family:'DM Mono',monospace;font-size:8px;color:var(--ghost);width:24px;text-align:right;">${pct}%</span>
  </div>`;
}

function renderCards(list) {
  const grid  = document.getElementById('dash-grid');
  const count = document.getElementById('dash-count');
  if (!grid) return;

  count.textContent = list.length ? `(${list.length})` : '';

  if (!list.length) {
    grid.innerHTML = `<div style="color:var(--ghost);font-size:12px;padding:20px 0;">Create your first story above.</div>`;
    return;
  }

  grid.innerHTML = list.map(story => {
    const dur     = storyDuration(story);
    const pages   = Math.round(story.minutes / 2);
    const pp      = Math.round(dur / 2 / 60);
    const sections = story.sections || [];
    const beatPct    = sections.length ? Math.round(sections.filter(s => s.value?.trim()).length / sections.length * 100) : 0;
    const outlinePct = sections.length ? Math.round(sections.filter((s, i) => (story.scenes || []).some(sc => sc.sectionIdx === i)).length / sections.length * 100) : 0;
    const scriptPct  = (story.scenes || []).length ? Math.round((story.scenes || []).filter(s => (s.trackOrder || []).length > 0).length / story.scenes.length * 100) : 0;
    return `
      <div style="position:relative;">
        <!-- Hamburger -->
        <div style="position:absolute;top:8px;right:8px;z-index:10;">
          <button class="ib" style="padding:3px 5px;" onclick="Dash.menuToggle(event,'${story.id}')">
            <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
              <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z"/>
            </svg>
          </button>
          <div id="menu-${story.id}" class="story-menu" onclick="event.stopPropagation()">
            <div class="ib" style="border:none;border-radius:0;justify-content:flex-start;" onclick="Dash.menuClose('${story.id}');Dash.rename('${story.id}')">Rename</div>
            <div class="ib" style="border:none;border-radius:0;justify-content:flex-start;" onclick="Dash.menuClose('${story.id}');Dash.copy('${story.id}')">Copy Story</div>
            <div class="ib" style="border:none;border-radius:0;justify-content:flex-start;" onclick="Dash.menuClose('${story.id}');Dash.exportStory('${story.id}')">Export</div>
            <div class="ib" style="border:none;border-radius:0;justify-content:flex-start;color:#f87171;" onclick="Dash.menuClose('${story.id}');Dash.del('${story.id}')">Delete</div>
          </div>
        </div>

        <!-- Card -->
        <div class="stc" onclick="App.openStory('${story.id}')">
          <div style="font-family:'Syne',sans-serif;font-size:15px;font-weight:700;margin-bottom:6px;padding-right:28px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
            ${story.name}
          </div>
          <div style="font-size:11px;color:var(--ghost);margin-bottom:10px;">${story.sectionPreset} &middot; ${pages} pp</div>
          <div style="display:flex;flex-direction:column;gap:5px;margin-bottom:11px;">
            ${progressRow('Beatsheet', beatPct)}
            ${progressRow('Outline',   outlinePct)}
            ${progressRow('Script',    scriptPct)}
          </div>
          <div style="padding-top:8px;border-top:1px solid rgba(255,255,255,0.05);display:flex;justify-content:flex-end;">
            <span style="font-family:'DM Mono',monospace;font-size:9px;color:var(--dim);" title="Total dictated audio across all scenes">${pp} of ${pages} pp dictated</span>
          </div>
        </div>
      </div>
    `;
  }).join('');

  // Close menus when clicking outside.
  // NOTE: We use setTimeout to defer the listener so the same click that opened
  // the menu doesn't immediately re-close it. { once:true } consumed the next
  // click globally and broke subsequent hamburger opens — removed.
  setTimeout(() => {
    function _closeAllMenus(e) {
      const anyMenuOpen = !!document.querySelector('.story-menu.open');
      if (!anyMenuOpen) { document.removeEventListener('click', _closeAllMenus); return; }
      document.querySelectorAll('.story-menu.open').forEach(m => m.classList.remove('open'));
    }
    document.removeEventListener('click', _closeAllMenus); // prevent stacking on re-render
    document.addEventListener('click', _closeAllMenus);
  }, 0);
}

// ── Dash actions (global) ─────────────────────────────────────────────────────

window.Dash = {

  onStructurePicked(id) {
    _pickedStructure = id;
    const btn = document.getElementById('ns-struct-btn');
    if (btn) { btn.textContent = id; btn.style.color = 'var(--white)'; }
    document.getElementById('ns-struct-err').style.display = 'none';
  },

  create() {
    const name  = (document.getElementById('ns-name')?.value || '').trim();
    const pages = parseInt(document.getElementById('ns-pages')?.value || '90', 10);

    if (!name) { App.showAlert('Please enter a story name.'); return; }
    if (!_pickedStructure) {
      document.getElementById('ns-struct-err').style.display = '';
      App.showAlert('Please choose a story structure.');
      return;
    }

    App.createStory(name, _pickedStructure, pages);
  },

  menuToggle(event, storyId) {
    event.stopPropagation();
    const menu = document.getElementById('menu-' + storyId);
    if (!menu) return;
    // Close all others
    document.querySelectorAll('.story-menu').forEach(m => { if (m !== menu) m.classList.remove('open'); });
    menu.classList.toggle('open');
  },

  menuClose(storyId) {
    const m = document.getElementById('menu-' + storyId);
    if (m) m.classList.remove('open');
  },

  _story(storyId) {
    return App.state.storyList.find(s => s.id === storyId);
  },

  rename(storyId) {
    const s = this._story(storyId);
    if (s) App.renameStory(s);
  },

  copy(storyId) {
    const s = this._story(storyId);
    if (s) App.copyStory(s);
  },

  del(storyId) {
    const s = this._story(storyId);
    if (s) App.deleteStory(s);
  },

  exportStory(storyId) {
    // Load the story first so export modal has full data
    const s = this._story(storyId);
    if (!s) { App.showAlert('Story not found.'); return; }
    // If it's already the active story, just open the modal
    if (App.state.activeStory?.id === s.id) {
      App.openExportModal('td');
    } else {
      // Temporarily load it into state for export, then open modal
      App.api.getStory(s.id).then(story => {
        App.state.activeStory = story;
        App.openExportModal('td');
      }).catch(() => App.showAlert('Could not load story for export.'));
    }
  },
};
