# Changelog

## 1.17.0

- Learn has Big Picture and Quiz. Big Picture starts on the event graph and swaps in the C++ lines, dependencies, expansions, and properties. Quiz has Beginner and Intermediate.
- Programs add FPS, TPS, Horror, and Strategy tracks at both levels. Each section has a reading lesson, a generated diagram, an assignment, and a quiz, and each track ends with a final exam that includes a broken graph and broken C++ repair.
- Courses add shorter general beginner and intermediate paths that mix those genres. The existing quizzes, scores, and reviews stay.
- The event-graph wire hint renders above the nodes. A compile check that passes clears the Outcome Check list.
- Version is 1.17.0. Glossary and node expansion wait for 1.18.0.

## 1.16.0

- The window title, About box, header, and Start menu say UE5 Systems Training Tool/Generator. Installer files are named UE5-Systems-Training-Tool-Generator. The data folder name is unchanged so saved projects stay put.
- Stack saved systems into one plugin. Shared interfaces and gameplay tags stay once. Duplicate classes are renamed. The same input action or replicated property is listed with a fix. Create in Unreal uses `/Game/Architect/<StackName>` and still asks before overwrite.
- Courses for GAS basics, multiplayer replication, and data-driven design, linked from the learning paths.
- Event graph nodes for Set Timer by Event, Set Timer by Function, Break Struct, and Make Struct, plus six graph templates. Timeline emits a UTimelineComponent. Event dispatchers emit a dynamic multicast delegate. Break and Make use the struct you pick.
- Interface Call and Cast To were already in the graph. Cast To keeps the result for the next node. An interface class sends Execute_ through ImplementsInterface. Stack stays on this computer. Integrate with AI is the model path and uses the network.
- Systems, nodes, and templates carry a when-to-use note and a common-mistakes note. The first-run tour can be skipped.
- The Windows installer and the app exe inside it are signed with Azure Artifact Signing when the repository secrets are present. The publisher on that certificate is John Fischer. A build without those secrets stays unsigned and still completes.
- Version is 1.16.0.

## 1.15.0

- Create in Unreal and Send to Unreal also send the system's WHY notes. The Architect panel lists them by data table, data asset, Blueprint, and C++ class.
- The panel can check two to four challenges against the real assets, and you can mark one done by hand. The result shows in the app with the asset name and counts toward your learning progress.
- The panel can search the glossary.
- One Send to Unreal shows one editor notification. If Unreal is not connected, Send and Create say so immediately and do not queue.
- Version is 1.15.0. The Stage 8 plugin work is done.

## 1.14.1

- Create and Open requests stay queued until Unreal answers that request. If the editor never answers, the app says so.
- Building on Windows runs RunUAT through cmd.exe, so the build tool no longer fails with spawn EINVAL.
- Data table rows, the primary data asset, and Blueprint defaults use the constructor values instead of zeros. The Blueprint comment box fits its text.
- Version is 1.14.1.

## 1.14.0

- Create in Unreal asks the paired Architect panel to make a data table, a primary data asset, and a Blueprint stub under `/Game/Architect/<SystemName>`.
- The data table row and the primary data asset class are C++ in the generated plugin. If those types are not compiled yet, the editor says to Send to Unreal and compile first.
- An existing asset is left alone until you confirm. The app lists the created paths and can ask the editor to open one.
- Version is 1.14.0. Learning inside the editor is planned for 1.15.0.

## 1.13.0

- The glossary lives in `content/glossary.json`. Each term has a one-line summary, an optional Unreal detail, tags, and see-also links. The dotted underline is unchanged.
- A Glossary section lists every term. You can search and filter by tag. A program or course underlines only the tags that fit that lesson.
- Right-click a word that is not in the glossary to request a definition. The Glossary page lists those requests and can copy them.
- Version is 1.13.0. Real assets are planned for 1.14.0. Learning inside the editor is planned for 1.15.0.
- The stage 2 spec terms are in the glossary, including Pose Search, GAS effect data, and the replication conditions. Short words such as Pose, Period, and Widget stay in the index and are not underlined.

