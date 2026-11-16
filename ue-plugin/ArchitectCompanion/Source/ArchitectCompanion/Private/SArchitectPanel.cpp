#include "SArchitectPanel.h"
#include "CompanionLink.h"
#include "AssetCreate.h"
#include "ProjectScan.h"
#include "Misc/EngineVersion.h"
#include "Misc/App.h"
#include "Widgets/Input/SButton.h"
#include "Widgets/Input/SEditableTextBox.h"
#include "Widgets/Text/STextBlock.h"
#include "Widgets/Layout/SScrollBox.h"
#include "Widgets/SBoxPanel.h"

static bool DigitsOnly(const FString& Text)
{
	if (Text.IsEmpty()) return false;
	for (const TCHAR Ch : Text)
	{
		if (Ch < TEXT('0') || Ch > TEXT('9')) return false;
	}
	return true;
}

static bool SplitHostPort(const FString& Token, FString& OutHost, FString& OutPort)
{
	int32 Colon = INDEX_NONE;
	if (!Token.FindChar(TEXT(':'), Colon) || Colon <= 0 || Colon >= Token.Len() - 1) return false;
	const FString MaybeHost = Token.Left(Colon).TrimStartAndEnd();
	const FString MaybePort = Token.Mid(Colon + 1).TrimStartAndEnd();
	if (MaybeHost.IsEmpty() || !DigitsOnly(MaybePort)) return false;
	OutHost = MaybeHost;
	OutPort = MaybePort;
	return true;
}

void SArchitectPanel::AcceptPairingText(const FString& Raw, int32 Field)
{
	FString Text = Raw.TrimStartAndEnd();
	Text.ReplaceInline(TEXT("\u00B7"), TEXT(" "));
	TArray<FString> Parts;
	Text.ParseIntoArrayWS(Parts);
	FString NextHost;
	FString NextPort;
	FString NextCode;
	bool bEndpoint = false;
	bool bCode = false;
	for (const FString& Part : Parts)
	{
		if (Part.Equals(TEXT("paired"), ESearchCase::IgnoreCase) || Part.Equals(TEXT("not"), ESearchCase::IgnoreCase)) continue;
		FString HostPart;
		FString PortPart;
		if (SplitHostPort(Part, HostPart, PortPart))
		{
			NextHost = HostPart;
			NextPort = PortPart;
			bEndpoint = true;
			continue;
		}
		bool bToken = Part.Len() >= 4;
		for (const TCHAR Ch : Part)
		{
			const bool bOk = (Ch >= TEXT('0') && Ch <= TEXT('9')) || (Ch >= TEXT('A') && Ch <= TEXT('Z')) || (Ch >= TEXT('a') && Ch <= TEXT('z'));
			if (!bOk) { bToken = false; break; }
		}
		if (bToken)
		{
			NextCode = Part;
			bCode = true;
		}
	}
	if (bEndpoint && bCode)
	{
		Host = NextHost;
		Port = NextPort;
		Code = NextCode;
		return;
	}
	if (bEndpoint)
	{
		Host = NextHost;
		Port = NextPort;
		return;
	}
	if (Field == 0) Host = Text;
	else if (Field == 1) Port = Text;
	else Code = Text;
}

void SArchitectPanel::Construct(const FArguments& InArgs)
{
	ProjectName = FApp::GetProjectName();
	EngineVersion = FEngineVersion::Current().ToString();
	ChildSlot
	[
		SNew(SScrollBox)
		+ SScrollBox::Slot()
		.Padding(12.f)
		[
			SNew(SVerticalBox)
			+ SVerticalBox::Slot().AutoHeight().Padding(0.f, 0.f, 0.f, 8.f)
			[
				SNew(STextBlock).Text(FText::FromString(TEXT("Architect"))).Font(FCoreStyle::GetDefaultFontStyle("Bold", 16))
			]
			+ SVerticalBox::Slot().AutoHeight()
			[
				SNew(STextBlock).Text_Lambda([this]() { return FText::FromString(FString::Printf(TEXT("Project: %s"), *ProjectName)); })
			]
			+ SVerticalBox::Slot().AutoHeight().Padding(0.f, 4.f, 0.f, 8.f)
			[
				SNew(STextBlock).Text_Lambda([this]() { return FText::FromString(FString::Printf(TEXT("Engine: %s"), *EngineVersion)); })
			]
			+ SVerticalBox::Slot().AutoHeight()
			[
				SNew(STextBlock).Text_Lambda([this]() { return FText::FromString(FString::Printf(TEXT("Connection: %s"), *Status)); })
			]
			+ SVerticalBox::Slot().AutoHeight().Padding(0.f, 8.f)
			[
				SNew(STextBlock).Text(FText::FromString(TEXT("Host")))
			]
			+ SVerticalBox::Slot().AutoHeight()
			[
				SNew(SEditableTextBox)
				.Text_Lambda([this]() { return FText::FromString(Host); })
				.OnTextCommitted_Lambda([this](const FText& Value, ETextCommit::Type) { AcceptPairingText(Value.ToString(), 0); })
			]
			+ SVerticalBox::Slot().AutoHeight().Padding(0.f, 8.f, 0.f, 0.f)
			[
				SNew(STextBlock).Text(FText::FromString(TEXT("Port")))
			]
			+ SVerticalBox::Slot().AutoHeight().Padding(0.f, 4.f)
			[
				SNew(SEditableTextBox)
				.Text_Lambda([this]() { return FText::FromString(Port); })
				.OnTextCommitted_Lambda([this](const FText& Value, ETextCommit::Type) { AcceptPairingText(Value.ToString(), 1); })
			]
			+ SVerticalBox::Slot().AutoHeight().Padding(0.f, 8.f, 0.f, 0.f)
			[
				SNew(STextBlock).Text(FText::FromString(TEXT("Pairing code")))
			]
			+ SVerticalBox::Slot().AutoHeight().Padding(0.f, 4.f)
			[
				SNew(SEditableTextBox)
				.HintText(FText::FromString(TEXT("Pairing code")))
				.Text_Lambda([this]() { return FText::FromString(Code); })
				.OnTextCommitted_Lambda([this](const FText& Value, ETextCommit::Type) { AcceptPairingText(Value.ToString(), 2); })
			]
			+ SVerticalBox::Slot().AutoHeight().Padding(0.f, 6.f, 0.f, 2.f)
			[
				SNew(STextBlock).Text(FText::FromString(TEXT("Paste the line from the app's Architect box"))).AutoWrapText(true)
			]
			+ SVerticalBox::Slot().AutoHeight().Padding(0.f, 8.f)
			[
				SNew(SButton).Text(FText::FromString(TEXT("Pair"))).OnClicked(this, &SArchitectPanel::Pair)
			]
			+ SVerticalBox::Slot().AutoHeight()
			[
				SNew(SButton).Text(FText::FromString(TEXT("Send project"))).OnClicked(this, &SArchitectPanel::SendProject)
			]
		]
	];
	Ticker = FTSTicker::GetCoreTicker().AddTicker(FTickerDelegate::CreateLambda([this](float)
	{
		Poll();
		return true;
	}), 2.f);
}

