# UE5 Modular System Architect — PRD

## Problem Statement
An app to build modular systems from description in Unreal Engine 5.

## User Choices (Jan 2026)
- Outputs: ALL (Blueprint pseudocode + C++ snippets + step-by-step setup + visual node graph)
- AI: Claude Sonnet 4.5 (`claude-sonnet-4-5-20250929`) via Emergent Universal Key
- Features: describe-to-system, pre-built template library, personal saved library
- No authentication (single-page tool, localStorage persistence)
- Design: Dark "Unreal Editor" inspired — dark navy (#0B0E14) + Unreal orange (#FF6B00)
- Outputs tunable via sliders + add/subtract module chips

## Architecture
- FastAPI backend `/api/generate` → calls Claude Sonnet 4.5 via `emergentintegrations`, returns structured JSON
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

- Iteration 4 (approved Phase 1 plan): Google + email/password sign-in (one account per email, admin seeded); cloud Projects (Mine / Shared with me, open/save/rename/delete, last-saved-by, atomic 409 overwrite warning); Export JSON / Copy JSON / Import .json; one-time migration of browser-saved systems; reference files the AI reads (images, PDF text, code; up to 5, 10 MB); project Files tab (25 MB); invites with Editor/Viewer roles plus invite links; view-only public links. Files are stored in Emergent object storage.
  - Security deviations: reset links are created by the admin only (account menu). Invite links require signing in with the invited email and can be claimed once. Email-matched auto-access applies only to Google-verified accounts.
- Iteration 5 (bring-your-own key): synthesis uses the user's own Gemini (gemini-2.5-flash / flash-lite / pro) or OpenAI (gpt-4.1-mini / gpt-4.1 / gpt-5-mini) key, stored in browser localStorage (`ue5_architect_ai_key`) and sent per request in the X-LLM-Provider / X-LLM-Model / X-LLM-Key headers. It is never stored or logged on the server (httpx/litellm logs muted, errors redacted). No key → the AI Key modal blocks synthesis. The Universal Key is no longer used for any synthesis; object storage still uses EMERGENT_LLM_KEY.
  - Fixes from test report iteration 2: logout revokes JWTs (token_version); Google linking drops unverified passwords; Google callback requires a browser-started sign-in; atomic version check on save; removed members lose file access; invite email check; late synthesis results discarded after switching projects; notes typed during synthesis are kept; double-save guard; Unicode download filenames; atomic reset token; references persist on save; reopening a project restores its Project Context; regenerations send the full previous implementation.

- Iteration 6: version history (`project_versions` snapshot on every create/save, with a pre-update backfill on first save; GET /projects/{id}/versions[/{n}]; Compare "compare against" picker). Test key button (POST /api/ai/test-key, stale results ignored). Default model gemini-3.5-flash-lite (retired models migrate automatically). Gemini models: 3.5 Flash-Lite, 3.1 Flash-Lite, 3.8 Flash, 3.1 Pro (paid); OpenAI models are marked paid. Paid-model / free-key detection (Gemini "free_tier" + "limit: 0" → paid_model_required; OpenAI insufficient_quota → no_credits) shows an inline panel with a "Switch to Gemini 3.5 Flash-Lite" button in both the key modal and the error banner. Gemini runs non-streaming with 2 automatic retries on 503/timeouts. Prompt tuned for Gemini (no copied sample text, Title Case names, 50–120 line C++ files). Empty systems are rejected.
  - Live check with a real free Gemini key: generate 9s, regenerate applied 5/5 edits, stack merged with shared attributes. Script: /app/tests/live_check.py
  - Security: logout revokes via the refresh token too; Google callback bound to a ?gs= nonce; 72-byte password cap; late save responses can't retarget projects.

- Iteration 7: UE5 .zip export in the workspace and on public links (client-side JSZip): `<Name>/Public/<Name>.h`, `Private/<Name>.cpp` (names taken from the .generated.h include), README.md with drop-in steps (API macro to replace, detected Build.cs modules), SETUP.md with Why notes, parameters and modules, BLUEPRINT_PSEUDOCODE.md with a Why summary, and system.json. Generation counter: `llm_usage` records every LLM request (synthesis attempts including retries, plus key tests) per user and key fingerprint (SHA-256 prefix, never the key) per Pacific day; GET /api/usage/today?fp=; header chip "N / ~500 today" that turns yellow at 70% and red at 90%. Approximate free limits: 3.5/3.1 Flash-Lite 500, 3.8 Flash 250, Pro 0. Restore version: POST /projects/{id}/versions/{n}/restore (editor+, atomic) makes the old version the newest one, so history is never lost; the Compare picker shows a "Restore vN" button.

- Iteration 8: Unreal plugin export, now the recommended option in the "UE5 .zip" menu and the default on share links. It builds `<Name>Kit/<Name>Kit.uplugin` (EnabledByDefault, Runtime module, and the engine plugins it needs such as EnhancedInput, GameplayAbilities, Niagara and ChaosVehiclesPlugin), `Source/<Name>Kit/<Name>Kit.Build.cs` (Core/CoreUObject/Engine plus detected GameplayTags/UMG/AIModule/NetCore…), `Private/<Name>KitModule.cpp` (IMPLEMENT_MODULE FDefaultModuleImpl), and Public/Private sources whose *_API macros are rewritten (or inserted) to <NAME>KIT_API. Version labels: PATCH /projects/{id}/versions/{n} {label} (editor+, ≤60 chars); Compare picker has "Named versions" and "All saved versions" groups plus a Name/Rename button. Limit warning: before any synthesis, if used+3 > 85% of the model's approximate free daily limit, a modal offers Cancel, Synthesize anyway, or a switch to the Gemini free model with the most quota left (each model has its own quota).

## Backlog
- P1 (from test report): mobile/narrow layout; pagination beyond 500 projects/files; image-only PDF pages sent to the model; stricter import validation; idempotent migration; per-project version history for Compare
- P1: Responsive layout for narrow/mobile screens (currently desktop IDE layout)
- P1: SSE streaming of code as it generates (tokens visible live)
- P1: Export full C++ project folder as .zip
- P2: Shareable URL for generated systems
- P2: Diff view between two tunings of the same prompt
