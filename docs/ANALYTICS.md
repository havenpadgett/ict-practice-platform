# Analytics Export

`GET /api/export/attempts` downloads the signed-in user's attempts as one flat CSV. There's also an **Export CSV** link on `/analytics`. It's built for Power BI, Excel, or any BI tool:
- **One row per attempt.**
- **Denormalized:** every column you'd otherwise get by joining back to exercise content (concept name, mode, real vs constructed) is already on the row.
- **No other tables needed.**

**Access:** you must be logged in; the route answers `401` otherwise. The query runs as that user, so Supabase Row Level Security limits it to their own attempts. There is no all-users export. That would need the service-role key on the server and an admin check, and neither exists yet (AI-DRAFTED decision, 2026-09-25: keep the export user-scoped until there's a real multi-user reporting need).

**Format:**
- **Encoding:** RFC 4180, UTF-8 with a byte-order mark so Excel detects the encoding, CRLF line endings.
- **Booleans:** `1` / `0`, so a column's average is a rate.
- **Blank cells:** the value doesn't apply (for example, a Guided Entry step the user never reached).
- **Timestamps:** UTC, ISO 8601.

Source: `src/lib/export.ts` (the column list) and `src/app/api/export/attempts/route.ts`. The column list is tested in `tests/export.test.ts`.

## Columns

### Who and when

| Column | Meaning |
|---|---|
| `attempt_id` | Unique id of the attempt (the `attempts` row id). |
| `user_id` | Supabase user id. |
| `user_email` | The user's email at export time. |
| `session_id` | The practice session the attempt was part of. Blank for attempts recorded before 2026-09-25, when the column was added. |
| `attempted_at_utc` | When the attempt was recorded, UTC, ISO 8601. |
| `attempted_date_utc` | The UTC calendar date of `attempted_at_utc`, for daily grouping. |

### What was practiced

| Column | Meaning |
|---|---|
| `exercise_id` | Exercise or scenario id (`fvg-001`, `real-mss-004`, `guided-003`, `ft-002`…). |
| `exercise_label` | What the exercise asks for ("Fair Value Gap", "Buy-Side Liquidity"…). Blank if the exercise no longer exists. |
| `concept` | Concept key: `FVG`, `Liquidity`, `MSS`, `IFVG`, `OrderBlock`, `TimeLiquidity`, `PremiumDiscount`, `GuidedEntry`, `FreeTrade`. |
| `concept_label` | Display name of the concept. |
| `mode` | `recognition` (mark the concept on a chart), `guided_entry` (bias → entry → stop → target) or `free_trade` (candle-by-candle playback). |
| `answer_type` | How the exercise is answered: `zone` (draw a box), `level` (place a line), `choice`, `guided`, `free`. |
| `user_answer_type` | What the user did: `region`, `level`, `choice`, `guided`, `free`, or `none` ("no X present"). |
| `difficulty` | 1 (easiest) to 3, recorded at the time of the attempt. Blank for attempts from before difficulty was recorded. |
| `data_source` | `real` (a reviewed historical NQ scenario), `constructed` (hand-built prototype data), or `unknown` (the exercise has since been removed). |
| `real_trading_date` | For real scenarios, the trading date the chart comes from. Blank otherwise. |
| `timeframe` | Candle timeframe of the exercise, e.g. `5m`, `15m`, `1h`. |

### Result

| Column | Meaning |
|---|---|
| `is_correct` | `1` if the attempt was correct. **For Guided Entry and Free Trade this is the process verdict, never whether the trade made money.** |
| `failure_reason` | Recognition mode only: which test failed. `coverage` (wrong area), `too_small`, `precision` (too broad), `time` (wrong candles), `off_level`, `wrong_choice`, `missed_answer` (said "none" when there was one), `false_positive` (marked something when there was none). |
| `response_time_ms` | Milliseconds from the exercise appearing to the answer. |
| `attempt_number` | How many times this user has attempted this exercise, this one included. |
| `coverage` | Zone answers: share of the true zone's price range inside the user's box (0–1). |
| `precision_ratio` | Zone answers: the box's height ÷ the true zone's height (1 = exact; the pass limit is 2.5). |
| `distance_from_level` | Level answers: the user's line minus the true level, in points (positive = too high). |

### Guided Entry steps

| Column | Meaning |
|---|---|
| `guided_bias_correct` | Guided Entry step result, `1` or `0`. Blank if the user never reached that step (they chose No Trade earlier). |
| `guided_entry_correct` | Same, for the entry step. |
| `guided_stop_correct` | Same, for the stop step. |
| `guided_target_correct` | Same, for the target step. |
| `guided_declared_trade` | `1` if the user submitted a full setup, `0` if they chose No Trade. |
| `guided_achieved_rr` | Risk-to-reward of the levels the user placed. |

### Free Trade

| Column | Meaning |
|---|---|
| `free_decision_correct` | Free Trade process check, `1` or `0`: traded a valid setup, or sat out an invalid one. |
| `free_direction_correct` | Same, for direction. Blank when the check didn't apply (e.g. no trade taken). |
| `free_entry_correct` | Same, for the entry. |
| `free_stop_correct` | Same, for the stop. |
| `free_rr_correct` | Same, for the risk-to-reward. |
| `free_direction` | `long`, `short`, or `none` (sat out). |
| `free_outcome` | `win` (target hit), `loss` (stop hit), `open` (still open at session end), `no_trade`. |
| `free_is_win` | `1` win, `0` loss, blank otherwise, so its average is the win rate on closed trades. |
| `free_result_r` | Result in R (multiples of the risk taken); −1 is a full stop-out. |
| `free_planned_rr` | Risk-to-reward of the trade as the user planned it. |

## Example questions

1. **Is real market data harder than the constructed exercises, concept by concept?**
   - Filter `mode = recognition`.
   - Put `concept_label` on the axis and `data_source` as the legend.
   - Measure the average of `is_correct`, with a count of `attempt_id` to show the sample size.
   - A gap that holds up at a meaningful count says the constructed exercises are too clean for that concept.
2. **Where does Guided Entry break down: reading the market, or placing the trade?**
   - Filter `mode = guided_entry`.
   - Compare the averages of `guided_bias_correct`, `guided_entry_correct`, `guided_stop_correct` and `guided_target_correct` (blanks are excluded automatically).
   - Add `attempted_date_utc` to see which step is improving.
3. **Does good process predict good results in Free Trade, or are people winning by luck?**
   - Filter `mode = free_trade`.
   - Cross-tab `is_correct` (process) against `free_is_win`, or plot the sum of `free_result_r` by `is_correct`.
   - Good process should earn more R over time even though individual good-process trades lose.
