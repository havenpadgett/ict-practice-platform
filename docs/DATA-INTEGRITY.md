# Data Integrity Guarantees

*2026-09-27 (AI-DRAFTED, pending Haven's review).*

`supabase/migrations/20260927130000_attempt_integrity.sql` (**not yet applied**) makes the database refuse attempt rows that can't be right, even if application code has a bug. Grading runs on the server now (ANSWER-KEYS.md), but users can still write their own rows directly, so the database is the last line of defense.

## What's guaranteed

| Constraint | Rule |
|---|---|
| **A real user** | This already existed and is unchanged: `user_id` is `NOT NULL`, references `profiles(id)`, which references `auth.users(id)`, with `on delete cascade` at both steps. |
| `attempts_concept_valid` | `concept` is one of the 9 concept keys. A new concept needs a migration, which is deliberate. |
| `attempts_concept_matches_mode` | Guided attempts are always `GuidedEntry` and Free Trade attempts are always `FreeTrade`, both ways. |
| `attempts_exercise_id_format` | `exercise_id` is a lowercase slug (`fvg-001`, `real-mss-004`) of at most 64 characters. |
| `attempts_answer_shape` | **An attempt can't claim an answer type whose fields are null.** `region` must have a box, `level` a price, `choice` both choices, `guided` a bias, trade decision and bias verdict, `free` a direction, outcome and decision verdict. `user_answer_type` must also fit `answer_type`: a box only on a zone exercise, "none" only where "no answer" exists. |
| `attempts_foreign_fields_empty` | Fields belonging to other answer types are empty. For example, a zone attempt has no Guided Entry or Free Trade values. |
| `attempts_failure_reason_consistent` | A correct recognition answer has no failure reason. A wrong one has a reason that fits how it was answered: `off_level` only for a placed line, `missed_answer` only for "none", and so on. The trade modes never set one. |
| `attempts_measurement_consistent` | A box has coverage and precision together or neither. A missing measurement means there was nothing to find, so the answer must be a wrong `false_positive`. The same applies to a line's distance. |
| `attempts_choice_consistent` | A choice answer is correct exactly when the user's choice equals the correct choice. |
| `attempts_guided_consistent` | Guided Entry: a step's verdict exists exactly when its level was placed. Steps are reached in order. "Unclear" has no levels and no trade. A declared trade has all three levels. A **correct** declared trade got every step right and has an R:R. |
| `attempts_free_consistent` | Free Trade: no trade means no position and outcome `no_trade`. A trade has its levels, an exit after its entry, and an outcome that matches the exit: win means target and positive R, loss means stop and exactly −1R, open means session end. **`is_correct` is exactly "no applicable process check failed"**, so the process verdict can't disagree with its own checks. |
| `attempts_ranges` | Response time 0 to 24 hours. `attempt_number` ≥ 1. Coverage 0–1. Every price positive, box bottom ≤ top, candle indices ordered and ≥ 0. Guided R:R within ±1000; it can be negative, because a target on the wrong side is a real mistake worth keeping. Free Trade R:R between 0 and 1000. Free Trade result between −1R and 1000R. |
| `practice_events_ranges` | Known concepts, difficulty 1–3, lengths ≤ 200. A session id is present on every event except `recommendation_shown`. |

**Deliberately not encoded:** the grading thresholds themselves (60% coverage, 2.5× precision, level tolerances). They're an open decision (PRD D-3). If they change, rows graded under the old thresholds must stay valid, so the database checks consistency and structure, not the grading math.

**App changes to match:**
- The grading Server Functions cap response time at 24 hours.
- They refuse a Free Trade position with its stop or target on the wrong side, which the UI never allows anyway, so a forged request can't produce a row the database would reject.

**Tested** in `tests/sql/integrity.test.ts`:
- **Real grading output is accepted:** more than 300 rows produced by the actual grading code are all accepted. They cover every exercise, every answer shape the UI can submit, a trade in both directions, and all three exits.
- **Contradictory rows are refused:** each constraint turns away a matching contradictory row.
- **Existing bad rows don't block the migration:** applied over a database that already holds a bad row, it succeeds, still enforces the rule for new rows, and the audit script finds exactly that row.

## Existing data

**I couldn't check the hosted database.** The only access is the publishable key, and under RLS it returns nothing without a login. So nothing below comes from real rows. To find out, run `supabase/audit/attempt_integrity_audit.sql` in the SQL editor after applying the migration. It lists each violated constraint, how many rows break it, and example ids.

**The migration can't fail on old data:**
- Every constraint is added `NOT VALID` and then validated one at a time.
- A constraint that existing rows break prints a notice and stays enforced for new rows only.
- Once those rows are fixed, validate it with `alter table public.attempts validate constraint <name>;`.

**Rows that may violate, from the code history:**

| Likely violation | Why | Constraint |
|---|---|---|
| **Liquidity boxes from 2026-09-09, migrated from localStorage.** For one day, before accounts existed, Liquidity was answered by drawing a box. The sign-in migration (`migrateLocalAttempts`) takes `answer_type` from *today's* catalog, `level`, so such a row reads "a level exercise answered with a box". | `src/lib/attempts.ts` `migrateLocalAttempts`; Decision Log 2026-09-10 | `attempts_answer_shape` |
| **A response time over 24 hours.** The clock starts when the exercise appears, so an exercise left open overnight and answered the next day would record more than a day. Nothing capped it before. | `msSince` in the practice page | `attempts_ranges` |

These only exist if they happened in practice. The first needs someone who practiced Liquidity on 2026-09-09 before signing up. Everything else has been written by the same row builders the test above exercises:
- **Mode shapes:** since accounts arrived (2026-09-10), Guided Entry (2026-09-20) and Free Trade (2026-09-24).
- **Concept keys:** only ever added, never renamed.

The code path that created them is fixed (Bug Log 2026-09-27), so no new rows of that shape can be written. The recommended fix for any existing Liquidity rows is to delete them. They were graded against a zone definition that no longer exists. The audit script gives their ids.
