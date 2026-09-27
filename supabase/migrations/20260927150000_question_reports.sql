-- NOT YET APPLIED. "Report a question" (written 2026-09-27; docs/SQL-QUERIES.md
-- → Question reports). Requires 20260926120000_analytics_views.sql and
-- 20260927120000_roles.sql (v_exercise_success, require_admin()).
--
-- A user can flag any exercise, while answering it or from its feedback,
-- with a structured reason. /admin shows the counts per exercise and flags
-- exercises for re-review: several open reports, or a failure rate far
-- below the rest of its concept.

create table if not exists public.question_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  exercise_id text not null check (char_length(exercise_id) between 1 and 100),
  reason text not null check (reason in (
    'answer_wrong',   -- the answer key looks wrong
    'chart_unclear',  -- the chart is hard to read
    'ambiguous',      -- more than one answer could be right
    'technical',      -- something broke
    'other'           -- needs a note
  )),
  note text check (note is null or char_length(note) <= 1000),
  -- Where the report was made: 'exercise' before answering, 'feedback' after.
  stage text not null check (stage in ('exercise', 'feedback')),
  -- SessionState.session_id. With exercise_id it reproduces the exact chart
  -- the user was shown (src/lib/framing.ts).
  session_id text check (session_id is null or char_length(session_id) <= 100),
  -- 'open' until an admin marks the exercise re-reviewed.
  status text not null default 'open' check (status in ('open', 'resolved')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  constraint question_reports_other_needs_note check (reason <> 'other' or char_length(btrim(coalesce(note, ''))) > 0)
);

create index if not exists idx_question_reports_exercise on public.question_reports (exercise_id, status);
create index if not exists idx_question_reports_user_created_at on public.question_reports (user_id, created_at);

alter table public.question_reports enable row level security;

-- Users file reports as themselves and can see their own. They can't edit
-- or resolve them: only the admin functions below change status.
create policy "Users can insert own reports"
  on public.question_reports for insert
  with check (auth.uid() = user_id and status = 'open' and resolved_at is null);

create policy "Users can view own reports"
  on public.question_reports for select
  using (auth.uid() = user_id);

-- Reports per exercise, most open first.
create or replace function public.admin_exercise_reports()
returns table (
  exercise_id text,
  reports bigint,
  open_reports bigint,
  reporters bigint,
  answer_wrong bigint,
  chart_unclear bigint,
  ambiguous bigint,
  technical bigint,
  other bigint,
  last_reported_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.require_admin();
  return query
  select
    r.exercise_id,
    count(*),
    count(*) filter (where r.status = 'open'),
    count(distinct r.user_id),
    count(*) filter (where r.reason = 'answer_wrong'),
    count(*) filter (where r.reason = 'chart_unclear'),
    count(*) filter (where r.reason = 'ambiguous'),
    count(*) filter (where r.reason = 'technical'),
    count(*) filter (where r.reason = 'other'),
    max(r.created_at)
  from public.question_reports r
  group by r.exercise_id
  order by count(*) filter (where r.status = 'open') desc, max(r.created_at) desc;
end;
$$;

-- The latest open reports with their notes. No reporter identity.
create or replace function public.admin_recent_reports(max_rows integer default 20)
returns table (
  id uuid,
  exercise_id text,
  reason text,
  note text,
  stage text,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.require_admin();
  return query
  select r.id, r.exercise_id, r.reason, r.note, r.stage, r.created_at
  from public.question_reports r
  where r.status = 'open'
  order by r.created_at desc
  limit max_rows;
end;
$$;

-- Exercises to re-review. Two independent reasons:
--   reports:      at least min_reports open reports
--   failure rate: at least min_attempts attempts, and a success rate at
--                 least min_gap below the rest of its concept's attempts
--                 pooled, and at least 2 standard errors below it (so a
--                 small sample can't trip it on noise alone).
create or replace function public.admin_review_flags(
  min_reports integer default 2,
  min_attempts integer default 10,
  min_gap numeric default 0.25
)
returns table (
  exercise_id text,
  concept text,
  attempts bigint,
  success_rate numeric,
  peer_success_rate numeric,
  open_reports bigint,
  flagged_reports boolean,
  flagged_failure_rate boolean
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.require_admin();
  return query
  with ex as (
    select e.exercise_id, e.concept, e.attempts, e.correct, e.success_rate from public.v_exercise_success e
  ),
  concept_totals as (
    select c.concept, sum(c.attempts) as attempts, sum(c.correct) as correct from ex c group by c.concept
  ),
  scored as (
    select
      ex.exercise_id,
      ex.concept,
      ex.attempts,
      ex.success_rate,
      round((t.correct - ex.correct)::numeric / nullif(t.attempts - ex.attempts, 0), 3) as peer_rate
    from ex join concept_totals t on t.concept = ex.concept
  ),
  open_counts as (
    select r.exercise_id, count(*) as n from public.question_reports r where r.status = 'open' group by r.exercise_id
  ),
  flagged as (
    select
      coalesce(s.exercise_id, o.exercise_id) as exercise_id,
      s.concept,
      coalesce(s.attempts, 0) as attempts,
      s.success_rate,
      s.peer_rate,
      coalesce(o.n, 0) as open_reports,
      coalesce(o.n, 0) >= min_reports as by_reports,
      coalesce(
        s.attempts >= min_attempts
        and s.peer_rate is not null
        and s.success_rate <= s.peer_rate - min_gap
        and (s.peer_rate - s.success_rate) >= 2 * sqrt(greatest(s.peer_rate * (1 - s.peer_rate), 0.0025) / s.attempts),
        false
      ) as by_failure
    from scored s
    full join open_counts o on o.exercise_id = s.exercise_id
  )
  select f.exercise_id, f.concept, f.attempts, f.success_rate, f.peer_rate, f.open_reports, f.by_reports, f.by_failure
  from flagged f
  where f.by_reports or f.by_failure
  order by f.by_reports and f.by_failure desc, f.open_reports desc, f.success_rate nulls last, f.exercise_id;
end;
$$;

-- Marks every open report on an exercise resolved, after it's been re-reviewed.
create or replace function public.admin_resolve_reports(target_exercise_id text)
returns integer
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  n integer;
begin
  perform public.require_admin();
  update public.question_reports
  set status = 'resolved', resolved_at = now()
  where exercise_id = target_exercise_id and status = 'open';
  get diagnostics n = row_count;
  return n;
end;
$$;
