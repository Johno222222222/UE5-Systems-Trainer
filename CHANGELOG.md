# Changelog

## 1.8.0

- The event graph is editable. Search a palette grouped like Unreal, drag nodes on, move them, box or shift select, and delete, duplicate, or copy and paste. Undo and redo use Ctrl+Z, Ctrl+Y, and Ctrl+Shift+Z.
- Wires connect pin to pin. Execution pins are white and data pins use Unreal's type colors. A mismatched wire shows a red hint and is refused. Alt+click or the right-click menu removes a wire.
- The canvas zooms, pans, snaps to a grid, and has a minimap and comment boxes. The graph is stored on the project, so Compare and Restore include it.
- Editing the graph rewrites the matching C++ handlers. Manual edits are left in place, with Revert to generated when you want the graph written back.
- No Tick and server-authority locks flag the nodes they affect, with a short WHY note. Clicking Show in C++ jumps to that node's line. Explain this graph walks through what fires, using the selected model when a key is set and a local summary otherwise.

## 1.7.0

- Lesson text, WHY notes, concepts, programs, courses, and setup steps underline glossary terms. Click or press Enter for a short definition. The first mention in each note is the one that is marked. Code, menus, buttons, and the C++ editor are left alone.
- The glossary ships in the app next to the lesson packs and is read from the installed app path.
- The header and source editors sit side by side again, and stack when the window is narrow.
- When a fix is not applied and a line is known, Jump to line selects that line in the editor.
- Build with Unreal no longer wraps RunUAT in `cmd /s /c`. Plugin and package paths are quoted on their own, and a package folder with spaces is moved to a path without spaces.

## 1.6.0

Stage 6, trustworthy export and more models.

- The UE, network, and model chips in the Tools header open a picker. The project badge that says Local explains that the project stays on this computer. Each chip has a tooltip.
- The C++ view is an editor. Edits are marked, saved with the project, and used by the pattern check, Build with Unreal, export, Fix, and AI review. A new synthesis asks before it replaces them. Revert to generated puts the last generated code back. A compile issue selects that line.
- Build with Unreal shows the RunUAT log, and a path with spaces is quoted. Compiler, linker, and Unreal Header Tool lines keep their file and line. Widget code adds UMG to the generated Build.cs.
- No Tick no longer flags `bCanEverTick = false`. It flags a Tick or TickComponent function, or `bCanEverTick = true`.
- A new synthesis adds a missing `Name_Implementation` for a BlueprintNativeEvent and `#include "Engine/World.h"` when the code calls GetWorld.

- If Unreal is installed, Compile check can build the exported plugin with Unreal's build tool and show the compiler errors. Fix still takes those errors. The app looks for UE 5.8, then UE 5.7. Settings can point at the engine folder. If no engine is found, the panel says so. The build-tool call is behind a platform check.
- UE5 .zip can copy the plugin straight into a project's Plugins folder. Pick the .uproject in the desktop app, or paste the path.
- A project can lock "Must stay server-authoritative" or "No Tick". The lock is saved with the project, goes into the next synthesis, and a reply that breaks it is flagged.
- Stacking draws shared interfaces and attributes, and class-name clashes, on the System Map.
- The plugin README now says what to expect in Unreal, how to set up a minimal test map, and the usual first errors.
- Settings adds Anthropic, OpenRouter, and Ollama. Ollama runs on this computer and does not need a key or the internet. Keys for the paid providers are stored the same way as Gemini and OpenAI.
- A paid model shows an estimate next to the usage chip, and again before the request is sent. Nothing is sent until you continue.
- When the model is unsure, the system is marked low confidence and offers one alternative.
- The eight template starters pass the in-app C++ pattern check, including a declared `Run()`. That is not a substitute for Unreal's compiler. On a machine with UE 5.8, open a template, press Build with Unreal, and read the compiler lines.

## 1.5.1

- Quiz options, Predict choices, concept questions, and spaced-review choices are buttons you can click. The one you pick is highlighted. After the answer is checked, the right option turns green and a wrong pick turns red, with a line that says why.

## 1.5.0

Stage 5, programs and courses.

- Programs and Courses are in the top bar. A program walks you from studying a system to loading one you can build on. The first program is the Tactical FPS foundation: interaction, inventory, weapon wear, and replication notes.
- Each guided step shows the functions or nodes it is about, asks you to predict the outcome, shows the WHY, then gives a small task. Checking the task does not call the model.
- Modify Without Docs is a set of settings checks. A 500 cm trace that ignores the player is one of them. A task passes only with the settings it asks for. There are six, and none of them call the model.
- Finishing the program loads its starter project into Tools, with interaction, inventory, weapon wear, and health together. Home marks the program complete. The C++ is written for a blank UE 5.8 game module, and the same files build on 5.7.
- Compare Approaches puts the same feature side by side: a Blueprint actor against a C++ component, and Tick against an event.
- The system map is a clickable picture of how input, interaction, health, and UI connect.
- The first course has four modules. Each one has a scored quiz, a diff that asks which side has the bug, a short assignment, and a takeaway. The pass mark is 70. Scores stay on this computer, and a retake replaces the saved score.
- A quiz you get wrong comes back in the next three sessions, in different words. It does not repeat in the session you missed it.
- Programs and courses are JSON files in `content/packs`. The app reads that folder when it starts. Add a file, restart, and it shows up. The file shape is in `content/packs/FORMAT.md`.
- The Windows install includes those packs. If a pack is missing or cannot be read, Programs and Courses say so. Extra JSON packs can go in the packs folder next to your projects.
- A project saved before this version still opens.

## 1.4.0

Stage 4, references.

- Start Here is a Character Interaction module that ships with the app. It opens with no API key. The graph, the pseudocode, the C++, the challenges, and the parameter sliders do not call the model.
- The first time you open the app, and in About, a short note says what this is. It is a UE5 architecture and learning tool. It is not a full game generator. Review the code before you ship it.
- References is in the top bar. It shows a system with every WHY note open and a list of the key decisions. That works for the bundled examples and for a system you saved.
- Fork copies a bundled example or a template into your projects. The original stays as it shipped.
- Concepts has a card for Tick vs timers, authority and server RPCs, Interface vs Cast, Data Assets, replication and RepNotify, delegates and events, components vs inheritance, Gameplay Tags, and line traces. Each card has a short explanation, a question you answer on this computer, and a link to an example that uses it. A WHY note's related concept opens that card.
- Examples and templates show a complexity, the topics they assume, and links to the official Unreal Engine docs.
- A project saved before this version still opens. Practice progress still loads.

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
