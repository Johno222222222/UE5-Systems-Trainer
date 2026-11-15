#include "ProjectScan.h"
#include "CoreMinimal.h"
#include "Interfaces/IPluginManager.h"
#include "AssetRegistry/AssetRegistryModule.h"
#include "Engine/Blueprint.h"
#include "Misc/EngineVersion.h"
#include "Misc/App.h"
#include "Misc/Paths.h"
#include "Misc/FileHelper.h"
#include "HAL/FileManager.h"
#include "Dom/JsonObject.h"

static bool IsGameplay(const FString& Name, const FString& Parent)
{
	const FString Both = Name + Parent;
	return Both.Contains(TEXT("Actor")) || Both.Contains(TEXT("Component")) || Both.Contains(TEXT("Character"))
		|| Both.Contains(TEXT("Pawn")) || Both.Contains(TEXT("GameMode")) || Both.Contains(TEXT("GameState"))
		|| Both.Contains(TEXT("Controller")) || Both.Contains(TEXT("Interface"));
}

static bool AlreadyListed(const TArray<TSharedPtr<FJsonValue>>& Classes, const FString& Name)
{
	for (const TSharedPtr<FJsonValue>& Value : Classes)
	{
		const TSharedPtr<FJsonObject> Item = Value.IsValid() ? Value->AsObject() : nullptr;
		if (Item.IsValid() && Item->GetStringField(TEXT("name")) == Name) return true;
	}
	return false;
}

static void AddClass(TArray<TSharedPtr<FJsonValue>>& Classes, const FString& Name, const FString& Parent, const FString& Kind)
{
	if (Classes.Num() >= 24 || Name.IsEmpty() || AlreadyListed(Classes, Name)) return;
	if (!IsGameplay(Name, Parent)) return;
	TSharedRef<FJsonObject> Item = MakeShared<FJsonObject>();
	Item->SetStringField(TEXT("name"), Name);
	Item->SetStringField(TEXT("parent"), Parent);
	Item->SetStringField(TEXT("kind"), Kind);
	Classes.Add(MakeShared<FJsonValueObject>(Item));
}

static FString NextToken(const FString& Text, int32& Cursor)
{
	while (Cursor < Text.Len() && FChar::IsWhitespace(Text[Cursor])) Cursor++;
	const int32 Start = Cursor;
	while (Cursor < Text.Len() && (FChar::IsAlnum(Text[Cursor]) || Text[Cursor] == TCHAR('_'))) Cursor++;
	return Text.Mid(Start, Cursor - Start);
}

static void ScanHeaders(const FString& Root, TArray<TSharedPtr<FJsonValue>>& Classes)
{
	if (Root.IsEmpty() || !IFileManager::Get().DirectoryExists(*Root)) return;
	TArray<FString> Files;
	IFileManager::Get().FindFilesRecursive(Files, *Root, TEXT("*.h"), true, false);
	for (const FString& File : Files)
	{
		if (Classes.Num() >= 24) break;
		if (File.Contains(TEXT("/Intermediate/")) || File.Contains(TEXT("\\Intermediate\\"))) continue;
		FString Text;
		if (!FFileHelper::LoadFileToString(Text, *File)) continue;
		int32 Search = 0;
		while (Classes.Num() < 24)
		{
			const int32 Marker = Text.Find(TEXT("UCLASS"), ESearchCase::CaseSensitive, ESearchDir::FromStart, Search);
			if (Marker == INDEX_NONE) break;
			const int32 ClassKw = Text.Find(TEXT("class "), ESearchCase::CaseSensitive, ESearchDir::FromStart, Marker);
			if (ClassKw == INDEX_NONE || ClassKw - Marker > 500)
			{
				Search = Marker + 6;
				continue;
			}
			int32 Cursor = ClassKw + 6;
			const FString First = NextToken(Text, Cursor);
			const FString Second = NextToken(Text, Cursor);
			const bool bMacro = First.Contains(TEXT("_API"));
			const FString ClassName = bMacro ? Second : First;
			FString Parent;
			while (Cursor < Text.Len() && FChar::IsWhitespace(Text[Cursor])) Cursor++;
			if (Cursor < Text.Len() && Text[Cursor] == TCHAR(':'))
			{
				Cursor++;
				const FString Access = NextToken(Text, Cursor);
				Parent = (Access == TEXT("public") || Access == TEXT("protected") || Access == TEXT("private"))
					? NextToken(Text, Cursor) : Access;
				const int32 Angle = Parent.Find(TEXT("<"));
				if (Angle != INDEX_NONE) Parent = Parent.Left(Angle);
			}
			AddClass(Classes, ClassName, Parent, TEXT("C++"));
			Search = FMath::Max(Cursor, Marker + 6);
		}
	}
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
	ScanHeaders(FPaths::GameSourceDir(), Classes);
	ScanHeaders(FPaths::ProjectPluginsDir(), Classes);
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
		AddClass(Classes, Name, Parent, TEXT("Blueprint"));
	}
	Root->SetArrayField(TEXT("classes"), Classes);
	return Root;
}
