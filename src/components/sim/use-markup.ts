"use client";

import { useCallback, useRef, useState } from "react";
import type { Annotation } from "@/lib/engine/types";

type State = { annotations: Annotation[]; history: Annotation[][]; selectedId: string | null };

/** Marks on a static chart (the staged modes): add, select, delete, undo,
 * clear. The replay's own reducer does the same inside its state machine.
 * Every change is a functional update, so two marks made before a re-render
 * both land. */
export function useMarkup() {
  const [state, setState] = useState<State>({ annotations: [], history: [], selectedId: null });
  // A ref, not state: ids stay distinct however quickly marks are made.
  const counter = useRef(1);

  const add = useCallback((a: Omit<Annotation, "id">) => {
    const id = `s${counter.current++}`;
    setState((s) => ({ annotations: [...s.annotations, { ...a, id }], history: [...s.history, s.annotations], selectedId: null }));
  }, []);
  const select = useCallback((id: string | null) => setState((s) => ({ ...s, selectedId: id })), []);
  const remove = useCallback(() => setState((s) => (s.selectedId ? { annotations: s.annotations.filter((a) => a.id !== s.selectedId), history: [...s.history, s.annotations], selectedId: null } : s)), []);
  const undo = useCallback(() => setState((s) => (s.history.length === 0 ? s : { annotations: s.history[s.history.length - 1], history: s.history.slice(0, -1), selectedId: null })), []);
  const clear = useCallback(() => setState((s) => (s.annotations.length === 0 ? s : { annotations: [], history: [...s.history, s.annotations], selectedId: null })), []);

  return { annotations: state.annotations, selectedId: state.selectedId, canUndo: state.history.length > 0, add, select, remove, undo, clear };
}
