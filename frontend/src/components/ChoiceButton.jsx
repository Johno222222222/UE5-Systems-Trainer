import React from "react";
import { choiceMark } from "../lib/choices.mjs";

// A real button, not a panel. The code inside does not take the click, so
// Windows still delivers it to the option.
export default function ChoiceButton({ id, label, picked, correct, revealed, onPick, testId, children }) {
  const mark = choiceMark({ id, picked, correct, revealed });
  return (
    <button
      type="button"
      className={`choice ${mark}`}
      aria-pressed={picked === id}
      data-choice-state={mark}
      data-testid={testId}
      onMouseDown={(event) => event.preventDefault()}
      onClick={() => onPick(id)}
    >
      <span className="choice-body">{children || label}</span>
    </button>
  );
}
