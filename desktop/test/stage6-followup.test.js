"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { pathToFileURL } = require("url");
const { checkConstraints } = require("../constraints");
const { repairCommonCpp } = require("../repair");
const { modulesFor } = require("../modules");
const { parseCompilerOutput, windowsBuildLaunch, safePackageDir } = require("../engine");
const { writePlugin } = require("../pluginFiles");

test("No Tick ignores bCanEverTick = false and flags a real override", () => {
  const off = checkConstraints({
    cpp_header: "class UHealth : public UActorComponent { GENERATED_BODY() public: };",
    cpp_source: "UHealth::UHealth() { PrimaryComponentTick.bCanEverTick = false; }",
  }, ["no_tick"]);
  assert.deepEqual(off, []);
  const on = checkConstraints({
    cpp_header: "",
    cpp_source: "PrimaryComponentTick.bCanEverTick = true;",
  }, ["no_tick"]);
  assert.equal(on[0].id, "no_tick");
  const override = checkConstraints({
    cpp_header: "virtual void TickComponent(float DeltaTime, ELevelTick TickType, FActorComponentTickFunction* ThisTickFunction) override;",
    cpp_source: "void UHealth::TickComponent(float, ELevelTick, FActorComponentTickFunction*) {}",
  }, ["no_tick"]);
  assert.equal(override[0].id, "no_tick");
});

