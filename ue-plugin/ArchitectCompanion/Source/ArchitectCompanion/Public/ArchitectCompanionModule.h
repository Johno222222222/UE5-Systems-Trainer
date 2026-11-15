#pragma once

#include "Modules/ModuleManager.h"

class FArchitectCompanionModule : public IModuleInterface
{
public:
	virtual void StartupModule() override;
	virtual void ShutdownModule() override;

private:
	void RegisterTab();
	void RegisterMenu();
	TSharedRef<class SDockTab> SpawnTab(const class FSpawnTabArgs& Args);
};
