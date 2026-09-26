# SQL Analysis Layer

*Written 2026-09-26 (AI-DRAFTED).*

The practice app records one row per answered exercise in the Postgres table `public.attempts` (hosted on Supabase). This doc describes the **database views** that turn those rows into answers to product questions. A view is a saved query: you select from it like a table, and it always reflects the latest data.

**Where they live:**

| Migration | Contents | Status |
|---|---|---|
| `supabase/migrations/20260926120000_analytics_views.sql` | The views in this doc | **Not yet applied** |
| `supabase/migrations/20260926130000_practice_events.sql` | Session and event views, [below](#session-and-event-views) | **Not yet applied** |
| `supabase/migrations/20260926140000_admin_functions.sql` | Admin functions | **Not yet applied** |

To apply them, run `supabase db push` or paste each file into the Supabase SQL editor, in filename order.

**How they're tested:** `tests/sql/` runs every migration in an in-process Postgres (PGlite) and checks each view's output on known data (`npm test`).

## Who sees what

Every view is created `with (security_invoker = true)`, so it runs with the permissions of whoever queries it.
- **Signed in to the app:** Row Level Security on `attempts` applies, and you see only your own rows. That is how the app's `/analytics` page reads them.
- **Service role (SQL editor, a BI connection, the admin functions):** every user's rows.

The same SQL therefore serves both a personal view and a product-wide view.

## Conventions

- **`accuracy` / `*_rate`:** fractions from 0 to 1, rounded to 3 places. `0.625` means 62.5%.
- **Real vs constructed:**
  - **Real:** scenarios cut from historical NQ data. Their exercise ids start with `real-`.
  - **Constructed:** hand-built exercises; everything else.
- **`is_correct`:** the grading verdict. For Guided Entry and Free Trade it is the *process* verdict (was the trade plan right), never whether the trade made money.
- **`concept` values:** `FVG`, `Liquidity`, `MSS`, `IFVG`, `OrderBlock`, `TimeLiquidity`, `PremiumDiscount`, `GuidedEntry`, `FreeTrade`.

---

## `v_accuracy_by_concept`

**Question:** How accurate is each user on each concept, and on how many attempts is that based?

```sql
select user_id, concept,
       count(*) as attempts,
       count(*) filter (where is_correct) as correct,
       round(avg(is_correct::int)::numeric, 3) as accuracy,
       min(created_at) as first_attempt_at, max(created_at) as last_attempt_at
from public.attempts
group by user_id, concept;
```

**Reading it:** one row per user and concept. Always read `accuracy` together with `attempts`: 1.000 over 2 attempts says almost nothing, and 0.700 over 60 says a lot. The app's recommendation engine applies the same caution, and doesn't call a concept weak before 3 attempts.

```sql
-- Concepts ranked by accuracy across everyone, only where there's enough data
select concept, sum(attempts) as attempts, round(sum(correct)::numeric / sum(attempts), 3) as accuracy
from v_accuracy_by_concept group by concept having sum(attempts) >= 30 order by accuracy;
```

## `v_accuracy_by_concept_difficulty`

**Question:** Within a concept, do the harder exercises actually get answered wrong more often?

```sql
select user_id, concept, difficulty, count(*) as attempts,
       count(*) filter (where is_correct) as correct,
       round(avg(is_correct::int)::numeric, 3) as accuracy
from public.attempts where difficulty is not null
group by user_id, concept, difficulty;
```

**Reading it:** each exercise is rated 1–3 by whoever wrote it. If accuracy doesn't fall from 1 to 3 once enough attempts accumulate, the ratings are wrong. Attempts from before difficulty was recorded (`difficulty is null`) are left out.

## `v_improvement_blocks`

**Question:** Does a user get better with practice? This view splits each user's history into consecutive blocks of 20 attempts.

```sql
with numbered as (
  select user_id, is_correct, created_at,
         (row_number() over (partition by user_id order by created_at, id) - 1) / 20 as block_index
  from public.attempts)
select user_id, block_index + 1 as block_number, min(created_at) as block_start, max(created_at) as block_end,
       count(*) as attempts, round(avg(is_correct::int)::numeric, 3) as accuracy
from numbered group by user_id, block_index;
```

**Reading it:**
- Block 1 is the user's first 20 answers, block 2 the next 20, and so on.
- A rising `accuracy` across blocks is improvement.
- The last block is usually partial (`attempts < 20`), so weigh it less.
- Blocks mix concepts: a user who moves on to a harder concept can look like they got worse. Filter by concept inside the CTE to compare like with like.

## `v_exercise_success`

**Question:** Which exercises do people actually get wrong? One very low success rate can mean a bad answer key.

```sql
select exercise_id, concept, (exercise_id like 'real-%') as is_real, max(difficulty) as difficulty,
       count(*) as attempts, count(distinct user_id) as users,
       count(*) filter (where is_correct) as correct,
       round(avg(is_correct::int)::numeric, 3) as success_rate,
       rank() over (order by avg(is_correct::int), count(*) desc) as hardness_rank
from public.attempts group by exercise_id, concept;
```

**Reading it:**
- `hardness_rank` 1 is the hardest exercise.
- An exercise far below others of the same concept and difficulty, across several `users`, deserves a look at its answer key before it's blamed on the users.
- Run as the service role for the product-wide picture. Signed in, it covers only your own attempts.

## `v_real_vs_constructed`

**Question:** Is real market data measurably harder than the hand-built exercises?

```sql
select user_id, concept,
       case when exercise_id like 'real-%' then 'real' else 'constructed' end as source,
       count(*) as attempts, count(*) filter (where is_correct) as correct,
       round(avg(is_correct::int)::numeric, 3) as accuracy
from public.attempts group by user_id, concept, (exercise_id like 'real-%');
```

**Reading it:** compare `real` against `constructed` **within the same concept**. Across concepts the mix differs, and that alone can create a gap. No real scenario is live until a human approves it at `/review`, so expect no `real` rows until then.

## `v_guided_step_accuracy`

**Question:** In Guided Entry (bias → entry → stop → target), which step do people get wrong?

```sql
select user_id, step, step_order, count(*) as reached,
       count(*) filter (where correct) as correct, round(avg(correct::int)::numeric, 3) as accuracy
from public.attempts a
cross join lateral (values ('bias', 1, a.guided_bias_correct), ('entry', 2, a.guided_entry_correct),
                           ('stop', 3, a.guided_stop_correct), ('target', 4, a.guided_target_correct)) as s(step, step_order, correct)
where a.answer_type = 'guided' and s.correct is not null
group by user_id, step, step_order;
```

**Reading it:**
- A step counts only when the user **reached** it. Choosing No Trade at the entry step leaves stop and target blank, not wrong.
- `reached` usually falls from bias to target. That's expected, not a problem.

## `v_free_trade_process_vs_outcome`

**Question:** In Free Trade, how often do users follow a good process, how often do they win, and are those the same thing?

```sql
select user_id, count(*) as scenarios,
       count(*) filter (where is_correct) as process_passed,
       round(avg(is_correct::int)::numeric, 3) as process_pass_rate,
       count(*) filter (where free_outcome in ('win','loss')) as closed_trades,
       count(*) filter (where free_outcome = 'win') as wins,
       round((count(*) filter (where free_outcome = 'win'))::numeric
             / nullif(count(*) filter (where free_outcome in ('win','loss')), 0), 3) as win_rate,
       count(*) filter (where is_correct and free_outcome = 'win')      as good_process_wins,
       count(*) filter (where is_correct and free_outcome = 'loss')     as good_process_losses,
       count(*) filter (where not is_correct and free_outcome = 'win')  as bad_process_wins,
       count(*) filter (where not is_correct and free_outcome = 'loss') as bad_process_losses,
       round(sum(coalesce(free_result_r, 0))::numeric, 2) as total_r
from public.attempts where answer_type = 'free' group by user_id;
```

**Reading it:**
- `win_rate` is over closed trades only. A trade still open at session end, or No Trade, is neither a win nor a loss.
- The four `*_process_*` counts form a 2×2:
  - `bad_process_wins`: lucky trades, the habit the app exists to break.
  - `good_process_losses`: sound trades that lost. Normal, and they pass.

## `v_response_time`

**Question:** Do users answer faster when they're right? Hesitation is a proxy for uncertainty.

```sql
select user_id, concept, is_correct, count(*) as attempts,
       round(avg(response_time_ms))::int as avg_ms,
       (percentile_cont(0.5) within group (order by response_time_ms))::int as median_ms
from public.attempts group by user_id, concept, is_correct;
```

**Reading it:**
- Prefer `median_ms`. One attempt left open in another tab for ten minutes wrecks the average.
- Compare `is_correct = true` against `false` within a concept.
- Response time runs from the exercise appearing to the answer being submitted. For Free Trade that includes watching the playback.

## `v_session_progress` and `v_session_dropoff`

**Question:** Where in a practice session do users stop?

```sql
-- one row per session
select user_id, session_id, count(*) as exercises_answered, count(*) filter (where is_correct) as correct,
       min(created_at) as started_at, max(created_at) as last_answer_at, array_agg(distinct concept) as concepts
from public.attempts where session_id is not null group by user_id, session_id;

-- distribution
select exercises_answered, count(*) as sessions,
       round(count(*)::numeric / sum(count(*)) over (), 3) as share_of_sessions
from v_session_progress group by exercises_answered;
```

**Reading it:**
- Sessions are 5, 10 or all exercises long, so peaks at 5 and 10 are completed sessions.
- A cluster at 1–2 answers is early abandonment.
- Attempts recorded before `session_id` existed (2026-09-25) are left out.
- These views only know how far a user got, not how long the session was meant to be. `v_session_funnel` (below) adds that from `practice_events`.

---

## Session and event views

*Added with `practice_events` in `20260926130000_practice_events.sql`.*

Attempts only say what was answered. `practice_events` records the rest:
- `session_started`, with mode, concept, planned length, and whether the session came from the recommendation, the adaptive mix, the concept picker or a deep link;
- `session_completed`;
- `session_abandoned`: the user left for the picker or started another session mid-way;
- `recommendation_shown`.

The table has Row Level Security like `attempts`: users can insert and read only their own events.

### `v_session_funnel`

**Question:** How many sessions that start get finished?

```sql
select s.user_id, count(*) as sessions_started,
       count(c.session_id) as sessions_completed,
       round(count(c.session_id)::numeric / nullif(count(*), 0), 3) as completion_rate
from practice_events s
left join practice_events c on c.session_id = s.session_id and c.event_type = 'session_completed'
where s.event_type = 'session_started' group by s.user_id;
```

The real view reads from `v_sessions` (one row per started session, also exported as CSV by `/api/export/sessions`), which is the query above plus fallbacks for sessions with no end event.

**Reading it:** a low `completion_rate` with high attempt counts means users practice but don't finish sessions. That usually means sessions are too long.

### `v_session_abandonment`

**Question:** At which exercise do unfinished sessions stop?

**Reading it:** one row per (`planned_length`, `exercises_answered` before stopping). For example, `planned_length = 10, exercises_answered = 3, sessions = 12` means 12 ten-exercise sessions were left after 3 answers. Sessions never marked completed count as abandoned, whether the user explicitly moved on or simply closed the tab.

### `v_mode_usage`

**Question:** Which practice modes get used?

**Reading it:** sessions started and completed per mode (`recognition`, `guided_entry`, `free_trade`, `adaptive`), and how many distinct users used each.

### `v_recommendation_follow`

**Question:** Do users follow the recommended session, or pick their own?

**Reading it:**
- `shown` counts days on which the dashboard showed a recommendation.
- `followed` counts sessions started from it.
- `own_choice` counts sessions started from the concept picker.
- `follow_rate = followed / shown`.

### `v_time_between_sessions`

**Question:** How long do users go between sessions? This is a retention signal.

**Reading it:** one row per session start after a user's first, with `hours_since_previous`. The median per user shows habit: under 24 hours is daily practice.

---

## Admin functions

`/admin` needs numbers across **all** users. With the anon key, Row Level Security would limit every view to the signed-in admin's own rows. So `20260926140000_admin_functions.sql` adds `security definer` functions, which run with the owner's rights: `admin_overview()`, `admin_exercise_failures()`, `admin_concept_ranking()`. Each first checks `public.is_admin()`, meaning the caller's user id is listed in `public.app_admins`, and raises an error otherwise. After applying the migration, add yourself:

```sql
insert into public.app_admins (user_id)
select id from auth.users where email = 'you@example.com';
```
