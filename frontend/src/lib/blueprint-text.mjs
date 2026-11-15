// Best-effort Unreal Blueprint clipboard text.
// The editor format is undocumented. This follows shapes that paste into UE 5.x
// (Begin Object Class=/Script/BlueprintGraph.K2Node_... with PinId and LinkedTo).
// Anything this app does not know becomes a placeholder, and the warnings say so.

import { createNode, pinSlug } from "./graph.mjs";

const PREFIX = "/Script/BlueprintGraph.";

const SPECS = {
  "begin-play": { cls: "K2Node_Event", event: "ReceiveBeginPlay", pins: [["Exec", "out", "then"]] },
  "end-play": { cls: "K2Node_Event", event: "ReceiveEndPlay", pins: [["Exec", "out", "then"]] },
  tick: { cls: "K2Node_Event", event: "ReceiveTick", pins: [["Exec", "out", "then"], ["Delta Seconds", "out", "DeltaSeconds"]] },
  "any-damage": { cls: "K2Node_Event", event: "ReceiveAnyDamage", pins: [["Exec", "out", "then"], ["Damage", "out", "Damage"]] },
  "point-damage": { cls: "K2Node_Event", event: "ReceivePointDamage", pins: [["Exec", "out", "then"], ["Damage", "out", "Damage"]] },
  "begin-overlap": { cls: "K2Node_Event", event: "ReceiveActorBeginOverlap", pins: [["Exec", "out", "then"], ["Other Actor", "out", "OtherActor"]] },
  "end-overlap": { cls: "K2Node_Event", event: "ReceiveActorEndOverlap", pins: [["Exec", "out", "then"], ["Other Actor", "out", "OtherActor"]] },
  hit: { cls: "K2Node_Event", event: "ReceiveHit", pins: [["Exec", "out", "then"], ["Other Actor", "out", "Other"]] },
  "enhanced-input": { cls: "K2Node_EnhancedInputAction", pins: [["Triggered", "out", "Triggered"], ["Value", "out", "ActionValue"]] },
  "custom-event": { cls: "K2Node_CustomEvent", pins: [["Exec", "out", "then"]] },
  branch: { cls: "K2Node_IfThenElse", pins: [["Exec", "in", "execute"], ["Condition", "in", "Condition"], ["Then", "out", "then"], ["Else", "out", "else"]] },
  sequence: { cls: "K2Node_ExecutionSequence", pins: [["Exec", "in", "execute"], ["Then 0", "out", "then_0"], ["Then 1", "out", "then_1"]] },
  "get-variable": { cls: "K2Node_VariableGet", pins: [["Value", "out", null]] },
  "set-variable": { cls: "K2Node_VariableSet", pins: [["Exec", "in", "execute"], ["Value", "in", null], ["Exec", "out", "then"]] },
  "print-string": { cls: "K2Node_CallFunction", fn: ["KismetSystemLibrary", "PrintString"], pins: [["Exec", "in", "execute"], ["In String", "in", "InString"], ["Exec", "out", "then"]] },
  "line-trace": { cls: "K2Node_CallFunction", fn: ["KismetSystemLibrary", "LineTraceByChannel"], pins: [["Exec", "in", "execute"], ["Exec", "out", "then"], ["Hit", "out", "ReturnValue"], ["Hit Actor", "out", "OutHit"]] },
  "interface-call": { cls: "K2Node_Message", pins: [["Exec", "in", "execute"], ["Target", "in", "self"], ["Exec", "out", "then"]] },
  add: { cls: "K2Node_CallFunction", fn: ["KismetMathLibrary", "Add_DoubleDouble"], pins: [["A", "in", "A"], ["B", "in", "B"], ["Result", "out", "ReturnValue"]] },
  subtract: { cls: "K2Node_CallFunction", fn: ["KismetMathLibrary", "Subtract_DoubleDouble"], pins: [["A", "in", "A"], ["B", "in", "B"], ["Result", "out", "ReturnValue"]] },
  multiply: { cls: "K2Node_CallFunction", fn: ["KismetMathLibrary", "Multiply_DoubleDouble"], pins: [["A", "in", "A"], ["B", "in", "B"], ["Result", "out", "ReturnValue"]] },
  divide: { cls: "K2Node_CallFunction", fn: ["KismetMathLibrary", "Divide_DoubleDouble"], pins: [["A", "in", "A"], ["B", "in", "B"], ["Result", "out", "ReturnValue"]] },
  clamp: { cls: "K2Node_CallFunction", fn: ["KismetMathLibrary", "FClamp"], pins: [["Value", "in", "Value"], ["Min", "in", "Min"], ["Max", "in", "Max"], ["Result", "out", "ReturnValue"]] },
  lerp: { cls: "K2Node_CallFunction", fn: ["KismetMathLibrary", "Lerp"], pins: [["A", "in", "A"], ["B", "in", "B"], ["Alpha", "in", "Alpha"], ["Result", "out", "ReturnValue"]] },
  equal: { cls: "K2Node_CallFunction", fn: ["KismetMathLibrary", "EqualEqual_DoubleDouble"], pins: [["A", "in", "A"], ["B", "in", "B"], ["Result", "out", "ReturnValue"]] },
  greater: { cls: "K2Node_CallFunction", fn: ["KismetMathLibrary", "Greater_DoubleDouble"], pins: [["A", "in", "A"], ["B", "in", "B"], ["Result", "out", "ReturnValue"]] },
  less: { cls: "K2Node_CallFunction", fn: ["KismetMathLibrary", "Less_DoubleDouble"], pins: [["A", "in", "A"], ["B", "in", "B"], ["Result", "out", "ReturnValue"]] },
  and: { cls: "K2Node_CallFunction", fn: ["KismetMathLibrary", "BooleanAND"], pins: [["A", "in", "A"], ["B", "in", "B"], ["Result", "out", "ReturnValue"]] },
  or: { cls: "K2Node_CallFunction", fn: ["KismetMathLibrary", "BooleanOR"], pins: [["A", "in", "A"], ["B", "in", "B"], ["Result", "out", "ReturnValue"]] },
  not: { cls: "K2Node_CallFunction", fn: ["KismetMathLibrary", "Not_PreBool"], pins: [["A", "in", "A"], ["Result", "out", "ReturnValue"]] },
  literal: { cls: "K2Node_CallFunction", fn: ["KismetSystemLibrary", "MakeLiteralDouble"], pins: [["Value", "out", "ReturnValue"]] },
  forloop: { cls: "K2Node_MacroInstance", macro: "ForLoop", pins: [["Exec", "in", "Exec"], ["First", "in", "FirstIndex"], ["Last", "in", "LastIndex"], ["Loop Body", "out", "LoopBody"], ["Index", "out", "Index"], ["Completed", "out", "Completed"]] },
  foreach: { cls: "K2Node_MacroInstance", macro: "ForEachLoop", pins: [["Exec", "in", "Exec"], ["Array", "in", "Array"], ["Loop Body", "out", "LoopBody"], ["Element", "out", "Array Element"], ["Completed", "out", "Completed"]] },
  while: { cls: "K2Node_MacroInstance", macro: "WhileLoop", pins: [["Exec", "in", "Exec"], ["Condition", "in", "Condition"], ["Loop Body", "out", "LoopBody"], ["Completed", "out", "Completed"]] },
  "do-once": { cls: "K2Node_MacroInstance", macro: "DoOnce", pins: [["Exec", "in", "Exec"], ["Reset", "in", "Reset"], ["Completed", "out", "Completed"]] },
  gate: { cls: "K2Node_MacroInstance", macro: "Gate", pins: [["Enter", "in", "Enter"], ["Open", "in", "Open"], ["Close", "in", "Close"], ["Exit", "out", "Exit"]] },
  flipflop: { cls: "K2Node_MacroInstance", macro: "FlipFlop", pins: [["Exec", "in", "Exec"], ["A", "out", "A"], ["B", "out", "B"], ["Is A", "out", "IsA"]] },
  delay: { cls: "K2Node_CallFunction", fn: ["KismetSystemLibrary", "Delay"], pins: [["Exec", "in", "execute"], ["Duration", "in", "Duration"], ["Completed", "out", "then"]] },
  "set-timer": { cls: "K2Node_CallFunction", fn: ["KismetSystemLibrary", "K2_SetTimerByEvent"], pins: [["Exec", "in", "execute"], ["Time", "in", "Time"], ["Exec", "out", "then"]] },
  timeline: { cls: "K2Node_Timeline", pins: [["Play", "in", "Play"], ["Update", "out", "Update"], ["Finished", "out", "Finished"], ["Alpha", "out", "Alpha"]] },
  "spawn-actor": { cls: "K2Node_SpawnActorFromClass", pins: [["Exec", "in", "execute"], ["Class", "in", "Class"], ["Exec", "out", "then"], ["Return Value", "out", "ReturnValue"]] },
  "cast-to": { cls: "K2Node_DynamicCast", pins: [["Exec", "in", "execute"], ["Object", "in", "Object"], ["Exec", "out", "then"], ["As", "out", "As"]] },
  "has-authority": { cls: "K2Node_CallFunction", fn: ["Actor", "HasAuthority"], pins: [["Exec", "in", "execute"], ["Exec", "out", "then"], ["Authority", "out", "ReturnValue"]] },
  "call-function": { cls: "K2Node_CallFunction", pins: [["Exec", "in", "execute"], ["Exec", "out", "then"]] },
  "call-user": { cls: "K2Node_CallFunction", pins: [["Exec", "in", "execute"], ["Exec", "out", "then"]] },
  "call-macro": { cls: "K2Node_MacroInstance", macro: "UserMacro", pins: [["Exec", "in", "execute"], ["Exec", "out", "then"]] },
  "server-rpc": { cls: "K2Node_CustomEvent", pins: [["Exec", "out", "then"]] },
  "client-rpc": { cls: "K2Node_CustomEvent", pins: [["Exec", "out", "then"]] },
  "multicast-rpc": { cls: "K2Node_CustomEvent", pins: [["Exec", "out", "then"]] },
};

