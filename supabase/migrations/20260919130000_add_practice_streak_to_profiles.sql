-- Tracks the user's practice streak (consecutive days with at least one
-- completed session) directly on their profile row, updated once per
-- completed session rather than recomputed from attempts on every
-- dashboard load. last_completed_date is a plain date (not timestamptz) —
-- streak logic only ever cares which calendar day a session completed on,
-- computed client-side in the user's local timezone.

alter table public.profiles
  add column if not exists current_streak integer not null default 0,
  add column if not exists last_completed_date date;

alter table public.profiles
  drop constraint if exists profiles_current_streak_check;

alter table public.profiles
  add constraint profiles_current_streak_check
  check (current_streak >= 0);
