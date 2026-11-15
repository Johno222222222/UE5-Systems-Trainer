#pragma once

#include "Dom/JsonObject.h"

namespace AssetCreate
{
	bool Create(const TSharedRef<FJsonObject>& Command, TArray<FString>& OutAssets, TArray<FString>& OutConflicts, FString& OutMessage);
	bool Open(const FString& AssetPath, FString& OutMessage);
}
