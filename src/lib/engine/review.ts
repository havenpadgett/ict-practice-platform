// The five review buckets, built from a scored attempt and the reference
// analysis. Concise and trader-worded: what you read correctly, what you
// missed, what was on the chart but didn't matter, what weakened or
// invalidated the setup, what to look for next time.

import type { AttemptResult, DimensionResult, MistakeId, RefAnnotation, ReviewBuckets, Scenario } from "@/lib/engine/types";
import { DIMENSION_LABEL } from "@/lib/engine/types";

const MAX_PER_BUCKET = 6;

function line(r: RefAnnotation): string {
  return `${r.label}: ${r.why}`;
}

function dimLine(d: DimensionResult): string {
  return `${DIMENSION_LABEL[d.dimension]}: ${d.note}`;
}

export function buildReview(scenario: Scenario, result: Omit<AttemptResult, "review"> | AttemptResult): ReviewBuckets {
  const ref = scenario.reference;
  const read: string[] = [];
  const missed: string[] = [];
  const irrelevant: string[] = [];
  const weakened: string[] = [];

  // Marks are listed mark by mark below; their dimension note would repeat them.
  const markDims = new Set(["liquidity_read", "poi_selection", "annotation_coverage"]);
  for (const d of result.dimensions) {
    if (!d.applicable) continue;
    if (result.marks && markDims.has(d.dimension)) continue;
    if (d.score >= 80) read.push(dimLine(d));
    else if (d.score < 55) missed.push(dimLine(d));
  }

  if (result.marks) {
    for (const m of result.marks.matched) if (m.ref.role !== "invalidating") read.push(`Marked ${m.ref.label}.`);
    for (const r of result.marks.missed) {
      const alternatives = r.group ? ref.annotations.filter((a) => a.group === r.group && a.id !== r.id).map((a) => a.label) : [];
      missed.push(`${line(r)}${alternatives.length ? ` (Any of these would do: ${[r.label, ...alternatives].join("; ")}.)` : ""}`);
    }
    for (const t of result.marks.trapped) weakened.push(`You marked ${t.ref.label}, which looks valid and isn't. ${t.ref.why}`);
  }

  // Everything real-but-unimportant, whether or not the user drew it.
  for (const r of ref.annotations) {
    if (r.role === "irrelevant") irrelevant.push(line(r));
    if (r.role === "trap" && !result.marks?.trapped.some((t) => t.ref.id === r.id)) irrelevant.push(`${r.label} looks like a setup and isn't. ${r.why}`);
  }
  for (const w of scenario.whyNot) irrelevant.push(`Why not ${w.label}? ${w.why}`);

  for (const r of ref.annotations) if (r.role === "invalidating") weakened.push(line(r));
  if (ref.trade && ref.trade.confirmedAtRevealed === null) weakened.push("The setup never confirmed: location without a closing candle behind it.");
  if (!ref.trade) weakened.push("There was no defensible trade here. Standing aside was the position.");

  const next = [...ref.lookFor];
  for (const m of result.mistakes) next.push(MISTAKE_TIP[m]);

  const cap = (xs: string[]) => [...new Set(xs)].slice(0, MAX_PER_BUCKET);
  return {
    readCorrectly: cap(read),
    missed: cap(missed),
    presentButIrrelevant: cap(irrelevant),
    weakenedSetup: cap(weakened),
    lookForNextTime: cap(next),
  };
}

/** What each structured mistake means in a sentence a trader would say. */
export const MISTAKE_TIP: Record<MistakeId, string> = {
  PREMATURE_ENTRY: "Wait for the confirming candle to close before the entry fills.",
  AGAINST_HTF_BIAS: "Check the higher-timeframe draw before taking a lower-timeframe setup the other way.",
  CHASED_DISPLACEMENT: "If displacement has already left the entry area, the trade is gone. Let it retrace or skip it.",
  WRONG_DRAW: "Aim at the liquidity price was drawn to, not an arbitrary round multiple.",
  STOP_TOO_TIGHT: "Put the stop where the idea is proven wrong, not where noise can reach.",
  IGNORED_OPPOSING_HTF: "Map higher-timeframe liquidity and arrays between entry and target before committing.",
  INTERNAL_EXTERNAL_CONFUSION: "Say whether the target is internal (inside the range) or external (beyond it), and which one the move is after.",
  FORCED_SETUP: "Not every chart holds a setup. No trade is a position.",
  NO_CONFIRMATION: "A good location without confirmation is a candidate, not an entry.",
};

/** Human-readable names for the structured mistakes. */
export const MISTAKE_LABEL: Record<MistakeId, string> = {
  PREMATURE_ENTRY: "Premature entry",
  AGAINST_HTF_BIAS: "Against HTF bias",
  CHASED_DISPLACEMENT: "Chased displacement",
  WRONG_DRAW: "Wrong draw on liquidity",
  STOP_TOO_TIGHT: "Stop too tight",
  IGNORED_OPPOSING_HTF: "Ignored opposing HTF structure",
  INTERNAL_EXTERNAL_CONFUSION: "Internal vs external confusion",
  FORCED_SETUP: "Forced a setup",
  NO_CONFIRMATION: "Entered without confirmation",
};
