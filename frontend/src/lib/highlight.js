// Single-pass tokenizer: matches tokens on raw source, escapes each piece once
const CPP_KEYWORDS = "class|public|private|protected|virtual|override|const|void|bool|float|double|int|int32|int64|uint8|FString|FName|FText|TArray|TMap|TSet|TSubclassOf|UClass|UObject|AActor|APawn|ACharacter|UActorComponent|USceneComponent|FVector|FRotator|FQuat|FTransform|TObjectPtr|TWeakObjectPtr|TSharedPtr|return|if|else|for|while|switch|case|break|continue|static|inline|new|delete|nullptr|true|false|this|struct|enum|namespace|template|typename|auto|using|Super";
const MACROS = "UCLASS|UPROPERTY|UFUNCTION|GENERATED_BODY|USTRUCT|UENUM|UMETA|DECLARE_DYNAMIC_MULTICAST_DELEGATE\\w*|DECLARE_DELEGATE\\w*|DOREPLIFETIME\\w*|#include|#pragma|BlueprintCallable|BlueprintReadWrite|BlueprintReadOnly|BlueprintPure|BlueprintAssignable|EditAnywhere|EditDefaultsOnly|VisibleAnywhere|Category|Replicated|ReplicatedUsing|NetMulticast|Server|Client|Reliable|Unreliable|BlueprintImplementableEvent|BlueprintNativeEvent|Meta";
const BP_KEYWORDS = "Event|Function|Set|Get|Branch|Sequence|ForEach|For Each|Loop|Cast|Delay|Spawn|Destroy|Bind|Call|Add|Remove|Create|Promote|Timer|Interface|Delegate|Replicated|Multicast|Authority|Return|Server|Client|True|False";

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function tokenize(code, rules) {
  const re = new RegExp(rules.map((r) => `(${r[0]})`).join("|"), "g");
  let out = "";
  let last = 0;
  for (const m of code.matchAll(re)) {
    out += esc(code.slice(last, m.index));
    const idx = m.slice(1).findIndex((g) => g !== undefined);
    out += `<span class="${rules[idx][1]}">${esc(m[0])}</span>`;
    last = m.index + m[0].length;
  }
  return out + esc(code.slice(last));
}

const CPP_RULES = [
  ["\\/\\/[^\\n]*|\\/\\*[\\s\\S]*?\\*\\/", "tok-com"],
  ['"(?:[^"\\\\\\n]|\\\\.)*"', "tok-str"],
  [`(?:${MACROS})\\b`, "tok-mac"],
  [`\\b(?:${CPP_KEYWORDS})\\b`, "tok-key"],
  ["\\b\\d+(?:\\.\\d+)?f?\\b", "tok-num"],
];
const BP_RULES = [
  ["\\/\\/[^\\n]*", "tok-com"],
  ['"[^"\\n]*"', "tok-str"],
  ["->", "tok-mac"],
  [`\\b(?:${BP_KEYWORDS})\\b`, "tok-key"],
  ["\\b\\d+(?:\\.\\d+)?\\b", "tok-num"],
];

export const highlightCpp = (code) => (code ? tokenize(code, CPP_RULES) : "");
export const highlightBlueprint = (code) => (code ? tokenize(code, BP_RULES) : "");
