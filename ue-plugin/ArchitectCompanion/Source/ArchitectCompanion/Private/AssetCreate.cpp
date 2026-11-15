#include "AssetCreate.h"

#include "AssetRegistry/AssetRegistryModule.h"
#include "AssetToolsModule.h"
#include "DataTableEditorUtils.h"
#include "Dom/JsonObject.h"
#include "EdGraph/EdGraph.h"
#include "EdGraphNode_Comment.h"
#include "EdGraphSchema_K2.h"
#include "Editor.h"
#include "Engine/Blueprint.h"
#include "Engine/BlueprintGeneratedClass.h"
#include "Engine/DataAsset.h"
#include "Engine/DataTable.h"
#include "Factories/DataAssetFactory.h"
#include "Factories/DataTableFactory.h"
#include "Kismet2/BlueprintEditorUtils.h"
#include "Kismet2/KismetEditorUtilities.h"
#include "Misc/PackageName.h"
#include "ObjectTools.h"
#include "ScopedTransaction.h"
#include "Subsystems/AssetEditorSubsystem.h"
#include "UObject/SavePackage.h"

static FString Bare(const FString& Name)
{
	if (Name.Len() > 1 && (Name[0] == TCHAR('U') || Name[0] == TCHAR('A') || Name[0] == TCHAR('F')) && FChar::IsUpper(Name[1]))
	{
		return Name.RightChop(1);
	}
	return Name;
}

static UObject* FindNative(UClass* Kind, const FString& Module, const FString& Name)
{
	if (Module.IsEmpty() || Name.IsEmpty()) return nullptr;
	const FString Path = FString::Printf(TEXT("/Script/%s.%s"), *Module, *Bare(Name));
	return StaticFindObject(Kind, nullptr, *Path);
}

static bool AllowedFolder(const FString& Folder)
{
	return Folder.StartsWith(TEXT("/Game/")) && !Folder.Contains(TEXT("..")) && !Folder.Contains(TEXT("\\"));
}

static void ApplyValue(const UStruct* Type, uint8* Container, const FString& Name, const FString& Value)
{
	if (!Type || !Container) return;
	FProperty* Prop = Type->FindPropertyByName(*Name);
	if (!Prop) return;
	if (FBoolProperty* Bool = CastField<FBoolProperty>(Prop))
	{
		Bool->SetPropertyValue_InContainer(Container, Value == TEXT("true") || Value == TEXT("1"));
		return;
	}
	if (FNumericProperty* Number = CastField<FNumericProperty>(Prop))
	{
		Number->SetNumericPropertyValueFromString(Prop->ContainerPtrToValuePtr<void>(Container), *Value);
		return;
	}
	if (FStrProperty* String = CastField<FStrProperty>(Prop))
	{
		String->SetPropertyValue_InContainer(Container, Value);
		return;
	}
	if (FNameProperty* NameProp = CastField<FNameProperty>(Prop))
	{
		NameProp->SetPropertyValue_InContainer(Container, FName(*Value));
	}
}

static void ReadValues(const TSharedPtr<FJsonObject>& Object, TArray<TPair<FString, FString>>& Out)
{
	if (!Object.IsValid()) return;
	for (const TPair<FString, TSharedPtr<FJsonValue>>& Pair : Object->Values)
	{
		Out.Add(TPair<FString, FString>(Pair.Key, Pair.Value.IsValid() ? Pair.Value->AsString() : TEXT("")));
	}
}

static bool SaveAsset(UObject* Asset, FString& OutMessage)
{
	if (!Asset) return false;
	UPackage* Package = Asset->GetOutermost();
	Package->MarkPackageDirty();
	const FString Filename = FPackageName::LongPackageNameToFilename(Package->GetName(), FPackageName::GetAssetPackageExtension());
	FSavePackageArgs Args;
	Args.TopLevelFlags = RF_Public | RF_Standalone;
	if (!UPackage::SavePackage(Package, Asset, *Filename, Args))
	{
		OutMessage = TEXT("The asset was created but the package did not save.");
		return false;
	}
	return true;
}

static UObject* MakeWithFactory(UFactory* Factory, UClass* Class, const FString& Folder, const FString& Name)
{
	const FString PackageName = Folder / Name;
	UPackage* Package = CreatePackage(*PackageName);
	UObject* Asset = Factory->FactoryCreateNew(Class, Package, *Name, RF_Public | RF_Standalone, nullptr, GWarn);
	if (Asset)
	{
		FAssetRegistryModule::AssetCreated(Asset);
		Asset->MarkPackageDirty();
	}
	return Asset;
}

static bool PackageAssets(const FString& PackageName, TArray<FAssetData>& Out)
{
	FAssetRegistryModule& Registry = FModuleManager::LoadModuleChecked<FAssetRegistryModule>("AssetRegistry");
	return Registry.Get().GetAssetsByPackageName(*PackageName, Out) && Out.Num() > 0;
}