## 1.12.0

- An editor-only Architect plugin ships in the app and can be copied into a project's Plugins folder. Its panel shows whether it is paired, the project name, and the engine version. It does not call an AI model.
- The desktop app and the plugin talk only on this computer, with a pairing code. Send to Unreal writes the generated module, asks before replacing a file you edited, and tells the plugin to compile or to ask you to.
- The plugin can report gameplay classes, enabled plugins, and the engine version. The app shows them and can put a short summary into Project Context.
- A version tag publishes one GitHub Release after the Windows, macOS, and Linux builds finish, so the later jobs no longer fail looking for a release that is not there yet.

## 1.11.0

- A .bbpack file is one zip of a manifest and content. Export a saved project, a lesson pack, or a graph template. Import it on another computer after a preview. A name that is already there can be renamed or replaced. The file is data. Nothing in it is run.
- Community is on the section bar. Listing packs from GitHub is off until a public repo is chosen. The tab explains that, shows how to submit a pack, and imports a local file. A bundled sample index is included.
- An imported pack can attach notes to a reference topic. References has a Community notes switch and shows the author.
- Home and Feedback list what is planned: the UE companion plugin, Mac signing, the community repo, and Linux packages.
- References has a Resources page for real Unreal projects and docs, with what to look at and a link that opens in the browser.
- The installer workflow also builds an unsigned macOS dmg and zip, and a Linux AppImage and deb. Those jobs are separate from the Windows installer.

## 1.10.0

- Play on the graph toolbar steps the open graph inside the app. Step, Run, Pause, and Stop are next to it. The active node glows and a pulse travels the execution wire. A watch lists variable values. Branch says which way it went. Loops count, and they stop at eight iterations. DoOnce, Gate, and FlipFlop remember their state. Server, client, multicast, and Has Authority nodes are tagged. No Unreal install is required.
- New from template adds Interact, Health & Damage, Door open/close, Pickup, Timer loop, and a Tactical FPS reload. Each node has a short note. Insert adds the graph to the one you have open. The other button opens it as a new function and creates the variables it needs.
- Copy for Unreal writes Blueprint clipboard text for the selection or the whole graph. Paste from Unreal reads that text back. Unknown nodes stay as labeled placeholders, and the panel says what will not translate. The text format is best effort.

## 1.9.0

- My Blueprint lists the event graph, functions, macros, and variables. Add, rename, or delete them. Double-click a function or macro to open it beside the event graph.
- A function has Entry and Return nodes, typed inputs and outputs, a Pure toggle, and BlueprintCallable. Call Function pins follow the signature. A variable has a type, a default, and replicated or RepNotify flags. Drag it on for Get or Set.
- Flow nodes cover ForEach, ForLoop, While, Select, Switch, DoOnce, Gate, and FlipFlop, plus math and comparisons. Collapse a selection into a function or a macro. Macros are inlined into the generated C++. Functions become UFUNCTIONs and variables become UPROPERTY fields. Manual C++ edits are still left alone.
- Loop-on-Tick, a costly Pure function used twice, a Cast inside a loop, and a While with no exit are flagged on the node. The tactical program asks you to split a messy graph into two functions and checks that you did.

## 1.8.0

- The event graph is editable. Search a palette grouped like Unreal, drag nodes on, move them, box or shift select, and delete, duplicate, or copy and paste. Undo and redo use Ctrl+Z, Ctrl+Y, and Ctrl+Shift+Z.
- Wires connect pin to pin. Execution pins are white and data pins use Unreal's type colors. A mismatched wire shows a red hint and is refused. Alt+click or the right-click menu removes a wire.
- The canvas zooms, pans, snaps to a grid, and has a minimap and comment boxes. The graph is stored on the project, so Compare and Restore include it.
- Editing the graph rewrites the matching C++ handlers. Manual edits are left in place, with Revert to generated when you want the graph written back.
- Wires snap to a pin, or to the first matching pin on a node. Comment and Explain this graph open inside the canvas. The canvas stays clipped, and a failed Unreal build shows the real error.
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
