// What the export README tells you to expect the first time the plugin opens in Unreal.

export function unrealHandoff() {
  return [
    "## What to expect in Unreal",
    "The plugin compiles as its own module. After the editor opens, the classes appear when you add a component or pick a parent class. The graph in this app is not imported as a Blueprint asset. Copy for Unreal pastes the event graph once the C++ has built, and you connect the component into each Target pin.",
    "A blank C++ project on UE 5.8 is the target. The same plugin is written so it also builds on 5.7. Blueprint-only projects will offer to compile the plugin the first time you open them.",
    "",
    "## A minimal test map",
    "1. Make a blank C++ project, or open one you already have.",
    "2. Copy this plugin folder into `YourProject/Plugins/`. Create `Plugins` if it is missing.",
    "3. Right-click the .uproject and generate project files, then build.",
    "4. Open the editor. Add a third-person or empty map if the project has none.",
    "5. Place the project's default pawn, or a plain Character, and add the generated component to it.",
    "6. Press Play. You should see the component on the pawn and the defaults from the header. Nothing else in the level is required.",
    "",
    "## Common first errors",
    "- **The plugin is missing a module.** Generate project files again after the copy. The .uplugin and Source folder have to stay together.",
    "- **Generated.h is not last, or UBT cannot find the class.** Build from the editor or Unreal Build Tool once so Unreal Header Tool can write the generated header. Do not add that file by hand.",
    "- **Unresolved external or missing module.** The Build.cs dependencies listed in this README have to match the engine plugins the code includes. Enable those plugins if the editor asks.",
    "- **Live Coding is stuck on the old DLL.** Close the editor, build, then open the project. A hot reload often keeps the previous plugin.",
    "- **The class does not show in Add Component.** The module failed to load. Read the Output Log for the first error, then run Compile check in this app and use Fix.",
  ].join("\n");
}
