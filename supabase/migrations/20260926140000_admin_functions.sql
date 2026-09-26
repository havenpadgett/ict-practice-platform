-- NOT YET APPLIED. Product-wide numbers for /admin (written 2026-09-26;
-- documented in docs/SQL-QUERIES.md → Admin functions). Requires
-- 20260926120000_analytics_views.sql and 20260926130000_practice_events.sql.
--
-- The app talks to Supabase with the anon key, so Row Level Security limits
-- every query and view to the caller's own rows. These functions are
-- SECURITY DEFINER: they run with their owner's rights and see every user,
-- and each one first checks that the caller is listed in app_admins.
--
-- Add an admin after applying (SQL editor):
--   insert into public.app_admins (user_id)
--   select id from auth.users where email = 'you@example.com';

create table if not exists public.app_admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

-- RLS on, no policies: nobody reads or writes this table through the API.
-- Only the SQL editor / service role and the functions below can.
alter table public.app_admins enable row level security;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (select 1 from public.app_admins where user_id = auth.uid());
$$;

create or replace function public.require_admin()
returns void
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_admin() then
    raise exception 'admin only' using errcode = '42501';
  end if;
end;
$$;

-- Headline counts: users, sessions, attempts, completion.
create or replace function public.admin_overview()
returns table (
  total_users bigint,
  active_users_7d bigint,
  total_attempts bigint,
  attempts_7d bigint,
  overall_accuracy numeric,
  sessions_started bigint,
  sessions_completed bigint,
  completion_rate numeric,
  sessions_with_attempts bigint
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
    (select count(*) from public.profiles),
    (select count(distinct user_id) from public.attempts where created_at > now() - interval '7 days'),
    (select count(*) from public.attempts),
    (select count(*) from public.attempts where created_at > now() - interval '7 days'),
    (select round(avg(is_correct::int)::numeric, 3) from public.attempts),
    (select count(*) from public.v_sessions),
    (select count(*) from public.v_sessions where completed),
    (select round(avg(completed::int)::numeric, 3) from public.v_sessions),
    -- Sessions seen in attempts, including those from before event tracking.
    (select count(*) from public.v_session_progress);
end;
$$;

-- Exercises with the lowest success rate across all users. Exercises with
-- fewer than min_attempts attempts are left out: 0 of 1 isn't a finding.
create or replace function public.admin_exercise_failures(min_attempts integer default 5, max_rows integer default 15)
returns table (
  exercise_id text,
  concept text,
  is_real boolean,
  difficulty smallint,
  attempts bigint,
  users bigint,
  success_rate numeric
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.require_admin();
  return query
  select e.exercise_id, e.concept, e.is_real, e.difficulty::smallint, e.attempts, e.users, e.success_rate
  from public.v_exercise_success e
  where e.attempts >= min_attempts
  order by e.success_rate, e.attempts desc, e.exercise_id
  limit max_rows;
end;
$$;

-- Concepts ranked hardest first by accuracy across all users.
create or replace function public.admin_concept_ranking()
returns table (
  concept text,
  attempts bigint,
  users bigint,
  accuracy numeric,
  difficulty_rank bigint
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.require_admin();
  return query
  select a.concept, count(*), count(distinct a.user_id),
         round(avg(a.is_correct::int)::numeric, 3),
         rank() over (order by avg(a.is_correct::int))
  from public.attempts a
  group by a.concept
  order by 5, 2 desc;
end;
$$;

revoke execute on function public.require_admin() from public, anon;
revoke execute on function public.admin_overview() from public, anon;
revoke execute on function public.admin_exercise_failures(integer, integer) from public, anon;
revoke execute on function public.admin_concept_ranking() from public, anon;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.admin_overview() to authenticated;
grant execute on function public.admin_exercise_failures(integer, integer) to authenticated;
grant execute on function public.admin_concept_ranking() to authenticated;
