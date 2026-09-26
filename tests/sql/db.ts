// An in-process Postgres (PGlite) with every migration in
// supabase/migrations applied, plus the few Supabase pieces the migrations
// assume: the auth schema with auth.users and auth.uid(), and the
// `authenticated` role. Lets the tests run the real SQL — views, functions,
// Row Level Security — without a Supabase project.

import fs from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";

const MIGRATIONS = path.resolve(__dirname, "../../supabase/migrations");

export async function migratedDb(): Promise<PGlite> {
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
  for (const file of fs.readdirSync(MIGRATIONS).filter((f) => f.endsWith(".sql")).sort()) {
    // pgcrypto isn't bundled; gen_random_uuid() is built into Postgres 13+.
    const sql = fs.readFileSync(path.join(MIGRATIONS, file), "utf8").replace(/create extension if not exists pgcrypto;/g, "");
    try {
      await db.exec(sql);
    } catch (err) {
      throw new Error(`${file}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  await db.exec(`grant select, insert, update, delete on all tables in schema public to authenticated;`);
  return db;
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
    const cols: Record<string, unknown> = {
      user_id: r.user ?? A,
      exercise_id: r.exercise ?? "fvg-001",
      concept: r.concept ?? "FVG",
      difficulty: r.difficulty ?? 1,
      answer_type: r.answer_type ?? "zone",
      user_answer_type: r.answer_type === "guided" ? "guided" : r.answer_type === "free" ? "free" : "region",
      is_correct: r.correct,
      response_time_ms: r.ms ?? 5000,
      attempt_number: 1,
      session_id: r.session === undefined ? "s1" : r.session,
      created_at: r.at,
      ...r.extra,
    };
    const keys = Object.keys(cols);
    await db.query(
      `insert into public.attempts (${keys.join(",")}) values (${keys.map((_, i) => `$${i + 1}`).join(",")})`,
      Object.values(cols),
    );
  }
}
