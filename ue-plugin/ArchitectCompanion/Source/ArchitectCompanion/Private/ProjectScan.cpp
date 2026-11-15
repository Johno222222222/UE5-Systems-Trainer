#include "ProjectScan.h"
#include "Interfaces/IPluginManager.h"
#include "AssetRegistry/AssetRegistryModule.h"
#include "Engine/Blueprint.h"
#include "Misc/EngineVersion.h"
#include "Misc/App.h"
#include "Dom/JsonObject.h"

static bool IsGameplay(const FString& Name, const FString& Parent)
{
	const FString Both = Name + Parent;
	return Both.Contains(TEXT("Actor")) || Both.Contains(TEXT("Component")) || Both.Contains(TEXT("Character"))
		|| Both.Contains(TEXT("Pawn")) || Both.Contains(TEXT("GameMode")) || Both.Contains(TEXT("GameState"))
		|| Both.Contains(TEXT("Controller")) || Both.Contains(TEXT("Interface"));
}

TSharedRef<FJsonObject> ProjectScan::Collect()
{
	TSharedRef<FJsonObject> Root = MakeShared<FJsonObject>();
	Root->SetStringField(TEXT("project"), FApp::GetProjectName());
	Root->SetStringField(TEXT("engine"), FEngineVersion::Current().ToString());
	TArray<TSharedPtr<FJsonValue>> Plugins;
	for (const TSharedRef<IPlugin>& Plugin : IPluginManager::Get().GetEnabledPlugins())
	{
		if (Plugins.Num() >= 12) break;
		Plugins.Add(MakeShared<FJsonValueString>(Plugin->GetName()));
	}
	Root->SetArrayField(TEXT("plugins"), Plugins);

	TArray<TSharedPtr<FJsonValue>> Classes;
	FAssetRegistryModule& Assets = FModuleManager::LoadModuleChecked<FAssetRegistryModule>("AssetRegistry");
	FARFilter Filter;
	Filter.ClassPaths.Add(UBlueprint::StaticClass()->GetClassPathName());
	Filter.bRecursivePaths = true;
	TArray<FAssetData> Found;
	Assets.Get().GetAssets(Filter, Found);
	for (const FAssetData& Asset : Found)
	{
		if (Classes.Num() >= 24) break;
		const FString Name = Asset.AssetName.ToString();
		FString Parent;
		Asset.GetTagValue(FName(TEXT("NativeParentClass")), Parent);
		if (Parent.IsEmpty()) Asset.GetTagValue(FName(TEXT("ParentClass")), Parent);
		if (!IsGameplay(Name, Parent)) continue;
		TSharedRef<FJsonObject> Item = MakeShared<FJsonObject>();
		Item->SetStringField(TEXT("name"), Name);
		Item->SetStringField(TEXT("parent"), Parent);
		Item->SetStringField(TEXT("kind"), TEXT("Blueprint"));
		Classes.Add(MakeShared<FJsonValueObject>(Item));
	}
	Root->SetArrayField(TEXT("classes"), Classes);
	return Root;
}
