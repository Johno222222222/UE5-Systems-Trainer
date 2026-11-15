using UnrealBuildTool;

public class ArchitectCompanion : ModuleRules
{
	public ArchitectCompanion(ReadOnlyTargetRules Target) : base(Target)
	{
		PCHUsage = PCHUsageMode.UseExplicitOrSharedPCHs;
		PrivateDependencyModuleNames.AddRange(new string[]
		{
			"Core",
			"CoreUObject",
			"Engine",
			"UnrealEd",
			"Slate",
			"SlateCore",
			"HTTP",
			"Json",
			"Projects",
			"AssetRegistry",
			"InputCore",
			"ToolMenus"
		});
	}
}
