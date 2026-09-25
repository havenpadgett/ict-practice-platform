-- NOT YET APPLIED. Written 2026-09-25; apply with `supabase db push` (or
-- paste into the SQL editor) before deploying code that writes session_id.
--
-- 1. session_id (PRD Section 9 lists it; it was never stored — see the
--    PRD Bug Log, 2026-09-25). Nullable: existing rows have none. The app
--    starts writing it only after this is applied (src/lib/attempt-rows.ts).
--
-- 2. Indexes for the two queries the app actually runs on attempts:
--    - fetchAttempts: where user_id = $1 order by created_at   (every
--      dashboard / analytics / CSV export / adaptive-session load)
--    - nextAttemptNumber: count(*) where user_id = $1 and exercise_id = $2
--      (once per saved attempt)
--    The composite (user_id, created_at) serves the first as an index scan
--    already in order (no sort) and makes the old single-column user_id
--    index redundant — any query it served can use the composite's prefix.

alter table public.attempts
  add column if not exists session_id text;

create index if not exists idx_attempts_user_created_at
  on public.attempts (user_id, created_at);

create index if not exists idx_attempts_user_exercise
  on public.attempts (user_id, exercise_id);

drop index if exists public.idx_attempts_user_id;
