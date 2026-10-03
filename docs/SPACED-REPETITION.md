# Spaced repetition

A mistake you've cleared comes back days later, to check it was learned and not just remembered from a minute ago. This is the scheduling logic as built (`src/lib/spaced-repetition.ts`, surfaced through `src/lib/mistakes.ts`), and the words it reserves.

## The words

| Word | Means | Never used for |
|---|---|---|
| **Open** | The latest answer on that chart is a miss. | |
| **Cleared** | One correct answer after the last miss: a single retry. | Anything that has not been rechecked. |
| **Confirming** | Cleared, and rechecked correctly at least once on a later day. | |
| **Mastered** | Four correct answers after the last miss, in four separate sessions, each at least the scheduled interval after the one before (below). At least 11 days in all. | A single correct retry. A streak of quick repeats. |

"Mastered" appears in the app only for the mastered stage: the Mistakes page, the dashboard line under the mistakes card, and the "Mistakes cleared" metric's detail. Everything else says "cleared".

## The schedule

After a miss, each correct answer *counts* only if it comes in a different session from the last counted answer **and** at least the interval after it:

| Counted answers | State | Next one counts after |
|---|---|---|
| 0 | open | (any correct answer starts the count) |
| 1 | cleared | 1 day |
| 2 | confirming (1 of 3 rechecks) | 3 days |
| 3 | confirming (2 of 3) | 7 days |
| 4 | mastered | |

- **Intervals are 24-hour multiples**, not calendar days, so they don't depend on a time zone, a device clock's date line, or a server in another zone. A chart cleared at 9 pm is due at 9 pm the next day.
- **An answer that doesn't count isn't penalized.** Practising a cleared chart early is fine; it just doesn't advance the schedule, and the chart stays due at the same time.
- **A miss resets it.** If a cleared, confirming or even mastered chart is answered wrong, the latest answer is a miss again: it is *open*, the count restarts from zero, and `lapses` goes up by one (kept for analysis; not shown yet). The chart did not hold, which is exactly what the recheck is for.
- **Only the answers after the last miss are looked at.** Earlier history (how many times it was missed before) is the Mistakes page's "missed N times".

## Where it shows up

- **Nav badge, dashboard card, practice picker:** "to review" is *open mistakes plus cleared ones that are due a recheck*.
- **Review mistakes session** (`/practice?mode=mistakes`, the dashboard and picker buttons): open mistakes first (most recently missed first), then due rechecks (longest overdue first), up to 20 (`MISTAKES_SESSION_CAP`). Answers in these sessions are recorded like any other, which is what advances the schedule. "Retry this chart" straight after an answer is never recorded and never counts.
- **Mistakes page:** each chart shows its stage ("Cleared. Recheck from Oct 4", "Cleared, rechecked 1 of 3. Due a recheck", "Mastered Oct 15: right again on separate days"). Filters: To review, Due a recheck, Cleared, Mastered, All.
- **Dashboard strip:** "Mistakes cleared" counts everything no longer open (mastered included), with mastered named in its detail.

## What it is derived from

Attempts alone: `created_at`, `session_id` and `is_correct`. There is no review table, so there is nothing to keep in step and no migration. Chart-by-chart state is recomputed whenever mistakes are read (`summarizeMistakes`), identically on the server (Mistakes page) and in the browser (nav badge, dashboard, picker). An older attempt with no session id is read as "can't tell", which doesn't block it from counting.

## What it does not do (yet)

- **It rechecks the same chart.** Each session frames a chart differently (`src/lib/framing.ts`: a different window, the answer in a different place), and the day-scale gaps mean the answer is not in short-term memory, but a learner who remembers *this exact chart* can still be right without having learned the concept. Pairing each mistake with a sibling chart of the same concept and difficulty would close that; it needs per-concept pools big enough to spare one, which Order Block, Premium & Discount and Time-Based Liquidity don't have yet.
- **No reminders.** Due rechecks show up where the learner already looks (nav badge, dashboard, picker); nothing is emailed or pushed.
- **No adaptive intervals.** 1, 3 and 7 days are fixed. If response time or confidence (now recorded) turn out to predict lapses, they could shorten or lengthen the next interval; that would be a change to this file and its test, and a decision for Haven, like the other engine constants.

## Changing it

Edit `REVIEW_INTERVALS_DAYS` in `src/lib/spaced-repetition.ts`; `MASTERY_SUCCESSES` follows from its length. `tests/spaced-repetition.test.ts` spells out every transition. Anything that reads "mastered" in copy should still be true afterwards: update this page's table with it.
