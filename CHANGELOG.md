# Changelog

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
