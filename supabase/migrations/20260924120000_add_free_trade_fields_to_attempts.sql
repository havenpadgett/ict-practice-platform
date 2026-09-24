-- Adds the "free" answer_type (Free Trade — historical playback where the
-- user decides if/when to trade, then manages it candle by candle) to the
-- attempts table: the trade the user took (direction, entry/stop/target,
-- which candle filled the entry, where and why it exited), its planned
-- risk-to-reward and realized result in R, the outcome, and each process
-- check's pass/fail — plus widened check constraints so 'free' is a valid
-- answer_type / user_answer_type value.
--
-- Free Trade fields are populated only when answer_type = 'free' and
-- user_answer_type = 'free'. free_direction = 'none' records a No Trade
-- decision; in that case the price, index, exit, R, and R:R fields are
-- null. Each free_*_correct flag is null when that check didn't apply
-- (e.g. entry/stop/R:R on a No Trade decision), not false — same
-- convention as the guided_*_correct flags.
--
-- is_correct holds the overall process verdict (every applicable check
-- passed), never the outcome: a losing trade with good process is
-- is_correct = true, a winning trade with bad process is false.

alter table public.attempts
  add column if not exists free_direction text,
  add column if not exists free_entry_price double precision,
  add column if not exists free_stop_price double precision,
  add column if not exists free_target_price double precision,
  add column if not exists free_entry_candle_index integer,
  add column if not exists free_exit_candle_index integer,
  add column if not exists free_exit_price double precision,
  add column if not exists free_exit_reason text,
  add column if not exists free_rr double precision,
  add column if not exists free_result_r double precision,
  add column if not exists free_outcome text,
  add column if not exists free_direction_correct boolean,
  add column if not exists free_entry_correct boolean,
  add column if not exists free_stop_correct boolean,
  add column if not exists free_rr_correct boolean,
  add column if not exists free_decision_correct boolean;

alter table public.attempts
  drop constraint if exists attempts_free_direction_check;

alter table public.attempts
  add constraint attempts_free_direction_check
  check (free_direction is null or free_direction in ('long', 'short', 'none'));

alter table public.attempts
  drop constraint if exists attempts_free_exit_reason_check;

alter table public.attempts
  add constraint attempts_free_exit_reason_check
  check (free_exit_reason is null or free_exit_reason in ('stop', 'target', 'session_end'));

alter table public.attempts
  drop constraint if exists attempts_free_outcome_check;

alter table public.attempts
  add constraint attempts_free_outcome_check
  check (free_outcome is null or free_outcome in ('win', 'loss', 'open', 'no_trade'));

alter table public.attempts
  drop constraint if exists attempts_answer_type_check;

alter table public.attempts
  add constraint attempts_answer_type_check
  check (answer_type in ('zone', 'level', 'choice', 'guided', 'free'));

alter table public.attempts
  drop constraint if exists attempts_user_answer_type_check;

alter table public.attempts
  add constraint attempts_user_answer_type_check
  check (user_answer_type in ('region', 'level', 'choice', 'guided', 'free', 'none'));
