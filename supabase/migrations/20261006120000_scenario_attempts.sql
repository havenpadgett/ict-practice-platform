-- NOT YET APPLIED. Scenario attempts: one row per finished attempt in the
-- training and simulation engine (simulator, Build Your Bias, HTF to LTF,
-- Confluence Trainer, Setup or Trap, Find Everything, Blind Chart,
-- "Does it matter?" and the placement test). Written 2026-10-06; see
-- docs/ENGINE.md.
--
-- Separate from `attempts` on purpose: that table is one wide row per graded
-- recognition exercise; an engine attempt is a process score with eight
-- dimensions, structured mistakes, a confidence rating and the full response
-- (so a journal entry can reopen the completed scenario review). Nothing
-- about `attempts` changes, and the app works without this migration: results
-- are kept on the device until it is applied (src/lib/scenario-attempts.ts).
--
-- score is PROCESS only. result_r (the trade's outcome in R) is stored beside
-- it and never feeds it. Rows are records: there is no UPDATE or DELETE
-- policy, like attempts.

create table if not exists public.scenario_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  scenario_id text not null,
  mode_id text not null,
  session_id text,
  difficulty smallint not null,
  scenario_type text not null,
  score smallint not null,
  verdict text not null,
  decision text,
  no_trade_scenario boolean not null default false,
  correct_avoidance boolean,
  confidence smallint,
  outcome text not null,
  result_r double precision,
  mae_r double precision,
  mfe_r double precision,
  mistakes text[] not null default '{}',
  dimensions jsonb not null default '[]'::jsonb,
  skill_evidence jsonb not null default '[]'::jsonb,
  response jsonb not null,
  response_time_ms integer not null default 0,
  attempt_number integer not null default 1,
  created_at timestamptz not null default now(),

  constraint scenario_attempts_mode check (mode_id in (
    'simulator', 'build_your_bias', 'htf_to_ltf', 'confluence', 'setup_or_trap',
    'find_everything', 'blind_chart', 'false_positive', 'placement')),
  constraint scenario_attempts_score_range check (score between 0 and 100),
  constraint scenario_attempts_verdict check (verdict in ('correct', 'could_improve', 'incorrect')),
  constraint scenario_attempts_difficulty check (difficulty between 1 and 3),
  constraint scenario_attempts_decision check (decision is null or decision in ('long', 'short', 'wait', 'no_trade')),
  constraint scenario_attempts_confidence check (confidence is null or confidence between 1 and 5),
  constraint scenario_attempts_outcome check (outcome in ('no_order', 'unfilled', 'stop', 'target', 'scenario_end')),
  -- A closed trade has an R result; anything else has none.
  constraint scenario_attempts_r_consistent check (
    (outcome in ('stop', 'target', 'scenario_end')) = (result_r is not null)
  ),
  -- Correct avoidance is only defined on a no-trade scenario.
  constraint scenario_attempts_avoidance check (correct_avoidance is null or no_trade_scenario),
  constraint scenario_attempts_mistake_ids check (mistakes <@ array[
    'PREMATURE_ENTRY', 'AGAINST_HTF_BIAS', 'CHASED_DISPLACEMENT', 'WRONG_DRAW', 'STOP_TOO_TIGHT',
    'IGNORED_OPPOSING_HTF', 'INTERNAL_EXTERNAL_CONFUSION', 'FORCED_SETUP', 'NO_CONFIRMATION']),
  constraint scenario_attempts_ranges check (
    response_time_ms between 0 and 86400000 and attempt_number >= 1
  )
);

create index if not exists idx_scenario_attempts_user_created on public.scenario_attempts (user_id, created_at desc);
create index if not exists idx_scenario_attempts_user_scenario on public.scenario_attempts (user_id, scenario_id);

alter table public.scenario_attempts enable row level security;

create policy "Users can view own scenario attempts"
  on public.scenario_attempts for select
  using (auth.uid() = user_id);

create policy "Users can insert own scenario attempts"
  on public.scenario_attempts for insert
  with check (auth.uid() = user_id);

-- Most frequent structured mistake per user, with its count: the dashboard's
-- "your most common mistake" line. security_invoker keeps RLS in force.
create or replace view public.v_mistake_counts
with (security_invoker = true) as
select user_id, m as mistake, count(*) as occurrences
from public.scenario_attempts, unnest(mistakes) as m
group by user_id, m;

-- Confidence versus accuracy on the 1-5 scale: high confidence with a low
-- score, and the reverse. "Wrong" here is a process verdict of incorrect.
create or replace view public.v_scenario_calibration
with (security_invoker = true) as
select
  user_id,
  confidence,
  count(*)                                        as attempts,
  round(avg(score)::numeric, 1)                   as avg_score,
  count(*) filter (where verdict = 'incorrect')   as incorrect
from public.scenario_attempts
where confidence is not null
group by user_id, confidence;

-- Correct Avoidance Rate: of the no-trade scenarios attempted, the share where
-- the user stood aside. Skipped valid setups are the mirror, reported apart.
create or replace view public.v_correct_avoidance
with (security_invoker = true) as
select
  user_id,
  count(*) filter (where no_trade_scenario)                              as no_trade_attempts,
  count(*) filter (where no_trade_scenario and correct_avoidance)        as avoided,
  count(*) filter (where not no_trade_scenario)                          as setup_attempts,
  count(*) filter (where not no_trade_scenario and decision in ('no_trade', 'wait')) as skipped_setups
from public.scenario_attempts
group by user_id;
