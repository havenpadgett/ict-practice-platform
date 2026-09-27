// Chart framing (src/lib/framing.ts, docs/SCENARIO-VALIDATION.md → Chart
// framing). Every chart used to be served whole, so answers sat at the same
// spot in same-sized windows and a user could learn where to look instead of
// what to look for. These tests fail if served answer positions or chart
// sizes cluster again, or if a frame ever cuts into a setup.

import { describe, expect, it } from "vitest";
import { exercises, type Exercise } from "@/data/exercises";
import { allowedFrames, answerAnchor, isFramable, pickFrame, type Frame } from "@/lib/framing";
import { gradeAttempt } from "@/lib/grading";
import { toPublicExercise } from "@/lib/public-exercise";

const SEEDS = Array.from({ length: 300 }, (_, i) => `session_${i}`);
const BUCKETS = 10;

const recognition = exercises.filter((e) => e.answer_type === "zone" || e.answer_type === "level" || e.answer_type === "choice");
/** Exercises whose answer the user has to find on the chart. */
const located = exercises.filter((e) => (e.answer_type === "zone" || e.answer_type === "level") && e.has_answer);

type Spread = { maxBucketShare: number; bucketsOver5pct: number; distinctLengths: number; maxLengthShare: number };

/** How spread out the answer's position in the window, and the window's
 * size, are across a set of showings. */
function spread(showings: { e: Exercise; f: Frame }[]): Spread {
  const buckets = new Array(BUCKETS).fill(0);
  const lengths = new Map<number, number>();
  for (const { e, f } of showings) {
    const pos = (answerAnchor(e)! - f.start) / (f.end - f.start);
    buckets[Math.min(BUCKETS - 1, Math.floor(pos * BUCKETS))]++;
    const len = f.end - f.start + 1;
    lengths.set(len, (lengths.get(len) ?? 0) + 1);
  }
  const n = showings.length;
  return {
    maxBucketShare: Math.max(...buckets) / n,
    bucketsOver5pct: buckets.filter((b) => b / n >= 0.05).length,
    distinctLengths: lengths.size,
    maxLengthShare: Math.max(...lengths.values()) / n,
  };
}

/** Clustered = the answer lands in the same tenth of the window in more
 * than 45% of showings, or in fewer than four tenths at all, or the chart
 * is nearly always the same size. */
function clustered(s: Spread): boolean {
  return s.maxBucketShare > 0.45 || s.bucketsOver5pct < 4 || s.distinctLengths < 8 || s.maxLengthShare > 0.25;
}

const concepts = [...new Set(located.map((e) => e.concept))];

describe("answer positions don't cluster", () => {
  it.each(concepts)("%s: served answers are spread across the window, in varied chart sizes", (concept) => {
    const showings = located.filter((e) => e.concept === concept).flatMap((e) => SEEDS.map((seed) => ({ e, f: pickFrame(e, seed) })));
    const s = spread(showings);
    expect(clustered(s), JSON.stringify(s)).toBe(false);
  });

  it("across every concept, no tenth of the window holds more than 20% of answers", () => {
    const s = spread(located.flatMap((e) => SEEDS.map((seed) => ({ e, f: pickFrame(e, seed) }))));
    expect(s.maxBucketShare, JSON.stringify(s)).toBeLessThanOrEqual(0.2);
  });

  it("the check catches the old whole-chart framing", () => {
    // Before framing every exercise was served whole. This is the state the
    // test exists to catch, so it must read as clustered.
    const whole = (e: Exercise) => ({ e, f: { start: 0, end: e.candles.length - 1 } });
    expect(concepts.some((c) => clustered(spread(located.filter((e) => e.concept === c).map(whole))))).toBe(true);
    expect(concepts.every((c) => spread(located.filter((e) => e.concept === c).map(whole)).maxLengthShare > 0.25)).toBe(true);
  });

  it("the same exercise is framed differently across sessions, and the same within one", () => {
    for (const e of recognition) {
      if (allowedFrames(e).length < 3) continue;
      const frames = new Set(SEEDS.slice(0, 50).map((seed) => JSON.stringify(pickFrame(e, seed))));
      expect(frames.size, e.exercise_id).toBeGreaterThan(2);
      expect(pickFrame(e, "same")).toEqual(pickFrame(e, "same"));
    }
  });
});

