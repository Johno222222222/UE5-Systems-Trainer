// What a quiz option should look like. "selected" is before the answer is
// checked. After it is checked, the right option is "correct" and a wrong
// pick is "incorrect".

export function choiceMark({ id, picked, correct, revealed }) {
  const selected = picked === id;
  if (!revealed) return selected ? "selected" : "idle";
  if (correct != null && id === correct) return "correct";
  if (selected) return "incorrect";
  return "idle";
}

export function choiceNote({ picked, correct, why, revealed, rightText, wrongText }) {
  if (!revealed || picked == null || picked === "") return "";
  if (picked === correct) return rightText || "That's the one.";
  return wrongText || why || "Not that one.";
}
