#pragma once

#include "Widgets/SCompoundWidget.h"
#include "Containers/Ticker.h"

class SArchitectPanel : public SCompoundWidget
{
public:
	SLATE_BEGIN_ARGS(SArchitectPanel) {}
	SLATE_END_ARGS()

	void Construct(const FArguments& InArgs);
	virtual ~SArchitectPanel() override;

private:
	FReply Pair();
	FReply SendProject();
	void Poll();
	void SetStatus(const FString& Text);
	void AcceptPairingText(const FString& Raw, int32 Field);

	FString Host = TEXT("127.0.0.1");
	FString Port = TEXT("0");
	FString Code;
	FString Token;
	FString Status = TEXT("Not paired");
	FString ProjectName;
	FString EngineVersion;
	FTSTicker::FDelegateHandle Ticker;
};
