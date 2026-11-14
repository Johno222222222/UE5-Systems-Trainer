# UE5 Modular System Architect — PRD

The current app is a local desktop program. Electron opens this React workspace, and a small Node server on the same computer stores projects and calls Gemini or OpenAI with a key saved in Settings. Accounts, teams, sharing, and hosted storage described below are history from the earlier web version. See the README for the layout of the code.

## Problem Statement
An app to build modular systems from description in Unreal Engine 5.

## User Choices (Jan 2026)
- Outputs: ALL (Blueprint pseudocode + C++ snippets + step-by-step setup + visual node graph)
- AI: Claude Sonnet 4.5 (`claude-sonnet-4-5-20250929`) via the hosted model gateway (later replaced by the user's own Gemini or OpenAI key)
- Features: describe-to-system, pre-built template library, personal saved library
- No authentication (single-page tool, localStorage persistence)
- Design: Dark "Unreal Editor" inspired — dark navy (#0B0E14) + Unreal orange (#FF6B00)
- Outputs tunable via sliders + add/subtract module chips

## Architecture
- FastAPI backend `/api/generate` → calls the configured model and returns structured JSON
- `/api/templates` → static library of 8 pre-built system templates
- React IDE-style frontend: left (prompt + templates + saved library), center (4 tabs: Event Graph, Blueprint Pseudocode, C++ Snippets, Setup Guide), right (architecture dials + dynamic system parameter sliders + module chips)
- SVG draggable node graph with exec/data wire styling
- LocalStorage key `ue5_architect_library_v1` for saved systems

## Implemented
- 2026-01: Backend `/api/generate` with strict JSON contract (SystemOutput schema), `/api/templates`, budget-exceeded 402 error mapping
- 2026-01: Frontend IDE workspace with UE5-slate theme, 8 template cards, Event Graph with bezier wires + zoom/pan/drag, syntax-highlighted C++ & Blueprint code boxes, copy/download per file, interactive setup checklist, tunable sliders (complexity/modularity/perf/tick), dynamic per-system parameter sliders, module add/toggle chips, persistent error banner + toast
- 2026-01: Reduced LLM max_tokens to 4000 + compact system prompt to fit under ~60s gateway budget
- Credits recharged. Generation switched to a background job + polling (POST /api/generate → job_id, GET /api/generate/{job_id}; jobs stored in Mongo `jobs`), with max_tokens 8000 and live char progress. This avoids proxy timeouts and stream drops.
- Fixes from review: saved systems restore their prompt and settings; single-pass C++ highlighter; module exclusion removes it from the added list; typed nested schema; safe and cross-tab-consistent localStorage; 2000-character prompt limit with counter and readable validation errors; pointer/touch graph pan, wheel zoom, auto-Fit; aria labels on sliders and tabs
- Per-system parameter sliders are sent back as parameter_overrides and baked into the next generation

- Iteration 3 (5 requested changes):
  1. Edit→Regenerate loop: every edit since the last synthesis (description, dials, class, NET, parameter values, module toggles/additions, designer notes) is listed in a "Queued for next synthesis" panel and sent as numbered change_requests along with a compact previous_system. The model reports each one in applied_changes, shown as "Applied in this synthesis". The button reads "Regenerate with N changes".
  2. Learning annotations: "WHY:" lines in the pseudocode render as yellow callouts (with a toggle); each setup step has a "why" callout
  3. Project Context field (left sidebar, saved in localStorage) is silently prepended to every synthesis
  4. Stack Systems: tick 2–4 library items → "Stack N systems". The backend merges them, unifies shared attributes, and lists resolved conflicts. stacked_from chips appear in the header.
  5. Compare tab: previous vs current side by side (Pseudocode, .h, .cpp, Setup, Params & Modules) with an LCS line diff and input-change chips. Opens automatically after a regeneration.
  - Verified in the browser with mocked API responses (credits ran out again before the live check)

- Iteration 4 (approved Phase 1 plan): Google + email/password sign-in (one account per email, admin seeded); cloud Projects (Mine / Shared with me, open/save/rename/delete, last-saved-by, atomic 409 overwrite warning); Export JSON / Copy JSON / Import .json; one-time migration of browser-saved systems; reference files the AI reads (images, PDF text, code; up to 5, 10 MB); project Files tab (25 MB); invites with Editor/Viewer roles plus invite links; view-only public links. Files were stored in hosted object storage.
  - Security deviations: reset links are created by the admin only (account menu). Invite links require signing in with the invited email and can be claimed once. Email-matched auto-access applies only to Google-verified accounts.
- Iteration 5 (bring-your-own key): synthesis uses the user's own Gemini (gemini-2.5-flash / flash-lite / pro) or OpenAI (gpt-4.1-mini / gpt-4.1 / gpt-5-mini) key, stored in browser localStorage (`ue5_architect_ai_key`) and sent per request in the X-LLM-Provider / X-LLM-Model / X-LLM-Key headers. It is never stored or logged on the server (httpx/litellm logs muted, errors redacted). No key → the AI Key modal blocks synthesis. The hosted universal key is no longer used for any synthesis.
  - Fixes from test report iteration 2: logout revokes JWTs (token_version); Google linking drops unverified passwords; Google callback requires a browser-started sign-in; atomic version check on save; removed members lose file access; invite email check; late synthesis results discarded after switching projects; notes typed during synthesis are kept; double-save guard; Unicode download filenames; atomic reset token; references persist on save; reopening a project restores its Project Context; regenerations send the full previous implementation.

- Iteration 6: version history (`project_versions` snapshot on every create/save, with a pre-update backfill on first save; GET /projects/{id}/versions[/{n}]; Compare "compare against" picker). Test key button (POST /api/ai/test-key, stale results ignored). Default model gemini-3.5-flash-lite (retired models migrate automatically). Gemini models: 3.5 Flash-Lite, 3.1 Flash-Lite, 3.8 Flash, 3.1 Pro (paid); OpenAI models are marked paid. Paid-model / free-key detection (Gemini "free_tier" + "limit: 0" → paid_model_required; OpenAI insufficient_quota → no_credits) shows an inline panel with a "Switch to Gemini 3.5 Flash-Lite" button in both the key modal and the error banner. Gemini runs non-streaming with 2 automatic retries on 503/timeouts. Prompt tuned for Gemini (no copied sample text, Title Case names, 50–120 line C++ files). Empty systems are rejected.
  - Live check with a real free Gemini key: generate 9s, regenerate applied 5/5 edits, stack merged with shared attributes. Script: /app/tests/live_check.py
  - Security: logout revokes via the refresh token too; Google callback bound to a ?gs= nonce; 72-byte password cap; late save responses can't retarget projects.

- Iteration 7: UE5 .zip export in the workspace and on public links (client-side JSZip): `<Name>/Public/<Name>.h`, `Private/<Name>.cpp` (names taken from the .generated.h include), README.md with drop-in steps (API macro to replace, detected Build.cs modules), SETUP.md with Why notes, parameters and modules, BLUEPRINT_PSEUDOCODE.md with a Why summary, and system.json. Generation counter: `llm_usage` records every LLM request (synthesis attempts including retries, plus key tests) per user and key fingerprint (SHA-256 prefix, never the key) per Pacific day; GET /api/usage/today?fp=; header chip "N / ~500 today" that turns yellow at 70% and red at 90%. Approximate free limits: 3.5/3.1 Flash-Lite 500, 3.8 Flash 250, Pro 0. Restore version: POST /projects/{id}/versions/{n}/restore (editor+, atomic) makes the old version the newest one, so history is never lost; the Compare picker shows a "Restore vN" button.

- Iteration 8: Unreal plugin export, now the recommended option in the "UE5 .zip" menu and the default on share links. It builds `<Name>Kit/<Name>Kit.uplugin` (EnabledByDefault, Runtime module, and the engine plugins it needs such as EnhancedInput, GameplayAbilities, Niagara and ChaosVehiclesPlugin), `Source/<Name>Kit/<Name>Kit.Build.cs` (Core/CoreUObject/Engine plus detected GameplayTags/UMG/AIModule/NetCore…), `Private/<Name>KitModule.cpp` (IMPLEMENT_MODULE FDefaultModuleImpl), and Public/Private sources whose *_API macros are rewritten (or inserted) to <NAME>KIT_API. Version labels: PATCH /projects/{id}/versions/{n} {label} (editor+, ≤60 chars); Compare picker has "Named versions" and "All saved versions" groups plus a Name/Rename button. Limit warning: before any synthesis, if used+3 > 85% of the model's approximate free daily limit, a modal offers Cancel, Synthesize anyway, or a switch to the Gemini free model with the most quota left (each model has its own quota).

## Backlog
- P1 (from test report): mobile/narrow layout; pagination beyond 500 projects/files; image-only PDF pages sent to the model; stricter import validation; idempotent migration; per-project version history for Compare
- P1: Responsive layout for narrow/mobile screens (currently desktop IDE layout; flagged repeatedly by reviews)
- P2: Click a compile-check issue to jump to its line; focus trapping in dialogs; version list pagination beyond 1000
- P1: SSE streaming of code as it generates (tokens visible live)
- P1: Export full C++ project folder as .zip
- P2: Shareable URL for generated systems
- P2: Diff view between two tunings of the same prompt

- Iteration 9 (2026-06): 
  - Version notes: Save opens a dialog with an optional "What changed and why?" note (≤200 chars, Enter saves). Notes are stored on each `project_versions` snapshot (POST/PUT /projects accept `note`); restores record "Restored from vN". Compare → History modal lists every version with label, note, saver and time, plus Compare buttons; the selected version's note shows beside the picker.
  - Compile check (frontend/src/lib/compileCheck.js): instant pattern check of the .h/.cpp pair: generated.h include order, own-header include, CoreMinimal, GENERATED_BODY count, brace/paren balance, class-name mismatches, defined-but-undeclared methods, UFUNCTIONs never defined per class (incl. _Implementation/_Validate), replication (GetLifetimeReplicatedProps, RepNotify, DOREPLIFETIME names, SetIsReplicatedByDefault), undeclared delegate types, missing Super:: calls, tick never enabled, likely missing engine includes. Shown at the top of the C++ tab with a count badge on the tab. Optional "AI review" (POST /api/ai/review-cpp, user's own key, counts 1 request) adds deeper findings. Export shows a "Check before export" warning (static + AI findings) with Export anyway.
  - Multi-system plugin: tick 2–6 projects (Mine and Shared) → "Bundle as plugin": one .uplugin with one Runtime module per system (Source/<Module>/Build.cs, module entry, Public/Private), Docs/<Module>/ per system, README module table. Sibling modules a system uses are added to its Build.cs; duplicate classes/headers and circular use are flagged. Extra Build.cs detection: NavigationSystem, PhysicsCore, InputCore, Slate/SlateCore.

- Iteration 10 (2026-06): Issue tools.
  - Jump to line: issue rows (compile check, AI review, export warning) are clickable; C++ viewers (components/CodeBox.jsx) have a line-number gutter and a pulsing highlight on the target line. No-line issues are located via the class/function named in the message (lib/compileCheck.js locateIssue), else line 1.
  - Fix these / per-row Fix: POST /api/ai/fix-cpp (user's key, 1 request, optional project_id requires editor). The model returns find/replace edits; the server applies them (exact match, then a whitespace-tolerant whole-line match) and returns 422 patch_failed/no_changes if they don't apply. FixReviewModal shows a before/after diff and the change list; Accept replaces the workspace code (unsaved), and the toast offers "Undo fix"; Discard changes nothing. Re-check after accept: "Cleared X of Y issues".
  - Ignore/Restore built-in issues: key = file + hash(message + offending line text); stored on the project (PUT /api/projects/{id}/ignores, returned as ignored_issues); excluded from the count, tab badge and export warning; "Ignored (N)" section. Viewers can see but not change them.
  - Copy issues (plain text with fixes).
  - Bundle presets (private per user): GET/POST /api/bundle-presets, PATCH/DELETE /api/bundle-presets/{id}; "Save as preset" in the bundle window; "Bundle presets" list in the Projects panel opens a preset with the latest saved versions; missing projects are shown as skipped.

- Iteration 11 (2026-06):
  - Fix & regenerate: a button in the compile check (and in the fix error window) sends the listed issues as numbered change requests into a normal regenerate (1 synthesis, then Compare opens).
  - Fix history notes: each accepted fix (and each fix-regenerate) is queued; opening Save pre-fills the note ("Fixed: …"), editable. Undo fix removes its note; the queue clears after a save or when another project opens.
  - Auto-fix before export: a per-project setting (`auto_fix_export`, PATCH /api/projects/{id}/settings, editor+) shown as a checkbox in the UE5 .zip menu. When it's on and issues exist, export runs Fix these first and shows the review: "Accept fix and export" / "Discard and export"; on error "Export without fixing". It falls back to the normal warning when there's no key or the user is a viewer.
  - Shared bundle presets: GET /api/bundle-presets also returns teammates' presets (mine:false, owner_name) when the user can open every project in them; only the creator can rename or delete.

- Iteration 12 (2026-06):
  - Clean export badge: plugin README (single and bundle) gets a shields.io "compile-checked: no errors" badge plus a dated line and the remaining warnings, only when there are no errors (ignored issues excluded; includes AI review findings if a review ran). The bundle README module table has a Compile check column; the top badge appears only if every module has no errors.
  - Fix History: each accepted fix is recorded as an entry (lib/fixLog.js: one hunk per file with removed/added lines, start line, why notes, model) and saved with the next version (`fixes` on POST/PUT /projects, stored on project_versions, returned by GET versions). The History modal lists fixes per version, plus unsaved ones; View opens FixDetailModal (before/after); "Undo this fix" puts the old lines back in the workspace if the added lines still match (located at the start line or uniquely elsewhere), and adds an "Undid fix: …" note.
  - Batch fix in bundles: "Fix all projects" in the bundle window runs Fix these on each project with active issues, one review at a time ("Project N of M"). Accept saves a new version (note + fix entry) for projects you can edit; otherwise the fix applies to this download only. Skip moves on; it warns near the daily free limit. The summary toast reports fixed and saved counts.

- Iteration 13 (2026-06): Unreal-ready exports, teams, real emails.
  - Copy for Unreal (lib/unrealExtras.js blueprintClipboard): Event Graph → UE clipboard T3D (K2Node_Event for BeginPlay/Tick/EndPlay/AnyDamage/overlap, CustomEvent, CallFunction for header UFUNCTIONs + Delay/PrintString, VariableGet/Set for header UPROPERTYs, IfThenElse, ExecutionSequence; exec wires linked; unmapped nodes become TODO comment nodes). Button on the Event Graph tab; plugin zips include Blueprints/<Module>_EventGraph.txt.
  - Tests tab (components/TestsPanel.jsx): POST /api/ai/tests (user key, 1 request, editor check if project_id) returns an Automation Spec file + case names; stored on system.tests {file_name, code, cases, for(hash), model}; "out of date" when the C++ hash changes; checkTests() compile check; Fix these for tests reuses /ai/fix-cpp (target "tests"). Plugin exports add a <Module>Tests Editor module.
  - Data Table: tuningFiles() writes Data/<Base>_Tuning.csv + <Base>TuningRow.h/.cpp (FTableRowBase row struct + U<Base>TuningLibrary::ApplyTuningRow, a reflection-based copier by property name); SETUP.md gets import/assign steps. The generated component itself isn't modified; the user calls ApplyTuningRow in BeginPlay.
  - COMPILE_REPORT.md in plugin, source-only and bundle zips (issues, ignored with "by", fixes since the last save, AI review model).
  - Teams (backend/teams.py): teams {team_id, name, owner_id, members[{email, role, user_id, invite_token}]}; GET/POST/PATCH/DELETE /api/teams, members add/role/remove, POST /api/team-invites/{token}/accept, POST /api/projects/{id}/team (project owner only), POST /api/bundle-presets/{id}/team. load_project and list_projects merge team role with direct share (the higher one wins; the team owner gets editor). GET /projects returns a `team` list. Deleting a team unsets team_id. UI: Team tab with switcher, TeamModal, per-project and per-preset move selects, team badges.
  - Real emails (backend/emailer.py, a managed email service; EMAIL_FROM_NAME "UE5 System Architect"): project invites, team invites (response `emailed` true/false; on-screen link fallback), and POST /api/auth/forgot-password (generic reply, 3 per hour, 1-hour single-use token, /reset/{token}). New /forgot page linked from the sign-in screen. Link host = the request's ingress host. The desktop app does not send email.
  - Review fixes (iteration_7 review): email link host comes only from the Host header (no x-forwarded-host); the email safety gate failure no longer raises; concurrent duplicate invites are guarded ($ne email); undo hunks carry neighbour context and a truncated flag; test-fix retry keeps its target; closing the auto-fix review cancels instead of exporting; batch Accept can't double-fire; Blueprint paste uses the bundle's unique module name; tests survive regeneration (marked out of date); restore clears pending fix notes and log; a late save doesn't clear another project's fix state; badges count test errors; stricter test reply validation; Stack/Bundle buttons count Team projects.
  - Known/left: phone layout; modal focus trapping; AI review findings aren't persisted; the public share export has no compile report; team roster shows emails only.

## Banked backlog (recorded 2026-06, not started; owner picks next month)
- P1: Data wires in Copy for Unreal (value pins reconnect automatically)
- P1: Team activity feed (who saved, fixed or exported what)
- P2: "Follow" emails when a teammate saves a followed project
- P2: One-click "verify in Unreal" script inside the plugin zip
- Carry-overs: phone-width layout; keyboard focus trapping in pop-ups; persist AI review results across reopen; compile report on public-share exports; member names in team list
