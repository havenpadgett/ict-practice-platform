-- NOT YET APPLIED. Database-level integrity for attempts (written
-- 2026-09-27; docs/DATA-INTEGRITY.md). Bad rows are refused by the
-- database even if application code has a bug.
--
-- Note: a CHECK passes when its expression is NULL, so comparisons on
-- nullable columns below use IS [NOT] DISTINCT FROM or COALESCE.
--
-- Every constraint is added NOT VALID. It is enforced on every new or
-- changed row from the moment this runs, but existing rows aren't checked
-- during the migration, so it can't fail on historical data. The block at
-- the end then tries to VALIDATE each constraint and prints a NOTICE for
-- any that existing rows violate, instead of failing. To see the violating
-- rows, run supabase/audit/attempt_integrity_audit.sql. Fix or delete them,
-- then run:  alter table public.attempts validate constraint <name>;
--
-- The grading thresholds (60% coverage, 2.5x precision, level tolerances)
-- are deliberately NOT encoded here. They are an open decision (PRD D-3),
-- and rows graded under old thresholds must stay valid. The constraints
-- check structure and consistency, not the grading math.

-- 1. A real user and a valid concept -----------------------------------------
-- user_id -> profiles(id) -> auth.users(id) already exists (both FKs,
-- on delete cascade), and user_id is NOT NULL.

alter table public.attempts drop constraint if exists attempts_concept_valid;
alter table public.attempts add constraint attempts_concept_valid check (
  concept in ('FVG', 'Liquidity', 'MSS', 'IFVG', 'OrderBlock', 'TimeLiquidity', 'PremiumDiscount', 'GuidedEntry', 'FreeTrade')
) not valid;

-- The two trade modes have their own concept; recognition never uses them.
alter table public.attempts drop constraint if exists attempts_concept_matches_mode;
alter table public.attempts add constraint attempts_concept_matches_mode check (
  (answer_type = 'guided') = (concept = 'GuidedEntry')
  and (answer_type = 'free') = (concept = 'FreeTrade')
) not valid;

alter table public.attempts drop constraint if exists attempts_exercise_id_format;
alter table public.attempts add constraint attempts_exercise_id_format check (
  exercise_id ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(exercise_id) <= 64
) not valid;

-- 2. The answer type claimed is the one whose fields are filled -------------
-- user_answer_type must fit answer_type, and that answer's fields must be
-- present.
alter table public.attempts drop constraint if exists attempts_answer_shape;
alter table public.attempts add constraint attempts_answer_shape check (
  case user_answer_type
    when 'region' then answer_type = 'zone'
      and num_nulls(user_price_low, user_price_high, user_candle_start, user_candle_end) = 0
    when 'level' then answer_type = 'level' and user_price is not null
    when 'choice' then answer_type = 'choice' and user_choice is not null and correct_choice is not null
    when 'guided' then answer_type = 'guided'
      and guided_bias_choice is not null and guided_declared_trade is not null and guided_bias_correct is not null
    when 'free' then answer_type = 'free'
      and free_direction is not null and free_outcome is not null and free_decision_correct is not null
    when 'none' then answer_type in ('zone', 'level')
    else false
  end
) not valid;

-- Fields belonging to other answer types stay empty.
alter table public.attempts drop constraint if exists attempts_foreign_fields_empty;
alter table public.attempts add constraint attempts_foreign_fields_empty check (
  (user_answer_type = 'region' or num_nonnulls(user_price_low, user_price_high, user_candle_start, user_candle_end, coverage, precision_ratio) = 0)
  and (user_answer_type = 'level' or num_nonnulls(user_price, distance_from_level) = 0)
  and (answer_type = 'choice' or num_nonnulls(user_choice, correct_choice) = 0)
  and (answer_type = 'guided' or num_nonnulls(
        guided_bias_choice, guided_entry_price, guided_stop_price, guided_target_price,
        guided_bias_correct, guided_entry_correct, guided_stop_correct, guided_target_correct,
        guided_achieved_rr, guided_declared_trade) = 0)
  and (answer_type = 'free' or num_nonnulls(
        free_direction, free_entry_price, free_stop_price, free_target_price,
        free_entry_candle_index, free_exit_candle_index, free_exit_price, free_exit_reason,
        free_rr, free_result_r, free_outcome,
        free_direction_correct, free_entry_correct, free_stop_correct, free_rr_correct, free_decision_correct) = 0)
) not valid;

