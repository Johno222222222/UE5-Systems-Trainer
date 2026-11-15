#include "CompanionLink.h"
#include "HttpModule.h"
#include "HttpManager.h"
#include "Interfaces/IHttpRequest.h"
#include "Interfaces/IHttpResponse.h"
#include "Serialization/JsonSerializer.h"
#include "Serialization/JsonWriter.h"
#include "Modules/ModuleManager.h"
#include "Framework/Notifications/NotificationManager.h"
#include "Widgets/Notifications/SNotificationList.h"

static bool PostJson(const FString& Url, const FString& Token, const TSharedRef<FJsonObject>& Body, FString& OutText, int32& OutCode)
{
	FString Payload;
	const TSharedRef<TJsonWriter<>> Writer = TJsonWriterFactory<>::Create(&Payload);
	FJsonSerializer::Serialize(Body, Writer);
	TSharedRef<IHttpRequest, ESPMode::ThreadSafe> Request = FHttpModule::Get().CreateRequest();
	Request->SetURL(Url);
	Request->SetVerb(TEXT("POST"));
	Request->SetHeader(TEXT("Content-Type"), TEXT("application/json"));
	if (!Token.IsEmpty()) Request->SetHeader(TEXT("X-Companion-Token"), Token);
	Request->SetContentAsString(Payload);
	bool bDone = false;
	Request->OnProcessRequestComplete().BindLambda([&](FHttpRequestPtr, FHttpResponsePtr Response, bool bConnected)
	{
		OutCode = Response.IsValid() ? Response->GetResponseCode() : 0;
		OutText = Response.IsValid() ? Response->GetContentAsString() : TEXT("");
		bDone = bConnected;
	});
	Request->ProcessRequest();
	const double Start = FPlatformTime::Seconds();
	while (!bDone && FPlatformTime::Seconds() - Start < 3.0)
	{
		FHttpModule::Get().GetHttpManager().Tick(0.01f);
		FPlatformProcess::Sleep(0.01f);
	}
	return bDone && OutCode >= 200 && OutCode < 300;
}

static bool GetText(const FString& Url, const FString& Token, FString& OutText)
{
	TSharedRef<IHttpRequest, ESPMode::ThreadSafe> Request = FHttpModule::Get().CreateRequest();
	Request->SetURL(Url);
	Request->SetVerb(TEXT("GET"));
	Request->SetHeader(TEXT("X-Companion-Token"), Token);
	bool bDone = false;
	int32 Code = 0;
	Request->OnProcessRequestComplete().BindLambda([&](FHttpRequestPtr, FHttpResponsePtr Response, bool bConnected)
	{
		Code = Response.IsValid() ? Response->GetResponseCode() : 0;
		OutText = Response.IsValid() ? Response->GetContentAsString() : TEXT("");
		bDone = bConnected;
	});
	Request->ProcessRequest();
	const double Start = FPlatformTime::Seconds();
	while (!bDone && FPlatformTime::Seconds() - Start < 3.0)
	{
		FHttpModule::Get().GetHttpManager().Tick(0.01f);
		FPlatformProcess::Sleep(0.01f);
	}
	return bDone && Code >= 200 && Code < 300;
}

static FString BaseUrl(const FString& Host, int32 Port)
{
	return FString::Printf(TEXT("http://%s:%d"), *Host, Port);
}

bool CompanionLink::Pair(const FString& Host, int32 Port, const FString& Code, FString& OutToken, FString& OutError)
{
	TSharedRef<FJsonObject> Body = MakeShared<FJsonObject>();
	Body->SetStringField(TEXT("code"), Code.TrimStartAndEnd());
	FString Text;
	int32 Status = 0;
	if (!PostJson(BaseUrl(Host, Port) + TEXT("/v1/pair"), TEXT(""), Body, Text, Status))
	{
		OutError = Status == 401 ? TEXT("That pairing code does not match.") : TEXT("Could not reach the app. Check the port.");
		return false;
	}
	TSharedPtr<FJsonObject> Parsed;
	const TSharedRef<TJsonReader<>> Reader = TJsonReaderFactory<>::Create(Text);
	if (!FJsonSerializer::Deserialize(Reader, Parsed) || !Parsed.IsValid())
	{
		OutError = TEXT("The app reply was not understood.");
		return false;
	}
	OutToken = Parsed->GetStringField(TEXT("token"));
	return !OutToken.IsEmpty();
}

bool CompanionLink::Report(const FString& Host, int32 Port, const FString& Token, const TSharedRef<FJsonObject>& Body, FString& OutError)
{
	FString Text;
	int32 Status = 0;
	if (!PostJson(BaseUrl(Host, Port) + TEXT("/v1/report"), Token, Body, Text, Status))
	{
		OutError = TEXT("The project report was refused.");
		return false;
	}
	return true;
}

bool CompanionLink::TakePending(const FString& Host, int32 Port, const FString& Token, FString& OutType, FString& OutMessage)
{
	FString Text;
	if (!GetText(BaseUrl(Host, Port) + TEXT("/v1/pending"), Token, Text)) return false;
	TSharedPtr<FJsonObject> Parsed;
	const TSharedRef<TJsonReader<>> Reader = TJsonReaderFactory<>::Create(Text);
	if (!FJsonSerializer::Deserialize(Reader, Parsed) || !Parsed.IsValid() || !Parsed->HasField(TEXT("command"))) return false;
	const TSharedPtr<FJsonObject>* Command = nullptr;
	if (!Parsed->TryGetObjectField(TEXT("command"), Command) || !Command || !Command->IsValid()) return false;
	OutType = (*Command)->GetStringField(TEXT("type"));
	OutMessage = (*Command)->GetStringField(TEXT("module"));
	return !OutType.IsEmpty();
}

bool CompanionLink::PostResult(const FString& Host, int32 Port, const FString& Token, bool bOk, const FString& Message, FString& OutError)
{
	TSharedRef<FJsonObject> Body = MakeShared<FJsonObject>();
	Body->SetBoolField(TEXT("ok"), bOk);
	Body->SetStringField(TEXT("message"), Message);
	FString Text;
	int32 Status = 0;
	return PostJson(BaseUrl(Host, Port) + TEXT("/v1/result"), Token, Body, Text, Status);
}

FString CompanionLink::TryLiveCompile()
{
	FNotificationInfo Info(NSLOCTEXT("ArchitectCompanion", "Compile", "Architect wrote files. Live Coding if it is on, or compile the project."));
	Info.ExpireDuration = 6.f;
	FSlateNotificationManager::Get().AddNotification(Info);
	if (FModuleManager::Get().ModuleExists(TEXT("LiveCoding")))
	{
		return TEXT("Files are in the project. Live Coding is available. Press Ctrl+Alt+F11 if it did not start.");
	}
	return TEXT("Files are in the project. Compile from the editor. Live Coding is not loaded.");
}
