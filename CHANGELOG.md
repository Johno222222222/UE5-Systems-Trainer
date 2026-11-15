# Changelog

## 1.4.0

Stage 4, references.

- Start Here is a Character Interaction module that ships with the app. You can open the graph, the pseudocode, and the C++, answer a question, and move a slider with no API key.
- A short note on first run and in About says what the app is, and that it is not a full game generator. The code still needs review before you ship it.
- References is in the top bar. It is a read-only look at a system with every WHY note open, plus the key decisions. It works for the bundled example and for a system you already have open.
- Fork copies a bundled example or a template into your projects. The original stays as it was.
- Concepts is a library of ten cards. Each one has a short explanation, a challenge that does not call the model, and a link to an example or a template. WHY notes open the matching card.
- Examples and templates show complexity, prerequisites, and Inspired by links. Those links go to Epic's Unreal documentation.

## 1.3.0

Stage 3, practice.

- Learn is in the top bar. It walks the open system's challenges. After an answer it shows the slider or module that challenge is about. Open in Learn from Tools, and Tools is still where you left it.
- Before a new system or a fix is shown, Learning asks you to predict the outcome. You can skip it. Minimal never asks.
- The reveal marks the graph nodes and the C++ lines and opens the matching WHY note. A wrong answer says why that choice is tempting.
- A What-if switch shows two versions of a key snippet, such as a timer and a Tick. Moving a parameter slider highlights the lines it will change, with no extra request.
- After a fix, Outcome Check lists every edit and why. Compare can explain one changed block in a single request.
- Practice progress is saved with the library. Home shows continue cards from it. Backup and Import carry that progress. Older projects still open.

## 1.2.0

Stage 2, the learning layer.

- After a system is generated it shows immediately. A second request then writes challenges, WHY notes, parameter effects, and common traps. If that pass fails, the system stays and you can retry it.
- WHY badges sit on event-graph nodes. The C++ view shows a callout beside the line it explains. One sentence is always visible. Learning mode also opens the tradeoff, the common mistake, and a link to the concept, which waits for a later stage.
- The help switch in the top bar is Learning, Standard, or Minimal. Learning is the default. Standard keeps the one-line notes. Minimal hides them and does not make the learning request. The choice is remembered on this computer.
- The eight built-in templates already include their teaching notes, so opening one does not call the model.
- A project saved before this version still opens.

## 1.1.1

- Versions is next to the project name again. It lists each save with its number, time, and a short summary. You can open one, compare it, or restore it. Home's project cards link to that list. Opening a card still loads the latest save.
- Stacking no longer feeds the model a chopped source file. Each system goes in as a summary, and the reply is allowed the model's full output length. If the answer is still cut off, the app asks the model to continue and will not show a half-finished system.

## 1.1.0

Stage 1, the app shell.

- The app opens on Home. Home lists saved projects, with the five most recent up front and the rest one step away.
- Home can start a new project, open the last system, or load a template. Each of those opens Tools in that state.
- Tools is the existing workspace.
- A top bar shows the sections that exist (Home and Tools) and the current system. An unsaved dot on that chip clears after Save.
- Switching sections keeps the system you were editing: the result, dials, notes, references, parameters, modules, setup ticks, and target Unreal version.
- The version is shown on Home and in Settings. Feedback and the update check use the same number.

## 1.0.0

The desktop app, plus Stage 0.

- Electron app for Windows, with projects and API keys stored on this computer.
- New project asks before throwing work away. Templates ask before replacing an open project.
- Target Unreal version (5.4 through 5.8, default 5.8) is saved with the project and named in the prompts.
- Setup Guide ticks are saved with the project.
- Feedback opens a GitHub issue with the app version. A newer GitHub Release shows an Update chip.
- A version tag such as `v1.0.0` publishes the Windows installer as a GitHub Release.
- Bench prompts for a first-compile check in a blank UE 5.8 project.