SArchitectPanel::~SArchitectPanel()
{
	if (Ticker.IsValid()) FTSTicker::GetCoreTicker().RemoveTicker(Ticker);
}

void SArchitectPanel::SetStatus(const FString& Text)
{
	Status = Text;
}

FReply SArchitectPanel::Pair()
{
	AcceptPairingText(Code, 2);
	AcceptPairingText(Host, 0);
	AcceptPairingText(Port, 1);
	const int32 PortNumber = FCString::Atoi(*Port);
	FString NewToken;
	FString Error;
	if (CompanionLink::Pair(Host, PortNumber, Code, NewToken, Error))
	{
		Token = NewToken;
		SetStatus(TEXT("Paired. This plugin does not call AI."));
		SendProject();
	}
	else
	{
		SetStatus(Error.IsEmpty() ? TEXT("Pairing failed.") : Error);
	}
	return FReply::Handled();
}

FReply SArchitectPanel::SendProject()
{
	if (Token.IsEmpty())
	{
		SetStatus(TEXT("Pair first."));
		return FReply::Handled();
	}
	const int32 PortNumber = FCString::Atoi(*Port);
	FString Error;
	const bool bOk = CompanionLink::Report(Host, PortNumber, Token, ProjectScan::Collect(), Error);
	SetStatus(bOk ? TEXT("Project sent to the app.") : (Error.IsEmpty() ? TEXT("Could not send the project.") : Error));
	return FReply::Handled();
}

void SArchitectPanel::Poll()
{
	if (Token.IsEmpty()) return;
	const int32 PortNumber = FCString::Atoi(*Port);
	TSharedPtr<FJsonObject> Command;
	if (!CompanionLink::TakePending(Host, PortNumber, Token, Command) || !Command.IsValid()) return;
	const FString Id = Command->GetStringField(TEXT("id"));
	const FString CommandType = Command->GetStringField(TEXT("type"));
	if (!Id.IsEmpty() && Id == FinishedId)
	{
		FString Ignored;
		CompanionLink::PostResult(Host, PortNumber, Token, Id, bFinishedOk, FinishedMessage, FinishedAssets, FinishedConflicts, Ignored);
		return;
	}
	FString Result;
	TArray<FString> Assets;
	TArray<FString> Conflicts;
	bool bOk = true;
	if (CommandType == TEXT("reload"))
	{
		Result = CompanionLink::TryLiveCompile();
	}
	else if (CommandType == TEXT("create-assets"))
	{
		bOk = AssetCreate::Create(Command.ToSharedRef(), Assets, Conflicts, Result);
	}
	else if (CommandType == TEXT("open-asset"))
	{
		bOk = AssetCreate::Open(Command->GetStringField(TEXT("asset")), Result);
	}
	else
	{
		bOk = false;
		Result = FString::Printf(TEXT("The editor does not understand request %s."), *CommandType);
	}
	FinishedId = Id;
	bFinishedOk = bOk;
	FinishedMessage = Result;
	FinishedAssets = Assets;
	FinishedConflicts = Conflicts;
	FString Ignored;
	const bool bPosted = CompanionLink::PostResult(Host, PortNumber, Token, Id, bOk, Result, Assets, Conflicts, Ignored);
	SetStatus(bPosted
		? (Result.IsEmpty() ? TEXT("The editor finished the request.") : Result)
		: TEXT("The editor finished, but the app did not accept the answer."));
}
