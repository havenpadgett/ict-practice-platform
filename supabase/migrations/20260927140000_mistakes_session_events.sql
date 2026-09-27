-- NOT YET APPLIED. Review Mistakes sessions in product analytics (written
-- 2026-09-27; src/app/mistakes/, src/lib/mistakes.ts).
--
-- A mistakes-only session mixes concepts and modes, so it gets its own
-- mode and concept, and a session started from Review Mistakes (or a single
-- retry from it) gets its own source. Apply after 20260927130000.

alter table public.practice_events drop constraint if exists practice_events_mode_check;
alter table public.practice_events
  add constraint practice_events_mode_check
  check (mode is null or mode in ('recognition', 'guided_entry', 'free_trade', 'adaptive', 'mistakes'));

alter table public.practice_events drop constraint if exists practice_events_source_check;
alter table public.practice_events
  add constraint practice_events_source_check
  check (source is null or source in ('recommendation', 'adaptive_mix', 'picker', 'deep_link', 'mistakes'));

-- The session's concept is 'Mistakes' (src/lib/storage.ts MISTAKES_SESSION).
-- Same constraint as 20260927130000_attempt_integrity.sql, plus 'Mistakes';
-- NOT VALID for the same reason (existing rows are checked separately).
alter table public.practice_events drop constraint if exists practice_events_ranges;
alter table public.practice_events add constraint practice_events_ranges check (
  (concept is null or concept in ('FVG', 'Liquidity', 'MSS', 'IFVG', 'OrderBlock', 'TimeLiquidity', 'PremiumDiscount', 'GuidedEntry', 'FreeTrade', 'Adaptive', 'Mistakes'))
  and (recommended_concept is null or recommended_concept in ('FVG', 'Liquidity', 'MSS', 'IFVG', 'OrderBlock', 'TimeLiquidity', 'PremiumDiscount', 'GuidedEntry', 'FreeTrade'))
  and (recommended_difficulty is null or recommended_difficulty in (1, 2, 3))
  and (planned_length is null or planned_length <= 200)
  and (position is null or position <= 200)
  and (session_id is null or length(session_id) between 1 and 100)
  and ((event_type = 'recommendation_shown') = (session_id is null))
) not valid;