const IMPORT_CLASS = new Map(Object.entries(SPECS).map(([catalog, spec]) => [spec.cls, catalog]));
const IMPORT_FN = new Map();
const IMPORT_MACRO = new Map();
const IMPORT_EVENT = new Map();
for (const [catalog, spec] of Object.entries(SPECS)) {
  if (spec.fn) IMPORT_FN.set(spec.fn[1], catalog);
  if (spec.macro) IMPORT_MACRO.set(spec.macro, catalog);
  if (spec.event) IMPORT_EVENT.set(spec.event, catalog);
}
IMPORT_FN.set("MakeLiteralFloat", "literal");
IMPORT_FN.set("MakeLiteralInt", "literal");
IMPORT_FN.set("MakeLiteralBool", "literal");
IMPORT_FN.set("MakeLiteralString", "literal");
IMPORT_FN.set("MakeLiteralName", "literal");

function guid(seed) {
  let h = 2166136261;
  const text = String(seed);
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const hex = (n) => (n >>> 0).toString(16).padStart(8, "0");
  return `${hex(h)}${hex(h ^ 0x9e3779b9)}${hex(Math.imul(h, 0x85ebca6b))}${hex(h ^ 0xc2b2ae35)}`.toUpperCase();
}

function pinCategory(type) {
  if (type === "exec") return ["exec", ""];
  if (type === "bool") return ["bool", ""];
  if (type === "int") return ["int", ""];
  if (type === "float") return ["real", "double"];
  if (type === "string") return ["string", ""];
  if (type === "name") return ["name", ""];
  if (type === "object") return ["object", ""];
  if (type === "vector") return ["struct", "/Script/CoreUObject.ScriptStruct'/Script/CoreUObject.Vector'"];
  return ["wildcard", ""];
}

