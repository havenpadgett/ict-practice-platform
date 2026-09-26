# Scenario Validation

How real historical data becomes a practice exercise. The PRD deferred real data to Phase 7 because it needs "a real answer-validation process" (Section 5, V1 ambiguity rule). This is that process.

**The rule:** answer keys come from the curriculum's rules applied by code, not from someone eyeballing a chart — and no scenario reaches a user until a human has checked it against [CURRICULUM.md](CURRICULUM.md). Detection finds candidates; a person decides.

## Pipeline

```
raw CSV ──ingest.py──▶ clean JSON ──detect.py──▶ candidates ──build_scenario.py──▶ scenario JSON ──human review──▶ promoted (or rejected + logged)
```

| Stage | Tool | What it guarantees |
|---|---|---|
| 1. Source | — | Data comes from a named vendor/dataset whose license allows this use. Raw files go in `data/raw/` (git-ignored — never commit licensed data); generated outputs go in `data/clean/` (also git-ignored). Every new source is checked against [Data quality lessons](#data-quality-lessons) before use. |
| 2. Clean | `scripts/ingest.py` | Strict ordering, no duplicate timestamps, no gaps outside scheduled CME closures (holidays must be named with `--allow-gap-on`), bar integrity (`low ≤ open/close ≤ high`), sane bar ranges and jumps. Timestamps converted to ET. Any error aborts with nothing written. |
| 3. Detect | `scripts/detect.py` | Every candidate is flagged by a rule that implements a CURRICULUM.md definition exactly: three-candle FVG, equal highs/lows, MSS by body close, previous day / NY AM / weekly highs and lows. Output lists each candidate's rule, timestamps, and price levels. |
| 4. Build | `scripts/build_scenario.py` | Turns one chosen candidate plus a candle window into an exercise in the app's format. The answer key is copied from the detected levels. It refuses (unless `--allow-ambiguous`) if the window holds another candidate of the same rule — PRD Section 5: exactly one valid answer per scenario. Writes `provenance.human_reviewed: false` and a placeholder explanation marked `[DRAFT`. |
| 5. Review | a human, this checklist | The candidate really is what the rule says, in curriculum terms; the chart is fair to a beginner; the explanation is rewritten in plain language. |
| 6. Promote or reject | `/review` (or by hand) + the log below | Approved: explanation rewritten, review fields filled in. Rejected: file deleted and unregistered, reason logged. Commit to make it live. |

### Curriculum versions

Each scenario records, in `provenance.curriculum_versions`, the version of every curriculum definition its answer key depends on (`scripts/common.py → curriculum_versions()`, from `src/data/curriculum-versions.json`). When a definition is bumped:
- scenarios built under the old version drop out of practice;
- they come back to `/review` as "needs re-review";
- `tests/curriculum.test.ts` fails until they're re-approved or rebuilt.

See docs/CURRICULUM-REVIEW.md → How a definition change is handled now.

### Commands

```bash
pip install -r scripts/requirements.txt          # Python 3.9+
CAL=(--calendar scripts/calendars/nq_2022_2025.txt --timestamp-label close --start 2022-12-27 --end 2025-12-11)
python3 scripts/ingest.py data/raw/Dataset_NQ_1min_2022_2025.csv --source "$NQ_SOURCE" "${CAL[@]}" \
    --session ny_am --context-start 07:00 --resample 5 -o data/clean/nq_nyam_ctx.clean.json
python3 scripts/ingest.py data/raw/Dataset_NQ_1min_2022_2025.csv --source "$NQ_SOURCE" "${CAL[@]}" \
    --session rth --resample 15 --max-bar-range-pct 3.5 -o data/clean/nq_rth_full.clean.json
python3 scripts/detect.py data/clean/nq_nyam_ctx.5m.clean.json
python3 scripts/detect.py data/clean/nq_rth_full.15m.clean.json
python3 scripts/build_scenario.py data/clean/nq_nyam_ctx.5m.clean.json data/clean/nq_nyam_ctx.5m.candidates.json \
    --candidate <candidate id> --exercise-id real-<concept>-<nnn> --difficulty <1-3>
```

`scripts/calendars/nq_2022_2025.txt` lists every date in this file where the NY session is missing or unusual: exchange closures and early closes (`allow` — missing bars expected), and NYSE holidays with only a thin futures session plus days with holes in the vendor's data (`exclude` — the date is dropped). `--end 2025-12-11` leaves out the truncated final trading day. `--max-bar-range-pct 3.5` admits the real 601-point 1m bar at 13:19 ET on 2025-04-09 (tariff-pause announcement).

### Timeframe and session constraints

Detection runs within one session at a time, so a session must hold enough bars for the rules to work. A swing point needs `--swing-lookback` (2) bars on each side inside the session; MSS needs two swing highs and two swing lows before the break.

| Timeframe | Session | Bars per session | Why |
|---|---|---|---|
| 5m | NY AM (9:30–11:00 ET), plus 07:00–9:30 context bars | 18 (+30 context) | Enough for FVGs, swings and equal highs/lows. On the 18 session bars alone MSS was rare (35 in 736 sessions); with `--context-start 07:00` the swings are read from 07:00 and there are 435 (see CURRICULUM.md, MSS). Only MSS uses the context bars. |
| 15m | RTH (9:30–16:00 ET) | 26 | NY AM would be only 6 bars — at most two bars could ever be swings, so equal highs/lows and MSS are mathematically impossible |

`previous_day_*` and `weekly_*` levels need every bar of the day or week, overnight included — `detect.py` skips them on NY AM- or RTH-only data. Build them from a `--session all` ingest.

### Building a batch

`scripts/pick_candidates.py` builds a spread-out batch: it splits the date range into equal slices, takes one candidate per slice (seeded random order, so a run can be repeated), and prefers a candidate matching a target difficulty that cycles 1–3. Difficulty is set by how clear the setup is: FVG size, how tight the equal highs/lows are, or how decisively the MSS break closed. `build_scenario.py` refuses a window if another candidate of the same rule is in it. On session data the window is the candidate's whole session; MSS windows on NY AM charts include the 07:00–9:30 context bars. It also refuses a window where:
- **FVG:** another gap of at least 0.1× the median bar range is visible, even one below the detection minimum.
- **Equal highs/lows:** the pool is taken before the chart ends.

The first batch (2026-09-24, awaiting review — no Review Log rows yet):

```bash
N=data/clean/nq_nyam_ctx.5m; R=data/clean/nq_rth_full.15m
python3 scripts/pick_candidates.py $N.clean.json $N.candidates.json --rules fvg --count 6 --prefix real-fvg --first 1
python3 scripts/pick_candidates.py $R.clean.json $R.candidates.json --rules fvg --count 4 --prefix real-fvg --first 7 --seed 2
python3 scripts/pick_candidates.py $N.clean.json $N.candidates.json --rules equal_highs,equal_lows --count 6 --prefix real-liq --first 1 --seed 3
python3 scripts/pick_candidates.py $R.clean.json $R.candidates.json --rules equal_highs,equal_lows --count 4 --prefix real-liq --first 7 --seed 4
python3 scripts/pick_candidates.py $N.clean.json $N.candidates.json --rules mss --count 7 --prefix real-mss --first 1 --seed 5
python3 scripts/pick_candidates.py $R.clean.json $R.candidates.json --rules mss --count 3 --prefix real-mss --first 8 --seed 6
```

That is 30 scenarios (`real-fvg-001`…`010`, `real-liq-001`…`010`, `real-mss-001`…`010`), each with `human_reviewed: false`. They are registered in `src/data/real-scenarios/index.ts`, so they're visible at `/review` but never served in practice until approved.

### Guided Entry and Free Trade batches

`scripts/build_trade_scenarios.py` classifies every NY AM session with the setup finder in `scripts/setups.py` (see CURRICULUM.md, Guided Entry → Real-data scenarios). It builds a planned mix of valid and no-trade sessions, spread across the date range and never reusing a session another trade scenario already uses. `scripts/register_scenarios.py` then rewrites the import list in `src/data/real-scenarios/index.ts`.

```bash
N=data/clean/nq_nyam_ctx.5m
python3 scripts/build_trade_scenarios.py $N.clean.json $N.candidates.json --mode guided \
    --plan valid=6,no_shift=1,no_sweep=1,no_entry=1,low_rr=1 --prefix real-guided
python3 scripts/build_trade_scenarios.py $N.clean.json $N.candidates.json --mode free \
    --plan valid=4,no_shift=2,no_sweep=2,no_entry=1,low_rr=1 --prefix real-ft --seed 2
python3 scripts/register_scenarios.py
```

Every step explanation and the overall verdict are drafts. `/review` asks for each of them to be rewritten before approving.

To try the pipeline without licensed data, generate synthetic bars first: `python3 scripts/sample/make_synthetic.py`, then run the same commands on `scripts/sample/synthetic_nq_5m.csv`. **Never promote a scenario built from synthetic data.**

Previous-day and weekly levels span a full day or week; build those from 1h (or 4h) bars so the chart stays around 40 candles. `build_scenario.py` warns when a window exceeds 120 bars.

## Data sources

| Source | Vendor / dataset | Coverage | License | Allowed use |
|---|---|---|---|---|
| `data/raw/Dataset_NQ_1min_2022_2025.csv` (sha256 in each clean file's `meta.input_sha256`) | Kaggle, "NQ Futures 1min Bar 2022-2025" — redistributed CME data | NQ 1m bars, 2022-12-26 18:00 to 2025-12-11 20:51 ET (file truncated at Excel's row limit; trading day 2025-12-12 is incomplete) | **Unverified** | Personal use only |

Pass this as `--source` (the `$NQ_SOURCE` above):
`Kaggle, "NQ Futures 1min Bar 2022-2025" (redistributed CME data); license unverified - personal use only`

**Before any public release, the license must be confirmed** — for this dataset that means establishing whether the uploader had the right to redistribute CME data and on what terms. Until then, scenarios built from it may be reviewed and practiced locally but must not ship in a public build.

## Data quality lessons

**Check which end of the bar the timestamp labels.** The Kaggle NQ file stamps each 1m bar with its *close* time: the 9:30–9:31 opening bar is labelled 9:31, every trading day starts at 18:01, and 734 bars sit at 17:00 — inside the daily CME halt, when no bar can open. The app and every pipeline stage treat a timestamp as the bar's *open*, so unshifted data puts every candle one bar late: session shading, day separators, NY AM levels and 5m/15m aggregation buckets all come out wrong without any visible error. Ingest it with `--timestamp-label close`.

Any new data source must be checked for this before use:
- Run `ingest.py --check-only` without `--timestamp-label`. Bars reported inside a scheduled closure (e.g. at 17:00 ET) almost always mean close-time labels.
- Confirm independently: the RTH open's volume spike (and an RTH VWAP column resetting, if present) should land on the 9:30 bar, and the first bar of each trading day should be 18:00.
- Record the convention in the Data sources table above.

## Provenance

Every real scenario carries a `provenance` block (type `ScenarioProvenance` in `src/data/exercises.ts`):

| Field | Set by | Meaning |
|---|---|---|
| `data_source` | ingest (`--source`) | Vendor, dataset, and license the candles came from |
| `symbol` | ingest | Instrument, e.g. NQ |
| `date_range.start` / `.end` | build | First and last candle in the scenario (ET) |
| `trading_date` | build | Trading date the setup formed on (18:00–17:00 ET) |
| `session` / `context_start` | build | Session the data was cut to (`ny_am`, `rth`, `all`), and for MSS on NY AM charts the time structure context starts (`07:00`) |
| `timeframe` | build | Bar size, e.g. `5m`, `15m` |
| `detection_rule` | build | The `detect.py` rule that flagged it, e.g. `fvg`, `mss`, `previous_day_high` |
| `candidate_id`, `detection_params`, `detection_notes` | build | Exactly which candidate, with which settings, and what the detector saw |
| `input_sha256` | ingest | Hash of the raw CSV — traces the scenario to the exact file |
| `human_reviewed` | build → reviewer | `false` until promoted |
| `reviewed_by`, `reviewed_at`, `review_notes` | reviewer | Who approved it, when (YYYY-MM-DD), and anything notable |

**Enforcement in the app:**
- `isPracticeReady()` in `src/data/exercises.ts` — sessions are built only from exercises with no provenance (constructed) or `human_reviewed: true`. An unreviewed scenario can be registered and still never appear in practice.
- `parseRealScenario()` in `src/data/real-scenarios/index.ts` — every registered file is validated at load. A scenario marked reviewed without `reviewed_by`/`reviewed_at`, or still carrying the `[DRAFT` explanation, fails loudly instead of shipping.

## Review checklist

Work through every item for each candidate. One "no" means reject (or fix and re-build — never hand-edit the answer key).

**Data**
- [ ] `data_source` names a real, licensed source — not the synthetic sample
- [ ] The window's dates look right on the chart (day separators, NY AM shading where expected) and don't straddle a holiday or data outage

**The answer key, against CURRICULUM.md**
- [ ] The detected concept is genuinely present by the curriculum definition — not just technically matched (e.g. an MSS broke a *structural* swing, not a minor internal one; confirmed by a body close, not a wick)
- [ ] The answer key's levels match what's on the chart (price range, level, candle indices)
- [ ] Exactly one valid answer in the window — no second FVG / equal-highs pool / MSS that a correct user could reasonably pick instead
- [ ] For time-based levels: the trading-day (18:00 ET) or trading-week boundary puts the level in the period the prompt names
- [ ] The level tolerance is fair for this timeframe (default: half the window's median bar range, minimum 2 points)

**Fairness to a beginner**
- [ ] Everything needed to answer is visible on the chart — nothing depends on candles outside the window
- [ ] The prompt doesn't give the answer away
- [ ] Difficulty (1–3) matches how obvious the setup is compared with the constructed exercises

**Copy**
- [ ] The `[DRAFT` explanation is rewritten in plain, beginner-friendly language — no candle numbers, states the correct answer explicitly (PRD Section 6.3)

**Promote** — use `/review`, which does the first three steps:
- [ ] Set `human_reviewed: true`, `reviewed_by`, `reviewed_at`, and `review_notes` if anything is worth recording
- [ ] Make sure the file is imported in `src/data/real-scenarios/index.ts` and listed in `registered` (`build_scenario.py` output must be registered by hand; the first batch already is)
- [ ] Add a row to the Review Log below
- [ ] Run the app and complete the exercise once, both correct and incorrect
- [ ] Commit the scenario file, `index.ts` and this doc

### The /review page

`/review` is internal tooling. It needs a login (`src/proxy.ts`), and the signed-in email must be listed in `REVIEWER_EMAILS` in `.env.local` (comma-separated; unset means nobody).

**Layout:**
- Candidates are grouped **by detection rule**, so you review one concept at a time. Counts show reviewed vs. remaining overall and per rule.
- Each candidate shows the chart with the detected answer key drawn on it, the rule that fired with its values and parameters, and the provenance.
- The **curriculum definition** the rule implements sits beside the chart, with its version. Definitions it also depends on are collapsed underneath.

**Three decisions:**
- **Approve:** requires the rewritten text users will see (anything still containing `[DRAFT` is refused). It updates the JSON file.
- **Reject:** pick a structured reason (wrong answer key, ambiguous, poor quality chart, doesn't match the definition, other + note). It deletes the JSON file and removes it from `index.ts`.
- **Flag ambiguous:** needs a note on what could be read two ways. It keeps the file, marked `review_status: "ambiguous"`, which is never practice-ready.

Every decision is appended to `docs/review-log.json`. The Rejection Summary, Review Log and Ambiguous Log below are regenerated from it.

**Keyboard:**

| Key | Action |
|---|---|
| `j` / `k` | Next / previous candidate |
| `[` / `]` | Previous / next rule |
| `a` | Approve |
| `r`, then `1`–`5` | Reject, choosing the reason |
| `f` | Flag ambiguous |
| Cmd/Ctrl+Enter | Submit the field you're in |
| Esc | Leave a field |

**Where it works:** scenarios stay in the repo, not the database, so saving only works on the local dev server. A deployed build shows the page read-only. Changes go live once committed and deployed.

## Rejection Summary

Generated from `docs/review-log.json` on every review decision. A rule with a high rejection rate is a rule to fix in `scripts/detect.py` or in [CURRICULUM.md](CURRICULUM.md); keep rejecting its output and the same mistake just gets rejected fifty times. A rule is called out below once 30% or more of at least 5 reviews end in rejection or an ambiguous flag.

Rejection reasons (picked on `/review`, keys 1–5):
- **Wrong answer key:** the detected zone or level isn't the right one.
- **Ambiguous:** reasonable traders would disagree. Prefer "Flag ambiguous", which keeps the file for later; this reason deletes it.
- **Poor quality chart:** a data gap, an unreadable window, or too few candles.
- **Doesn't match the definition:** the rule fired, but the chart doesn't satisfy the curriculum (see docs/DETECTION-AUDIT.md for known gaps).
- **Other:** a note is required.

<!-- rejection-summary:start -->
*Rejection rate counts rejected and ambiguous together: both mean the rule produced something that can't be an exercise.*

| Rule | Awaiting | Reviewed | Approved | Rejected | Ambiguous | Rejection rate | Most common reason |
|---|---|---|---|---|---|---|---|
| equal_highs | 5 | 0 | 0 | 0 | 0 | — | — |
| equal_lows | 5 | 0 | 0 | 0 | 0 | — | — |
| free_trade_setup | 10 | 0 | 0 | 0 | 0 | — | — |
| fvg | 10 | 0 | 0 | 0 | 0 | — | — |
| guided_setup | 10 | 0 | 0 | 0 | 0 | — | — |
| mss | 10 | 0 | 0 | 0 | 0 | — | — |

| Reason | Rejections | Share | Rules |
|---|---|---|---|
| Wrong answer key | 0 | — | — |
| Ambiguous | 0 | — | — |
| Poor quality chart | 0 | — | — |
| Doesn't match the definition | 0 | — | — |
| Other | 0 | — | — |

No rule is above the 30% line yet (needs at least 5 reviews to count).
<!-- rejection-summary:end -->

## Review Log

Every candidate that reaches review gets a row: approvals and rejections alike. Rejected scenario files are deleted; the log keeps the reason so the same candidate isn't re-built and re-rejected. **This table and the two below are generated** from `docs/review-log.json` by `/review`. Edit the JSON, not the tables.

<!-- review-log:start -->
| Date | Exercise ID | Candidate ID | Rule | Decision | Reason | Reviewer | Notes |
|---|---|---|---|---|---|---|---|
| — | — | — | — | — | — | — | No real scenarios reviewed yet |
<!-- review-log:end -->

## Ambiguous Log

Candidates flagged **ambiguous**: two reasonable traders would label the chart differently. Per the PRD's ambiguity rule (Section 5, "exactly one valid answer"), they never become exercises. Their files stay on disk with `provenance.review_status: "ambiguous"`, so they can be revisited once the definition behind them is settled (docs/CURRICULUM-REVIEW.md).

<!-- ambiguous-log:start -->
| Date | Exercise ID | Candidate ID | Rule | Decision | Reason | Reviewer | Notes |
|---|---|---|---|---|---|---|---|
| — | — | — | — | — | — | — | None flagged yet |
<!-- ambiguous-log:end -->
