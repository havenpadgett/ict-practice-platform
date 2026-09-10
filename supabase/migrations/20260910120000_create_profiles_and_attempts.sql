-- Profiles and attempts: user data only. Exercises stay in code
-- (src/data/exercises.ts), version-controlled and reviewed against
-- docs/CURRICULUM.md — nothing about exercise content lives in the
-- database.

-- Needed for gen_random_uuid() below. Supabase projects usually have this
-- enabled already; this is a no-op if so.
create extension if not exists pgcrypto;

-- One row per authenticated user, extending auth.users (Supabase's own
-- user table, which this project doesn't manage — auth isn't built yet).
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text,
  created_at timestamptz not null default now()
);

-- One row per graded exercise attempt (PRD Section 9 fields).
--
-- Zone fields (user_price_low, user_price_high, user_candle_start,
-- user_candle_end, coverage, precision_ratio) are populated only when
-- answer_type = 'zone' and user_answer_type = 'region' (the user drew a
-- box).
--
-- Level fields (user_price, distance_from_level) are populated only when
-- answer_type = 'level' and user_answer_type = 'level' (the user placed a
-- line).
--
-- When user_answer_type = 'none' (the user answered "no zone/level
-- present"), neither set is populated.
create table if not exists public.attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  exercise_id text not null,
  concept text not null,
  answer_type text not null check (answer_type in ('zone', 'level')),
  user_answer_type text not null check (user_answer_type in ('region', 'level', 'none')),

  -- Zone fields
  user_price_low double precision,
  user_price_high double precision,
  user_candle_start integer,
  user_candle_end integer,
  coverage double precision,
  precision_ratio double precision,

  -- Level fields
  user_price double precision,
  distance_from_level double precision,

  is_correct boolean not null,
  failure_reason text,
  response_time_ms integer not null,
  attempt_number integer not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_attempts_user_id on public.attempts (user_id);

-- Row Level Security: every user can only read and write their own rows.
alter table public.profiles enable row level security;
alter table public.attempts enable row level security;

create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "Users can delete own profile"
  on public.profiles for delete
  using (auth.uid() = id);

create policy "Users can view own attempts"
  on public.attempts for select
  using (auth.uid() = user_id);

create policy "Users can insert own attempts"
  on public.attempts for insert
  with check (auth.uid() = user_id);

create policy "Users can update own attempts"
  on public.attempts for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own attempts"
  on public.attempts for delete
  using (auth.uid() = user_id);