describe("frames never cut off the setup or reach outside the stored window", () => {
  it("every recognition exercise has a setup span inside its candles", () => {
    for (const e of recognition) {
      expect(e.setup_span, e.exercise_id).toBeDefined();
      const [s, t] = e.setup_span!;
      expect(s >= 0 && s <= t && t < e.candles.length, e.exercise_id).toBe(true);
      expect(isFramable(e)).toBe(true);
    }
  });

  it("the setup span covers the answer", () => {
    for (const e of recognition) {
      const [s, t] = e.setup_span!;
      if (e.answer_type === "zone" && e.answer) {
        expect(s <= e.answer.candle_start && e.answer.candle_end <= t, e.exercise_id).toBe(true);
      }
      if (e.answer_type === "level" && e.answer) {
        // The swing that makes the level is on screen.
        const a = e.answer;
        const touches = e.candles.slice(s, t + 1).filter((c) => Math.min(Math.abs(c.high - a.price), Math.abs(c.low - a.price)) <= a.tolerance);
        expect(touches.length, e.exercise_id).toBeGreaterThan(0);
      }
      if (e.answer_type === "choice") {
        // What price did after the gap / range is the question: keep it all.
        expect(t, e.exercise_id).toBe(e.candles.length - 1);
        const z = e.answer.fvg_zone;
        if (z) expect(s <= z.candle_start, e.exercise_id).toBe(true);
        const r = e.answer.dealing_range;
        if (r) expect(s <= Math.min(r.high_index, r.low_index), e.exercise_id).toBe(true);
      }
    }
  });

  it("every allowed frame holds the whole span and stays inside the candles", () => {
    for (const e of recognition) {
      const [s, t] = e.setup_span!;
      for (const f of allowedFrames(e)) {
        expect(f.start >= 0 && f.start <= s && f.end >= t && f.end < e.candles.length, `${e.exercise_id} ${JSON.stringify(f)}`).toBe(true);
        expect(f.end - f.start + 1).toBeGreaterThanOrEqual(Math.min(e.candles.length, 12));
      }
    }
  });

  it("Guided Entry and Free Trade are always shown whole", () => {
    for (const e of exercises.filter((x) => x.answer_type === "guided" || x.answer_type === "free")) {
      expect(pickFrame(e, "s")).toEqual({ start: 0, end: e.candles.length - 1 });
    }
  });
});

describe("framed charts grade the same as the whole chart", () => {
  it("the public chart is the framed slice, with shown indices moved into it", () => {
    for (const e of recognition) {
      const f = pickFrame(e, "s1");
      const pub = toPublicExercise(e, f);
      expect(pub.candles).toEqual(e.candles.slice(f.start, f.end + 1));
      if (pub.answer_type === "choice" && e.answer_type === "choice" && e.answer.fvg_zone) {
        expect(pub.candles[pub.fvg_zone!.candle_start]).toBe(e.candles[e.answer.fvg_zone.candle_start]);
      }
    }
  });

  it("a correct box on the framed chart grades correct once moved back", () => {
    for (const e of located) {
      if (e.answer_type !== "zone" || !e.answer) continue;
      const f = pickFrame(e, "s2");
      const a = e.answer;
      const framedLow = a.candle_start - f.start;
      expect(framedLow).toBeGreaterThanOrEqual(0);
      const grade = gradeAttempt(e, {
        type: "region",
        region: { priceLow: a.price_low, priceHigh: a.price_high, candleIndexLow: framedLow + f.start, candleIndexHigh: a.candle_end },
      });
      expect(grade.isCorrect, e.exercise_id).toBe(true);
    }
  });
});
