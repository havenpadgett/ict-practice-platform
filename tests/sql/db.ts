// An in-process Postgres (PGlite) with every migration in
// supabase/migrations applied, plus the few Supabase pieces the migrations
// assume: the auth schema with auth.users and auth.uid(), and the
// `authenticated` role. Lets the tests run the real SQL — views, functions,
// Row Level Security — without a Supabase project.

import fs from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";

const MIGRATIONS = path.resolve(__dirname, "../../supabase/migrations");

/** Every migration, or with `before`, only those whose filename sorts
 * before it (to test a migration against data written before it). */
export async function migratedDb(opts: { before?: string } = {}): Promise<PGlite> {
  const db = new PGlite();
  await db.exec(`
    create schema auth;
    create table auth.users (id uuid primary key, email text);
    create function auth.uid() returns uuid language sql stable
      as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create function auth.jwt() returns jsonb language sql stable
      as $$ select jsonb_build_object('email', current_setting('request.jwt.claim.email', true)) $$;
    create role authenticated;
    create role anon;
    grant usage on schema public to authenticated, anon;
    grant usage on schema auth to authenticated, anon;
    alter default privileges in schema public grant all on tables to authenticated;
    alter default privileges in schema public grant execute on functions to authenticated;
  `);
  await applyMigrations(db, (f) => !opts.before || f < opts.before);
  await db.exec(`grant select, insert, update, delete on all tables in schema public to authenticated;`);
  return db;
}

export async function applyMigrations(db: PGlite, include: (file: string) => boolean): Promise<void> {
  for (const file of fs.readdirSync(MIGRATIONS).filter((f) => f.endsWith(".sql") && include(f)).sort()) {
    // pgcrypto isn't bundled; gen_random_uuid() is built into Postgres 13+.
    const sql = fs.readFileSync(path.join(MIGRATIONS, file), "utf8").replace(/create extension if not exists pgcrypto;/g, "");
    try {
      await db.exec(sql);
    } catch (err) {
      throw new Error(`${file}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}

/** Run `fn` as a signed-in user, the way PostgREST does. */
export async function asUser<T>(db: PGlite, userId: string, fn: () => Promise<T>, email = "user@example.com"): Promise<T> {
  await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub', '${userId}', false); select set_config('request.jwt.claim.email', '${email}', false);`);
  try {
    return await fn();
  } finally {
    await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false);`);
  }
}

export const A = "00000000-0000-0000-0000-00000000000a";
export const B = "00000000-0000-0000-0000-00000000000b";

type Row = {
  user?: string;
  exercise?: string;
  concept?: string;
  difficulty?: number;
  answer_type?: string;
  correct: boolean;
  ms?: number;
  session?: string | null;
  at: string;
  extra?: Record<string, unknown>;
};

export async function seed(db: PGlite, rows: Row[]): Promise<void> {
  await db.exec(`insert into auth.users (id, email) values ('${A}', 'a@example.com'), ('${B}', 'b@example.com') on conflict do nothing;
    insert into public.profiles (id) values ('${A}'), ('${B}') on conflict do nothing;`);
  for (const r of rows) {
    const type = r.answer_type ?? "zone";
    const cols: Record<string, unknown> = {
      user_id: r.user ?? A,
      exercise_id: r.exercise ?? "fvg-001",
      concept: r.concept ?? "FVG",
      difficulty: r.difficulty ?? 1,
      answer_type: type,
      user_answer_type: type === "zone" ? "region" : type,
      is_correct: r.correct,
      response_time_ms: r.ms ?? 5000,
      attempt_number: 1,
      session_id: r.session === undefined ? "s1" : r.session,
      created_at: r.at,
      // A well-formed answer for the mode (20260927130000_attempt_integrity.sql);
      // tests override what they care about through `extra`.
      ...shapeFor(type, r.correct),
      ...r.extra,
    };
    normalize(cols);
    const keys = Object.keys(cols);
    await db.query(
      `insert into public.attempts (${keys.join(",")}) values (${keys.map((_, i) => `$${i + 1}`).join(",")})`,
      Object.values(cols),
    );
  }
}

function shapeFor(type: string, correct: boolean): Record<string, unknown> {
  switch (type) {
    case "zone":
      return {
        user_price_low: 100, user_price_high: 110, user_candle_start: 0, user_candle_end: 2,
        coverage: correct ? 0.8 : 0.3, precision_ratio: 1.2, failure_reason: correct ? null : "coverage",
      };
    case "level":
      return { user_price: 100, distance_from_level: correct ? 0.5 : 20, failure_reason: correct ? null : "off_level" };
    case "choice":
      return { user_choice: "a", correct_choice: correct ? "a" : "b", failure_reason: correct ? null : "wrong_choice" };
    case "guided":
      return { guided_bias_choice: "bullish", guided_bias_correct: true, guided_declared_trade: false };
    default:
      return { free_outcome: "no_trade" };
  }
}

/** Fill in the fields a guided/free row's flags imply, so fixtures that set
 * only the columns a view reads still satisfy the integrity constraints. */
function normalize(c: Record<string, unknown>): void {
  if (c.answer_type === "guided") {
    const price: Record<string, number> = { entry: 100, stop: 90, target: 130 };
    for (const step of ["entry", "stop", "target"]) {
      if (c[`guided_${step}_correct`] !== undefined && c[`guided_${step}_correct`] !== null) c[`guided_${step}_price`] ??= price[step];
    }
  }
  if (c.answer_type === "free") {
    const outcome = c.free_outcome as string;
    const ok = c.is_correct as boolean;
    if (outcome === "no_trade") {
      Object.assign(c, { free_direction: "none", free_result_r: null, free_decision_correct: ok });
      return;
    }
    const r = typeof c.free_result_r === "number" ? c.free_result_r : 0.5;
    Object.assign(c, {
      free_direction: "long", free_entry_price: 100, free_stop_price: 90, free_target_price: 125,
      free_entry_candle_index: 5, free_exit_candle_index: 6, free_rr: 2.5,
      free_exit_reason: outcome === "win" ? "target" : outcome === "loss" ? "stop" : "session_end",
      free_exit_price: outcome === "win" ? 125 : outcome === "loss" ? 90 : 105,
      free_result_r: outcome === "win" ? (r > 0 ? r : 2.5) : outcome === "loss" ? -1 : Math.max(-1, r),
      free_direction_correct: true, free_entry_correct: true, free_stop_correct: true, free_rr_correct: true,
      free_decision_correct: ok,
    });
  }
}
