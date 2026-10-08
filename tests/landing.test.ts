// The landing page embeds one playable exercise (src/components/landing/
// hero-exercise.tsx). It must be a good, safe one: constructed (no data-
// licence question on the front page), easy, a single valid answer, public,
// and not repeated by "Try 3 more charts".

import { describe, expect, it } from "vitest";
import { loadSample } from "@/app/try/actions";
import { getExercise, isPracticeReady } from "@/data/exercises";
import { LANDING_EXERCISE_ID } from "@/lib/challenge";
import { shareableExercise } from "@/lib/challenge-source";

describe("landing exercise", () => {
  const e = getExercise(LANDING_EXERCISE_ID);

  it("is a constructed, easy, single-answer zone exercise", () => {
    expect(e).toBeDefined();
    expect(isPracticeReady(e!)).toBe(true);
    expect(e!.provenance).toBeUndefined();
    expect(e!.answer_type).toBe("zone");
    expect(e!.difficulty).toBe(1);
    if (e!.answer_type === "zone") expect(e!.has_answer).toBe(true);
    expect(e!.concept).toBe("FVG");
  });

  it("is public, and not one of the three 'try more' charts", async () => {
    expect(shareableExercise(LANDING_EXERCISE_ID)).not.toBeNull();
    const more = await loadSample();
    expect(more.map((c) => c.exercise_id)).not.toContain(LANDING_EXERCISE_ID);
  });
});

describe("landing sample attempt", () => {
  it("is a real scored attempt on a seeded scenario, with the weak part named from the scorer's own notes", async () => {
    const { buildLandingSample } = await import("@/lib/landing-sample");
    const s = await buildLandingSample();
    expect(s).not.toBeNull();
    expect(s!.score).toBeGreaterThan(0);
    expect(s!.score).toBeLessThanOrEqual(100);
    expect(s!.dimensions.length).toBeGreaterThan(4);
    expect(s!.after.length).toBeGreaterThanOrEqual(s!.before.length);
    expect(s!.before.at(-1)!.t).toBeLessThanOrEqual(s!.decisionT);
    // The weakness named is the lowest-scoring dimension, and nothing is claimed about profit.
    const lowest = [...s!.dimensions].sort((a, b) => a.score - b.score)[0];
    expect(s!.weakest?.label).toBe(lowest.label);
    expect(JSON.stringify(s)).not.toMatch(/profit|guarantee|win rate/i);
  });
});
