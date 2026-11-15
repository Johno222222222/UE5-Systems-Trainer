import React from "react";
import { ABOUT } from "../lib/content.mjs";

export default function AboutCopy() {
  return (
    <div data-testid="about-copy">
      <p className="text-[13px] text-[var(--text-secondary)] leading-relaxed">
        <span className="font-semibold text-[var(--text-primary)]">What this is. </span>{ABOUT.is}
      </p>
      <p className="mt-2 text-[13px] text-[var(--text-secondary)] leading-relaxed">
        <span className="font-semibold text-[var(--text-primary)]">What this isn't. </span>{ABOUT.isnt}
      </p>
    </div>
  );
}
