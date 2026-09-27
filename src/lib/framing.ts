// Which slice of an exercise's candles the user is shown (docs/SCENARIO-
// VALIDATION.md, Chart framing). Every chart used to be served whole, so
// the answer sat at the same place in the same-sized window every time
// (e.g. three of four IFVG answers on candle 9 of 40) and a user could
// learn where to look instead of what to look for.
//
// Each framable exercise stores a `setup_span`: the candles that must stay
// on screen — the setup, the context it depends on, and for a no-answer
// exercise the near-miss. The server picks a window that contains the span
// plus a little lead-in, spreading the answer across the window and
// varying how many candles are shown. Trimming only ever removes candles
// from the stored window, so it can't cut off the setup, show price the
// exercise was built to hide, or add a second valid answer.
//
// The window is picked from a seed (session id + exercise id), so loading
// and grading agree without storing anything, and a refresh shows the
// same chart. Grading converts candle indices back to the stored window,
// so recorded attempts stay in one coordinate system whatever was shown.

import type { Exercise, ZoneAnswer } from "@/data/exercises";

export type Frame = { start: number; end: number };

/** Candles always kept before a zone answer's span, when the window has
 * them. Other spans already start with the swings' own lookback. */
const LEAD = 3;
/** Candles always kept after a zone answer's last candle. */
const TRAIL = 1;
/** A framed chart keeps at least this share of the stored window... */
const MIN_FRACTION = 0.5;
/** ...and never fewer candles than this. */
const MIN_CANDLES = 12;
/** Position buckets the picker spreads the answer across. */
const BUCKETS = 5;

/** Recognition exercises with a setup span are framed. Guided Entry and
 * Free Trade are shown whole: their windows end at a decision point. */
export function isFramable(e: Exercise): boolean {
  return (e.answer_type === "zone" || e.answer_type === "level" || e.answer_type === "choice") && e.setup_span !== undefined;
}

/** Where the answer sits, as a candle index into the stored window: a
 * zone's middle candle; for a level, the candle in the setup span whose
 * high or low is closest to it (the swing that makes the level); otherwise
 * the middle of the setup span. */
export function answerAnchor(e: Exercise): number | null {
  if (!isFramable(e)) return null;
  if (e.answer_type === "zone" && e.answer) return e.answer.key_candle_index;
  const [s, t] = e.setup_span!;
  if (e.answer_type === "level" && e.answer) {
    const price = e.answer.price;
    let best = s;
    for (let i = s; i <= t; i++) {
      const c = e.candles[i];
      const b = e.candles[best];
      if (Math.min(Math.abs(c.high - price), Math.abs(c.low - price)) <= Math.min(Math.abs(b.high - price), Math.abs(b.low - price))) best = i;
    }
    return best;
  }
  return (s + t) / 2;
}

/** Every window the exercise may be shown in. */
export function allowedFrames(e: Exercise): Frame[] {
  const n = e.candles.length;
  if (!isFramable(e)) return [{ start: 0, end: n - 1 }];
  const [s, t] = e.setup_span!;
  const maxStart = Math.max(0, s - (e.answer_type === "zone" ? LEAD : 0));
  const minEnd = e.answer_type === "choice" ? n - 1 : Math.min(n - 1, t + (e.answer_type === "zone" ? TRAIL : 0));
  const minLen = Math.min(n, Math.max(MIN_CANDLES, Math.ceil(n * MIN_FRACTION)));
  const frames: Frame[] = [];
  for (let start = 0; start <= maxStart; start++) {
    for (let end = minEnd; end < n; end++) {
      if (end - start + 1 >= minLen) frames.push({ start, end });
    }
  }
  return frames.length > 0 ? frames : [{ start: 0, end: n - 1 }];
}

// FNV-1a, then mulberry32: small, deterministic, good enough to spread frames.
function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function rng(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The window for one showing of an exercise. A position bucket is picked
 * first, so the answer lands near the start, middle or end about equally
 * often wherever the setup allows it; then a window within that bucket,
 * which also varies the candle count. */
export function pickFrame(e: Exercise, seed: string): Frame {
  const frames = allowedFrames(e);
  const anchor = answerAnchor(e);
  if (frames.length === 1 || anchor === null) return frames[0];
  const buckets: Frame[][] = Array.from({ length: BUCKETS }, () => []);
  for (const f of frames) {
    const pos = (anchor - f.start) / (f.end - f.start);
    buckets[Math.min(BUCKETS - 1, Math.max(0, Math.floor(pos * BUCKETS)))].push(f);
  }
  const nonEmpty = buckets.filter((b) => b.length > 0);
  const rand = rng(hash(`${seed}|${e.exercise_id}`));
  const bucket = nonEmpty[Math.floor(rand() * nonEmpty.length)];
  return bucket[Math.floor(rand() * bucket.length)];
}

/** A zone answer moved into the framed window's candle indices. */
export function zoneToFrame(zone: ZoneAnswer, f: Frame): ZoneAnswer {
  return {
    ...zone,
    candle_start: zone.candle_start - f.start,
    candle_end: zone.candle_end - f.start,
    key_candle_index: zone.key_candle_index - f.start,
  };
}
