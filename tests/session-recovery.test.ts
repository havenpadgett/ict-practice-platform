// Session recovery (src/lib/storage.ts → ExerciseProgress): the exercise on
// screen is autosaved and restored after a refresh, but only onto the same
// session, position and exercise it was saved for.

import { beforeEach, describe, expect, it } from "vitest";

const store = new Map<string, string>();
Object.assign(globalThis, {
  window: {
    localStorage: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    },
  },
});

const { clearSession, createSession, loadProgress, loadSession, MISTAKES_SESSION, saveProgress, saveSession } = await import("@/lib/storage");

const session = () => ({ ...createSession("FVG", ["fvg-001", "fvg-002"]), session_id: "s1" });
const progress = (over: Record<string, unknown> = {}) => ({
  session_id: "s1",
  current_index: 0,
  exercise_id: "fvg-001",
  started_at: 1000,
  draft: { region: { priceLow: 1, priceHigh: 2, candleIndexLow: 3, candleIndexHigh: 4 }, level: null, choice: null },
  graded: null,
  ...over,
});

describe("exercise progress autosave", () => {
  beforeEach(() => store.clear());

  it("restores what was saved for the exercise on screen", () => {
    saveProgress(progress());
    expect(loadProgress(session())).toEqual(progress());
  });

  it("never restores onto a different session, position or exercise", () => {
    saveProgress(progress({ session_id: "other" }));
    expect(loadProgress(session())).toBeNull();
    saveProgress(progress({ current_index: 1 }));
    expect(loadProgress(session())).toBeNull();
    saveProgress(progress({ exercise_id: "fvg-002" }));
    expect(loadProgress(session())).toBeNull();
    saveProgress(progress());
    expect(loadProgress({ ...session(), completed: true })).toBeNull();
  });

  it("ignores anything malformed", () => {
    store.set("ict-practice:progress", "{not json");
    expect(loadProgress(session())).toBeNull();
    store.set("ict-practice:progress", JSON.stringify({ session_id: "s1" }));
    expect(loadProgress(session())).toBeNull();
  });

  it("keeps a graded answer so a refresh can't score it twice", () => {
    const graded = { result: { isCorrect: true, explanation: "x" }, reveal: { zone: null, level: 21000 } };
    saveProgress(progress({ graded }));
    expect(loadProgress(session())?.graded).toEqual(graded);
  });

  it("is cleared with the session (sign-out, starting over)", () => {
    saveSession(session());
    saveProgress(progress());
    clearSession();
    expect(loadSession()).toBeNull();
    expect(store.has("ict-practice:progress")).toBe(false);
  });

  it("a Review Mistakes session survives a refresh", () => {
    saveSession({ ...createSession(MISTAKES_SESSION, ["fvg-001"]), session_id: "m1" });
    expect(loadSession()?.concept).toBe(MISTAKES_SESSION);
  });
});
