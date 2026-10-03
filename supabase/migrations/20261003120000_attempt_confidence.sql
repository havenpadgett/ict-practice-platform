-- NOT YET APPLIED. Optional confidence rating on attempts (written
-- 2026-10-03; docs/ANALYTICS.md → Confidence versus accuracy).
--
-- Before submitting, a learner may say how sure they are: 1 a guess, 2
-- fairly sure, 3 certain. It is stored with the attempt and never required,
-- so the column is nullable and every earlier attempt keeps null. Nothing
-- else about an attempt changes, and the app keeps working without this
-- migration: it retries without the column when the database doesn't have
-- it (src/lib/attempts.ts), and the analytics section simply stays empty.
--
-- The view is the SQL twin of the in-app calibration table (the app
-- computes it from the attempts it already fetches), for the same reason
-- the other analytics views exist: so the numbers can be checked in the SQL
-- editor or a BI tool. security_invoker keeps Row Level Security in force,
-- like every view in 20260926120000_analytics_views.sql.

alter table public.attempts add column if not exists confidence smallint;

alter table public.attempts drop constraint if exists attempts_confidence_range;
alter table public.attempts add constraint attempts_confidence_range check (
  confidence is null or confidence between 1 and 3
);

-- Accuracy at each confidence level, per user. "Confidently wrong" is
-- confidence = 3 with is_correct = false; the rate below is the share of
-- that level's attempts that were wrong.
create or replace view public.v_confidence_calibration
with (security_invoker = true) as
select
  user_id,
  confidence,
  count(*)                                             as attempts,
  count(*) filter (where is_correct)                   as correct,
  count(*) filter (where not is_correct)               as wrong,
  round(avg(is_correct::int)::numeric, 3)              as accuracy
from public.attempts
where confidence is not null
group by user_id, confidence;
