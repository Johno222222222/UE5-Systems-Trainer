// UE requires the .h/.cpp names to match the "X.generated.h" include.
export function baseName(system) {
  const gen = (system.cpp_header || "").match(/#include\s+"([\w]+)\.generated\.h"/);
  if (gen) return gen[1];
  const cls = (system.cpp_header || "").match(/class\s+(?:\w+_API\s+)?[UAF]([A-Z]\w+)/);
  return cls ? cls[1] : (system.system_name || "System").replace(/[^A-Za-z0-9]/g, "");
}

export function headerClasses(header) {
  const code = (header || "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  return [...code.matchAll(/\b(?:class|struct)\s+(?:\w+_API\s+)?([UAFIE][A-Z]\w*)\s*(?:final\s*)?[:{]/g)].map((m) => m[1]);
}

export const moduleName = (system) => {
  const base = baseName(system);
  return `${base.replace(/Component$|System$|Subsystem$/, "") || base}Kit`;
};