function categoryToType(category, sub) {
  const cat = String(category || "").toLowerCase();
  const subcat = String(sub || "").toLowerCase();
  if (cat === "exec") return "exec";
  if (cat === "bool") return "bool";
  if (cat === "int" || cat === "byte") return "int";
  if (cat === "real" || cat === "float" || subcat.includes("double") || subcat.includes("float")) return "float";
  if (cat === "string") return "string";
  if (cat === "name") return "name";
  if (cat === "object" || cat === "class") return "object";
  if (cat === "struct" && subcat.includes("vector")) return "vector";
  if (cat === "struct" && subcat.includes("rotator")) return "rotator";
  return "wildcard";
}

function uePinName(node, spec, pin) {
  const row = (spec?.pins || []).find((item) => item[0] === pin.name && item[1] === pin.dir);
  if (row && row[2]) return row[2];
  if (node.catalog === "get-variable" && pin.name === "Value") return node.data?.variable || "Value";
  if (node.catalog === "set-variable" && pin.name === "Value") return node.data?.variable || "Value";
  return pin.name;
}

function literalFn(type) {
  if (type === "bool") return "MakeLiteralBool";
  if (type === "int") return "MakeLiteralInt";
  if (type === "string") return "MakeLiteralString";
  if (type === "name") return "MakeLiteralName";
  return "MakeLiteralDouble";
}

