"use strict";

// Includes that need a module in Build.cs. The plugin writer adds these so
// Unreal's build tool does not fail on a missing module.

const MODULE_RULES = [
  { re: /GameplayTag/, module: "GameplayTags" },
  { re: /UUserWidget|UMG|WidgetComponent|WidgetLayoutLibrary|WidgetBlueprintLibrary/, module: "UMG" },
  { re: /EnhancedInput|UInputAction|UInputMappingContext/, module: "EnhancedInput", plugin: "EnhancedInput" },
  { re: /AAIController|UBlackboard|UBehaviorTree|AIPerception/, module: "AIModule" },
  { re: /Niagara/, module: "Niagara", plugin: "Niagara" },
  { re: /AbilitySystem|UGameplayAbility|UAttributeSet|GameplayEffect/, module: "GameplayAbilities", plugin: "GameplayAbilities" },
  { re: /ChaosVehicle|WheeledVehicle/, module: "ChaosVehicles", plugin: "ChaosVehiclesPlugin" },
  { re: /DOREPLIFETIME|Replicated|NetMulticast/, module: "NetCore" },
  { re: /UNavigationSystemV1|UNavigationPath|NavigationSystem\.h/, module: "NavigationSystem" },
  { re: /UPhysicalMaterial|EPhysicalSurface|PhysicsCore/, module: "PhysicsCore" },
  { re: /\bEKeys::|FKey\b|InputCore/, module: "InputCore" },
  { re: /SNew\(|SWidget|Slate\//, module: "Slate" },
  { re: /UUserWidget|UMG|WidgetComponent|SNew\(|Slate/, module: "SlateCore" },
];

function modulesFor(code) {
  const modules = ["Core", "CoreUObject", "Engine"];
  const plugins = [];
  for (const rule of MODULE_RULES) {
    if (!rule.re.test(code || "")) continue;
    if (!modules.includes(rule.module)) modules.push(rule.module);
    if (rule.plugin && !plugins.includes(rule.plugin)) plugins.push(rule.plugin);
  }
  return { modules, plugins };
}

module.exports = { MODULE_RULES, modulesFor };
