#include "SArchitectPanel.h"
#include "CompanionLink.h"
#include "AssetCreate.h"
#include "LearnCheck.h"
#include "ProjectScan.h"
#include "Misc/EngineVersion.h"
#include "Misc/App.h"
#include "Misc/Guid.h"
#include "Styling/CoreStyle.h"
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
			+ SVerticalBox::Slot().AutoHeight().Padding(0.f, 14.f, 0.f, 4.f)
			[
				SNew(STextBlock).Text(FText::FromString(TEXT("Learn"))).Font(FCoreStyle::GetDefaultFontStyle("Bold", 14))
			]
			+ SVerticalBox::Slot().FillHeight(1.f)
			[
				SNew(SScrollBox)
				+ SScrollBox::Slot()
				[
					SAssignNew(LearnBox, SVerticalBox)
				]
				+ SScrollBox::Slot().Padding(0.f, 12.f, 0.f, 0.f)
				[
					SNew(SVerticalBox)
					+ SVerticalBox::Slot().AutoHeight()
					[
						SNew(STextBlock).Text(FText::FromString(TEXT("Glossary"))).Font(FCoreStyle::GetDefaultFontStyle("Bold", 12))
					]
					+ SVerticalBox::Slot().AutoHeight().Padding(0.f, 4.f)
					[
						SAssignNew(GlossaryQuery, SEditableTextBox).HintText(FText::FromString(TEXT("Search a term")))
					]
					+ SVerticalBox::Slot().AutoHeight().Padding(0.f, 4.f)
					[
						SNew(SButton).Text(FText::FromString(TEXT("Search"))).OnClicked(this, &SArchitectPanel::SearchGlossary)
					]
					+ SVerticalBox::Slot().AutoHeight()
					[
						SAssignNew(GlossaryBox, SVerticalBox)
					]
				]
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

void SArchitectPanel::ShowLearn()
{
	if (!LearnBox.IsValid()) return;
	LearnBox->ClearChildren();
	if (!CurrentLearn.IsValid())
	{
		LearnBox->AddSlot().AutoHeight()
		[
			SNew(STextBlock).Text(FText::FromString(TEXT("Create in Unreal or Send to Unreal to load notes for this system."))).AutoWrapText(true)
		];
		return;
	}
	const TArray<TSharedPtr<FJsonValue>>* Groups = nullptr;
	if (CurrentLearn->TryGetArrayField(TEXT("groups"), Groups) && Groups)
	{
		for (const TSharedPtr<FJsonValue>& GroupValue : *Groups)
		{
			const TSharedPtr<FJsonObject> Group = GroupValue.IsValid() ? GroupValue->AsObject() : nullptr;
			if (!Group.IsValid()) continue;
			LearnBox->AddSlot().AutoHeight().Padding(0.f, 8.f, 0.f, 2.f)
			[
				SNew(STextBlock).Text(FText::FromString(Group->GetStringField(TEXT("kind")) + TEXT(" · ") + Group->GetStringField(TEXT("title")))).Font(FCoreStyle::GetDefaultFontStyle("Bold", 11))
			];
			const TArray<TSharedPtr<FJsonValue>>* Notes = nullptr;
			if (!Group->TryGetArrayField(TEXT("notes"), Notes) || !Notes) continue;
			for (const TSharedPtr<FJsonValue>& NoteValue : *Notes)
			{
				const TSharedPtr<FJsonObject> Note = NoteValue.IsValid() ? NoteValue->AsObject() : nullptr;
				if (!Note.IsValid()) continue;
				LearnBox->AddSlot().AutoHeight().Padding(0.f, 2.f)
				[
					SNew(STextBlock).Text(FText::FromString(Note->GetStringField(TEXT("one_line")))).AutoWrapText(true)
				];
				const FString Tradeoff = Note->GetStringField(TEXT("tradeoff"));
				const FString Mistake = Note->GetStringField(TEXT("common_mistake"));
				if (!Tradeoff.IsEmpty())
				{
					LearnBox->AddSlot().AutoHeight()
					[
						SNew(STextBlock).Text(FText::FromString(TEXT("Tradeoff: ") + Tradeoff)).AutoWrapText(true)
					];
				}
				if (!Mistake.IsEmpty())
				{
					LearnBox->AddSlot().AutoHeight().Padding(0.f, 0.f, 0.f, 4.f)
					[
						SNew(STextBlock).Text(FText::FromString(TEXT("Common mistake: ") + Mistake)).AutoWrapText(true)
					];
				}
			}
		}
	}
	const TArray<TSharedPtr<FJsonValue>>* Challenges = nullptr;
	if (CurrentLearn->TryGetArrayField(TEXT("challenges"), Challenges) && Challenges)
	{
		LearnBox->AddSlot().AutoHeight().Padding(0.f, 8.f, 0.f, 2.f)
		[
			SNew(SButton).Text(FText::FromString(TEXT("Check"))).OnClicked(this, &SArchitectPanel::CheckChallenges)
		];
		for (const TSharedPtr<FJsonValue>& Item : *Challenges)
		{
			const TSharedPtr<FJsonObject> Challenge = Item.IsValid() ? Item->AsObject() : nullptr;
			if (!Challenge.IsValid()) continue;
			const FString Id = Challenge->GetStringField(TEXT("id"));
			const bool bManual = Challenge->GetBoolField(TEXT("manual"));
			LearnBox->AddSlot().AutoHeight().Padding(0.f, 6.f, 0.f, 0.f)
			[
				SNew(STextBlock).Text(FText::FromString(Challenge->GetStringField(TEXT("prompt")))).AutoWrapText(true)
			];
			if (bManual)
			{
				LearnBox->AddSlot().AutoHeight()
				[
					SNew(SButton).Text(FText::FromString(TEXT("I did this"))).OnClicked_Lambda([this, Id]() { return MarkManual(Id); })
				];
			}
		}
	}
}

void SArchitectPanel::PostChecks(const TArray<TSharedPtr<FJsonValue>>& Checks, const FString& Message)
{
	if (Token.IsEmpty())
	{
		SetStatus(TEXT("Pair first."));
		return;
	}
	FString Error;
	TArray<FString> NoAssets;
	TArray<FString> NoConflicts;
	CompanionLink::PostResult(Host, FCString::Atoi(*Port), Token, FGuid::NewGuid().ToString(), true, Message, NoAssets, NoConflicts, Checks, Error);
	SetStatus(Error.IsEmpty() ? Message : Error);
}

FReply SArchitectPanel::CheckChallenges()
{
	if (!CurrentLearn.IsValid()) return FReply::Handled();
	const TArray<TSharedPtr<FJsonValue>>* Challenges = nullptr;
	if (!CurrentLearn->TryGetArrayField(TEXT("challenges"), Challenges) || !Challenges) return FReply::Handled();
	TArray<TSharedPtr<FJsonValue>> Checks;
	int32 Passed = 0;
	int32 Automatic = 0;
	for (const TSharedPtr<FJsonValue>& Item : *Challenges)
	{
		const TSharedPtr<FJsonObject> Challenge = Item.IsValid() ? Item->AsObject() : nullptr;
		if (!Challenge.IsValid() || Challenge->GetBoolField(TEXT("manual"))) continue;
		Automatic += 1;
		const TSharedPtr<FJsonObject>* CheckJson = nullptr;
		bool bPass = false;
		FString Hint = Challenge->GetStringField(TEXT("hint"));
		if (Challenge->TryGetObjectField(TEXT("check"), CheckJson) && CheckJson && CheckJson->IsValid())
		{
			LearnCheck::Evaluate((*CheckJson).ToSharedRef(), bPass, Hint);
		}
		if (bPass) Passed += 1;
		TSharedRef<FJsonObject> Row = MakeShared<FJsonObject>();
		Row->SetStringField(TEXT("id"), Challenge->GetStringField(TEXT("id")));
		Row->SetBoolField(TEXT("pass"), bPass);
		Row->SetBoolField(TEXT("manual"), false);
		Row->SetStringField(TEXT("hint"), Hint);
		Row->SetStringField(TEXT("asset"), Challenge->GetStringField(TEXT("asset")));
		Row->SetStringField(TEXT("systemName"), CurrentLearn->GetStringField(TEXT("systemName")));
		Checks.Add(MakeShared<FJsonValueObject>(Row));
	}
	PostChecks(Checks, FString::Printf(TEXT("%d of %d checks passed."), Passed, Automatic));
	return FReply::Handled();
}

FReply SArchitectPanel::MarkManual(FString ChallengeId)
{
	if (!CurrentLearn.IsValid()) return FReply::Handled();
	const TArray<TSharedPtr<FJsonValue>>* Challenges = nullptr;
	if (!CurrentLearn->TryGetArrayField(TEXT("challenges"), Challenges) || !Challenges) return FReply::Handled();
	for (const TSharedPtr<FJsonValue>& Item : *Challenges)
	{
		const TSharedPtr<FJsonObject> Challenge = Item.IsValid() ? Item->AsObject() : nullptr;
		if (!Challenge.IsValid() || Challenge->GetStringField(TEXT("id")) != ChallengeId) continue;
		TSharedRef<FJsonObject> Row = MakeShared<FJsonObject>();
		Row->SetStringField(TEXT("id"), ChallengeId);
		Row->SetBoolField(TEXT("pass"), true);
		Row->SetBoolField(TEXT("manual"), true);
		Row->SetStringField(TEXT("hint"), TEXT("Marked done in the editor."));
		Row->SetStringField(TEXT("asset"), Challenge->GetStringField(TEXT("asset")));
		Row->SetStringField(TEXT("systemName"), CurrentLearn->GetStringField(TEXT("systemName")));
		TArray<TSharedPtr<FJsonValue>> Checks;
		Checks.Add(MakeShared<FJsonValueObject>(Row));
		PostChecks(Checks, TEXT("Marked done."));
		break;
	}
	return FReply::Handled();
}

FReply SArchitectPanel::SearchGlossary()
{
	if (!GlossaryBox.IsValid()) return FReply::Handled();
	GlossaryBox->ClearChildren();
	if (Token.IsEmpty())
	{
		SetStatus(TEXT("Pair first."));
		return FReply::Handled();
	}
	TArray<TSharedPtr<FJsonValue>> Terms;
	FString Error;
	const FString Query = GlossaryQuery.IsValid() ? GlossaryQuery->GetText().ToString() : FString();
	if (!CompanionLink::SearchGlossary(Host, FCString::Atoi(*Port), Token, Query, Terms, Error))
	{
		SetStatus(Error);
		return FReply::Handled();
	}
	if (!Terms.Num())
	{
		GlossaryBox->AddSlot().AutoHeight()[SNew(STextBlock).Text(FText::FromString(TEXT("No matching term."))).AutoWrapText(true)];
		return FReply::Handled();
	}
	for (const TSharedPtr<FJsonValue>& Item : Terms)
	{
		const TSharedPtr<FJsonObject> Term = Item.IsValid() ? Item->AsObject() : nullptr;
		if (!Term.IsValid()) continue;
		FString See;
		const TArray<TSharedPtr<FJsonValue>>* SeeList = nullptr;
		if (Term->TryGetArrayField(TEXT("see"), SeeList) && SeeList)
		{
			for (const TSharedPtr<FJsonValue>& Name : *SeeList) See += (See.IsEmpty() ? TEXT("") : TEXT(", ")) + Name->AsString();
		}
		GlossaryBox->AddSlot().AutoHeight().Padding(0.f, 6.f, 0.f, 0.f)
		[
			SNew(STextBlock).Text(FText::FromString(Term->GetStringField(TEXT("term")))).Font(FCoreStyle::GetDefaultFontStyle("Bold", 11))
		];
		GlossaryBox->AddSlot().AutoHeight()[SNew(STextBlock).Text(FText::FromString(Term->GetStringField(TEXT("summary")))).AutoWrapText(true)];
		const FString Detail = Term->GetStringField(TEXT("detail"));
		if (!Detail.IsEmpty()) GlossaryBox->AddSlot().AutoHeight()[SNew(STextBlock).Text(FText::FromString(Detail)).AutoWrapText(true)];
		if (!See.IsEmpty()) GlossaryBox->AddSlot().AutoHeight()[SNew(STextBlock).Text(FText::FromString(TEXT("See also: ") + See)).AutoWrapText(true)];
	}
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
		TArray<TSharedPtr<FJsonValue>> NoChecks;
		CompanionLink::PostResult(Host, PortNumber, Token, Id, bFinishedOk, FinishedMessage, FinishedAssets, FinishedConflicts, NoChecks, Ignored);
		return;
	}
	// Polls overlap while HTTP ticks. Claim the id before any notice so a
	// repeated poll of this request does not stack another one.
	if (!Id.IsEmpty() && Id == NotifiedId) return;
	NotifiedId = Id;
	const TSharedPtr<FJsonObject>* LearnJson = nullptr;
	if (Command->TryGetObjectField(TEXT("learn"), LearnJson) && LearnJson && LearnJson->IsValid())
	{
		CurrentLearn = *LearnJson;
		ShowLearn();
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
	TArray<TSharedPtr<FJsonValue>> NoChecks;
	const bool bPosted = CompanionLink::PostResult(Host, PortNumber, Token, Id, bOk, Result, Assets, Conflicts, NoChecks, Ignored);
	SetStatus(bPosted
		? (Result.IsEmpty() ? TEXT("The editor finished the request.") : Result)
		: TEXT("The editor finished, but the app did not accept the answer."));
}