export function exportBlueprintText(graph, { nodeIds } = {}) {
  const warnings = [];
  const chosen = new Set(nodeIds || []);
  const nodes = (graph?.nodes || []).filter((node) => !chosen.size || chosen.has(node.id));
  const keep = new Set(nodes.map((node) => node.id));
  const wires = (graph?.wires || []).filter((wire) => keep.has(wire.from.node) && keep.has(wire.to.node));
  const names = new Map();
  nodes.forEach((node, index) => {
    const spec = SPECS[node.catalog];
    const cls = spec?.cls || "K2Node_Event";
    names.set(node.id, `${cls}_${index}`);
  });
  const pinIds = new Map();
  for (const node of nodes) {
    for (const pin of node.pins || []) pinIds.set(`${node.id}:${pin.id}`, guid(`${node.id}:${pin.id}`));
  }
  const blocks = nodes.map((node) => {
    const spec = SPECS[node.catalog];
    if (!spec) warnings.push(`${node.label} has no K2Node mapping. It is exported as a labeled placeholder.`);
    const cls = spec?.cls || "K2Node_Event";
    const name = names.get(node.id);
    const lines = [`Begin Object Class=${PREFIX}${cls} Name="${name}"`];
    if (spec?.event) lines.push(`   EventReference=(MemberParent=Class'"/Script/Engine.Actor"',MemberName="${spec.event}")`);
    if (node.catalog === "custom-event" || ROLES(node.catalog)) lines.push(`   CustomFunctionName="${node.data?.name || node.catalog}"`);
    if (node.catalog === "get-variable" || node.catalog === "set-variable") {
      lines.push(`   VariableReference=(MemberName="${node.data?.variable || "Value"}",bSelfContext=True)`);
    }
    if (node.catalog === "literal") lines.push(`   FunctionReference=(MemberParent=Class'"/Script/Engine.KismetSystemLibrary"',MemberName="${literalFn(node.data?.varType)}")`);
    else if (spec?.fn && node.catalog !== "call-function" && node.catalog !== "call-user") {
      lines.push(`   FunctionReference=(MemberParent=Class'"/Script/Engine.${spec.fn[0]}"',MemberName="${spec.fn[1]}")`);
    }
    if (node.catalog === "call-function" || node.catalog === "call-user") {
      lines.push(`   FunctionReference=(MemberName="${node.data?.function || node.label || "Function"}",bSelfContext=True)`);
    }
    if (node.catalog === "interface-call") lines.push(`   FunctionReference=(MemberName="${node.data?.function || "Interact"}",bSelfContext=True)`);
    if (spec?.macro || node.catalog === "call-macro") {
      const macro = node.catalog === "call-macro" ? (node.data?.function || "UserMacro") : spec.macro;
      lines.push(`   MacroGraphReference=(MacroGraph="/Engine/EditorBlueprintResources/StandardMacros.StandardMacros:${macro}")`);
    }
    if (node.catalog === "timeline") lines.push(`   TimelineName="${node.data?.name || "Timeline"}"`);
    lines.push(`   NodePosX=${Math.round(node.x || 0)}`);
    lines.push(`   NodePosY=${Math.round(node.y || 0)}`);
    lines.push(`   NodeGuid=${guid(node.id)}`);
    if (!spec) lines.push(`   NodeComment="${String(node.label || "Unknown").replace(/"/g, "'")}"`);
    for (const pin of node.pins || []) {
      const ueName = uePinName(node, spec, pin);
      const [category, sub] = pinCategory(pin.type);
      const links = wires.filter((wire) => (pin.dir === "out" ? wire.from.node === node.id && wire.from.pin === pin.id : wire.to.node === node.id && wire.to.pin === pin.id));
      const linked = links.map((wire) => {
        const otherId = pin.dir === "out" ? wire.to.node : wire.from.node;
        const otherPin = pin.dir === "out" ? wire.to.pin : wire.from.pin;
        return `${names.get(otherId)} ${pinIds.get(`${otherId}:${otherPin}`)}`;
      }).join(",");
      const linkedTo = linked ? `LinkedTo=(${linked},),` : "";
      const direction = pin.dir === "in" ? "EGPD_Input" : "EGPD_Output";
      lines.push(`   CustomProperties Pin (PinId=${pinIds.get(`${node.id}:${pin.id}`)},PinName="${ueName}",PinFriendlyName="${pin.name}",Direction="${direction}",PinType.PinCategory="${category}",PinType.PinSubCategory="${sub}",${linkedTo}PersistentGuid=00000000000000000000000000000000,bHidden=False,)`);
    }
    lines.push("End Object");
    return lines.join("\n");
  });
  if ((graph?.nodes || []).some((node) => !keep.has(node.id)) && chosen.size) {
    warnings.push("Wires that left the selection were left out.");
  }
  warnings.push("Blueprint clipboard text is best effort. Paste it into a UE 5.x graph and check the nodes Unreal does not recognise.");
  return { text: blocks.join("\n"), warnings };
}

