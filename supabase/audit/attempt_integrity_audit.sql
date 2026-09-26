-- Read-only. Lists existing rows that break the integrity constraints
-- (supabase/migrations/20260927130000_attempt_integrity.sql;
-- docs/DATA-INTEGRITY.md). Run it in the Supabase SQL editor (service
-- role, so it sees every user's rows) after that migration. It works from
-- the constraints themselves, so it stays correct if they change.
--
-- The result has one row per constraint with violations: how many rows
-- break it, and up to 20 example attempt/event ids. No rows back means
-- all existing data is clean, and every constraint can be validated:
--   alter table public.attempts validate constraint <name>;

create or replace function pg_temp.integrity_violations()
returns table (table_name text, constraint_name text, violating_rows bigint, example_ids text)
language plpgsql
as $$
declare
  c record;
  expr text;
begin
  for c in
    select conrelid::regclass::text as tbl, conname, pg_get_constraintdef(oid) as def
    from pg_constraint
    where contype = 'c'
      and conrelid in ('public.attempts'::regclass, 'public.practice_events'::regclass)
    order by 1, 2
  loop
    -- "CHECK ((...)) NOT VALID" -> "(...)"
    expr := regexp_replace(regexp_replace(c.def, '^CHECK ', ''), ' NOT VALID$', '');
    -- A CHECK passes on NULL, so a violation is "false", not "not true".
    return query execute format(
      'select %L::text, %L::text, count(*), string_agg(id::text, '', '' order by created_at) filter (where rn <= 20)
         from (select id, created_at, row_number() over (order by created_at) as rn
                 from %s where not coalesce(%s, true)) v
       having count(*) > 0',
      c.tbl, c.conname, c.tbl, expr);
  end loop;
end;
$$;

select * from pg_temp.integrity_violations();
