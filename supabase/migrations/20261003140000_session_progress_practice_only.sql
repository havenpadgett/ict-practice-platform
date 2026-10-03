-- NOT YET APPLIED. Must run after 20260926120000_analytics_views.sql
-- (written 2026-10-03; docs/SHARING.md).
--
-- Answers given through a shared challenge link or the daily challenge are
-- attempts like any other, so they count toward accuracy, mistakes and the
-- recommendation engine. They are recorded under session ids
-- 'challenge:<exercise id>' and 'daily:<date>': one-exercise visits, not
-- practice sessions. Left in v_session_progress they would pile into the
-- "ended after 1 answer" bucket of v_session_dropoff and read as sessions
-- abandoned after one exercise. The app's own session counts already leave
-- them out (src/lib/challenge.ts → isPracticeSessionId); this makes the SQL
-- agree. Same columns as before, so create-or-replace is enough and
-- v_session_dropoff, v_session_funnel and the admin functions need no change.

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
  and session_id not like 'challenge:%'
  and session_id not like 'daily:%'
group by user_id, session_id;
