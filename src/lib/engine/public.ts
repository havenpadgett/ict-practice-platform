// What the browser may see of a scenario before an attempt ends: the data up
// to the cursor, the prompt and the controls. Never the reference analysis,
// the explanation, or candles past the cursor. The server builds these
// (src/app/train/actions.ts) and sends further candles only as they are
// revealed. Same stance as docs/ANSWER-KEYS.md; the same documented limit:
// someone who calls the reveal action directly can read ahead.

import type { PublicScenario, Scenario } from "@/lib/engine/types";

/** The most candles one reveal call returns. */
export const MAX_REVEAL = 240;

export function toPublicScenario(s: Scenario, revealed: number = s.cursorStart): PublicScenario {
  const upTo = Math.max(1, Math.min(revealed, s.data.stream.length));
  return {
    id: s.id,
    title: s.title,
    difficulty: s.difficulty,
    instrument: s.instrument,
    seeded: s.provenance.kind === "seeded",
    cursorStart: s.cursorStart,
    streamTimeframe: s.data.streamTimeframe,
    history: s.data.history,
    stream: s.data.stream.slice(0, upTo),
    checkpoints: s.checkpoints,
    prompt: s.prompt,
    intro: s.intro,
    confluenceOptions: s.reference.confluences.map((c) => ({ id: c.id, label: c.label })),
    candidates: s.reference.annotations
      .filter((a) => a.candidate)
      .map((a) => ({ id: a.id, label: a.label, kind: a.kind, price: a.price, priceLow: a.priceLow, priceHigh: a.priceHigh, t: a.t, tStart: a.tStart, tEnd: a.tEnd })),
  };
}

/** A chunk of the stream after `from`; `done` once it reaches the end. */
export function revealChunk(s: Scenario, from: number, count: number): { rows: Scenario["data"]["stream"]; from: number; done: boolean } {
  const start = Math.max(0, Math.min(Math.floor(from), s.data.stream.length));
  const n = Math.max(0, Math.min(Math.floor(count), MAX_REVEAL));
  const rows = s.data.stream.slice(start, start + n);
  return { rows, from: start, done: start + rows.length >= s.data.stream.length };
}