-- 3. Correctness can't contradict the answer it describes -------------------
-- Recognition: a correct answer has no failure reason, a wrong one has a
-- reason that fits how it was answered. The trade modes don't use
-- failure_reason.
alter table public.attempts drop constraint if exists attempts_failure_reason_consistent;
alter table public.attempts add constraint attempts_failure_reason_consistent check (
  case
    when answer_type in ('guided', 'free') then failure_reason is null
    when is_correct then failure_reason is null
    -- coalesce: a NULL reason would otherwise make the check pass.
    else coalesce(failure_reason = any (case user_answer_type
      when 'region' then array['coverage', 'too_small', 'precision', 'time', 'false_positive']
      when 'level'  then array['off_level', 'false_positive']
      when 'choice' then array['wrong_choice']
      when 'none'   then array['missed_answer']
      else array[]::text[] end), false)
  end
) not valid;

-- A drawn box or line is measured against the key when there is one; no
-- measurement means the chart had nothing to find (a false positive).
alter table public.attempts drop constraint if exists attempts_measurement_consistent;
alter table public.attempts add constraint attempts_measurement_consistent check (
  (user_answer_type <> 'region' or (coverage is null) = (precision_ratio is null))
  and (user_answer_type <> 'region' or coverage is not null or (not is_correct and failure_reason is not distinct from 'false_positive'))
  and (user_answer_type <> 'level' or distance_from_level is not null or (not is_correct and failure_reason is not distinct from 'false_positive'))
) not valid;

alter table public.attempts drop constraint if exists attempts_choice_consistent;
alter table public.attempts add constraint attempts_choice_consistent check (
  user_answer_type <> 'choice' or is_correct = (user_choice = correct_choice)
) not valid;

-- Guided Entry: steps are reached in order; a step's verdict exists exactly
-- when its level was placed; "unclear" has no levels; a declared trade has
-- all three; a correct declared trade got every step right.
alter table public.attempts drop constraint if exists attempts_guided_consistent;
alter table public.attempts add constraint attempts_guided_consistent check (
  answer_type <> 'guided' or (
    (guided_entry_price is null) = (guided_entry_correct is null)
    and (guided_stop_price is null) = (guided_stop_correct is null)
    and (guided_target_price is null) = (guided_target_correct is null)
    and (guided_stop_price is null or guided_entry_price is not null)
    and (guided_target_price is null or guided_stop_price is not null)
    and (guided_bias_choice <> 'unclear' or (guided_entry_price is null and not guided_declared_trade))
    and (not guided_declared_trade or num_nulls(guided_entry_price, guided_stop_price, guided_target_price) = 0)
    and (not (is_correct and guided_declared_trade) or (
      coalesce(guided_bias_correct and guided_entry_correct and guided_stop_correct and guided_target_correct, false)
      and guided_achieved_rr is not null))
  )
) not valid;

-- Free Trade: no trade means no position and outcome 'no_trade'; a trade
-- has its levels, an exit and a result whose sign matches the outcome;
-- the process verdict is exactly "no applicable check failed".
alter table public.attempts drop constraint if exists attempts_free_consistent;
alter table public.attempts add constraint attempts_free_consistent check (
  answer_type <> 'free' or (
    case when free_direction = 'none' then
      free_outcome = 'no_trade'
      and num_nonnulls(free_entry_price, free_stop_price, free_target_price, free_entry_candle_index,
                       free_exit_candle_index, free_exit_price, free_exit_reason, free_rr, free_result_r,
                       free_direction_correct, free_entry_correct, free_stop_correct, free_rr_correct) = 0
    else
      free_outcome in ('win', 'loss', 'open')
      and num_nulls(free_entry_price, free_stop_price, free_target_price, free_entry_candle_index,
                    free_exit_candle_index, free_exit_price, free_exit_reason, free_result_r,
                    free_direction_correct, free_entry_correct, free_rr_correct) = 0
      and free_exit_candle_index >= free_entry_candle_index
      and case free_outcome
            when 'win'  then free_exit_reason = 'target' and free_result_r > 0
            when 'loss' then free_exit_reason = 'stop' and free_result_r = -1
            else free_exit_reason = 'session_end'
          end
    end
    and is_correct = (
      coalesce(free_direction_correct, true) and coalesce(free_entry_correct, true)
      and coalesce(free_stop_correct, true) and coalesce(free_rr_correct, true)
      and free_decision_correct)
  )
) not valid;

