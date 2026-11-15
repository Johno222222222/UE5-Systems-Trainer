#include "SArchitectPanel.h"
#include "CompanionLink.h"
#include "ProjectScan.h"
#include "Misc/EngineVersion.h"
#include "Misc/App.h"
#include "Widgets/Input/SButton.h"
#include "Widgets/Input/SEditableTextBox.h"
#include "Widgets/Text/STextBlock.h"
#include "Widgets/Layout/SScrollBox.h"

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
				.OnTextCommitted_Lambda([this](const FText& Value, ETextCommit::Type) { Host = Value.ToString(); })
			]
			+ SVerticalBox::Slot().AutoHeight().Padding(0.f, 8.f, 0.f, 0.f)
			[
				SNew(STextBlock).Text(FText::FromString(TEXT("Port")))
			]
			+ SVerticalBox::Slot().AutoHeight().Padding(0.f, 4.f)
			[
				SNew(SEditableTextBox)
				.Text_Lambda([this]() { return FText::FromString(Port); })
				.OnTextCommitted_Lambda([this](const FText& Value, ETextCommit::Type) { Port = Value.ToString(); })
			]
			+ SVerticalBox::Slot().AutoHeight().Padding(0.f, 8.f, 0.f, 0.f)
			[
				SNew(STextBlock).Text(FText::FromString(TEXT("Pairing code")))
			]
			+ SVerticalBox::Slot().AutoHeight().Padding(0.f, 4.f)
			[
				SNew(SEditableTextBox)
				.HintText(FText::FromString(TEXT("Pairing code")))
				.OnTextCommitted_Lambda([this](const FText& Value, ETextCommit::Type) { Code = Value.ToString(); })
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
	FString CommandType;
	FString Message;
	if (!CompanionLink::TakePending(Host, PortNumber, Token, CommandType, Message)) return;
	if (CommandType == TEXT("reload"))
	{
		const FString Result = CompanionLink::TryLiveCompile();
		FString Ignored;
		CompanionLink::PostResult(Host, PortNumber, Token, true, Result, Ignored);
		SetStatus(Result);
	}
}
