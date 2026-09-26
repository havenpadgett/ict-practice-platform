import { beforeAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { A, asUser, B, migratedDb, seed } from "./db";

let db: PGlite;
const at = (h: number) => new Date(Date.UTC(2026, 8, 1, h)).toISOString();

async function ev(user: string, e: Record<string, unknown>) {
  const cols = { user_id: user, ...e };
  const keys = Object.keys(cols);
  await db.query(`insert into practice_events (${keys.join(",")}) values (${keys.map((_, i) => `$${i + 1}`).join(",")})`, Object.values(cols));
}

beforeAll(async () => {
  db = await migratedDb();
  // Attempts: s1 answered 5 (completed), s2 answered 2 (tab closed), s3 answered 3 then abandoned explicitly.
  await seed(db, [
    ...Array.from({ length: 5 }, (_, i) => ({ correct: true, session: "s1", at: at(1 + i / 10) })),
    ...Array.from({ length: 2 }, (_, i) => ({ correct: false, session: "s2", at: at(30 + i / 10) })),
    ...Array.from({ length: 3 }, (_, i) => ({ correct: true, session: "s3", at: at(40 + i / 10) })),
  ]);
  await ev(A, { event_type: "recommendation_shown", recommended_concept: "MSS", recommended_difficulty: 1, created_at: at(0) });
  await ev(A, { event_type: "session_started", session_id: "s1", mode: "recognition", concept: "MSS", source: "recommendation", planned_length: 5, created_at: at(1) });
  await ev(A, { event_type: "session_completed", session_id: "s1", position: 5, created_at: at(2) });
  await ev(A, { event_type: "session_started", session_id: "s2", mode: "guided_entry", concept: "GuidedEntry", source: "picker", planned_length: 5, created_at: at(30) });
  await ev(A, { event_type: "session_started", session_id: "s3", mode: "adaptive", concept: "Adaptive", source: "adaptive_mix", planned_length: 10, created_at: at(40) });
  await ev(A, { event_type: "session_abandoned", session_id: "s3", position: 3, created_at: at(41) });
  await ev(B, { event_type: "session_started", session_id: "sb", mode: "recognition", concept: "FVG", source: "picker", planned_length: 5, created_at: at(5) });
});

const q = async (sql: string) => (await db.query(sql)).rows as Record<string, unknown>[];

describe("practice_events views", () => {
  it("funnel: started vs completed", async () => {
    expect(await q(`select sessions_started, sessions_completed, completion_rate from v_session_funnel where user_id = '${A}'`)).toEqual([
      { sessions_started: 3, sessions_completed: 1, completion_rate: "0.333" },
    ]);
  });

  it("abandonment position comes from the event, else from attempts answered", async () => {
    const rows = await q(`select planned_length, exercises_answered, sessions from v_session_abandonment order by planned_length, exercises_answered`);
    expect(rows).toEqual([
      { planned_length: 5, exercises_answered: 0, sessions: 1 }, // user B: started, answered nothing
      { planned_length: 5, exercises_answered: 2, sessions: 1 }, // s2: tab closed after 2
      { planned_length: 10, exercises_answered: 3, sessions: 1 }, // s3: explicitly abandoned at 3
    ]);
  });

  it("mode usage", async () => {
    const rows = await q(`select mode, sessions_started, users from v_mode_usage order by mode`);
    expect(rows).toEqual([
      { mode: "adaptive", sessions_started: 1, users: 1 },
      { mode: "guided_entry", sessions_started: 1, users: 1 },
      { mode: "recognition", sessions_started: 2, users: 2 },
    ]);
  });

  it("recommendation followed vs own choice", async () => {
    expect(await q(`select shown, followed, own_choice, adaptive_mix, follow_rate from v_recommendation_follow where user_id = '${A}'`)).toEqual([
      { shown: 1, followed: 1, own_choice: 1, adaptive_mix: 1, follow_rate: "1.000" },
    ]);
  });

  it("time between sessions", async () => {
    const rows = await q(`select session_id, hours_since_previous from v_time_between_sessions where user_id = '${A}' order by started_at`);
    expect(rows).toEqual([
      { session_id: "s2", hours_since_previous: "29.00" },
      { session_id: "s3", hours_since_previous: "10.00" },
    ]);
  });

  it("RLS: a user can insert and read only their own events", async () => {
    const own = await asUser(db, B, () => q(`select distinct user_id from practice_events`));
    expect(own).toEqual([{ user_id: B }]);
    await expect(asUser(db, B, () => ev(A, { event_type: "session_started", session_id: "x" }))).rejects.toThrow(/row-level security/);
  });
});
