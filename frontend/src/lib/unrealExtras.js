import { baseName, headerClasses, moduleName } from "./zipExport.js";

// Unreal Editor clipboard (T3D) text for the Event Graph; UE 5.3–5.5
const guid = () => Array.from({ length: 32 }, () => "0123456789ABCDEF"[Math.floor(Math.random() * 16)]).join("");
const clean = (s) => String(s || "").replace(/["\\\r\n]/g, " ").trim();
const ident = (s) => clean(s).replace(/^(Event|Call|Get|Set)\s+/i, "").replace(/[^A-Za-z0-9_]/g, "");

const ENGINE_EVENTS = {
  beginplay: ["/Script/Engine.Actor", "ReceiveBeginPlay"],
  endplay: ["/Script/Engine.Actor", "ReceiveEndPlay"],
  tick: ["/Script/Engine.Actor", "ReceiveTick"],
  takeanydamage: ["/Script/Engine.Actor", "ReceiveAnyDamage"],
  anydamage: ["/Script/Engine.Actor", "ReceiveAnyDamage"],
  actorbeginoverlap: ["/Script/Engine.Actor", "ReceiveActorBeginOverlap"],
};
const LIB_CALLS = {
  delay: ["/Script/Engine.KismetSystemLibrary", "Delay"],
  printstring: ["/Script/Engine.KismetSystemLibrary", "PrintString"],
};

function mapNode(n, ctx) {
  const label = clean(n.label);
  const key = ident(label).toLowerCase();
  const type = (n.node_type || "").toLowerCase();
  if (type === "event" || /^event\s/i.test(label)) {
    const ev = ENGINE_EVENTS[key];
    return ev
      ? { cls: "K2Node_Event", props: [`EventReference=(MemberParent=Class'"${ev[0]}"',MemberName="${ev[1]}")`, "bOverrideFunction=True"], out: ["then"] }
      : { cls: "K2Node_CustomEvent", props: [`CustomFunctionName="${ident(label) || "CustomEvent"}"`], out: ["then"] };
  }
  if (/^branch$|^if\b/i.test(label) || type === "branch") return { cls: "K2Node_IfThenElse", props: [], in: ["execute", "Condition"], out: ["then", "else"] };
  if (/^sequence$/i.test(label) || type === "sequence") return { cls: "K2Node_ExecutionSequence", props: [], in: ["execute"], out: ["then_0", "then_1", "then_2"] };
  if (LIB_CALLS[key]) return { cls: "K2Node_CallFunction", props: [`FunctionReference=(MemberParent=Class'"${LIB_CALLS[key][0]}"',MemberName="${LIB_CALLS[key][1]}")`], in: ["execute"], out: ["then"] };
  const name = ident(label);
  if (/^(get|set)\s/i.test(label) && ctx.props.has(name)) {
    const set = /^set\s/i.test(label);
    return { cls: set ? "K2Node_VariableSet" : "K2Node_VariableGet", props: [`VariableReference=(MemberParent=Class'"${ctx.classPath}"',MemberName="${name}")`], in: set ? ["execute"] : [], out: set ? ["then"] : [] };
  }
  if (ctx.funcs.has(name)) return { cls: "K2Node_CallFunction", props: [`FunctionReference=(MemberParent=Class'"${ctx.classPath}"',MemberName="${name}")`], in: ["execute"], out: ["then"] };
  return null;
}

export function blueprintClipboard(system, module = null) {
  const nodes = system?.node_graph_nodes || [];
  const header = system?.cpp_header || "";
  const cls = headerClasses(header).find((c) => /^[UA]/.test(c)) || `U${baseName(system)}`;
  const ctx = {
    classPath: `/Script/${module || moduleName(system)}.${cls.slice(1)}`,
    funcs: new Set([...header.matchAll(/UFUNCTION\s*\([^)]*\)\s*(?:[\w<>,*&:]+[\s*&]+)*?(\w+)\s*\(/g)].map((m) => m[1])),
    props: new Set([...header.matchAll(/UPROPERTY\s*\((?:[^()]|\([^()]*\))*\)\s*(?:[\w<>,*&:]+[\s*&]+)+?(\w+)\s*[;={]/g)].map((m) => m[1])),
  };
  const built = nodes.map((n, i) => ({ n, map: mapNode(n, ctx), name: "", pins: {} })).map((b, i) => {
    b.name = b.map ? `${b.map.cls}_${i}` : `EdGraphNode_Comment_${i}`;
    return b;
  });
  const byId = Object.fromEntries(built.map((b) => [b.n.id, b]));
  const pin = (b, pinName) => (b.pins[pinName] = b.pins[pinName] || { id: guid(), links: [] });
  const outUsed = {};
  (system?.node_graph_edges || []).filter((e) => (e.kind || "exec") === "exec").forEach((e) => {
    const a = byId[e.from_node];
    const z = byId[e.to_node];
    if (!a?.map || !z?.map || !a.map.out?.length || !(z.map.in || []).includes("execute")) return;
    const k = (outUsed[a.name] = (outUsed[a.name] || 0) + 1) - 1;
    const outName = a.map.out[Math.min(k, a.map.out.length - 1)];
    const o = pin(a, outName);
    const inp = pin(z, "execute");
    o.links.push(`${z.name} ${inp.id}`);
    inp.links.push(`${a.name} ${o.id}`);
  });
  let mapped = 0;
  const text = built.map((b) => {
    const x = Math.round(b.n.x || 0) * 2;
    const y = Math.round(b.n.y || 0) * 2;
    if (!b.map) {
      return [`Begin Object Class=/Script/UnrealEd.EdGraphNode_Comment Name="${b.name}"`, `   NodePosX=${x}`, `   NodePosY=${y}`, "   NodeWidth=320", "   NodeHeight=96",
        `   NodeComment="TODO (not auto-mapped): ${clean(b.n.label)}${b.n.node_type ? ` [${clean(b.n.node_type)}]` : ""}"`, `   NodeGuid=${guid()}`, "End Object"].join("\r\n");
    }
    mapped += 1;
    const pins = Object.entries(b.pins).map(([pn, p]) => {
      const dir = (b.map.in || []).includes(pn) ? "" : ',Direction="EGPD_Output"';
      return `   CustomProperties Pin (PinId=${p.id},PinName="${pn}"${dir},PinType.PinCategory="exec",LinkedTo=(${p.links.map((l) => `${l},`).join("")}),)`;
    });
    return [`Begin Object Class=/Script/BlueprintGraph.${b.map.cls} Name="${b.name}"`, ...b.map.props.map((p) => `   ${p}`), `   NodePosX=${x}`, `   NodePosY=${y}`, `   NodeGuid=${guid()}`, ...pins, "End Object"].join("\r\n");
  }).join("\r\n");
  return { text: `${text}\r\n`, mapped, total: nodes.length, classPath: ctx.classPath };
}

const pascal = (k) => String(k).split(/[^A-Za-z0-9]+/).filter(Boolean).map((w) => w[0].toUpperCase() + w.slice(1)).join("");

export function tuningFiles(system, module) {
  const params = (system?.tunable_parameters || []).filter((p) => typeof p.value === "number");
  if (!params.length) return null;
  const base = baseName(system).replace(/Component$/, "");
  const row = `F${base}TuningRow`;
  const lib = `U${base}TuningLibrary`;
  const cols = params.map((p) => ({ name: pascal(p.key || p.label), value: p.value, label: p.label, unit: p.unit }));
  const csv = [`---,${cols.map((c) => c.name).join(",")}`, `Default,${cols.map((c) => c.value).join(",")}`].join("\n") + "\n";
  const h = `#pragma once

#include "CoreMinimal.h"
#include "Engine/DataTable.h"
#include "Kismet/BlueprintFunctionLibrary.h"
#include "${base}TuningRow.generated.h"

// One row of designer-tunable values. Import ${base}_Tuning.csv with this row struct.
USTRUCT(BlueprintType)
struct ${row} : public FTableRowBase
{
\tGENERATED_BODY()

${cols.map((c) => `\t// ${c.label}${c.unit ? ` (${c.unit})` : ""}\n\tUPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Tuning")\n\tfloat ${c.name} = ${Number(c.value).toFixed(Number.isInteger(c.value) ? 1 : 3)}f;`).join("\n\n")}
};

UCLASS()
class ${module.toUpperCase()}_API ${lib} : public UBlueprintFunctionLibrary
{
\tGENERATED_BODY()

public:
\t// Copies each column of the row onto the Target property with the same name (float, double or int). Returns how many were set.
\tUFUNCTION(BlueprintCallable, Category = "Tuning")
\tstatic int32 ApplyTuningRow(UObject* Target, UDataTable* Table, FName RowName = TEXT("Default"));
};
`;
  const cpp = `#include "${base}TuningRow.h"

int32 ${lib}::ApplyTuningRow(UObject* Target, UDataTable* Table, FName RowName)
{
\tif (!Target || !Table || Table->GetRowStruct() != ${row}::StaticStruct())
\t{
\t\treturn 0;
\t}
\tconst uint8* Row = Table->FindRowUnchecked(RowName);
\tif (!Row)
\t{
\t\treturn 0;
\t}
\tint32 Count = 0;
\tfor (TFieldIterator<FNumericProperty> It(${row}::StaticStruct()); It; ++It)
\t{
\t\tFNumericProperty* Dest = CastField<FNumericProperty>(Target->GetClass()->FindPropertyByName(It->GetFName()));
\t\tif (!Dest)
\t\t{
\t\t\tcontinue;
\t\t}
\t\tconst void* Src = It->ContainerPtrToValuePtr<void>(Row);
\t\tconst double Value = It->IsFloatingPoint() ? It->GetFloatingPointPropertyValue(Src) : static_cast<double>(It->GetSignedIntPropertyValue(Src));
\t\tvoid* DestPtr = Dest->ContainerPtrToValuePtr<void>(Target);
\t\tif (Dest->IsFloatingPoint())
\t\t{
\t\t\tDest->SetFloatingPointPropertyValue(DestPtr, Value);
\t\t}
\t\telse
\t\t{
\t\t\tDest->SetIntPropertyValue(DestPtr, static_cast<int64>(FMath::RoundToInt(Value)));
\t\t}
\t\t++Count;
\t}
\treturn Count;
}
`;
  const setup = [
    "## Tuning Data Table (no recompiling)",
    "",
    `1. In the Content Browser, Import \`Data/${base}_Tuning.csv\` and pick **${row.slice(1)}** as the row structure. Name it \`DT_${base}Tuning\`.`,
    `2. In the owning actor's BeginPlay (or the component's), call **Apply Tuning Row** with Target = the component, Table = \`DT_${base}Tuning\`, Row = \`Default\`.`,
    "3. Edit the numbers in the Data Table and press Play. Columns that match a property name are applied; the code keeps its built-in defaults when no table is assigned.",
    "",
    `Columns: ${cols.map((c) => `\`${c.name}\``).join(", ")}.`,
  ].join("\n");
  return { base, csv, h, cpp, setup };
}

const day = () => new Date().toISOString().slice(0, 10);
const line = (i) => `- **${i.severity === "error" ? "Error" : "Warning"}** \`${i.file || ""}${i.line ? `:${i.line}` : ""}\` ${i.message}${i.fix ? `\n  - Suggested fix: ${i.fix}` : ""}`;

// report: {issues, ignored: [{file, message, by}], fixes: [entry], aiModel}
export function reportSection(title, r) {
  const out = [`## ${title}`, ""];
  const errs = (r.issues || []).filter((i) => i.severity === "error").length;
  out.push(`Status: ${errs ? `${errs} error(s)` : "no errors"}, ${(r.issues || []).length - errs} warning(s), ${(r.ignored || []).length} ignored.`, "");
  out.push("### Current issues", "", ...((r.issues || []).length ? r.issues.map(line) : ["None found."]), "");
  out.push("### Ignored issues", "", ...((r.ignored || []).length ? r.ignored.map((i) => `- \`${i.file || ""}\` ${i.message}${i.by ? ` (ignored by ${i.by})` : ""}`) : ["None."]), "");
  if (r.fixes) out.push("### Fixes applied since the last save", "", ...(r.fixes.length ? r.fixes.flatMap((f) => f.changes.map((c) => `- ${new Date(f.at).toLocaleString()}: \`${c.file}\` ${c.why || "edit"}`)) : ["None."]), "");
  return out.join("\n");
}

export function compileReport(sections, aiModel) {
  return [
    "# Compile report",
    "",
    `Generated by UE5 Systems Training Tool/Generator on ${day()}. AI review: ${aiModel ? `run with ${aiModel}` : "not run for this export"}.`,
    "",
    "_This is the app's pattern check (plus AI review if run), not an actual Unreal build. Build once in Unreal to be sure._",
    "",
    ...sections,
  ].join("\n");
}
