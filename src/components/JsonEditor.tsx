"use client";

import { useEffect, useRef, useCallback } from "react";
import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter } from "@codemirror/view";
import { EditorState } from "@codemirror/state";
import { json } from "@codemirror/lang-json";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { syntaxHighlighting, defaultHighlightStyle, bracketMatching, foldGutter, foldKeymap } from "@codemirror/language";
import { searchKeymap, highlightSelectionMatches } from "@codemirror/search";
import { closeBrackets, closeBracketsKeymap } from "@codemirror/autocomplete";
import { lintGutter } from "@codemirror/lint";

const darkTheme = EditorView.theme({
  "&": {
    backgroundColor: "#18181b",
    color: "#e4e4e7",
    fontSize: "13px",
    height: "100%",
  },
  ".cm-content": {
    caretColor: "#e4e4e7",
    fontFamily: "var(--font-geist-mono), monospace",
  },
  ".cm-cursor": {
    borderLeftColor: "#e4e4e7",
  },
  "&.cm-focused .cm-selectionBackground, .cm-selectionBackground": {
    backgroundColor: "#3f3f46 !important",
  },
  ".cm-gutters": {
    backgroundColor: "#18181b",
    color: "#71717a",
    border: "none",
    borderRight: "1px solid #27272a",
  },
  ".cm-activeLineGutter": {
    backgroundColor: "#27272a",
  },
  ".cm-activeLine": {
    backgroundColor: "#27272a40",
  },
  ".cm-foldGutter .cm-gutterElement": {
    color: "#71717a",
  },
  ".cm-scroller": {
    overflow: "auto",
  },
}, { dark: true });

interface JsonEditorProps {
  value: string;
  onChange: (value: string) => void;
}

export default function JsonEditor({ value, onChange }: JsonEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const createView = useCallback((container: HTMLElement, doc: string) => {
    const state = EditorState.create({
      doc,
      extensions: [
        lineNumbers(),
        highlightActiveLineGutter(),
        highlightActiveLine(),
        history(),
        foldGutter(),
        bracketMatching(),
        closeBrackets(),
        highlightSelectionMatches(),
        syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
        json(),
        lintGutter(),
        darkTheme,
        keymap.of([
          ...defaultKeymap,
          ...historyKeymap,
          ...foldKeymap,
          ...searchKeymap,
          ...closeBracketsKeymap,
        ]),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            onChangeRef.current(update.state.doc.toString());
          }
        }),
        EditorView.lineWrapping,
      ],
    });

    return new EditorView({ state, parent: container });
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;
    const view = createView(containerRef.current, value);
    viewRef.current = view;
    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // Only create once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const current = view.state.doc.toString();
    if (current !== value) {
      view.dispatch({
        changes: { from: 0, to: current.length, insert: value },
      });
    }
  }, [value]);

  return (
    <div ref={containerRef} className="h-full overflow-hidden [&_.cm-editor]:h-full" />
  );
}
