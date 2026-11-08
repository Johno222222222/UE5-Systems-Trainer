// Lightweight C++ / blueprint-pseudocode syntax highlighter (tokens only, no deps)
const CPP_KEYWORDS = [
  "class","public","private","protected","virtual","override","const","void","bool","float","int","int32","int64","FString","FName","FText","TArray","TMap","TSet","TSubclassOf","UClass","UObject","AActor","APawn","ACharacter","UActorComponent","USceneComponent","FVector","FRotator","FQuat","FTransform","TObjectPtr","TWeakObjectPtr","TUniquePtr","TSharedPtr","return","if","else","for","while","switch","case","break","continue","static","inline","explicit","new","delete","nullptr","true","false","this","struct","enum","namespace","template","typename","auto","using"
];
const BP_KEYWORDS = [
  "Event","Function","Set","Get","Branch","Sequence","ForEach","Loop","Cast","To","Delay","Spawn","Destroy","Bind","Call","Add","Remove","Create","Promote","Variable","Timer","Interface","Delegate","Replicated","Multicast","Authority","RPC","Server","Client"
];
const MACROS = [
  "UCLASS","UPROPERTY","UFUNCTION","GENERATED_BODY","USTRUCT","UENUM","DECLARE_DYNAMIC_MULTICAST_DELEGATE","DECLARE_DELEGATE","DECLARE_LOG_CATEGORY_EXTERN","DEFINE_LOG_CATEGORY","IMPLEMENT_MODULE","BlueprintCallable","BlueprintReadWrite","BlueprintReadOnly","EditAnywhere","EditDefaultsOnly","VisibleAnywhere","Category","Replicated","ReplicatedUsing","NetMulticast","Server","Client","Reliable","BlueprintImplementableEvent","BlueprintNativeEvent"
];

function escapeHtml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function highlightCpp(code) {
  if (!code) return "";
  let out = escapeHtml(code);
  // line comments
  out = out.replace(/(\/\/[^\n]*)/g, '<span class="tok-com">$1</span>');
  // strings (post-escape, so quotes are literal)
  out = out.replace(/("(?:[^"\\]|\\.)*")/g, '<span class="tok-str">$1</span>');
  // macros (word followed by ( or alone)
  const macroRe = new RegExp(`\\b(${MACROS.join("|")})\\b`, "g");
  out = out.replace(macroRe, '<span class="tok-mac">$1</span>');
  // keywords
  const kwRe = new RegExp(`\\b(${CPP_KEYWORDS.join("|")})\\b`, "g");
  out = out.replace(kwRe, '<span class="tok-key">$1</span>');
  // numbers
  out = out.replace(/\b(\d+\.?\d*f?)\b/g, '<span class="tok-num">$1</span>');
  return out;
}

export function highlightBlueprint(code) {
  if (!code) return "";
  let out = escapeHtml(code);
  out = out.replace(/(\/\/[^\n]*)/g, '<span class="tok-com">$1</span>');
  const kwRe = new RegExp(`\\b(${BP_KEYWORDS.join("|")})\\b`, "g");
  out = out.replace(kwRe, '<span class="tok-key">$1</span>');
  out = out.replace(/(->)/g, '<span class="tok-mac">$1</span>');
  out = out.replace(/\b(\d+\.?\d*)\b/g, '<span class="tok-num">$1</span>');
  return out;
}
