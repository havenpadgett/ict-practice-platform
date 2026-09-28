// "Try a sample" is reachable without an account, so it must stay narrow:
// three charts, served without keys, graded without recording anything,
// and nothing else gradeable through it.

import { describe, expect, it } from "vitest";
import { gradeSample, loadSample } from "@/app/try/actions";

describe("try a sample", () => {
  it("serves three charts without answer keys", async () => {
    const charts = await loadSample();
    expect(charts).toHaveLength(3);
    for (const c of charts) {
      const json = JSON.stringify(c);
      expect(json).not.toMatch(/"answer"|price_low|key_candle_index|tolerance|explanation|distractor_note/);
    }
  });

  it("refuses to grade anything outside the sample", async () => {
    const res = await gradeSample("fvg-002", { type: "none" });
    expect(res.ok).toBe(false);
  });

  it("rejects malformed answers", async () => {
    const res = await gradeSample("fvg-001", { type: "region", region: { priceLow: NaN } } as never);
    expect(res.ok).toBe(false);
  });

  it("grades a sample answer and reveals the key only with the verdict", async () => {
    const res = await gradeSample("liq-001", { type: "none" });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.grade.isCorrect).toBe(false);
      expect(res.reveal.level).not.toBeNull();
    }
  });
});
