/**
 * TalkingStudio — tabs/chemistry.js
 * Tab 4: Enneagram ensemble mapping (stub)
 * Inline SVG — no external file dependency.
 */

export function renderChemistry(container) {
  container.style.flexDirection = 'column';
  container.style.alignItems    = 'center';
  container.style.justifyContent = 'center';
  container.style.overflow      = 'hidden';

  container.innerHTML = `
    <div style="display:flex;flex-direction:column;align-items:center;gap:18px;padding:32px 20px;">

      <div style="font-family:'Syne',sans-serif;font-size:18px;font-weight:800;letter-spacing:0.02em;">
        Ensemble Character Conflict Mapping
      </div>

      <div style="font-size:11px;color:var(--ghost);font-family:'DM Mono',monospace;letter-spacing:0.06em;text-transform:uppercase;">
        Coming Soon
      </div>

      <!-- Enneagram SVG — inline, no external dependency -->
      <svg viewBox="-80 0 960 800" xmlns="http://www.w3.org/2000/svg" style="width:560px;height:420px;">

        <!-- Outer circle -->
        <circle cx="400" cy="400" r="310" fill="none" stroke="#BAE8E8" stroke-width="5"/>

        <!-- Triangle: 3–6–9 -->
        <polygon points="400,90 131.5,555 668.5,555"
                 fill="none" stroke="rgba(186,232,232,0.25)" stroke-width="3"/>

        <!-- Hexad: 1→4→2→8→5→7→1 -->
        <polygon points="599.3,162.5 506,691.3 705.3,346.2 200.7,162.5 294,691.3 94.7,346.2"
                 fill="none" stroke="rgba(186,232,232,0.25)" stroke-width="3"/>

        <!-- GUT triad nodes (8, 9, 1) — yellow -->
        <circle cx="200.7" cy="162.5" r="22" fill="#FFD800"/>  <!-- 8 -->
        <circle cx="400"   cy="90"    r="22" fill="#FFD800"/>  <!-- 9 -->
        <circle cx="599.3" cy="162.5" r="22" fill="#FFD800"/>  <!-- 1 -->

        <!-- HEART triad nodes (2, 3, 4) — teal -->
        <circle cx="705.3" cy="346.2" r="22" fill="#BAE8E8"/>  <!-- 2 -->
        <circle cx="668.5" cy="555"   r="22" fill="#BAE8E8"/>  <!-- 3 -->
        <circle cx="506"   cy="691.3" r="22" fill="#BAE8E8"/>  <!-- 4 -->

        <!-- HEAD triad nodes (5, 6, 7) — ghost -->
        <circle cx="294"   cy="691.3" r="22" fill="#DADFF2"/>  <!-- 5 -->
        <circle cx="131.5" cy="555"   r="22" fill="#DADFF2"/>  <!-- 6 -->
        <circle cx="94.7"  cy="346.2" r="22" fill="#DADFF2"/>  <!-- 7 -->

        <!-- Labels -->
        <text class="en-lbl" x="400"   y="60"    text-anchor="middle">9</text>
        <text class="en-lbl" x="630"   y="160"   text-anchor="start" >1</text>
        <text class="en-lbl" x="730"   y="355"   text-anchor="start" >2</text>
        <text class="en-lbl" x="695"   y="575"   text-anchor="start" >3</text>
        <text class="en-lbl" x="520"   y="730"   text-anchor="middle">4</text>
        <text class="en-lbl" x="278"   y="730"   text-anchor="middle">5</text>
        <text class="en-lbl" x="98"    y="575"   text-anchor="end"   >6</text>
        <text class="en-lbl" x="58"    y="355"   text-anchor="end"   >7</text>
        <text class="en-lbl" x="168"   y="160"   text-anchor="end"   >8</text>

      </svg>

    </div>
  `;
}
