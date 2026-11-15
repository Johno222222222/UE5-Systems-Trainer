#include "ArchitectCompanionModule.h"
#include "SArchitectPanel.h"
#include "ToolMenus.h"
#include "Widgets/Docking/SDockTab.h"
#include "Framework/Docking/TabManager.h"
#include "Framework/Commands/UIAction.h"
#include "Styling/SlateIcon.h"
#include "WorkspaceMenuStructure.h"
#include "WorkspaceMenuStructureModule.h"

static const FName ArchitectTabName("ArchitectCompanion");

void FArchitectCompanionModule::StartupModule()
{
	RegisterTab();
	UToolMenus::RegisterStartupCallback(FSimpleMulticastDelegate::FDelegate::CreateRaw(this, &FArchitectCompanionModule::RegisterMenu));
}

void FArchitectCompanionModule::ShutdownModule()
{
	if (FModuleManager::Get().IsModuleLoaded("ToolMenus"))
	{
		UToolMenus::UnregisterOwner(this);
	}
	FGlobalTabmanager::Get()->UnregisterNomadTabSpawner(ArchitectTabName);
}

void FArchitectCompanionModule::RegisterTab()
{
	FGlobalTabmanager::Get()->RegisterNomadTabSpawner(ArchitectTabName, FOnSpawnTab::CreateRaw(this, &FArchitectCompanionModule::SpawnTab))
		.SetDisplayName(NSLOCTEXT("ArchitectCompanion", "TabTitle", "Architect"))
		.SetTooltipText(NSLOCTEXT("ArchitectCompanion", "TabTip", "Link this project to UE5 System Architect on this computer."))
		.SetGroup(WorkspaceMenu::GetMenuStructure().GetToolsCategory());
}

void FArchitectCompanionModule::RegisterMenu()
{
	UToolMenu* Menu = UToolMenus::Get()->ExtendMenu("LevelEditor.MainMenu.Window");
	FToolMenuSection& Section = Menu->FindOrAddSection("Architect");
	Section.AddMenuEntry(
		"OpenArchitect",
		NSLOCTEXT("ArchitectCompanion", "Open", "Architect"),
		NSLOCTEXT("ArchitectCompanion", "OpenTip", "Open the Architect companion panel."),
		FSlateIcon(),
		FUIAction(FExecuteAction::CreateLambda([]()
		{
			FGlobalTabmanager::Get()->TryInvokeTab(ArchitectTabName);
		}))
	);
}

TSharedRef<SDockTab> FArchitectCompanionModule::SpawnTab(const FSpawnTabArgs& Args)
{
	return SNew(SDockTab)
		.TabRole(ETabRole::NomadTab)
		[
			SNew(SArchitectPanel)
		];
}

IMPLEMENT_MODULE(FArchitectCompanionModule, ArchitectCompanion)
