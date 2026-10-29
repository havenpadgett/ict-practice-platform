-- NOT YET APPLIED. Launch readiness (written 2026-10-29). Apply after every
-- earlier migration; needs is_admin() from 20260927120000_roles.sql.
--
-- 1. Row Level Security on every table in public, as a backstop: each
--    table's own migration already enables it, this makes sure none slipped.
-- 2. public.errors: the app's own error log. Anyone can write a row (signed
--    out visitors hit errors too); only admins can read them (/admin).
-- 3. delete_own_account(): Settings → Delete my account. Deletes the
--    caller's auth user, and with it, by cascade, their profile, attempts,
--    events, reports and scenario attempts. Runs as the function owner so
--    the app never needs a service-role key.

-- 1. RLS everywhere.
do $$
declare
  t record;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t.tablename);
  end loop;
end;
$$;

-- 2. Error log.
create table if not exists public.errors (
  id uuid primary key default gen_random_uuid(),
  message text not null check (char_length(message) between 1 and 2000),
  stack text check (stack is null or char_length(stack) <= 8000),
  page text check (page is null or char_length(page) <= 500),
  source text not null default 'client' check (source in ('client', 'boundary', 'server')),
  -- Kept when the account is deleted, without the id.
  user_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_errors_created_at on public.errors (created_at desc);

alter table public.errors enable row level security;

drop policy if exists "Anyone can log an error" on public.errors;
create policy "Anyone can log an error"
  on public.errors for insert
  to anon, authenticated
  -- A row may name only the signed-in user, or nobody.
  with check (user_id is null or user_id = auth.uid());

drop policy if exists "Admins can read errors" on public.errors;
create policy "Admins can read errors"
  on public.errors for select
  to authenticated
  using (public.is_admin());

grant insert on public.errors to anon, authenticated;
grant select on public.errors to authenticated;
revoke update, delete on public.errors from anon, authenticated;

-- 3. Account deletion.
create or replace function public.delete_own_account()
returns void
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  -- Explicit, though auth.users → profiles → every user table cascades.
  delete from public.scenario_attempts where user_id = uid;
  delete from public.question_reports where user_id = uid;
  delete from public.practice_events where user_id = uid;
  delete from public.attempts where user_id = uid;
  delete from public.profiles where id = uid;
  delete from auth.users where id = uid;
end;
$$;

revoke execute on function public.delete_own_account() from public, anon;
grant execute on function public.delete_own_account() to authenticated;