-- 4. Sane ranges ---------------------------------------------------------------
alter table public.attempts drop constraint if exists attempts_ranges;
alter table public.attempts add constraint attempts_ranges check (
  -- 0 to 24 hours. The clock restarts whenever an exercise is shown.
  response_time_ms between 0 and 86400000
  and attempt_number >= 1
  and (session_id is null or length(session_id) between 1 and 100)
  and (coverage is null or coverage between 0 and 1)
  and (precision_ratio is null or precision_ratio >= 0)
  and (user_price_low is null or (user_price_low > 0 and user_price_low <= user_price_high))
  and (user_candle_start is null or (user_candle_start >= 0 and user_candle_start <= user_candle_end))
  and (user_price is null or user_price > 0)
  and (guided_entry_price is null or guided_entry_price > 0)
  and (guided_stop_price is null or guided_stop_price > 0)
  and (guided_target_price is null or guided_target_price > 0)
  and (free_entry_price is null or free_entry_price > 0)
  and (free_stop_price is null or free_stop_price > 0)
  and (free_target_price is null or free_target_price > 0)
  and (free_exit_price is null or free_exit_price > 0)
  and (free_entry_candle_index is null or free_entry_candle_index >= 0)
  -- R:R. Guided is the user's own build and can be negative (target on the
  -- wrong side is a real mistake worth keeping). Free Trade placement is
  -- enforced on the right sides, so its R:R is positive. The +-1000 bound
  -- only rules out nonsense (for example a 0.01-point stop).
  and (guided_achieved_rr is null or guided_achieved_rr between -1000 and 1000)
  and (free_rr is null or (free_rr > 0 and free_rr <= 1000))
  -- An exit at the stop is exactly -1R, and nothing is worse.
  and (free_result_r is null or free_result_r between -1 and 1000)
) not valid;

-- practice_events: same idea for the event table.
alter table public.practice_events drop constraint if exists practice_events_ranges;
alter table public.practice_events add constraint practice_events_ranges check (
  (concept is null or concept in ('FVG', 'Liquidity', 'MSS', 'IFVG', 'OrderBlock', 'TimeLiquidity', 'PremiumDiscount', 'GuidedEntry', 'FreeTrade', 'Adaptive'))
  and (recommended_concept is null or recommended_concept in ('FVG', 'Liquidity', 'MSS', 'IFVG', 'OrderBlock', 'TimeLiquidity', 'PremiumDiscount', 'GuidedEntry', 'FreeTrade'))
  and (recommended_difficulty is null or recommended_difficulty in (1, 2, 3))
  and (planned_length is null or planned_length <= 200)
  and (position is null or position <= 200)
  and (session_id is null or length(session_id) between 1 and 100)
  and ((event_type = 'recommendation_shown') = (session_id is null))
) not valid;

-- Validate what existing data allows; report the rest instead of failing.
do $$
declare
  c record;
begin
  for c in
    select conrelid::regclass as tbl, conname from pg_constraint
    where not convalidated and contype = 'c'
      and conrelid in ('public.attempts'::regclass, 'public.practice_events'::regclass)
  loop
    begin
      execute format('alter table %s validate constraint %I', c.tbl, c.conname);
    exception when check_violation then
      raise notice 'Existing rows in % violate %; it is enforced for new rows only. See supabase/audit/attempt_integrity_audit.sql.', c.tbl, c.conname;
    end;
  end loop;
end;
$$;
