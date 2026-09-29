-- NOT YET APPLIED. Depends on 20260929120000_add_verdict_to_attempts.sql
-- (must run after it) and 20260926120000_analytics_views.sql (must run
-- after it too, and both are themselves not yet applied — see
-- docs/APP_PERFECTION_PLAN.md, "Blocked on Haven").
--
-- Adds a COULD_IMPROVE breakdown to v_accuracy_by_concept, so the
-- analytics page (Phase B, docs/APP_PERFECTION_PLAN.md) can show how much
-- of a concept's accuracy is a near miss rather than a clean correct. Every
-- other column is untouched — this is `create or replace view`, not a new
-- view, so every existing consumer keeps reading the same columns it did
-- before.

-- CREATE OR REPLACE VIEW can only append columns, not insert them in the
-- middle (Postgres matches trailing columns positionally) — the new ones
-- go after last_attempt_at, not next to accuracy.
create or replace view public.v_accuracy_by_concept
with (security_invoker = true) as
select
  user_id,
  concept,
  count(*)                                             as attempts,
  count(*) filter (where is_correct)                   as correct,
  round(avg(is_correct::int)::numeric, 3)              as accuracy,
  min(created_at)                                      as first_attempt_at,
  max(created_at)                                      as last_attempt_at,
  -- How much of `accuracy` is a near miss (COULD_IMPROVE) rather than a
  -- clean CORRECT. 0 for every attempt recorded before verdict existed
  -- (null) — nothing to recover there, same as is_correct's own
  -- backward-compat reading of those rows.
  count(*) filter (where verdict = 'could_improve')    as could_improve,
  round((count(*) filter (where verdict = 'could_improve'))::numeric
        / nullif(count(*), 0), 3)                      as could_improve_rate
from public.attempts
group by user_id, concept;