static FString PinCategory(const FString& Type)
{
	if (Type == TEXT("bool")) return UEdGraphSchema_K2::PC_Boolean;
	if (Type == TEXT("float")) return UEdGraphSchema_K2::PC_Real;
	if (Type == TEXT("FString")) return UEdGraphSchema_K2::PC_String;
	if (Type == TEXT("FName")) return UEdGraphSchema_K2::PC_Name;
	return UEdGraphSchema_K2::PC_Int;
}

bool AssetCreate::Open(const FString& AssetPath, FString& OutMessage)
{
	if (!GEditor)
	{
		OutMessage = TEXT("The editor is not ready to open an asset.");
		return false;
	}
	UObject* Asset = LoadObject<UObject>(nullptr, *AssetPath);
	if (!Asset)
	{
		OutMessage = FString::Printf(TEXT("Could not find %s."), *AssetPath);
		return false;
	}
	UAssetEditorSubsystem* Editors = GEditor->GetEditorSubsystem<UAssetEditorSubsystem>();
	if (!Editors || !Editors->OpenEditorForAsset(Asset))
	{
		OutMessage = TEXT("The asset editor did not open.");
		return false;
	}
	OutMessage = FString::Printf(TEXT("Opened %s."), *Asset->GetName());
	return true;
}

