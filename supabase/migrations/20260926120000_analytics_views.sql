-- NOT YET APPLIED. Analytics views over public.attempts (written
-- 2026-09-26; documented in docs/SQL-QUERIES.md).
--
-- Every view is created WITH (security_invoker = true), so it runs with the
-- caller's permissions and the attempts table's Row Level Security still
-- applies: a signed-in user querying a view sees only their own rows. The
-- same views run as the service role (SQL editor, Power BI, the admin
-- functions in 20260926130000_admin_functions.sql) cover every user.
--
-- Conventions:
--   - "real" scenarios are exercise ids starting with 'real-' (the naming
--     scripts/build_scenario.py and build_trade_scenarios.py enforce);
--     everything else is a constructed exercise.
--   - accuracy is a 0-1 fraction rounded to 3 places; multiply by 100 for %.
--   - is_correct is the grading verdict. For Guided Entry and Free Trade it
--     is the *process* verdict, never whether the trade made money.

-- 1. Accuracy by concept, per user ------------------------------------------
create or replace view public.v_accuracy_by_concept
with (security_invoker = true) as
select
  user_id,
  concept,
  count(*)                                             as attempts,
  count(*) filter (where is_correct)                   as correct,
  round(avg(is_correct::int)::numeric, 3)              as accuracy,
  min(created_at)                                      as first_attempt_at,
  max(created_at)                                      as last_attempt_at
from public.attempts
group by user_id, concept;

-- 2. Accuracy by difficulty within each concept, per user --------------------
create or replace view public.v_accuracy_by_concept_difficulty
with (security_invoker = true) as
select
  user_id,
  concept,
  difficulty,
  count(*)                                             as attempts,
  count(*) filter (where is_correct)                   as correct,
  round(avg(is_correct::int)::numeric, 3)              as accuracy
from public.attempts
where difficulty is not null
group by user_id, concept, difficulty;

-- 3. Improvement over time: successive blocks of 20 attempts, per user ------
create or replace view public.v_improvement_blocks
with (security_invoker = true) as
with numbered as (
  select
    user_id,
    is_correct,
    created_at,
    (row_number() over (partition by user_id order by created_at, id) - 1) / 20 as block_index
  from public.attempts
)
select
  user_id,
  block_index + 1                                      as block_number,
  min(created_at)                                      as block_start,
  max(created_at)                                      as block_end,
  count(*)                                             as attempts,
  round(avg(is_correct::int)::numeric, 3)              as accuracy
from numbered
group by user_id, block_index;

-- 4. Exercise difficulty in practice: success rate per exercise -------------
-- Ranked hardest first. Across every user when run as the service role;
-- for a signed-in user, across their own attempts only.
create or replace view public.v_exercise_success
with (security_invoker = true) as
select
  exercise_id,
  concept,
  (exercise_id like 'real-%')                          as is_real,
  max(difficulty)                                      as difficulty,
  count(*)                                             as attempts,
  count(distinct user_id)                              as users,
  count(*) filter (where is_correct)                   as correct,
  round(avg(is_correct::int)::numeric, 3)              as success_rate,
  rank() over (order by avg(is_correct::int), count(*) desc) as hardness_rank
from public.attempts
group by exercise_id, concept;

-- 5. Real versus constructed scenarios, per user and concept ---------------
create or replace view public.v_real_vs_constructed
with (security_invoker = true) as
select
  user_id,
  concept,
  case when exercise_id like 'real-%' then 'real' else 'constructed' end as source,
  count(*)                                             as attempts,
  count(*) filter (where is_correct)                   as correct,
  round(avg(is_correct::int)::numeric, 3)              as accuracy
from public.attempts
group by user_id, concept, (exercise_id like 'real-%');

-- 6. Guided Entry: accuracy per step, per user ------------------------------
-- A step counts only when it was reached (its *_correct flag is not null).
create or replace view public.v_guided_step_accuracy
with (security_invoker = true) as
select user_id, step, step_order, count(*) as reached,
       count(*) filter (where correct) as correct,
       round(avg(correct::int)::numeric, 3) as accuracy
from public.attempts a
cross join lateral (values
  ('bias',   1, a.guided_bias_correct),
  ('entry',  2, a.guided_entry_correct),
  ('stop',   3, a.guided_stop_correct),
  ('target', 4, a.guided_target_correct)
) as s(step, step_order, correct)
where a.answer_type = 'guided' and s.correct is not null
group by user_id, step, step_order;

-- 7. Free Trade: process pass rate versus win rate, per user ----------------
create or replace view public.v_free_trade_process_vs_outcome
with (security_invoker = true) as
select
  user_id,
  count(*)                                                        as scenarios,
  count(*) filter (where is_correct)                              as process_passed,
  round(avg(is_correct::int)::numeric, 3)                         as process_pass_rate,
  count(*) filter (where free_outcome in ('win', 'loss'))         as closed_trades,
  count(*) filter (where free_outcome = 'win')                    as wins,
  round((count(*) filter (where free_outcome = 'win'))::numeric
        / nullif(count(*) filter (where free_outcome in ('win', 'loss')), 0), 3) as win_rate,
  count(*) filter (where is_correct and free_outcome = 'win')     as good_process_wins,
  count(*) filter (where is_correct and free_outcome = 'loss')    as good_process_losses,
  count(*) filter (where not is_correct and free_outcome = 'win') as bad_process_wins,
  count(*) filter (where not is_correct and free_outcome = 'loss') as bad_process_losses,
  round(sum(coalesce(free_result_r, 0))::numeric, 2)              as total_r
from public.attempts
where answer_type = 'free'
group by user_id;

-- 8. Time to answer: correct versus incorrect, per user and concept ---------
create or replace view public.v_response_time
with (security_invoker = true) as
select
  user_id,
  concept,
  is_correct,
  count(*)                                                        as attempts,
  round(avg(response_time_ms))::int                               as avg_ms,
  (percentile_cont(0.5) within group (order by response_time_ms))::int as median_ms
from public.attempts
group by user_id, concept, is_correct;

-- 9. Drop-off: how far into each session users got -------------------------
-- One row per session (attempts recorded before session_id existed are
-- left out). exercises_answered is the position of the last answered
-- exercise; with the session's planned length from practice_events
-- (20260926130000) it becomes a completion funnel — see
-- v_session_funnel there.
create or replace view public.v_session_progress
with (security_invoker = true) as
select
  user_id,
  session_id,
  count(*)                                             as exercises_answered,
  count(*) filter (where is_correct)                   as correct,
  min(created_at)                                      as started_at,
  max(created_at)                                      as last_answer_at,
  array_agg(distinct concept)                          as concepts
from public.attempts
where session_id is not null
group by user_id, session_id;

-- Distribution: how many sessions ended after 1, 2, 3 … answers.
create or replace view public.v_session_dropoff
with (security_invoker = true) as
select
  exercises_answered,
  count(*)                                             as sessions,
  round(count(*)::numeric / sum(count(*)) over (), 3)  as share_of_sessions
from public.v_session_progress
group by exercises_answered;
