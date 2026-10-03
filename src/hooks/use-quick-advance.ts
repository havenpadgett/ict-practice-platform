"use client";

import { useEffect, useRef } from "react";
import { useExperience } from "@/contexts/experience-context";
import { behavior } from "@/lib/experience";

/** Experienced learners: with feedback showing, N (or Enter, when nothing
 * else has focus) goes to the next exercise. The Next button also takes
 * focus when feedback appears, so Enter reaches it directly. */
export function useQuickAdvance(feedbackShowing: boolean, next: () => void): void {
  const { level } = useExperience();
  const enabled = behavior(level).quickAdvance && feedbackShowing;
  const nextRef = useRef(next);
  useEffect(() => {
    nextRef.current = next;
  });

  useEffect(() => {
    if (!enabled) return;
    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
      const t = e.target as HTMLElement | null;
      // Never while typing.
      if (t?.closest("input, textarea, select, [contenteditable=true]")) return;
      const isN = e.key === "n" || e.key === "N";
      // N works wherever focus is. Enter is left to a focused button, link or
      // summary (which handle it themselves) and only advances from nowhere.
      if (isN || (e.key === "Enter" && !t?.closest("button, a, summary"))) {
        e.preventDefault();
        nextRef.current();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [enabled]);
}
