# UE5 System Architect: Unreal-Ready Exports, Team Workspaces and Real Emails

Exports that go further into Unreal: Blueprint nodes you can paste straight into the editor, ready-to-run automation tests, an editable Data Table of tuning values and a compile report inside every zip.
The release also adds team workspaces that share everything at once, plus invites and password resets delivered by real email.

## Who it's for
Unreal developers who generate systems in the app and want less manual work between "generated" and "running in my project". It also serves small teams (owners, editors, viewers) who work on many projects together.

## Core features and experience
- **Paste-into-Unreal Blueprint nodes**: the Event Graph tab gets a "Copy for Unreal" button. It copies the graph in Unreal's own clipboard text format, so pasting into a Blueprint editor (Ctrl+V) creates the real nodes and wires. It covers common node types: events, function calls on the generated component, branches, variables (get/set), sequence and delays. Anything it can't map becomes a clearly labeled comment node instead of being dropped. A short note explains where to paste (for example, the Event Graph of the actor that owns the component). Plugin zips also include the paste text as a file per graph.
- **Auto-generated test cases**: each system can produce Unreal automation tests (C++ "spec" tests) that check its core behavior, such as "damage lowers health", "health never goes below 0" and "regen stops at max". Tests are generated on request with the user's own AI key (1 request), shown in a new **Tests** tab, run through the compile check like the main code, and can be fixed the same way. Plugin exports place them in the plugin as a test-only module that runs from Unreal's Session Frontend > Automation panel. A test file is kept with the project and marked "out of date" when the system changes.
- **Tunable values as a Data Table**: the system's tunable values (damage, regen rate, max health, cooldowns) export as a CSV Data Table plus a matching row struct in the C++. The generated code reads its defaults from that table when one is assigned, so designers can tweak numbers in Unreal without recompiling. The Setup guide gains steps for importing the table and assigning it.
- **Compile report in exports**: every zip (single plugin, source-only and bundle) includes `COMPILE_REPORT.md`. It lists the date, the model used for any AI review, every current issue (errors and warnings), every ignored issue with who ignored it, and fixes applied since the last save. Bundles get one section per module.
- **Team workspaces**: an owner creates a team (name plus members by email, each with Editor or Viewer). A project or bundle preset can be moved into a team, and then everyone in it has access with their team role. No per-project sharing is needed. The Projects panel gets a third tab, "Team", with a team switcher if someone belongs to several. Owners can rename the team, change roles, remove members or delete the team. Deleting a team moves its projects back to their creators. Per-project sharing still works for people outside the team.
- **Real invite and reset emails**: team invites, project share invites and password-reset requests are sent as real emails from "UE5 System Architect". The link inside opens the app directly. On-screen links remain as a fallback when sending fails (shown only to the person who sent the invite). Reset links expire after 1 hour and work once.

## User flow
1. Generate or open a system. In the Event Graph tab, press **Copy for Unreal** and paste into a Blueprint in Unreal Editor. The nodes appear wired.
2. Open the **Tests** tab and press **Generate tests**. Review the tests, run the compile check on them and fix them if needed.
3. Export the plugin. The zip contains the code, tests module, Data Table CSV, Blueprint paste files and `COMPILE_REPORT.md`.
4. In Unreal: build, import the Data Table, run the tests from the Automation panel and tweak numbers in the table.
5. Teams: create a team, invite teammates by email (they receive the email and join), then move projects and presets into the team. Everyone sees them in the Team tab.
6. Forgot password: request a reset, receive the email and set a new password from the link.

## UI/UX feel
- Same dark Unreal Editor look.
- New **Tests** tab beside C++, using the same code viewers with line numbers and the compile-check panel.
- "Copy for Unreal" is a prominent chip on the graph with a short success hint ("Paste into a Blueprint Event Graph").
- Team tab and switcher use the existing project list styling, with a small team badge on team projects.
- Emails are short, plain and dark-accented: app name, what happened, one button, and a footer noting the app never asks for passwords by email.

## Implementation phases
- **Phase 1 (MVP, built now)**: Copy for Unreal (common node types plus comment fallback, also included in zips); generated automation tests with Tests tab, check and fix, and a tests module in plugin exports; Data Table CSV plus row struct and setup steps; COMPILE_REPORT.md in all exports; team workspaces (create, invite, roles, move projects and presets in and out, Team tab); real emails for team invites, project invites and password reset.
- **Phase 2**: More Blueprint node types (timelines, macros, custom events with inputs). Graphs that can be pasted into a specific Blueprint class. Tests that also cover multiplayer replication. A team activity feed (who saved, fixed or exported what). An email when a teammate shares or saves a project you follow.
- **Phase 3**: Team-level usage limits and settings set by the owner. A team template library of approved systems. A one-click "verify in Unreal" helper script that builds the plugin and runs its tests locally, then reports back.

## Assumptions
- Blueprint paste targets Unreal Engine 5.3–5.5 clipboard format. Pasted nodes reference the generated C++ classes, so they work after the plugin is built.
- Test generation uses the user's own AI key and counts toward the daily usage counter, the same as fixes. Tests are not generated automatically with every synthesis.
- The Data Table covers only values already listed as tunable; the code keeps its built-in defaults when no table is assigned.
- The compile report lists only issues the app knows about (built-in check, plus AI review if one was run). It is not an actual Unreal build.
- Emails are sent through Emergent's managed email service, so no email account or key is needed. The sender name is "UE5 System Architect". Emails go only to addresses the inviting user typed or to the account requesting a reset. There are no bulk emails.
- A person can belong to several teams. Each team has one owner. Moving a project into a team requires being its owner. A team role and a direct project share don't add up: the higher of the two applies.
- Team presets follow the existing rule: visible to anyone who can open all of their projects.
- Existing on-screen invite and reset links keep working until they expire.
