-- NOT YET APPLIED. Phase B (docs/APP_PERFECTION_PLAN.md) replaced
-- all-or-nothing grading with a three-state verdict — CORRECT /
-- COULD_IMPROVE / INCORRECT — for every answer type. This adds the column
-- that carries it, plus a per-step reading for Guided Entry and Free
-- Trade, without touching `is_correct`: application code
-- (src/lib/verdict.ts: isCorrectForCompat) keeps writing is_correct = true
-- for both CORRECT and COULD_IMPROVE, so every existing view, dashboard,
-- and analytics computation over is_correct is unaffected by this
-- migration and needs no rewrite to stay working.
--
-- Steps to apply (Haven):
--   1. Run this file against the hosted database (alongside the other
--      not-yet-applied migrations listed in APP_PERFECTION_PLAN.md).
--   2. No backfill: `verdict` is left null on every existing row rather
--      than backfilled from is_correct. A blanket UPDATE would touch every
--      row and re-trigger every NOT VALID constraint from
--      20260927130000_attempt_integrity.sql on rows that predate it and
--      were deliberately grandfathered in (that migration's own historical
--      test case is exactly this shape) — an unrelated column changing
--      shouldn't be what surfaces an old data-quality issue. Application
--      code treats a null verdict as the binary read of is_correct it
--      always was (COULD_IMPROVE didn't exist when those rows were graded,
--      so there's nothing to recover); every row written from here on
--      always carries a real verdict.

-- 1. The overall three-state verdict, on every attempt -----------------------
-- Nullable, same convention as difficulty/session_id on older rows: null
-- means "recorded before this existed," not "unknown."
alter table public.attempts add column if not exists verdict text;

alter table public.attempts drop constraint if exists attempts_verdict_valid;
alter table public.attempts add constraint attempts_verdict_valid
  check (verdict is null or verdict in ('correct', 'could_improve', 'incorrect'));

-- Where a verdict is recorded, it and is_correct must agree — COULD_IMPROVE
-- is still a pass (the process/answer was fundamentally sound), so
-- is_correct is true for both CORRECT and COULD_IMPROVE, false only for
-- INCORRECT.
alter table public.attempts drop constraint if exists attempts_verdict_matches_is_correct;
alter table public.attempts add constraint attempts_verdict_matches_is_correct
  check (verdict is null or is_correct = (verdict <> 'incorrect'));

-- 2. Per-step verdicts — Guided Entry ------------------------------------------
-- Null exactly when the corresponding guided_*_correct flag is null (the
-- step was never reached), same convention as every other per-type column.
alter table public.attempts
  add column if not exists guided_bias_verdict text,
  add column if not exists guided_entry_verdict text,
  add column if not exists guided_stop_verdict text,
  add column if not exists guided_target_verdict text,
  add column if not exists guided_rr_verdict text;

-- 3. Per-check verdicts — Free Trade -------------------------------------------
-- free_target_verdict is new alongside the others: Phase B closes the
-- "target isn't graded on its own" V1 gap noted in docs/CURRICULUM.md by
-- adding a target check to Free Trade for the first time.
alter table public.attempts
  add column if not exists free_direction_verdict text,
  add column if not exists free_entry_verdict text,
  add column if not exists free_stop_verdict text,
  add column if not exists free_target_verdict text,
  add column if not exists free_rr_verdict text,
  add column if not exists free_decision_verdict text;

alter table public.attempts drop constraint if exists attempts_step_verdicts_valid;
alter table public.attempts add constraint attempts_step_verdicts_valid check (
  (guided_bias_verdict is null or guided_bias_verdict in ('correct', 'could_improve', 'incorrect'))
  and (guided_entry_verdict is null or guided_entry_verdict in ('correct', 'could_improve', 'incorrect'))
  and (guided_stop_verdict is null or guided_stop_verdict in ('correct', 'could_improve', 'incorrect'))
  and (guided_target_verdict is null or guided_target_verdict in ('correct', 'could_improve', 'incorrect'))
  and (guided_rr_verdict is null or guided_rr_verdict in ('correct', 'could_improve', 'incorrect'))
  and (free_direction_verdict is null or free_direction_verdict in ('correct', 'could_improve', 'incorrect'))
  and (free_entry_verdict is null or free_entry_verdict in ('correct', 'could_improve', 'incorrect'))
  and (free_stop_verdict is null or free_stop_verdict in ('correct', 'could_improve', 'incorrect'))
  and (free_target_verdict is null or free_target_verdict in ('correct', 'could_improve', 'incorrect'))
  and (free_rr_verdict is null or free_rr_verdict in ('correct', 'could_improve', 'incorrect'))
  and (free_decision_verdict is null or free_decision_verdict in ('correct', 'could_improve', 'incorrect'))
);

-- 4. Keep the "foreign fields stay empty" rule (20260927130000) covering
-- the new columns too, so a bug can't leak a guided_*_verdict onto a zone
-- attempt or vice versa.
alter table public.attempts drop constraint if exists attempts_foreign_fields_empty;
alter table public.attempts add constraint attempts_foreign_fields_empty check (
  (user_answer_type = 'region' or num_nonnulls(user_price_low, user_price_high, user_candle_start, user_candle_end, coverage, precision_ratio) = 0)
  and (user_answer_type = 'level' or num_nonnulls(user_price, distance_from_level) = 0)
  and (answer_type = 'choice' or num_nonnulls(user_choice, correct_choice) = 0)
  and (answer_type = 'guided' or num_nonnulls(
        guided_bias_choice, guided_entry_price, guided_stop_price, guided_target_price,
        guided_bias_correct, guided_entry_correct, guided_stop_correct, guided_target_correct,
        guided_bias_verdict, guided_entry_verdict, guided_stop_verdict, guided_target_verdict, guided_rr_verdict,
        guided_achieved_rr, guided_declared_trade) = 0)
  and (answer_type = 'free' or num_nonnulls(
        free_direction, free_entry_price, free_stop_price, free_target_price,
        free_entry_candle_index, free_exit_candle_index, free_exit_price, free_exit_reason,
        free_rr, free_result_r, free_outcome,
        free_direction_correct, free_entry_correct, free_stop_correct, free_rr_correct, free_decision_correct,
        free_direction_verdict, free_entry_verdict, free_stop_verdict, free_target_verdict, free_rr_verdict, free_decision_verdict) = 0)
) not valid;

-- Existing rows predate this constraint's new columns (all null there, so
-- the check already holds) — validate immediately rather than deferring,
-- matching every other constraint in 20260927130000.
alter table public.attempts validate constraint attempts_foreign_fields_empty;
