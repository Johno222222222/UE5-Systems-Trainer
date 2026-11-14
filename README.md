# UE5 System Architect

A desktop app for designing Unreal Engine 5 gameplay systems. You describe a system, and it builds an editable node graph, Blueprint pseudocode with WHY notes, C++ header and source, a setup guide, tuning sliders, a compile check, version history, and Unreal plugin export.

It runs on your computer. The only time it uses the internet is when it asks Gemini or OpenAI to generate or review something, using a key you provide.

## Install on Windows

1. Open the latest [GitHub Release](https://github.com/Johno222222222/blueprint-builder/releases) and download the Windows installer, or use the latest successful **Desktop installer** run on this repository's GitHub Actions page and download the artifact named `ue5-system-architect-windows`.
2. Unzip the artifact if you used Actions. A Release file is the installer itself.
3. Run the installer (`UE5 System Architect Setup ….exe`).
4. Windows may say the app is unrecognized. That is because this installer is not code-signed. Choose **More info**, then **Run anyway**, if you trust the build.
5. Start **UE5 System Architect** from the Start menu. It opens straight into the workspace. There is no account and no sign-in.

Your projects are stored on this PC, in the app data folder. Open **Settings** (the key button in the top bar) and use **Open folder** to see it. On Windows that folder is usually:

`C:\Users\YourName\AppData\Roaming\UE5 System Architect`

## Add an API key

1. Click **Add AI key** (it becomes **Settings** after a key is saved).
2. Pick **Google Gemini** or **OpenAI**, then a model.
   - A free Gemini key is the easiest start. Gemini 3.5 Flash-Lite is the recommended model.
   - OpenAI models need a paid key or credits.
3. Paste the key.
   - Gemini keys come from [Google AI Studio](https://aistudio.google.com/app/apikey).
   - OpenAI keys come from [platform.openai.com/api-keys](https://platform.openai.com/api-keys).
4. Click **Test key**, then **Save**.

The key stays on this computer. When Windows can protect it, the app uses Windows data protection (tied to your Windows user). It is not put inside project files, and it is not sent anywhere except to the provider you picked, from this app.

You can save one Gemini key and one OpenAI key and switch between them. Changing the model does not require pasting the key again.

## Everyday use

- **New** clears the workspace. If you have unsaved work it asks Save, Discard, or Cancel. Cancel changes nothing. "Keep my project context" is off unless you tick it. The API key and model stay. The next Save creates a new project, not a version of the one you just left.
- Pick a template while a project is open and the app asks before replacing it. **Start a new project** so Save does not add a version to the open project.
- **Target Unreal** (under the description) is UE 5.8 by default. 5.4 through 5.7 are selectable. It is saved with the project. An older project with no version opens as 5.4, which is what those systems were written for.
- Ticks on the Setup Guide are saved with the project.
- Settings has **Clear remembered project context**. That forgets the box on this computer. Saved projects keep their own context.
- **Feedback** opens a new GitHub issue with the app version and a category. Nothing is emailed.
- Describe a system on the left and press **Synthesize**. Templates are starting points.
- Edit sliders, modules, and notes, then regenerate. The Compare tab shows what changed.
- **Save project** keeps a version. History can name a version, compare against it, or restore it. Restoring adds a new version, so older ones stay.
- **JSON** downloads the system you are looking at. **Backup** in the Projects list downloads every project, its version history, and bundle presets as one file. **Import** accepts either kind of file.
- **UE5 .zip** builds an Unreal plugin (recommended) or source files only. Copy for Unreal, tests, and Data Table tuning files are in that export.
- Tick two or more projects to **Stack** them into one system, or **Bundle** them as one plugin. Bundle presets remember a group.
- The number on the usage chip is a local estimate of today's requests for the free Gemini models. It is not a bill, and it does not see use of the same key outside this app.

Copying the data folder to another PC copies your projects. A key protected by Windows does not unlock on a different PC or Windows user, so enter the key again there. Uploaded reference files live in that folder and are not inside the JSON backup.

## Build the installer yourself

You need [Node.js 22](https://nodejs.org/) and [Yarn 1](https://classic.yarnpkg.com/). Git must be installed if you are cloning the repository.

From the project folder, in PowerShell:

```powershell
cd frontend
yarn install --frozen-lockfile
yarn build
cd ..
npm ci
npx electron-builder --win nsis --publish never
```

The installer is written to the `release` folder.

To just run the app while you are working on it:

```powershell
cd frontend
yarn build
cd ..
npm ci
npm start
```

Mac and Linux use the same steps, with `npx electron-builder --mac dmg --publish never` or `npx electron-builder --linux AppImage --publish never`. Those installers are not built in GitHub Actions yet. The app code uses `path.join` for files and the operating system's own key store when it is available (Windows data protection, macOS Keychain, or the Linux keyring), so a later Mac or Linux build is not blocked.

GitHub Actions builds the Windows installer on every push and pull request (see `.github/workflows/desktop-installer.yml`) and uploads it as an artifact. Pushing a version tag such as `v1.1.0` also attaches that installer to a GitHub Release. Set `package.json` `"version"` to the same number before you tag, because the in-app update check compares that version with the latest Release. The repository is private, so the check does nothing if GitHub does not answer. Do not commit signing secrets. Code signing is left as a TODO in the workflow for Azure Artifact Signing.

**Feedback** in the top bar opens a new GitHub issue with the app version and a category. It does not send email.

## How it is put together

```
Electron window
  └─ local Node server (127.0.0.1 only)
       ├─ React workspace (the existing UI, built into frontend/build)
       ├─ library.json          projects, versions, presets, usage
       ├─ secrets.json          encrypted API keys
       └─ files/                uploads
```

The window is Electron because it keeps this React UI and produces a normal Windows installer. The old Python service is not bundled. That service needed MongoDB, accounts, and hosted file storage. The behavior you use (generate, review, fix, tests, projects, versions, files, presets) now lives in `desktop/` and runs in the same process as the window, so a Windows user does not install Python.

| Piece | Where | What to edit |
| --- | --- | --- |
| Workspace UI | `frontend/src` | Screens, graph, export zip, compile check |
| Local API | `desktop/server.js` | Projects, versions, files, jobs |
| AI providers | `desktop/llm.js` | How a provider is called |
| Prompts and patching | `desktop/logic.js` | The system prompt, review, fix, and test prompts |
| Saved data | `desktop/store.js`, `desktop/secrets.js` | JSON library and key encryption |
| App shell | `desktop/main.js` | Window, menus, OS key store |
| Model list in Settings | `frontend/src/components/AiKeyModal.jsx` | Labels the user sees |

To add a provider later (for example another paid model):

1. Add its id and model ids in `ALLOWED_MODELS` inside `desktop/logic.js`.
2. Teach `requestFor()` in `desktop/llm.js` how to call that provider's HTTP API. `complete()` is the only function the rest of the app uses.
3. Add the same models to `PROVIDERS` in `AiKeyModal.jsx`, including whether each one is free or paid.

Keys are read only in the desktop process. The workspace sends the provider and model. A key typed into Settings is sent once, over localhost, so it can be encrypted. After that the page does not keep it.

`npm test` runs the local API tests, including mocked Gemini and OpenAI calls. No real key is required, and keys should never be committed. Setting `UE5_STUB_LLM=1` makes the local server answer with a fixed sample system instead of calling a provider. That is only for development checks.
