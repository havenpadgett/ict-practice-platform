# Scenario Validation

How real historical data becomes a practice exercise. The PRD deferred real data to Phase 7 because it needs "a real answer-validation process" (Section 5, V1 ambiguity rule). This is that process.

**The rule:** answer keys come from the curriculum's rules applied by code, not from someone eyeballing a chart — and no scenario reaches a user until a human has checked it against [CURRICULUM.md](CURRICULUM.md). Detection finds candidates; a person decides.

## Pipeline

```
raw CSV ──ingest.py──▶ clean JSON ──detect.py──▶ candidates ──build_scenario.py──▶ scenario JSON ──human review──▶ promoted (or rejected + logged)
```

| Stage | Tool | What it guarantees |
|---|---|---|
| 1. Source | — | Data comes from a named vendor/dataset whose license allows this use. Raw files go in `scripts/data/` (git-ignored — never commit licensed data). |
| 2. Clean | `scripts/ingest.py` | Strict ordering, no duplicate timestamps, no gaps outside scheduled CME closures (holidays must be named with `--allow-gap-on`), bar integrity (`low ≤ open/close ≤ high`), sane bar ranges and jumps. Timestamps converted to ET. Any error aborts with nothing written. |
| 3. Detect | `scripts/detect.py` | Every candidate is flagged by a rule that implements a CURRICULUM.md definition exactly: three-candle FVG, equal highs/lows, MSS by body close, previous day / NY AM / weekly highs and lows. Output lists each candidate's rule, timestamps, and price levels. |
| 4. Build | `scripts/build_scenario.py` | Turns one chosen candidate plus a candle window into an exercise in the app's format. The answer key is copied from the detected levels. It refuses (unless `--allow-ambiguous`) if the window holds another candidate of the same rule — PRD Section 5: exactly one valid answer per scenario. Writes `provenance.human_reviewed: false` and a placeholder explanation marked `[DRAFT`. |
| 5. Review | a human, this checklist | The candidate really is what the rule says, in curriculum terms; the chart is fair to a beginner; the explanation is rewritten in plain language. |
| 6. Promote or reject | `src/data/real-scenarios/index.ts` + the log below | Approved: review fields filled in, file registered. Rejected: file deleted, reason logged. |

### Commands

```bash
pip install -r scripts/requirements.txt          # Python 3.9+
python3 scripts/ingest.py scripts/data/nq_5m.csv --source "<vendor, dataset, license>" --source-tz UTC
python3 scripts/detect.py scripts/data/nq_5m.clean.json
python3 scripts/build_scenario.py scripts/data/nq_5m.clean.json scripts/data/nq_5m.candidates.json \
    --candidate <candidate id> --exercise-id real-<concept>-<nnn> --difficulty <1-3>
```

To try the pipeline without licensed data, generate synthetic bars first: `python3 scripts/sample/make_synthetic.py`, then run the same commands on `scripts/sample/synthetic_nq_5m.csv`. **Never promote a scenario built from synthetic data.**

Previous-day and weekly levels span a full day or week; build those from 1h (or 4h) bars so the chart stays around 40 candles. `build_scenario.py` warns when a window exceeds 120 bars.

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
