-- Adds the "guided" answer_type (Guided Entry — bias, entry, stop, target,
-- graded as a chain rather than four independent guesses) to the attempts
-- table: new columns for the user's bias choice and placed entry/stop/
-- target prices, each step's independent correctness, the achieved
-- risk-to-reward, and whether the user confirmed all four steps as a trade
-- ("Submit Setup") versus bailing with "No Trade" — plus widened check
-- constraints so 'guided' is a valid answer_type / user_answer_type value
-- alongside the existing 'zone', 'level', and 'choice' ones.
--
-- Guided fields are populated only when answer_type = 'guided' and
-- user_answer_type = 'guided'. Within that, each guided_*_correct flag is
-- null when that step was never reached (the user chose "No Trade" before
-- placing it) rather than reached and graded wrong (which is false) — same
-- convention as the existing per-type null fields (e.g. coverage is null
-- for a level attempt, not false).

alter table public.attempts
  add column if not exists guided_bias_choice text,
  add column if not exists guided_entry_price double precision,
  add column if not exists guided_stop_price double precision,
  add column if not exists guided_target_price double precision,
  add column if not exists guided_bias_correct boolean,
  add column if not exists guided_entry_correct boolean,
  add column if not exists guided_stop_correct boolean,
  add column if not exists guided_target_correct boolean,
  add column if not exists guided_achieved_rr double precision,
  add column if not exists guided_declared_trade boolean;

alter table public.attempts
  drop constraint if exists attempts_guided_bias_choice_check;

alter table public.attempts
  add constraint attempts_guided_bias_choice_check
  check (guided_bias_choice is null or guided_bias_choice in ('bullish', 'bearish', 'unclear'));

alter table public.attempts
  drop constraint if exists attempts_answer_type_check;

alter table public.attempts
  add constraint attempts_answer_type_check
  check (answer_type in ('zone', 'level', 'choice', 'guided'));

alter table public.attempts
  drop constraint if exists attempts_user_answer_type_check;

alter table public.attempts
  add constraint attempts_user_answer_type_check
  check (user_answer_type in ('region', 'level', 'choice', 'guided', 'none'));
