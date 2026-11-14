# Compile baseline

This is how to record how many of the 10 bench prompts compile the first time in a blank Unreal Engine 5.8 C++ project. The app does not compile anything itself. You run Unreal on your Windows PC and write down the score.

The prompts are in `bench/prompts.json`. Eight of them are the built-in templates. The other two are a tactical FPS weapon and a GAS character. Copy `bench/results-template.csv` when you want a sheet to fill in. Do not change a prompt between the run you are scoring and the notes you keep.

## Before you start

1. Install this app and add a Gemini or OpenAI key in Settings.
2. Set **Target Unreal** to **UE 5.8**.
3. In the Epic Launcher, create a new **Games → Blank** project. Choose **C++**, desktop, no starter content. Name it something like `ArchitectBench`.
4. Open the `.uproject` once so the IDE project exists, then close the editor.
5. For the GAS character prompt only, enable the **GameplayAbilities** plugin before you build that one (Edit → Plugins). The other nine prompts should not need extra plugins.

## One prompt

Do this once per row. Do not press Fix, Fix & regenerate, or AI review before the first compile. Those are not part of the first-try number.

1. In the app, press **New**. Discard if it asks. Leave **Keep my project context** off.
2. Paste the prompt from `bench/prompts.json` into the synthesizer. Set the class dropdown to that prompt's `default_class`.
3. Press **Synthesize** once. Wait until it finishes.
4. Export **UE5 .zip → Unreal plugin**.
5. Copy the plugin folder into `ArchitectBench/Plugins/`.
6. Build `ArchitectBench` (Build in the IDE, or the editor's compile). Do not hand-edit the generated files first.
7. In the sheet, mark `compiled_first_try` as `yes` or `no`. If it failed, paste the first compiler error into `notes`.

Then delete that plugin folder (or use a fresh copy of the blank project) before the next prompt, so one system's files cannot make the next one compile or fail.

## The number

Count the `yes` rows. That count out of 10 is the baseline, for example `6/10 compiled first try on UE 5.8`. Write the date, the app version (Settings does not show it; it is on the window title's Feedback menu, and in `package.json`), and the model you used next to the sheet.

A later run uses the same 10 prompts, the same blank C++ project type, and the same "no fixes before the first compile" rule. Compare the new count with this one.
