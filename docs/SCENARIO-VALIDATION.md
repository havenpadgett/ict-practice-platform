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
| 6. Promote or reject | `src/data/real-scenarios/index.ts` + the log below | Approved: review fields filled in, file registered. Rejected: file deleted, reason logged. |

### Commands

```bash
pip install -r scripts/requirements.txt          # Python 3.9+
CAL=(--calendar scripts/calendars/nq_2022_2025.txt --timestamp-label close --start 2022-12-27 --end 2025-12-11)
python3 scripts/ingest.py data/raw/Dataset_NQ_1min_2022_2025.csv --source "$NQ_SOURCE" "${CAL[@]}" \
    --session ny_am --resample 5 -o data/clean/nq_nyam_full.clean.json
python3 scripts/ingest.py data/raw/Dataset_NQ_1min_2022_2025.csv --source "$NQ_SOURCE" "${CAL[@]}" \
    --session rth --resample 15 --max-bar-range-pct 3.5 -o data/clean/nq_rth_full.clean.json
python3 scripts/detect.py data/clean/nq_nyam_full.5m.clean.json
python3 scripts/detect.py data/clean/nq_rth_full.15m.clean.json
python3 scripts/build_scenario.py data/clean/nq_nyam_full.5m.clean.json data/clean/nq_nyam_full.5m.candidates.json \
    --candidate <candidate id> --exercise-id real-<concept>-<nnn> --difficulty <1-3>
```

`scripts/calendars/nq_2022_2025.txt` lists every date in this file where the NY session is missing or unusual: exchange closures and early closes (`allow` — missing bars expected), and NYSE holidays with only a thin futures session plus days with holes in the vendor's data (`exclude` — the date is dropped). `--end 2025-12-11` leaves out the truncated final trading day. `--max-bar-range-pct 3.5` admits the real 601-point 1m bar at 13:19 ET on 2025-04-09 (tariff-pause announcement).

### Timeframe and session constraints

Detection runs within one session at a time, so a session must hold enough bars for the rules to work. A swing point needs `--swing-lookback` (2) bars on each side inside the session; MSS needs two swing highs and two swing lows before the break.

| Timeframe | Session | Bars per session | Why |
|---|---|---|---|
| 5m | NY AM (9:30–11:00 ET) | 18 | Enough for FVGs, swings, equal highs/lows; MSS is rare (about 1 in 20 sessions) |
| 15m | RTH (9:30–16:00 ET) | 26 | NY AM would be only 6 bars — at most two bars could ever be swings, so equal highs/lows and MSS are mathematically impossible |

`previous_day_*` and `weekly_*` levels need every bar of the day or week, overnight included — `detect.py` skips them on NY AM- or RTH-only data. Build them from a `--session all` ingest.

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

**Promote**
- [ ] Set `human_reviewed: true`, `reviewed_by`, `reviewed_at`, and `review_notes` if anything is worth recording
- [ ] Import the file in `src/data/real-scenarios/index.ts` and add it to `registered`
- [ ] Add a row to the Review Log below
- [ ] Run the app and complete the exercise once, both correct and incorrect

## Review Log

Every candidate that reaches review gets a row — approvals and rejections alike. Rejected scenario files are deleted; the log keeps the reason so the same candidate isn't re-built and re-rejected.

| Date | Exercise ID | Candidate ID | Rule | Decision | Reviewer | Reason / notes |
|---|---|---|---|---|---|---|
| — | — | — | — | — | — | No real scenarios reviewed yet |
