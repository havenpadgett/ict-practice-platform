-- Adds the "choice" answer_type (FVG respected/disrespected — the user
-- picks an option instead of drawing) to the attempts table: new columns
-- for the picked and correct choice, and widened check constraints so
-- 'choice' is a valid answer_type / user_answer_type value alongside the
-- existing 'zone' and 'level' ones.
--
-- Choice fields (user_choice, correct_choice) are populated only when
-- answer_type = 'choice' and user_answer_type = 'choice' (the user picked
-- an option) — same pattern as the existing zone/level fields.

alter table public.attempts
  add column if not exists user_choice text,
  add column if not exists correct_choice text;

alter table public.attempts
  drop constraint if exists attempts_answer_type_check;

alter table public.attempts
  add constraint attempts_answer_type_check
  check (answer_type in ('zone', 'level', 'choice'));

alter table public.attempts
  drop constraint if exists attempts_user_answer_type_check;

alter table public.attempts
  add constraint attempts_user_answer_type_check
  check (user_answer_type in ('region', 'level', 'choice', 'none'));
