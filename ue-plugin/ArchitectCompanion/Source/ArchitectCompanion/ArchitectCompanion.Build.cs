using UnrealBuildTool;

public class ArchitectCompanion : ModuleRules
{
	public ArchitectCompanion(ReadOnlyTargetRules Target) : base(Target)
	{
		PCHUsage = PCHUsageMode.UseExplicitOrSharedPCHs;
		if (!Target.bBuildEditor)
		{
			throw new BuildException("ArchitectCompanion is editor-only and is not part of a game build.");
		}
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
			"ToolMenus",
			"WorkspaceMenuStructure",
			"AssetTools",
			"Kismet",
			"KismetCompiler",
			"BlueprintGraph"
		});
	}
}