test("common generation misses get an implementation and Engine/World.h", () => {
  const repaired = repairCommonCpp({
    cpp_header: [
      "#include \"CoreMinimal.h\"",
      "UCLASS() class UDoor : public UActorComponent {",
      "  GENERATED_BODY()",
      "public:",
      "  UFUNCTION(BlueprintNativeEvent) void Open();",
      "};",
    ].join("\n"),
    cpp_source: "#include \"Door.h\"\nvoid UDoor::BeginPlay() { GetWorld(); }\n",
  });
  assert.match(repaired.cpp_source, /Engine\/World\.h/);
  assert.match(repaired.cpp_source, /UDoor::Open_Implementation\s*\(/);
  assert.ok(repaired.repair_notes.length >= 2);
  const again = repairCommonCpp(repaired);
  assert.equal(again.cpp_source, repaired.cpp_source);
});

test("Build.cs gains UMG when the code uses a widget", () => {
  const deps = modulesFor("class UHud : public UUserWidget {};");
  assert.ok(deps.modules.includes("UMG"));
  assert.ok(deps.modules.includes("Engine"));
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ue5-mod-"));
  const written = writePlugin(dir, {
    system_name: "Hud",
    cpp_header: "#include \"HudWidget.generated.h\"\nclass UHudWidget : public UUserWidget {};",
    cpp_source: "void UHudWidget::Show() {}",
  });
  const build = fs.readFileSync(path.join(dir, "Source", written.module, `${written.module}.Build.cs`), "utf8");
  assert.match(build, /"UMG"/);
});

test("compiler output maps a header line and keeps the RunUAT error", () => {
  const issues = parseCompilerOutput([
    "Running AutomationTool...",
    "C:/Projects/Plugin/Source/Hud/Public/HudWidget.h(8): Error: BlueprintNativeEvent Open is missing Open_Implementation",
    "HudWidget.cpp(14): error C2065: 'Nope': undeclared identifier",
    "ERROR: Missing module UMG",
    "HudWidget.cpp.obj : error LNK2019: unresolved external symbol Open_Implementation",
  ].join("\n"));
  const header = issues.find((item) => item.file === ".h");
  assert.equal(header.line, 8);
  assert.match(header.message, /Open_Implementation/);
  const source = issues.find((item) => item.message.includes("Nope"));
  assert.equal(source.file, ".cpp");
  assert.equal(source.line, 14);
  assert.ok(issues.some((item) => /Missing module UMG/.test(item.message)));
  assert.ok(issues.some((item) => /LNK2019/.test(item.message) || /unresolved external/.test(item.message)));
});

test("the Windows build command runs RunUAT.bat through cmd.exe", () => {
  const plugin = "C:\\Users\\borna\\AppData\\Roaming\\UE5 System Architect\\scratch\\Kit\\Kit.uplugin";
  const uat = "C:\\Program Files\\Epic Games\\UE_5.8\\Engine\\Build\\BatchFiles\\RunUAT.bat";
  const launch = windowsBuildLaunch({
    uat,
    pluginPath: plugin,
    packageDir: "C:\\ue5tmp\\ue5-uat-out",
  });
  assert.equal(launch.file, "cmd.exe");
  assert.equal(launch.options.shell, false);
  assert.equal(launch.options.windowsVerbatimArguments, true);
  assert.deepEqual(launch.args.slice(0, 3), ["/d", "/s", "/c"]);
  const line = launch.args[3];
  assert.equal(line.startsWith("\""), true);
  assert.equal(line.endsWith("\""), true);
  assert.match(line, /"C:\\Program Files\\Epic Games\\UE_5\.8\\Engine\\Build\\BatchFiles\\RunUAT\.bat"/);
  assert.match(line, /-Plugin="C:\\Users\\borna\\AppData\\Roaming\\UE5 System Architect\\scratch\\Kit\\Kit\.uplugin"/);
  assert.match(line, /-Package="C:\\ue5tmp\\ue5-uat-out"/);
  assert.match(line, /BuildPlugin/);
  const { commandFor } = require("../engine");
  const spec = commandFor("C:\\Program Files\\Epic Games\\UE_5.8", plugin, "C:\\ue5tmp\\out", "win32", "C:\\ue5tmp");
  assert.equal(spec.file, "cmd.exe");
  assert.equal(spec.options.shell, false);
  const packaged = safePackageDir("C:\\Unreal Projects\\out", "win32", "C:\\ue5tmp");
  assert.equal(/\s/.test(packaged), false);
  assert.equal(normalizeCheck(packaged), true);
  function normalizeCheck(value) {
    return !value.endsWith("\\") && !value.startsWith("\\\\");
  }
});

test("a manual edit is remembered and can be reverted or discarded for synthesis", async () => {
  const mod = await import(pathToFileURL(path.join(__dirname, "..", "..", "frontend", "src", "lib", "manualEdit.mjs")).href);
  const edited = mod.applyManualEdit({ cpp_header: "class A {};\n", cpp_source: "void A::Run() {}\n" }, ".h", "class A { int X; };\n");
  assert.equal(edited.manual_cpp, true);
  assert.match(edited.cpp_header, /int X/);
  assert.equal(edited.generated_cpp.header, "class A {};\n");
  const span = mod.lineSpan("a\nbc\n", 2);
  assert.equal(span.from, 2);
  assert.equal(span.to, 4);
  const reverted = mod.revertManualEdit(edited);
  assert.equal(reverted.manual_cpp, false);
  assert.equal(reverted.cpp_header, "class A {};\n");
  const kept = mod.synthesisAfterManual({ previous_system: { cpp_header: "class A { int X; };\n" } }, edited, "keep");
  assert.match(kept.previous_system.cpp_header, /int X/);
  const discarded = mod.synthesisAfterManual({ previous_system: { cpp_header: "class A { int X; };\n", cpp_source: "edited" } }, edited, "discard");
  assert.equal(discarded.previous_system.cpp_header, "class A {};\n");
});

test("CodeMirror is a frontend dependency so the editor is in the packaged build", () => {
  const pkg = require("../../frontend/package.json");
  assert.ok(pkg.dependencies["@codemirror/view"]);
  assert.ok(pkg.dependencies["@codemirror/lang-cpp"]);
  const editor = fs.readFileSync(path.join(__dirname, "..", "..", "frontend", "src", "components", "CppEditor.jsx"), "utf8");
  assert.match(editor, /@codemirror\/view/);
  assert.match(editor, /lineNumbers/);
});
