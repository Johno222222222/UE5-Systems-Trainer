"use strict";

// Small systems the stack composer and the plugin zips both use.
// They stay on Engine types so a stacked plugin can go through BuildPlugin.

const INTERFACE = `UINTERFACE(BlueprintType)
class UStackInteractable : public UInterface
{
	GENERATED_BODY()
};

class IStackInteractable
{
	GENERATED_BODY()
public:
	virtual void Interact(AActor* User) = 0;
};`;

function header(file, body) {
  return `#pragma once
#include "CoreMinimal.h"
#include "Components/ActorComponent.h"
#include "GameFramework/Actor.h"
#include "Net/UnrealNetwork.h"
#include "${file}.generated.h"

${INTERFACE}

${body}
`;
}

function component(className, property, defaultValue, tag, action) {
  return `UCLASS(ClassGroup=(Game), meta=(BlueprintSpawnableComponent))
class U${className} : public UActorComponent
{
	GENERATED_BODY()
public:
	U${className}();
	void Use();
protected:
	UPROPERTY(ReplicatedUsing=OnRep_${property})
	float ${property} = ${defaultValue};
	UFUNCTION()
	void OnRep_${property}();
	virtual void GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& OutLifetimeProps) const override;
};`;
}

function source(file, className, property, cap, tag, action) {
  return `#include "${file}.h"
#include "Net/UnrealNetwork.h"

U${className}::U${className}()
{
	SetIsReplicatedByDefault(true);
	PrimaryComponentTick.bCanEverTick = false;
}

void U${className}::Use()
{
	// ${action}
	// Gameplay tag: "${tag}"
	${property} = FMath::Clamp(${property}, 0.f, ${cap});
}

void U${className}::OnRep_${property}()
{
	${property} = FMath::Clamp(${property}, 0.f, ${cap});
}

void U${className}::GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& OutLifetimeProps) const
{
	Super::GetLifetimeReplicatedProps(OutLifetimeProps);
	DOREPLIFETIME(U${className}, ${property});
}
`;
}

function system(name, file, className, property, defaultValue, cap, tag, action) {
  return {
    system_name: name,
    summary: `${name} as a component.`,
    cpp_header: header(file, component(className, property, defaultValue, tag, action)),
    cpp_source: source(file, className, property, cap, tag, action),
  };
}

function health() {
  return system("Health", "Health", "HealthComponent", "Health", "100.f", "100.f", "Character.Vital", "IA_Reload");
}

function ammo() {
  return system("Ammo", "Ammo", "AmmoComponent", "Health", "30.f", "30.f", "Character.Vital", "IA_Reload");
}

function interact() {
  return system("Interact", "Interact", "InteractComponent", "FocusId", "0.f", "1.f", "Character.Focus", "IA_Reload");
}

function vital() {
  const base = health();
  return {
    ...base,
    system_name: "Vital",
    cpp_header: base.cpp_header.replace("100.f", "50.f"),
    cpp_source: base.cpp_source.replace(/100\.f/g, "50.f"),
  };
}

function save() {
  return {
    system_name: "Save",
    summary: "One slot index on a component.",
    cpp_header: `#pragma once
#include "CoreMinimal.h"
#include "Components/ActorComponent.h"
#include "Save.generated.h"

UCLASS(ClassGroup=(Game), meta=(BlueprintSpawnableComponent))
class USaveComponent : public UActorComponent
{
	GENERATED_BODY()
public:
	USaveComponent();
	void WriteSlot();
protected:
	UPROPERTY(EditAnywhere, Category="Save")
	int32 SlotIndex = 0;
};
`,
    cpp_source: `#include "Save.h"

USaveComponent::USaveComponent()
{
	PrimaryComponentTick.bCanEverTick = false;
}

void USaveComponent::WriteSlot()
{
	// Gameplay tag: "Save.Slot"
	SlotIndex = FMath::Max(SlotIndex, 0);
}
`,
  };
}

function inventory() {
  return {
    system_name: "Inventory",
    summary: "One stack count on a component.",
    cpp_header: `#pragma once
#include "CoreMinimal.h"
#include "Components/ActorComponent.h"
#include "Inventory.generated.h"

UCLASS(ClassGroup=(Game), meta=(BlueprintSpawnableComponent))
class UInventoryComponent : public UActorComponent
{
	GENERATED_BODY()
public:
	UInventoryComponent();
	void AddOne();
protected:
	UPROPERTY(EditAnywhere, Category="Inventory")
	int32 StackCount = 0;
};
`,
    cpp_source: `#include "Inventory.h"

UInventoryComponent::UInventoryComponent()
{
	PrimaryComponentTick.bCanEverTick = false;
}

void UInventoryComponent::AddOne()
{
	// Gameplay tag: "Item.Stack"
	StackCount = FMath::Clamp(StackCount + 1, 0, 99);
}
`,
  };
}

function patrol() {
  return {
    system_name: "Patrol",
    summary: "A patrol index on a component.",
    cpp_header: `#pragma once
#include "CoreMinimal.h"
#include "Components/ActorComponent.h"
#include "Patrol.generated.h"

UCLASS(ClassGroup=(Game), meta=(BlueprintSpawnableComponent))
class UPatrolComponent : public UActorComponent
{
	GENERATED_BODY()
public:
	UPatrolComponent();
	void Advance();
protected:
	UPROPERTY(EditAnywhere, Category="Patrol")
	int32 PointIndex = 0;
};
`,
    cpp_source: `#include "Patrol.h"

UPatrolComponent::UPatrolComponent()
{
	PrimaryComponentTick.bCanEverTick = false;
}

void UPatrolComponent::Advance()
{
	// Gameplay tag: "AI.Patrol"
	PointIndex = PointIndex + 1;
}
`,
  };
}

function slot() {
  return {
    system_name: "Slot",
    summary: "An inventory slot index on a component.",
    cpp_header: `#pragma once
#include "CoreMinimal.h"
#include "Components/ActorComponent.h"
#include "Slot.generated.h"

UCLASS(ClassGroup=(Game), meta=(BlueprintSpawnableComponent))
class USlotComponent : public UActorComponent
{
	GENERATED_BODY()
public:
	USlotComponent();
	void Select(int32 Index);
protected:
	UPROPERTY(EditAnywhere, Category="Slot")
	int32 Selected = 0;
};
`,
    cpp_source: `#include "Slot.h"

USlotComponent::USlotComponent()
{
	PrimaryComponentTick.bCanEverTick = false;
}

void USlotComponent::Select(int32 Index)
{
	// Gameplay tag: "Item.Slot"
	Selected = FMath::Max(Index, 0);
}
`,
  };
}

function exampleStacks() {
  return [
    { name: "Health + Ammo + Interact", systems: [health(), ammo(), interact()] },
    { name: "Health + Vital", systems: [health(), vital()] },
    { name: "Save + Inventory", systems: [save(), inventory()] },
    { name: "Patrol + Slot", systems: [patrol(), slot()] },
  ];
}

module.exports = {
  health,
  ammo,
  interact,
  vital,
  save,
  inventory,
  patrol,
  slot,
  exampleStacks,
};
