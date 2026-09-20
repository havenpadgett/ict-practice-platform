-- Adds the exercise's difficulty (1-3, from src/data/exercises.ts at the
-- time of the attempt) to each recorded attempt, so accuracy-by-difficulty
-- can be computed without joining back against exercise content that may
-- since have changed or been removed. Nullable: existing rows predate this
-- column and have no difficulty recorded — accuracy-by-difficulty queries
-- simply exclude nulls rather than treating them as any particular value.

alter table public.attempts
  add column if not exists difficulty smallint;

alter table public.attempts
  drop constraint if exists attempts_difficulty_check;

alter table public.attempts
  add constraint attempts_difficulty_check
  check (difficulty is null or difficulty in (1, 2, 3));
