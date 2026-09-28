import { describe, expect, it } from "vitest";
import { getExerciseMeta } from "@/data/catalog";
import { buildMixedSessionIds } from "@/lib/session-builder";
import { accuracyLabel } from "@/lib/practice-modes";

describe("mixed-concepts session", () => {
  it("draws distinct, practice-ready recognition exercises from several concepts", () => {
    for (let run = 0; run < 50; run++) {
      const ids = buildMixedSessionIds(10);
      expect(ids).toHaveLength(10);
      expect(new Set(ids).size).toBe(10);
      const metas = ids.map((id) => getExerciseMeta(id)!);
      expect(metas.every((m) => m.practice_ready)).toBe(true);
      expect(metas.some((m) => m.concept === "GuidedEntry" || m.concept === "FreeTrade")).toBe(false);
      expect(new Set(metas.map((m) => m.concept)).size).toBeGreaterThanOrEqual(3);
    }
  });

  it("stops when it runs out rather than repeating", () => {
    const ids = buildMixedSessionIds(1000);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("accuracy labels", () => {
  it("never shows a percentage below five attempts", () => {
    expect(accuracyLabel(undefined)).toBe("Not started");
    expect(accuracyLabel({ attempts: 1, accuracy: 1 })).toBe("1 attempt · not enough to score yet");
    expect(accuracyLabel({ attempts: 4, accuracy: 0 })).toBe("4 attempts · not enough to score yet");
    expect(accuracyLabel({ attempts: 22, accuracy: 0.727 })).toBe("73% · 22 attempts");
  });
});
