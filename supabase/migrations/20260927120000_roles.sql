-- NOT YET APPLIED. Roles on profiles (security audit S1 and S3,
-- docs/SECURITY-AUDIT.md). Requires 20260926140000_admin_functions.sql.
--
-- profiles.role is 'user' (default), 'reviewer' (/review) or 'admin'
-- (/admin and /review). It replaces the REVIEWER_EMAILS env allowlist and
-- the app_admins table: one place, tied to the user id rather than an
-- email address, and enforced by the database.
--
-- Users can insert and update their own profile row (username, streak),
-- so the trigger below stops anyone signed in through the API from
-- setting or changing a role, their own included. Roles are granted from
-- the SQL editor:
--
--   update public.profiles set role = 'admin'
--   where id = (select id from auth.users where email = 'you@example.com');

alter table public.profiles
  add column if not exists role text not null default 'user';

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check check (role in ('user', 'reviewer', 'admin'));

create or replace function public.protect_profile_role()
returns trigger
language plpgsql
as $$
begin
  -- 'authenticated' / 'anon' are the roles API requests run as. The SQL
  -- editor, the service role and migrations are unaffected.
  if current_user in ('authenticated', 'anon') then
    if tg_op = 'INSERT' and new.role <> 'user' then
      raise exception 'role can only be granted by an administrator' using errcode = '42501';
    end if;
    if tg_op = 'UPDATE' and new.role is distinct from old.role then
      raise exception 'role can only be changed by an administrator' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_profile_role on public.profiles;
create trigger protect_profile_role
  before insert or update on public.profiles
  for each row execute function public.protect_profile_role();

-- Carry over anyone already listed in app_admins, then retire the table.
do $$
begin
  if to_regclass('public.app_admins') is not null then
    update public.profiles p set role = 'admin'
    from public.app_admins a where a.user_id = p.id;
  end if;
end;
$$;

create or replace function public.current_role_name()
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce((select role from public.profiles where id = auth.uid()), 'user');
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.current_role_name() = 'admin';
$$;

create or replace function public.is_reviewer()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.current_role_name() in ('reviewer', 'admin');
$$;

drop table if exists public.app_admins;

revoke execute on function public.current_role_name() from public, anon;
revoke execute on function public.is_reviewer() from public, anon;
grant execute on function public.current_role_name() to authenticated;
grant execute on function public.is_reviewer() to authenticated;

-- S3: graded attempts are a record, not a draft. No app code updates them,
-- and letting users rewrite is_correct would let them skew the product-wide
-- numbers /admin and the answer-key anomaly check rely on. Deleting their
-- own rows stays allowed.
drop policy if exists "Users can update own attempts" on public.attempts;
