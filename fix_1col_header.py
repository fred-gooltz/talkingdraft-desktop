#!/usr/bin/env python3
"""
Replaces the 1-col overlay header in talking-draft.js with the full
story nav + structure chooser + pages input version.
"""

import re

filepath = '/Users/FredGooltz/Documents/FRED-DEV/TALKINGDRAFT/desktop/TalkingDraft-Desktop/resources/js/tabs/talking-draft.js'

with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# The old header block — match from overlay.innerHTML = to the closing div
OLD = (
    "overlay.innerHTML =\n"
    "    '<div style=\"padding:8px 12px;border-bottom:1px solid rgba(255,255,255,0.06);background:var(--card);flex-shrink:0;display:flex;align-items:center;justify-content:space-between;\">'"
)

if OLD not in content:
    print("ERROR: Could not find old header block. Searching for nearby text...")
    # Try to find the overlay.innerHTML line
    idx = content.find("overlay.innerHTML =")
    if idx >= 0:
        print(f"Found 'overlay.innerHTML =' at char {idx}")
        print(repr(content[idx:idx+200]))
    else:
        print("'overlay.innerHTML =' not found at all!")
else:
    # Find the full old block end
    start_idx = content.find(OLD)
    # Find the closing line
    end_marker = "'<div style=\"flex:1;overflow-y:auto;padding:8px 12px 24px;\">' + sectionsHtml + '</div>';"
    end_idx = content.find(end_marker, start_idx)
    if end_idx < 0:
        print("ERROR: Could not find end marker")
    else:
        end_idx += len(end_marker)
        old_block = content[start_idx:end_idx]
        print(f"Found block ({len(old_block)} chars), replacing...")

        NEW = (
            "// 1-col header matches 2-col: story nav + structure chooser + pages input\n"
            "  overlay.innerHTML =\n"
            "    '<div style=\"padding:8px 12px;border-bottom:1px solid rgba(255,255,255,0.05);background:var(--card);flex-shrink:0;\">' +\n"
            "      '<div style=\"display:flex;align-items:center;gap:8px;margin-bottom:6px;\">' +\n"
            "        '<div style=\"font-size:9px;color:var(--ghost);font-family:\\'DM Mono\\',monospace;letter-spacing:0.06em;flex-shrink:0;\">ScriptOutliner</div>' +\n"
            "        '<div style=\"display:flex;align-items:center;gap:5px;cursor:pointer;flex:1;min-width:0;\" onclick=\"TD._toggleStoryNav()\">' +\n"
            "          '<svg width=\"14\" height=\"14\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"var(--yellow)\" stroke-width=\"1.5\"><path stroke-linecap=\"round\" stroke-linejoin=\"round\" d=\"M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m.75 12 3 3m0 0 3-3m-3 3v-6m-1.5-9H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z\"/></svg>' +\n"
            "          '<span style=\"font-family:\\'Syne\\',sans-serif;font-size:13px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:200px;\">' + story.name + '</span>' +\n"
            "          '<svg width=\"9\" height=\"9\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"rgba(255,255,255,0.4)\" stroke-width=\"2\"><path d=\"M19 9l-7 7-7-7\"/></svg>' +\n"
            "        '</div>' +\n"
            "        '<div style=\"display:flex;gap:5px;flex-shrink:0;\">' +\n"
            "          '<button class=\"ib\" style=\"font-size:9px;\" id=\"td1-collapse-btn\" onclick=\"TD._collapseAll1col()\">' +\n"
            "            '<svg width=\"9\" height=\"9\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.5\"><path d=\"M18 15l-6-6-6 6\"/></svg> Hide All' +\n"
            "          '</button>' +\n"
            "          '<button class=\"ib\" style=\"font-size:9px;\" onclick=\"App.openExportModal(\\'td\\')\">' +\n"
            "            '<svg width=\"9\" height=\"9\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\"><path d=\"M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4\"/><polyline points=\"7 10 12 15 17 10\"/><line x1=\"12\" y1=\"15\" x2=\"12\" y2=\"3\"/></svg> Export' +\n"
            "          '</button>' +\n"
            "        '</div>' +\n"
            "      '</div>' +\n"
            "      '<div style=\"display:flex;align-items:center;gap:8px;\">' +\n"
            "        '<span style=\"font-size:10px;color:var(--ghost);\">Structure</span>' +\n"
            "        '<button class=\"ib\" style=\"font-size:10px;flex:1;justify-content:flex-start;\" onclick=\"App.openStructureModal(App.state.activeStory?.sectionPreset, TD._onStructureChange)\">' + story.sectionPreset + '</button>' +\n"
            "        '<span style=\"font-size:10px;color:var(--ghost);\">Pages</span>' +\n"
            "        '<input type=\"number\" class=\"fi\" style=\"width:52px;text-align:center;font-size:11px;\" min=\"1\" max=\"999\" value=\"' + Math.round((story.minutes||90)/2) + '\" onchange=\"TD._onPagesChange(this.value)\" onfocus=\"this.select()\"/>' +\n"
            "      '</div>' +\n"
            "    '</div>' +\n"
            "    '<div style=\"flex:1;overflow-y:auto;padding:8px 12px 24px;\">' + sectionsHtml + '</div>';"
        )

        new_content = content[:start_idx] + NEW + content[end_idx:]
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print(f"SUCCESS: Replaced {len(old_block)} chars with {len(NEW)} chars")
        print("File saved.")
