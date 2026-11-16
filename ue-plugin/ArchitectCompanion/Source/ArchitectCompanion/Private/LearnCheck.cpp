#include "LearnCheck.h"

#include "EdGraph/EdGraph.h"
#include "Engine/Blueprint.h"
#include "Engine/DataTable.h"
#include "K2Node_CallFunction.h"
#include "Kismet2/BlueprintEditorUtils.h"

static bool ReadNumber(const UStruct* Type, const uint8* Container, const FString& Name, double& Out)
{
	if (!Type || !Container) return false;
	FNumericProperty* Number = CastField<FNumericProperty>(Type->FindPropertyByName(*Name));
	if (!Number) return false;
	const void* Value = Number->ContainerPtrToValuePtr<void>(Container);
	Out = Number->IsFloatingPoint() ? Number->GetFloatingPointPropertyValue(Value) : static_cast<double>(Number->GetSignedIntPropertyValue(Value));
	return true;
}

static bool ReadText(const UStruct* Type, const uint8* Container, const FString& Name, FString& Out)
{
	if (!Type || !Container) return false;
	FProperty* Prop = Type->FindPropertyByName(*Name);
	if (FStrProperty* String = CastField<FStrProperty>(Prop))
	{
		Out = String->GetPropertyValue_InContainer(Container);
		return true;
	}
	if (FNameProperty* NameProp = CastField<FNameProperty>(Prop))
	{
		Out = NameProp->GetPropertyValue_InContainer(Container).ToString();
		return true;
	}
	return false;
}

static UObject* LoadAsset(const FString& Path)
{
	if (Path.IsEmpty()) return nullptr;
	return LoadObject<UObject>(nullptr, *Path);
}

bool LearnCheck::Evaluate(const TSharedRef<FJsonObject>& Check, bool& bPass, FString& OutHint)
{
	bPass = false;
	const FString Kind = Check->GetStringField(TEXT("kind"));
	const FString Asset = Check->GetStringField(TEXT("asset"));
	const FString Hint = Check->GetStringField(TEXT("hint"));
	if (Kind == TEXT("manual"))
	{
		OutHint = Hint.IsEmpty() ? TEXT("Press I did this when you have done this one.") : Hint;
		return true;
	}
	UObject* Loaded = LoadAsset(Asset);
	if (!Loaded)
	{
		OutHint = Hint.IsEmpty() ? FString::Printf(TEXT("Create %s first."), *Asset) : Hint;
		return true;
	}
	if (Kind == TEXT("table-row"))
	{
		UDataTable* Table = Cast<UDataTable>(Loaded);
		const FName RowName(*Check->GetStringField(TEXT("row")));
		if (!Table || !Table->GetRowStruct() || !Table->GetRowMap().Contains(RowName))
		{
			OutHint = Hint;
			return true;
		}
		const FString Property = Check->GetStringField(TEXT("property"));
		if (Property.IsEmpty())
		{
			bPass = true;
			OutHint = FString::Printf(TEXT("Row %s is in the table."), *RowName.ToString());
			return true;
		}
		double Value = 0.0;
		const uint8* Row = Table->FindRowUnchecked(RowName);
		if (!Row || !ReadNumber(Table->GetRowStruct(), Row, Property, Value))
		{
			OutHint = Hint;
			return true;
		}
		const double Than = Check->GetNumberField(TEXT("than"));
		const bool bGreater = Check->GetStringField(TEXT("compare")) == TEXT("gt");
		const double RowDelta = Value - Than;
		bPass = bGreater ? Value > Than : (RowDelta < 0.01 && RowDelta > -0.01);
		OutHint = bPass ? FString::Printf(TEXT("%s on %s is %g."), *Property, *RowName.ToString(), Value) : Hint;
		return true;
	}
	if (Kind == TEXT("asset-number"))
	{
		double Value = 0.0;
		const FString Property = Check->GetStringField(TEXT("property"));
		if (!ReadNumber(Loaded->GetClass(), reinterpret_cast<const uint8*>(Loaded), Property, Value))
		{
			OutHint = Hint;
			return true;
		}
		const double Equals = Check->GetNumberField(TEXT("equals"));
		const double Delta = Value - Equals;
		bPass = Delta < 0.01 && Delta > -0.01;
		OutHint = bPass ? FString::Printf(TEXT("%s is %g."), *Property, Value) : Hint;
		return true;
	}
	if (Kind == TEXT("asset-text"))
	{
		FString Value;
		const FString Property = Check->GetStringField(TEXT("property"));
		if (!ReadText(Loaded->GetClass(), reinterpret_cast<const uint8*>(Loaded), Property, Value))
		{
			OutHint = Hint;
			return true;
		}
		bPass = Value.Equals(Check->GetStringField(TEXT("equals")), ESearchCase::IgnoreCase);
		OutHint = bPass ? FString::Printf(TEXT("%s is %s."), *Property, *Value) : Hint;
		return true;
	}
	if (Kind == TEXT("blueprint-edit"))
	{
		UBlueprint* Blueprint = Cast<UBlueprint>(Loaded);
		if (!Blueprint)
		{
			OutHint = Hint;
			return true;
		}
		bool bVariable = Blueprint->NewVariables.Num() > 0;
		bool bCall = false;
		if (UEdGraph* Graph = FBlueprintEditorUtils::FindEventGraph(Blueprint))
		{
			for (UEdGraphNode* Node : Graph->Nodes)
			{
				if (Node && Node->IsA(UK2Node_CallFunction::StaticClass())) { bCall = true; break; }
			}
		}
		bPass = bVariable || bCall;
		OutHint = bPass ? TEXT("The Blueprint has a new variable or a function call.") : Hint;
		return true;
	}
	OutHint = TEXT("This check is not one the editor can read.");
	return true;
}
