-- NOT YET APPLIED. The learner's experience level (written 2026-10-03;
-- docs/PRD-MVP-V1.md → Experience mode).
--
-- Chosen during onboarding and changeable in Settings: 'beginner' gets more
-- structure, guidance and explanation by default; 'experienced' gets minimal
-- hints, concise feedback with the detail on demand, and faster transitions.
-- It is a preference about the interface, not a record of skill, and the
-- app works without this column: the choice is kept on the device
-- (localStorage) first, and mirrored here, when the column exists, so it
-- follows the learner to another device. Null means not chosen yet.
--
-- The existing profile policies (a user reads and updates only their own
-- row) already cover the new column.

alter table public.profiles add column if not exists experience_level text;

alter table public.profiles drop constraint if exists profiles_experience_level_check;
alter table public.profiles
  add constraint profiles_experience_level_check check (experience_level is null or experience_level in ('beginner', 'experienced'));
