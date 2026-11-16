#pragma once

#include "Dom/JsonObject.h"

namespace CompanionLink
{
	bool Pair(const FString& Host, int32 Port, const FString& Code, FString& OutToken, FString& OutError);
	bool Report(const FString& Host, int32 Port, const FString& Token, const TSharedRef<FJsonObject>& Body, FString& OutError);
	bool TakePending(const FString& Host, int32 Port, const FString& Token, TSharedPtr<FJsonObject>& OutCommand);
	bool PostResult(const FString& Host, int32 Port, const FString& Token, const FString& Id, bool bOk, const FString& Message, const TArray<FString>& Assets, const TArray<FString>& Conflicts, FString& OutError);
	FString TryLiveCompile();
}
