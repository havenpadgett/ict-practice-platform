"use client";

import { useState } from "react";
import { getPracticeCatalog } from "@/data/catalog";
import { getAvailableSessionLengths, type SessionLength } from "@/lib/session-builder";
import { CONCEPTS, conceptDisplayName, conceptShortName, type Concept } from "@/lib/concepts";
import { difficultyRange, estimateConceptMinutes } from "@/lib/practice-modes";

export function SessionLengthPicker({
  concept,
  onPick,
  onBack,
}: {
  concept: Concept;
  onPick: (length: SessionLength) => void;
  onBack: () => void;
}) {
  const lengths = getAvailableSessionLengths(concept);
  const total = getPracticeCatalog(concept).length;
  const countOf = (l: SessionLength) => (l === "all" ? total : l);
  const [selected, setSelected] = useState<SessionLength>(lengths[0]);

  return (
    <div className="max-w-xl">
      <button type="button" onClick={onBack} className="btn-link -ml-1 no-underline hover:underline">
        ← All practice
      </button>
      <h1 className="page-title mt-2">{conceptDisplayName(concept)}</h1>
      <p className="page-lede">{CONCEPTS[concept].pickerDescription}</p>
      <p className="mt-2 text-xs text-muted tabular-nums">
        {difficultyRange(concept)} · {total} exercise{total === 1 ? "" : "s"} · shuffled every session
      </p>

      {lengths.length > 1 && (
      <fieldset className="mt-8">
        <legend className="eyebrow">Session length</legend>
        <div className="mt-3 flex flex-wrap gap-3">
          {lengths.map((length) => (
            <button
              key={String(length)}
              type="button"
              onClick={() => setSelected(length)}
              aria-pressed={selected === length}
              className="btn-option"
            >
              {length === "all" ? `All ${total}` : `${length} exercises`}
            </button>
          ))}
        </div>
      </fieldset>
      )}

      <div className="mt-8 flex flex-wrap items-center gap-4 border-t border-line pt-5">
        <button type="button" onClick={() => onPick(selected)} className="btn-primary">
          Start {conceptShortName(concept)} practice
        </button>
        <span className="text-sm text-muted tabular-nums">About {estimateConceptMinutes(concept, countOf(selected))} min</span>
      </div>
    </div>
  );
}
