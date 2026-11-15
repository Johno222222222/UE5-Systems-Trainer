import React, { useEffect, useRef } from "react";
import { EditorView, keymap, lineNumbers, highlightActiveLine, ViewPlugin } from "@codemirror/view";
import { cpp } from "@codemirror/lang-cpp";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { syntaxHighlighting, defaultHighlightStyle, bracketMatching } from "@codemirror/language";
import { oneDark } from "@codemirror/theme-one-dark";
import { lineSpan } from "../lib/manualEdit.mjs";

const theme = EditorView.theme({
  "&": { backgroundColor: "#0b0e14", color: "#f1f5f9", fontSize: "12.5px", minHeight: "120px" },
  ".cm-gutters": { backgroundColor: "#0e121b", color: "#64748b", borderRight: "1px solid #1b2232" },
  ".cm-activeLine": { backgroundColor: "rgba(255,107,0,0.08)" },
  ".cm-activeLineGutter": { backgroundColor: "rgba(255,107,0,0.12)" },
  ".cm-content": { fontFamily: '"JetBrains Mono", monospace', caretColor: "#ff6b00" },
  "&.cm-focused": { outline: "none" },
}, { dark: true });

// A bundled CodeMirror editor. Undo is the editor history. A compile jump
// selects that line.
export default function CppEditor({ title, code, testId, target, readOnly, onChange }) {
  const host = useRef(null);
  const viewRef = useRef(null);
  const onChangeRef = useRef(onChange);
  const applying = useRef(false);
  const own = useRef(code || "");
  onChangeRef.current = onChange;

  useEffect(() => {
    let view;
    try {
    view = new EditorView({
      parent: host.current,
      doc: code || "",
      extensions: [
          lineNumbers(),
          highlightActiveLine(),
          history(),
          bracketMatching(),
          cpp(),
          syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
          oneDark,
          theme,
          keymap.of([indentWithTab, ...defaultKeymap, ...historyKeymap]),
          EditorView.editable.of(!readOnly),
          ViewPlugin.fromClass(class {
            update(update) {
              if (!update.docChanged || applying.current) return;
              const text = update.state.doc.toString();
              own.current = text;
              onChangeRef.current?.(text);
            }
          }),
      ],
    });
    viewRef.current = view;
    view.focus();
    } catch (err) {
      console.error(err);
      return undefined;
    }
    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // Recreate when the file identity changes, not on every keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [testId, readOnly]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const next = code || "";
    if (next === own.current) return;
    own.current = next;
    const current = view.state.doc.toString();
    if (current === next) return;
    applying.current = true;
    view.dispatch({ changes: { from: 0, to: current.length, insert: next } });
    applying.current = false;
  }, [code]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view || !target?.line) return;
    const span = lineSpan(view.state.doc.toString(), target.line);
    view.dispatch({
      selection: { anchor: span.from, head: span.to },
      scrollIntoView: true,
    });
    view.focus();
  }, [target?.nonce, target?.line]);

  return (
    <div className="code-box" data-testid={`editor-${testId}`}>
      <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--border-soft)] bg-[var(--bg-secondary)]">
        <span className="font-mono text-[11px] uppercase tracking-widest text-[var(--text-secondary)]">{title}</span>
        <span className="text-[10.5px] font-mono text-[var(--text-muted)]">{readOnly ? "Read only" : "Editable"}</span>
      </div>
      <div ref={host} className="overflow-auto max-h-[480px] min-h-[120px]" data-testid={`${testId}-editor`} onMouseDown={() => viewRef.current?.focus()} />
    </div>
  );
}