bool AssetCreate::Create(const TSharedRef<FJsonObject>& Command, TArray<FString>& OutAssets, TArray<FString>& OutConflicts, FString& OutMessage)
{
	const FString Folder = Command->GetStringField(TEXT("folder"));
	const bool bConfirm = Command->GetBoolField(TEXT("confirm"));
	const FString Module = Command->GetStringField(TEXT("module"));
	if (!AllowedFolder(Folder))
	{
		OutMessage = TEXT("Assets stay under /Game. Pick a folder that starts with /Game/.");
		return false;
	}

	const TSharedPtr<FJsonObject>* TableJson = nullptr;
	const TSharedPtr<FJsonObject>* PrimaryJson = nullptr;
	const TSharedPtr<FJsonObject>* BlueprintJson = nullptr;
	Command->TryGetObjectField(TEXT("table"), TableJson);
	Command->TryGetObjectField(TEXT("primary"), PrimaryJson);
	Command->TryGetObjectField(TEXT("blueprint"), BlueprintJson);
	if (!TableJson || !PrimaryJson || !BlueprintJson)
	{
		OutMessage = TEXT("The create request did not include a table, a data asset, and a Blueprint.");
		return false;
	}

	const FString RowName = (*TableJson)->GetStringField(TEXT("struct"));
	const FString DataName = (*PrimaryJson)->GetStringField(TEXT("className"));
	const FString ParentName = (*BlueprintJson)->GetStringField(TEXT("parent"));
	UScriptStruct* RowStruct = Cast<UScriptStruct>(FindNative(UScriptStruct::StaticClass(), Module, RowName));
	UClass* DataClass = Cast<UClass>(FindNative(UClass::StaticClass(), Module, DataName));
	UClass* ParentClass = Cast<UClass>(FindNative(UClass::StaticClass(), Module, ParentName));
	TArray<FString> Missing;
	if (!RowStruct) Missing.Add(RowName);
	if (!DataClass || !DataClass->IsChildOf(UPrimaryDataAsset::StaticClass())) Missing.Add(DataName);
	if (!ParentClass) Missing.Add(ParentName);
	if (Missing.Num())
	{
		OutMessage = FString::Printf(TEXT("Send to Unreal and compile first. The editor does not have these types yet: %s."), *FString::Join(Missing, TEXT(", ")));
		return false;
	}

	const FString Names[3] = {
		(*TableJson)->GetStringField(TEXT("asset")),
		(*PrimaryJson)->GetStringField(TEXT("asset")),
		(*BlueprintJson)->GetStringField(TEXT("asset"))
	};
	TArray<FAssetData> ExistingAssets;
	for (const FString& Name : Names)
	{
		TArray<FAssetData> Existing;
		if (PackageAssets(Folder / Name, Existing)) ExistingAssets.Append(Existing);
	}
	if (ExistingAssets.Num() && !bConfirm)
	{
		OutMessage = TEXT("These assets already exist. Confirm in the app before replacing them.");
		for (const FAssetData& Asset : ExistingAssets) OutConflicts.Add(Asset.GetObjectPathString());
		return false;
	}

	FScopedTransaction Transaction(NSLOCTEXT("ArchitectCompanion", "CreateAssets", "Create Architect assets"));
	if (bConfirm && ExistingAssets.Num())
	{
		ObjectTools::DeleteAssets(ExistingAssets, false);
	}

	IAssetTools& AssetTools = FModuleManager::LoadModuleChecked<FAssetToolsModule>("AssetTools").Get();
	FString UnusedPackage;
	FString UnusedName;
	AssetTools.CreateUniqueAssetName(Folder / Names[0], TEXT(""), UnusedPackage, UnusedName);

	UDataTableFactory* TableFactory = NewObject<UDataTableFactory>();
	TableFactory->Struct = RowStruct;
	UDataTable* Table = Cast<UDataTable>(MakeWithFactory(TableFactory, UDataTable::StaticClass(), Folder, Names[0]));
	if (!Table)
	{
		OutMessage = TEXT("The data table was not created.");
		return false;
	}
	Table->Modify();
	Table->RowStruct = RowStruct;
	const TArray<TSharedPtr<FJsonValue>>* Rows = nullptr;
	if ((*TableJson)->TryGetArrayField(TEXT("rows"), Rows))
	{
		for (const TSharedPtr<FJsonValue>& RowValue : *Rows)
		{
			const TSharedPtr<FJsonObject> Row = RowValue.IsValid() ? RowValue->AsObject() : nullptr;
			if (!Row.IsValid()) continue;
			const FName RowId(*Row->GetStringField(TEXT("name")));
			uint8* Data = FDataTableEditorUtils::AddRow(Table, RowId);
			const TSharedPtr<FJsonObject>* Values = nullptr;
			if (Data && Row->TryGetObjectField(TEXT("values"), Values))
			{
				TArray<TPair<FString, FString>> Fields;
				ReadValues(*Values, Fields);
				for (const TPair<FString, FString>& Field : Fields) ApplyValue(RowStruct, Data, Field.Key, Field.Value);
			}
		}
	}
	FString SaveMessage;
	if (!SaveAsset(Table, SaveMessage))
	{
		OutMessage = SaveMessage;
		return false;
	}
	OutAssets.Add(Table->GetPathName());

	UDataAssetFactory* DataFactory = NewObject<UDataAssetFactory>();
	DataFactory->DataAssetClass = DataClass;
	UObject* DataAsset = MakeWithFactory(DataFactory, DataClass, Folder, Names[1]);
	if (!DataAsset)
	{
		OutMessage = TEXT("The primary data asset was not created.");
		return false;
	}
	DataAsset->Modify();
	const TSharedPtr<FJsonObject>* Values = nullptr;
	if ((*PrimaryJson)->TryGetObjectField(TEXT("values"), Values))
	{
		TArray<TPair<FString, FString>> Fields;
		ReadValues(*Values, Fields);
		for (const TPair<FString, FString>& Field : Fields) ApplyValue(DataClass, reinterpret_cast<uint8*>(DataAsset), Field.Key, Field.Value);
	}
	if (!SaveAsset(DataAsset, SaveMessage))
	{
		OutMessage = SaveMessage;
		return false;
	}
	OutAssets.Add(DataAsset->GetPathName());

	UPackage* BlueprintPackage = CreatePackage(*(Folder / Names[2]));
	UBlueprint* Blueprint = FKismetEditorUtilities::CreateBlueprint(
		ParentClass,
		BlueprintPackage,
		*Names[2],
		BPTYPE_Normal,
		UBlueprint::StaticClass(),
		UBlueprintGeneratedClass::StaticClass(),
		NAME_None);
	if (!Blueprint)
	{
		OutMessage = TEXT("The Blueprint stub was not created.");
		return false;
	}
	Blueprint->Modify();
	const TArray<TSharedPtr<FJsonValue>>* Variables = nullptr;
	if ((*BlueprintJson)->TryGetArrayField(TEXT("variables"), Variables))
	{
		for (const TSharedPtr<FJsonValue>& Item : *Variables)
		{
			const TSharedPtr<FJsonObject> Variable = Item.IsValid() ? Item->AsObject() : nullptr;
			if (!Variable.IsValid()) continue;
			const FName VarName(*Variable->GetStringField(TEXT("name")));
			if (VarName.IsNone() || ParentClass->FindPropertyByName(VarName)) continue;
			FEdGraphPinType PinType;
			PinType.PinCategory = PinCategory(Variable->GetStringField(TEXT("type")));
			if (PinType.PinCategory == UEdGraphSchema_K2::PC_Real) PinType.PinSubCategory = UEdGraphSchema_K2::PC_Float;
			FBlueprintEditorUtils::AddMemberVariable(Blueprint, VarName, PinType, Variable->GetStringField(TEXT("default")));
		}
	}
	if (UEdGraph* Graph = FBlueprintEditorUtils::FindEventGraph(Blueprint))
	{
		UEdGraphNode_Comment* Comment = NewObject<UEdGraphNode_Comment>(Graph);
		Comment->NodeComment = (*BlueprintJson)->GetStringField(TEXT("comment"));
		Comment->NodePosX = -240;
		Comment->NodePosY = -220;
		Comment->NodeWidth = 520;
		Comment->NodeHeight = 180;
		Comment->CreateNewGuid();
		Graph->AddNode(Comment, false, false);
	}
	FKismetEditorUtilities::CompileBlueprint(Blueprint);
	FAssetRegistryModule::AssetCreated(Blueprint);
	if (!SaveAsset(Blueprint, SaveMessage))
	{
		OutMessage = SaveMessage;
		return false;
	}
	OutAssets.Add(Blueprint->GetPathName());
	OutMessage = FString::Printf(TEXT("Created %d assets in %s. Delete that folder to remove them."), OutAssets.Num(), *Folder);
	return true;
}
