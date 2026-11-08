# UE5 System Architect: Jump to Line, One-Click Fix and Issue Tools

New tools that link compile-check issues to the code that caused them and repair them with one button, showing a before/after review first.
The release also adds re-checking, ignoring and copying issues, plus saved bundle presets for multi-system plugins.

## Who it's for
Unreal developers who generate systems in the app and want export-ready C++ without hand-searching for errors. That includes solo devs and teams who share projects (Editors and Viewers).

## Core features and experience
- **Jump to line**: clicking an issue in the compile check (or in the export warning) opens the C++ tab and scrolls to the matching file and line. That line is highlighted and the code viewers show line numbers. Issues with no exact line jump to the most likely spot, such as the class or function involved. If none is found, the file opens at the top.
- **Fix these (patch only)**: one button sends the current issues (built-in and AI review) with both files to your own AI key. This costs 1 request and counts toward the daily usage counter. The AI returns only the lines that need changing, and the rest of the code stays as it is.
- **Before/after review**: the proposed fix opens in a side-by-side diff of the .h and .cpp with changed lines marked. A short list explains what each change fixes. There are two choices: **Accept fix** replaces the code in the workspace (unsaved, like any edit), and **Discard** leaves everything unchanged. Nothing changes without approval.
- **Re-check after fix**: on accept, the compile check runs again automatically. It shows a result such as "Cleared 4 of 5 issues", and any remaining or new issues stay listed.
- **Fix a single issue**: each issue row also has a small "Fix" action that patches just that one problem, through the same before/after review.
- **Ignore an issue**: any built-in warning or error can be marked "Ignore". It's hidden from the count, the tab badge and the export warning, and listed under a collapsible "Ignored (N)" section where it can be restored. Ignores are saved with the project, so teammates see them too. An ignore stops applying if that issue's line text changes.
- **Copy issues**: a "Copy issues" button puts a plain-text list on the clipboard: file, line, message and suggested fix. Ignored items are excluded.
- **Bundle presets**: from the bundle window, "Save as preset" stores the plugin name and chosen projects under a name such as "Survival Kit". A "Bundle presets" list in the Projects panel re-opens a preset with its projects already ticked, using their latest saved versions. Presets can be renamed and deleted. Missing or no-longer-accessible projects are listed as skipped.

## User flow
1. Open a project, then the C++ tab. The compile check shows its issues and the tab badge shows the count.
2. Click an issue. The code scrolls to the highlighted line.
3. Press **Fix these** (or the single "Fix" on one row). A progress state shows while the AI works.
4. Review the before/after diff and the change list, then Accept or Discard.
5. On accept, the check re-runs and reports what was cleared. Remaining items can be fixed again, ignored or copied.
6. Save with a version note (for example "Fixed missing includes").
7. For multi-system plugins, tick projects, open Bundle, and Save as preset. Later, open the preset from the Projects panel and download the updated plugin.

## UI/UX feel
- Same dark Unreal Editor look as today.
- Issue rows become clickable, with a hover state and a small arrow.
- The code viewers gain a line-number column and a short highlight pulse on the target line.
- The fix review uses the existing Compare diff style: red for removed lines, green for added.
- Buttons are compact chips in the compile-check header: Fix these, Copy issues, AI review.

## Implementation phases
- **Phase 1 (MVP, built now)**: Jump to line, Fix these (patch only, all issues), per-issue Fix, before/after review with Accept/Discard, re-check after fix, Ignore/restore issues saved per project, Copy issues, and Bundle presets (save, open, rename, delete).
- **Phase 2**: "Fix and regenerate" as an alternative for structural problems. Fix history showing what each accepted fix changed in version notes. Ignoring AI-review findings. Inline editing of code lines.
- **Phase 3**: Auto-fix before export as an optional setting. Presets shared across a team workspace. A deeper multi-pass check that compares the bundle's modules against each other for cross-module problems.

## Assumptions
- Fixes use the user's own AI key and current model, never the Universal Key. With no key saved, the key window opens.
- An accepted fix changes only the workspace code. It isn't saved until the user presses Save, and it can be undone by discarding changes or from version history.
- Accepting a fix doesn't count as a "change for next synthesis". It replaces the current code directly, so the regenerate button doesn't light up for it.
- If the AI returns a patch that can't be applied cleanly (lines no longer match), the review shows an error and offers to try again. Nothing changes.
- Viewers can jump to lines, copy issues and see ignored items. Only Owners and Editors can fix, accept or ignore.
- Ignores apply to built-in check issues only in phase 1. AI review findings are refreshed each run.
- Bundle presets belong to the user who made them, can include shared projects, and are not visible to teammates.
- Before running, Fix these warns when the daily free limit is near, the same way synthesis does now.
