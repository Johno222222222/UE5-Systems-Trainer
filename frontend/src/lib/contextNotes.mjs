// Short notes for systems that did not bring their own. The words are
// glossary phrases so the dotted terms can link.

export function systemNotes(system) {
  const when = String(system?.when_to_use || "").trim();
  const mistakes = String(system?.common_mistakes || "").trim();
  return {
    when: when || "Use this when the behaviour should be its own component, so the pawn does not need a new character class.",
    mistakes: mistakes || "A common mistake is to Cast To every Blueprint instead of an interface, or to change replicated state off the authority.",
  };
}
