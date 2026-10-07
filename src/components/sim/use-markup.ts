"use client";

import { useCallback, useState } from "react";
import type { Annotation } from "@/lib/engine/types";

/** Marks on a static chart (the staged modes): add, select, delete, undo,
 * clear. The replay's own reducer does the same inside its state machine. */
export function useMarkup() {
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [history, setHistory] = useState<Annotation[][]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [counter, setCounter] = useState(1);

  const push = useCallback((next: Annotation[]) => {
    setHistory((h) => [...h, annotations]);
    setAnnotations(next);
  }, [annotations]);

  return {
    annotations,
    selectedId,
    canUndo: history.length > 0,
    add: (a: Omit<Annotation, "id">) => {
      push([...annotations, { ...a, id: `s${counter}` }]);
      setCounter((c) => c + 1);
      setSelectedId(null);
    },
    select: setSelectedId,
    remove: () => {
      if (!selectedId) return;
      push(annotations.filter((a) => a.id !== selectedId));
      setSelectedId(null);
    },
    undo: () => {
      if (history.length === 0) return;
      setAnnotations(history[history.length - 1]);
      setHistory(history.slice(0, -1));
      setSelectedId(null);
    },
    clear: () => {
      if (annotations.length === 0) return;
      push([]);
      setSelectedId(null);
    },
    replace: (next: Annotation[]) => {
      setAnnotations(next);
      setHistory([]);
    },
  };
}
