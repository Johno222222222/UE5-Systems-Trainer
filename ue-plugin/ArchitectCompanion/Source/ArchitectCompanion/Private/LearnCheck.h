#pragma once

#include "Dom/JsonObject.h"

namespace LearnCheck
{
	bool Evaluate(const TSharedRef<FJsonObject>& Check, bool& bPass, FString& OutHint);
}
