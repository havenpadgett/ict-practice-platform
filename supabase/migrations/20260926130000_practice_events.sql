-- NOT YET APPLIED. Product analytics events (written 2026-09-26;
-- documented in docs/SQL-QUERIES.md → Session and event views).
--
-- attempts record what was answered. practice_events records the rest of a
-- session's life so the PRD's product questions can be answered: sessions
-- started vs completed, where sessions are abandoned, which modes are used,
-- whether users follow the adaptive recommendation, time between sessions.
--
-- Events are written fire-and-forget by the app (src/lib/events.ts): a
-- failed or missing insert never affects practice. Until this migration is
-- applied the inserts simply fail silently.

create table if not exists public.practice_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  -- SessionState.session_id, joins to attempts.session_id. Null for events
  -- that aren't about one session (recommendation_shown).
  session_id text,
  event_type text not null check (event_type in (
    'session_started',      -- a new session began
    'session_completed',    -- the last exercise was answered and Next pressed
    'session_abandoned',    -- left for the picker, or replaced by a new session, before finishing
    'recommendation_shown'  -- the dashboard showed a recommended session (at most once per day per user)
  )),
  -- recognition | guided_entry | free_trade | adaptive (a mixed session)
  mode text check (mode is null or mode in ('recognition', 'guided_entry', 'free_trade', 'adaptive')),
  -- The session's concept, or 'Adaptive' for a mixed session.
  concept text,
  -- How the session was started.
  source text check (source is null or source in ('recommendation', 'adaptive_mix', 'picker', 'deep_link')),
  planned_length integer check (planned_length is null or planned_length >= 0),
  -- Exercises answered when the session ended (completed or abandoned).
  position integer check (position is null or position >= 0),
  recommended_concept text,
  recommended_difficulty smallint,
  created_at timestamptz not null default now()
);

create index if not exists idx_practice_events_user_created_at on public.practice_events (user_id, created_at);
create index if not exists idx_practice_events_session on public.practice_events (session_id);

alter table public.practice_events enable row level security;

create policy "Users can view own events"
  on public.practice_events for select
  using (auth.uid() = user_id);

create policy "Users can insert own events"
  on public.practice_events for insert
  with check (auth.uid() = user_id);

create policy "Users can delete own events"
  on public.practice_events for delete
  using (auth.uid() = user_id);

-- One row per started session: how it started, how far it got, whether it
-- finished. Position falls back to the attempts answered in that session
-- when no end event was recorded (e.g. the tab was simply closed).
create or replace view public.v_sessions
with (security_invoker = true) as
select
  s.user_id,
  s.session_id,
  s.created_at                                           as started_at,
  s.mode,
  s.concept,
  s.source,
  s.planned_length,
  (c.created_at is not null)                              as completed,
  coalesce(c.position, a.position, p.exercises_answered, 0) as exercises_answered,
  coalesce(c.created_at, a.created_at, p.last_answer_at) as ended_at,
  extract(epoch from s.created_at - lag(s.created_at) over (partition by s.user_id order by s.created_at)) / 3600.0
                                                          as hours_since_previous
from public.practice_events s
left join lateral (
  select position, created_at from public.practice_events
  where user_id = s.user_id and session_id = s.session_id and event_type = 'session_completed' order by created_at limit 1
) c on true
left join lateral (
  select position, created_at from public.practice_events
  where user_id = s.user_id and session_id = s.session_id and event_type = 'session_abandoned' order by created_at limit 1
) a on true
left join public.v_session_progress p on p.user_id = s.user_id and p.session_id = s.session_id
where s.event_type = 'session_started';

-- Sessions started vs completed, per user.
create or replace view public.v_session_funnel
with (security_invoker = true) as
select
  user_id,
  count(*)                                               as sessions_started,
  count(*) filter (where completed)                      as sessions_completed,
  round(avg(completed::int)::numeric, 3)                 as completion_rate
from public.v_sessions
group by user_id;

-- Where unfinished sessions stop: planned length x exercises answered.
create or replace view public.v_session_abandonment
with (security_invoker = true) as
select
  planned_length,
  exercises_answered,
  count(*)                                               as sessions
from public.v_sessions
where not completed
group by planned_length, exercises_answered;

-- Which modes get used.
create or replace view public.v_mode_usage
with (security_invoker = true) as
select
  mode,
  count(*)                                               as sessions_started,
  count(*) filter (where completed)                      as sessions_completed,
  count(distinct user_id)                                as users
from public.v_sessions
group by mode;

-- Do users follow the recommendation or pick their own?
create or replace view public.v_recommendation_follow
with (security_invoker = true) as
select
  u.user_id,
  (select count(*) from public.practice_events e
    where e.user_id = u.user_id and e.event_type = 'recommendation_shown')          as shown,
  count(*) filter (where s.source = 'recommendation')                                as followed,
  count(*) filter (where s.source = 'picker')                                        as own_choice,
  count(*) filter (where s.source = 'adaptive_mix')                                  as adaptive_mix,
  round((count(*) filter (where s.source = 'recommendation'))::numeric
        / nullif((select count(*) from public.practice_events e
                   where e.user_id = u.user_id and e.event_type = 'recommendation_shown'), 0), 3) as follow_rate
from (select distinct user_id from public.practice_events) u
left join public.v_sessions s on s.user_id = u.user_id
group by u.user_id;

-- Time between sessions (one row per session after a user's first).
create or replace view public.v_time_between_sessions
with (security_invoker = true) as
select user_id, session_id, started_at, round(hours_since_previous::numeric, 2) as hours_since_previous
from public.v_sessions
where hours_since_previous is not null;