function ROLES(catalog) {
  return catalog === "server-rpc" || catalog === "client-rpc" || catalog === "multicast-rpc";
}

function matchParens(text, openAt) {
  let depth = 0;
  for (let i = openAt; i < text.length; i += 1) {
    if (text[i] === "(") depth += 1;
    else if (text[i] === ")") {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function parsePins(body) {
  const pins = [];
  let cursor = 0;
  while (cursor < body.length) {
    const at = body.indexOf("CustomProperties Pin (", cursor);
    if (at < 0) break;
    const open = body.indexOf("(", at);
    const close = matchParens(body, open);
    if (close < 0) break;
    const inner = body.slice(open + 1, close);
    const grab = (name) => {
      const quoted = inner.match(new RegExp(`${name}="([^"]*)"`));
      if (quoted) return quoted[1];
      const plain = inner.match(new RegExp(`${name}=([^,\\)]+)`));
      return plain ? plain[1] : "";
    };
    const linkedRaw = inner.match(/LinkedTo=\(([^)]*)\)/);
    const links = linkedRaw ? linkedRaw[1].split(",").map((item) => item.trim()).filter(Boolean).map((item) => {
      const [nodeName, pinId] = item.split(/\s+/);
      return { nodeName, pinId };
    }) : [];
    pins.push({
      id: grab("PinId"),
      name: grab("PinName"),
      friendly: grab("PinFriendlyName"),
      dir: grab("Direction").includes("Input") ? "in" : "out",
      type: categoryToType(grab("PinType.PinCategory"), grab("PinType.PinSubCategory")),
      links,
    });
    cursor = close + 1;
  }
  return pins;
}

function parseObjects(text) {
  const objects = [];
  const marker = "Begin Object ";
  let cursor = 0;
  while (cursor < text.length) {
    const at = text.indexOf(marker, cursor);
    if (at < 0) break;
    const end = text.indexOf("End Object", at);
    if (end < 0) break;
    const body = text.slice(at, end);
    const header = body.match(/Class=(\S+)\s+Name="([^"]+)"/);
    const grab = (name) => {
      const quoted = body.match(new RegExp(`${name}="([^"]*)"`));
      if (quoted) return quoted[1];
      const plain = body.match(new RegExp(`${name}=([^\\s]+)`));
      return plain ? plain[1] : "";
    };
    objects.push({
      cls: header ? header[1].split(".").pop() : "K2Node_Event",
      name: header ? header[2] : `Node_${objects.length}`,
      member: (body.match(/MemberName="([^"]+)"/) || [])[1] || "",
      macro: (body.match(/StandardMacros:([A-Za-z0-9_]+)/) || [])[1] || "",
      variable: (body.match(/VariableReference=\(MemberName="([^"]+)"/) || [])[1] || "",
      custom: grab("CustomFunctionName"),
      x: Number(grab("NodePosX")) || 0,
      y: Number(grab("NodePosY")) || 0,
      comment: (body.match(/NodeComment="([^"]*)"/) || [])[1] || "",
      pins: parsePins(body),
    });
    cursor = end + "End Object".length;
  }
  return objects;
}

function catalogFor(object) {
  if (object.macro && IMPORT_MACRO.has(object.macro)) return IMPORT_MACRO.get(object.macro);
  if (object.member && IMPORT_FN.has(object.member)) return IMPORT_FN.get(object.member);
  if (object.member && IMPORT_EVENT.has(object.member)) return IMPORT_EVENT.get(object.member);
  if (object.cls === "K2Node_VariableGet") return "get-variable";
  if (object.cls === "K2Node_VariableSet") return "set-variable";
  if (object.cls === "K2Node_CustomEvent") {
    if (object.custom === "server-rpc") return "server-rpc";
    if (object.custom === "client-rpc") return "client-rpc";
    if (object.custom === "multicast-rpc") return "multicast-rpc";
    return "custom-event";
  }
  if (object.cls === "K2Node_CallFunction") return "call-function";
  if (object.cls === "K2Node_MacroInstance") return "call-macro";
  if (IMPORT_CLASS.has(object.cls) && object.cls !== "K2Node_CallFunction" && object.cls !== "K2Node_CustomEvent" && object.cls !== "K2Node_Event" && object.cls !== "K2Node_MacroInstance") {
    return IMPORT_CLASS.get(object.cls);
  }
  return "";
}

function ourPin(node, ueName, dir) {
  const spec = SPECS[node.catalog];
  const row = (spec?.pins || []).find((item) => (item[2] === ueName || item[0] === ueName) && item[1] === dir);
  if (row) return node.pins.find((pin) => pin.name === row[0] && pin.dir === dir);
  if ((node.catalog === "get-variable" || node.catalog === "set-variable") && (ueName === "Value" || ueName === node.data?.variable)) {
    return node.pins.find((pin) => pin.name === "Value" && pin.dir === dir) || null;
  }
  return node.pins.find((pin) => pin.name === ueName && pin.dir === dir) || null;
}

export function importBlueprintText(text) {
  const warnings = ["Blueprint clipboard text is best effort. Unknown nodes become placeholders."];
  const objects = parseObjects(String(text || ""));
  if (!objects.length) {
    warnings.push("No Begin Object blocks were found.");
    return { nodes: [], wires: [], warnings };
  }
  const nodes = [];
  const byName = new Map();
  objects.forEach((object, index) => {
    const catalog = catalogFor(object);
    let node;
    if (!catalog) {
      node = createNode("placeholder", object.x, object.y, {
        id: `bp_${index}`,
        label: object.comment || object.member || object.cls,
        data: { unrealClass: object.cls, function: object.member },
      });
      warnings.push(`${object.cls}${object.member ? ` ${object.member}` : ""} is not a node this app knows. It was kept as a placeholder.`);
    } else {
      const data = {};
      if (catalog === "get-variable" || catalog === "set-variable") {
        data.variable = object.variable || "Value";
        const pin = object.pins.find((item) => item.name === data.variable) || object.pins.find((item) => item.type !== "exec");
        data.varType = pin?.type && pin.type !== "wildcard" ? pin.type : "float";
      }
      if (catalog === "literal") {
        data.varType = object.member === "MakeLiteralBool" ? "bool" : object.member === "MakeLiteralInt" ? "int" : object.member === "MakeLiteralString" ? "string" : object.member === "MakeLiteralName" ? "name" : "float";
        data.value = data.varType === "bool" ? "false" : data.varType === "string" ? "" : "0";
      }
      if (catalog === "custom-event") data.name = object.custom || "CustomEvent";
      if (catalog === "call-function" || catalog === "call-user" || catalog === "interface-call") data.function = object.member || "Function";
      if (catalog === "print-string") data.text = "Hello";
      node = createNode(catalog, object.x, object.y, { id: `bp_${index}`, data, label: catalog === "call-function" ? data.function : undefined });
    }
    node._uePins = object.pins;
    node._ueName = object.name;
    nodes.push(node);
    byName.set(object.name, node);
  });
  const wires = [];
  const seen = new Set();
  for (const node of nodes) {
    for (const pin of node._uePins || []) {
      if (pin.dir !== "out") continue;
      const ours = ourPin(node, pin.friendly || pin.name, "out") || ourPin(node, pin.name, "out");
      if (!ours) continue;
      for (const link of pin.links) {
        const target = byName.get(link.nodeName);
        if (!target) continue;
        const targetUe = (target._uePins || []).find((item) => item.id === link.pinId);
        const targetPin = targetUe ? (ourPin(target, targetUe.friendly || targetUe.name, "in") || ourPin(target, targetUe.name, "in")) : null;
        if (!targetPin) {
          warnings.push(`A wire from ${node.label} could not find its pin.`);
          continue;
        }
        const key = `${node.id}:${ours.id}->${target.id}:${targetPin.id}`;
        if (seen.has(key)) continue;
        seen.add(key);
        wires.push({ id: `bpw_${wires.length}`, from: { node: node.id, pin: ours.id }, to: { node: target.id, pin: targetPin.id } });
      }
    }
  }
  const clean = nodes.map((node) => {
    const { _uePins, _ueName, ...rest } = node;
    return rest;
  });
  return { nodes: clean, wires, warnings };
}

export function pinSlugFor(dir, name) {
  return pinSlug(dir, name);
}
