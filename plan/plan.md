# UE5 System Architect: Republish Current Version and Bank Next Month's Upgrades

Puts the current build of UE5 System Architect live exactly as it is, with no new features or code changes.
Saves the suggested next upgrades as a backlog for next month, so no credits are spent on them now.

## Who it's for
The app owner, who is low on credits and wants the latest features live without spending more on development. Also existing users and teammates, who get the newest version at the same live address.

## Core features and experience
- **Republish as-is**: the version that exists today goes live, with no pre-check or changes. That includes Unreal-ready exports (Copy for Unreal, Tests tab, Data Table, compile report), team workspaces, real invite and reset emails, the compile check and fixes, version history and bundle presets.
- **Banked backlog (not built now)**: the following are recorded for next month and not started:
  - Data wires in Copy for Unreal (value pins reconnect automatically)
  - Team activity feed (who saved, fixed or exported what)
  - "Follow" emails when a teammate saves a followed project
  - One-click "verify in Unreal" script inside the plugin zip
  - Earlier carry-overs: phone-width layout, keyboard focus inside pop-up windows, keeping AI review results after reopening a project, a compile report on public-share exports, and member names in the team list
- **Nothing else changes**: no new features, no fixes and no testing round in this step.

## User flow
1. The owner approves this plan.
2. The current version is republished to the existing live address.
3. The live link is shared back when publishing finishes.
4. Next month, the owner picks items from the banked backlog to build.

## UI/UX feel
- No visual changes. The live app looks and works exactly like the current preview.

## Implementation phases
- **Phase 1 (now)**: Republish the current version as-is and record the banked backlog in the project notes. No code changes.
- **Phase 2 (next month)**: Build the owner's chosen backlog items. The likely first pick is data wires for Copy for Unreal plus the team activity feed.
- **Phase 3 (later)**: Remaining backlog: follow emails, the "verify in Unreal" script, phone layout and the other carry-overs.

## Assumptions
- Republishing goes to the same live address as before. Existing users, projects, teams and settings carry over unchanged.
- The owner chose no readiness check, so any live-only problem would only show up after publishing. A fix would come in a later session.
- Live emails (invites and password resets) use Emergent's managed email service. Any per-email cost comes from the owner's Emergent balance; if credits run out, sending pauses and on-screen invite links still work.
- AI features keep using each user's own Gemini or OpenAI key, so they don't draw on the owner's credits.
- The republish costs whatever the platform charges for publishing. No development credits are spent beyond that.
- The backlog is only recorded. Nothing from it is built until the owner asks.
