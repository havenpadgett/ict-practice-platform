-- NOT YET APPLIED. Review Mistakes sessions in product analytics (written
-- 2026-09-27; src/app/mistakes/, src/lib/mistakes.ts).
--
-- A mistakes-only session mixes concepts and modes, so it gets its own
-- mode, and a session started from the Review Mistakes page (or a single
-- retry from it) gets its own source. Apply after 20260926130000.

alter table public.practice_events drop constraint if exists practice_events_mode_check;
alter table public.practice_events
  add constraint practice_events_mode_check
  check (mode is null or mode in ('recognition', 'guided_entry', 'free_trade', 'adaptive', 'mistakes'));

alter table public.practice_events drop constraint if exists practice_events_source_check;
alter table public.practice_events
  add constraint practice_events_source_check
  check (source is null or source in ('recommendation', 'adaptive_mix', 'picker', 'deep_link', 'mistakes'));
