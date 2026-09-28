-- NOT YET APPLIED. Apply after 20260927150000_question_reports.sql.
-- Written 2026-09-28 (docs/APP_PERFECTION_PLAN.md, Phase 26).
--
-- 1. A report reason for "the explanation is unclear", separate from "the
--    answer looks wrong": a correct key with a confusing explanation needs
--    a rewrite, not a re-review of the answer.
-- 2. The app version that filed the report, so a report can be matched to
--    the code (and curriculum) that was live when it was made.
--
-- The rest of a report's context needs no new columns: session_id plus
-- exercise_id join to the user's attempt (their answer, concept,
-- difficulty), and the expected answer is the exercise's key in the repo.
-- The app writes the new reason and column only once this is applied; until
-- then it files an unclear-explanation report as 'other' with a note.

alter table public.question_reports drop constraint if exists question_reports_reason_check;
alter table public.question_reports
  add constraint question_reports_reason_check check (reason in (
    'answer_wrong',         -- the answer key looks wrong
    'chart_unclear',        -- the chart is hard to read
    'explanation_unclear',  -- the key is fine, the explanation doesn't make sense
    'ambiguous',            -- more than one answer could be right
    'technical',            -- something broke
    'other'                 -- needs a note
  ));

alter table public.question_reports
  add column if not exists app_version text check (app_version is null or char_length(app_version) <= 40);

-- Adds the new reason's count. The return type changes, so drop first.
drop function if exists public.admin_exercise_reports();
create function public.admin_exercise_reports()
returns table (
  exercise_id text,
  reports bigint,
  open_reports bigint,
  reporters bigint,
  answer_wrong bigint,
  chart_unclear bigint,
  explanation_unclear bigint,
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
    count(*) filter (where r.reason = 'explanation_unclear'),
    count(*) filter (where r.reason = 'ambiguous'),
    count(*) filter (where r.reason = 'technical'),
    count(*) filter (where r.reason = 'other'),
    max(r.created_at)
  from public.question_reports r
  group by r.exercise_id
  order by count(*) filter (where r.status = 'open') desc, max(r.created_at) desc;
end;
$$;
