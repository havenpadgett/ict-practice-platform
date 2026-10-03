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
