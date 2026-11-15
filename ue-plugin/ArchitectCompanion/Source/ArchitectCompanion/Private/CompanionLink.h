#pragma once

#include "Dom/JsonObject.h"

namespace CompanionLink
{
	bool Pair(const FString& Host, int32 Port, const FString& Code, FString& OutToken, FString& OutError);
	bool Report(const FString& Host, int32 Port, const FString& Token, const TSharedRef<FJsonObject>& Body, FString& OutError);
	bool TakePending(const FString& Host, int32 Port, const FString& Token, FString& OutType, FString& OutMessage);
	bool PostResult(const FString& Host, int32 Port, const FString& Token, bool bOk, const FString& Message, FString& OutError);
	FString TryLiveCompile();
}
