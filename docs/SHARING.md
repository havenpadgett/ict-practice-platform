# Sharing: challenge links, the daily challenge, share cards

*2026-10-03 (AI-DRAFTED, pending Haven's review).* How a chart gets from one person to another without an account, what the public routes show and don't, and how to operate them.

## Challenge links: `/c/<exercise id>`

Any practice-ready **Recognition** (zone, level, choice) or **Guided Entry** exercise has a standalone public URL. A visitor sees the chart and the prompt with no account; the answer stays on the server until they commit to one.

| Step | What happens |
|---|---|
| Open the link | `src/app/c/[id]/page.tsx` renders the chart through `toPublicExercise`, which drops the answer key, explanation, near-miss note, `setup_span` and provenance (the same projection practice uses; `tests/answer-keys.test.ts` pins it for every exercise). The chart is shown whole, so the link is the same chart for everyone. |
| Submit | `gradeChallengeRecognition` / `gradeChallengeGuided` (`src/app/c/actions.ts`) grade on the server and return the verdict, the checks, the explanation, the key to draw (your mark solid, the correct one dashed) and the attempt row. No account, nothing written server-side. |
| After | Your mark against the correct one, the explanation, a "Practice more {concept}" call to action (sign-up first, returning to practice), Share, "Create result card", and a prompt to make an account to keep the result. |
| Save | Signed in: the row goes to the attempt history. Signed out: it is kept in `localStorage` (`ict-practice:pending-results`, `src/lib/pending-attempts.ts`) and the dashboard offers to add it after sign-up ("N results from before you signed in"). The row is the one the server built from the grade, so nothing is re-graded or re-typed. |

**Where the links are:** a share action on every completed exercise in practice (Recognition and Guided Entry), on challenge results, on the daily challenge, and on the session summary ("Send a friend a chart from this session": a missed chart if there was one).

**What isn't shareable: Free Trade.** Its playback needs the not-yet-revealed candles in the browser, and a public page must not carry them. A share action isn't shown for it, and `/c/<free trade id>` is a 404. Serving candles one at a time from the server would fix it (docs/ANSWER-KEYS.md → "What this does not protect"); not built.

**Real-data charts** (`real-*`, CME-derived, licence unconfirmed: docs/APP_PERFECTION_PLAN.md → B1) are shareable like any other practice-ready chart, because they are already served to anyone who signs up. To stop serving them on public links without a code change, set `NEXT_PUBLIC_SHARE_REAL_SCENARIOS=false` and redeploy; their links 404 and their share buttons disappear. The landing page's chart and "Try 3 more charts" are constructed.

**Not reachable before committing, verified:** page source and RSC payload for a zone, level, choice and Guided Entry exercise (constructed and real), the daily page and the landing page contain none of `answer`, `key_candle_index`, `explanation`, `distractor_note`, `setup_span`, `provenance`, `has_answer`, `correct_choice`, `step_explanations`, `overall_explanation`, `is_valid_setup`, `intended_bias`, `entry_zone`, `stop_zone`, `hidden_candles`, `minor_margin`, `invalidation_price`, `reasonable_buffer`; no static JS chunk contains exercise explanations or key fields; and `tests/challenge.test.ts` repeats the projection check for every shareable exercise. The one deliberate exception is a choice exercise's `fvg_zone` / `dealing_range`, which is the question itself (src/data/exercises.ts → ChoiceAnswer).

**What a public grading call can do:** grade one of the shareable exercises and return its key, as practice does. Someone POSTing a dummy answer learns the key; that is the documented "deliberate probing" limit (docs/ANSWER-KEYS.md), and there is no leaderboard or score for it to inflate.

## Daily challenge: `/daily` and `/daily/<date>`

One chart per **UTC** day (00:00 UTC = 8 pm ET in summer, 7 pm in winter), the same for everyone. `/daily` redirects to today's dated address, which is the one to share. A date in the future, before the first daily, or malformed is a 404, so tomorrow's chart can't be previewed.

- **Schedule:** `src/data/daily-schedule.ts`, one exercise id per day from `2026-10-03`, generated and **append-only** by `npm run daily`. A published day never changes, because links get shared. The concept rotates through seven (FVG, Liquidity, MSS, IFVG, Order Block, Premium & Discount, Time-Based Liquidity) and the difficulty through a cycle of five; within a concept the least-used chart comes first, hand-built and human-reviewed before auto-approved. The front-page chart is excluded. The current file covers 365 days from 2026-10-03; a test fails once fewer than 60 days remain, as a reminder to run `npm run daily -- <days>`. If it ever runs out the schedule repeats from the start rather than going blank. Charts do repeat within the year (a concept's pool is 11 to 31 charts); more reviewed content lengthens the cycle.
- **Grading:** `source: "daily:<date>"`. The server only grades that day's exercise. It records the attempt as a **daily completion** (session id `daily:<date>`) only when the date is today (UTC); an earlier day's link still grades, as an ordinary challenge, and doesn't extend the streak.
- **Completion and streak** are derived from attempts (the `daily:<date>` session ids), signed in or from the results kept on the device, so there is no table and no migration, and signed-out completions carry into the account at sign-up. They are separate from the practice streak (`profiles.current_streak`, sessions per day), and the dashboard labels them apart ("Practice streak", "Daily streak"). The streak is consecutive completed days up to today; today not yet played doesn't break it.
- **No leaderboard**, no comparison with other people, no count of who played.
- **Surfaces:** the dashboard card, the landing page link, its own link preview image, and a result card carrying the date and streak.

## Share cards: `POST /api/card`

A 1200 × 630 PNG: the learner's marked chart (solid) against the correct one (dashed mint), the result, the concept and difficulty, the brand mark, "Educational use only. Not financial advice." Two kinds: a **result** (a challenge, daily or practice answer) and a **session** (score, per-concept results, and the chart from the session that went best).

- **Built from ids, numbers and marks only** (`src/lib/card/model.ts`). No free text is accepted, so the endpoint can't be used to put arbitrary words under the brand; every sentence on a card is derived from the exercise and the grade.
- **The card grades the mark itself.** The verdict comes from the grader, not from the request. The correct answer is drawn only for shareable exercises and only next to the answer given, which is exactly what the feedback for that answer shows.
- **No fabricated numbers.** A card contains no money, P&L, R figure, win rate or population statistic. The only figures are this session's own score and per-concept counts and, on a daily card, the learner's own streak. `tests/share-card.test.ts` checks the strings.
- **Public, unauthenticated, uncached** (`Cache-Control: no-store`). Rendering takes about 70 ms warm. There is no rate limit in the app (as for `/try`); put a rate limit on `/api/card` and `/c/*` at the platform (Vercel Firewall) if it is ever abused. Bodies over 4 KB are refused.
- **Fonts:** Geist Regular and SemiBold (SIL OFL, `src/assets/fonts/`), the app's own typeface.
- **Link previews** (Open Graph / Twitter) for `/c/<id>` and `/daily/<date>` show the chart and the question, never the answer (`src/lib/card/og.tsx`).

## Operating it

| Task | How |
|---|---|
| Stop serving real-data charts on public links | `NEXT_PUBLIC_SHARE_REAL_SCENARIOS=false`, redeploy |
| Extend the daily schedule | `npm run daily -- 540` (days from the first), commit `src/data/daily-schedule.ts` |
| Regenerate favicon / Apple icon | `npm run brand` |
| Change the mark | `src/lib/brand.ts` (one geometry for the nav, favicons, social preview and cards), then `npm run brand` |
| A scheduled daily chart is withdrawn (stops being practice-ready) | `tests/daily.test.ts` fails; replace that day's id by hand if it's already published (the one exception to append-only), and say why in the commit |
