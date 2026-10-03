# Scenario Validation

How real historical data becomes a practice exercise. The PRD deferred real data to Phase 7 because it needs "a real answer-validation process" (Section 5, V1 ambiguity rule). This is that process.

**The rule:** answer keys come from the curriculum's rules applied by code, not from someone eyeballing a chart. Since 2026-10-03 a scenario reaches users one of two ways, and the record always says which:
- **Human-reviewed** (`human_reviewed: true`, `reviewed_by` = the reviewer): a person checked it against [CURRICULUM.md](CURRICULUM.md) at `/review` and wrote or approved its explanation. The first 49 approvals were done this way, as were later ones; see the [Approval Summary](#approval-summary) for the current counts.
- **Auto-approved** (`auto_approved: true`, `human_reviewed: false`, `reviewed_by: "auto"`): the pipeline built it from a detection rule, wrote its explanation in the house style, and approved it with no person reading it. [Auto-approval](#auto-approval) says what that does and doesn't guarantee.

Don't describe the whole set as human-validated: it isn't. The About page, README and landing copy say the same.

## Pipeline

```
raw CSV ──ingest.py──▶ clean JSON ──detect.py──▶ candidates ──build_scenario.py──▶ scenario JSON ──auto-approved──▶ live ──/review spot-check──▶ confirmed (or rejected + logged)
                                                                                         └─ --manual-review: held for a human first
```

| Stage | Tool | What it guarantees |
|---|---|---|
| 1. Source | — | Data comes from a named vendor/dataset whose license allows this use. Raw files go in `data/raw/` (git-ignored — never commit licensed data); generated outputs go in `data/clean/` (also git-ignored). Every new source is checked against [Data quality lessons](#data-quality-lessons) before use. |
| 2. Clean | `scripts/ingest.py` | Strict ordering, no duplicate timestamps, no gaps outside scheduled CME closures (holidays must be named with `--allow-gap-on`), bar integrity (`low ≤ open/close ≤ high`), sane bar ranges and jumps. Timestamps converted to ET. Any error aborts with nothing written. |
| 3. Detect | `scripts/detect.py` | Every candidate is flagged by a rule that implements a CURRICULUM.md definition exactly: three-candle FVG, equal highs/lows, MSS by body close, previous day / NY AM / weekly highs and lows. Output lists each candidate's rule, timestamps, and price levels. |
| 4. Build | `scripts/build_scenario.py` | Turns one chosen candidate plus a candle window into an exercise in the app's format. The answer key is copied from the detected levels. It refuses (unless `--allow-ambiguous`) if the window holds another candidate of the same rule — PRD Section 5: exactly one valid answer per scenario. Writes the `setup_span` the app frames the chart around (see [Chart framing](#chart-framing)), an explanation in the house style (`scripts/explanations.py`, [CURRICULUM.md → Explanation style guide](CURRICULUM.md#explanation-style-guide)) and `auto_approved: true`, `reviewed_by: "auto"`. With `--manual-review`, or for a rule without an explanation template, it instead writes `human_reviewed: false`, a placeholder explanation marked `[DRAFT`, and waits for a person. |
| 5. Register + catalog | `scripts/register_scenarios.py`, `npm run catalog` | Registers the file and marks it practice-ready in the generated catalog. Commit to make it live. |
| 6. Spot-check (optional, any time) | `/review`, this checklist | A person re-checks an auto-approved scenario (or one the app flagged from use): approve it (it becomes human-reviewed), reject it (file deleted, reason logged) or flag it ambiguous (kept, never live). |

### Auto-approval

*Decided 2026-10-03 (PRD Decision Log): hand review was the bottleneck, so new scenarios go live on the pipeline's say-so and humans check afterwards.* This replaced "no real scenario is served until a human approves it".

What an auto approval does vouch for:
- The answer key was **derived by code** from a detection rule that implements the curriculum definition (`scripts/detect.py`; its fit to the written definitions is audited in [DETECTION-AUDIT.md](DETECTION-AUDIT.md), which still lists known gaps).
- The builder refused windows holding a second candidate of the same rule (one valid answer, PRD Section 5).
- The explanation is a template filled from the answer key, so it can't contradict it.
- If a curriculum definition has changed since the scenario was built, it is only approved after its answer key is **re-derived from the source data under today's rules and comes out the same** (`scripts/auto_approve.py`). A key that no longer reproduces is flagged ambiguous and logged, never served.

What it does not vouch for: that the chart is fair to a beginner, that the setup is a *good* example in a trader's eyes, or that a rule with known audit gaps is right in this instance. Several rules (Order Block, Premium/Discount, IFVG, NY AM high/low) have no human-reviewed scenario at all yet, and the first three are still AI-DRAFTED, pending Haven's review, in CURRICULUM.md. Their explanation wording is extrapolated from the house style, not copied from reviewed examples.

How bad auto-approved keys surface:
- **Use:** an exercise is flagged when it gets open question reports (one is enough for an auto-approved scenario; two for a human-approved one) or when its success rate is at least 25 points below the rest of its concept over 10+ attempts and clear of chance (`admin_review_flags`, `src/lib/review/use-flags.ts`). Flagged scenarios show first, with the reason, at `/review?view=flagged`, and on `/admin`. The database functions behind this are in `supabase/migrations/20260927150000_question_reports.sql`, which is marked NOT YET APPLIED; until it is, nothing is flagged from use.
- **Spot-checks:** `/review?view=auto` lists every auto-approved scenario. Each decision there is logged with `after_auto`, so the Approval Summary shows how many were checked and how many a person overturned. That overturn rate is the measure of whether auto-approval is working: if it is high for a rule, switch that rule back to `--manual-review` and fix the rule.

To hold a batch for human review instead, pass `--manual-review` to `pick_candidates.py`, `build_scenario.py` or `build_trade_scenarios.py`.

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

The first batch (2026-09-24; built before auto-approval, so reviewed by hand):

```bash
N=data/clean/nq_nyam_ctx.5m; R=data/clean/nq_rth_full.15m
python3 scripts/pick_candidates.py $N.clean.json $N.candidates.json --rules fvg --count 6 --prefix real-fvg --first 1
python3 scripts/pick_candidates.py $R.clean.json $R.candidates.json --rules fvg --count 4 --prefix real-fvg --first 7 --seed 2
python3 scripts/pick_candidates.py $N.clean.json $N.candidates.json --rules equal_highs,equal_lows --count 6 --prefix real-liq --first 1 --seed 3
python3 scripts/pick_candidates.py $R.clean.json $R.candidates.json --rules equal_highs,equal_lows --count 4 --prefix real-liq --first 7 --seed 4
python3 scripts/pick_candidates.py $N.clean.json $N.candidates.json --rules mss --count 7 --prefix real-mss --first 1 --seed 5
python3 scripts/pick_candidates.py $R.clean.json $R.candidates.json --rules mss --count 3 --prefix real-mss --first 8 --seed 6
```

That is 30 scenarios (`real-fvg-001`…`010`, `real-liq-001`…`010`, `real-mss-001`…`010`), each with `human_reviewed: false`. They are registered in `src/data/real-scenarios/index.ts`, so they're visible at `/review` but never served in practice until approved. **Reviewed 2026-09-30: 49 of the first 50 approved (across this batch and the Guided/Free Trade one below), 1 (`real-mss-007`) flagged ambiguous — see the Review Log and Ambiguous Log below.**

The second batch (2026-09-30; auto-approved 2026-10-03 unless noted in the Review Log), deepening the existing pools and adding the first-ever real Order Block and TimeLiquidity content:

```bash
N=data/clean/nq_nyam_ctx.5m; R=data/clean/nq_rth_full.15m
python3 scripts/pick_candidates.py $N.clean.json $N.candidates.json --rules fvg --count 3 --prefix real-fvg --first 11 --seed 11
python3 scripts/pick_candidates.py $R.clean.json $R.candidates.json --rules fvg --count 2 --prefix real-fvg --first 14 --seed 12
python3 scripts/pick_candidates.py $N.clean.json $N.candidates.json --rules equal_highs,equal_lows --count 3 --prefix real-liq --first 11 --seed 13
python3 scripts/pick_candidates.py $R.clean.json $R.candidates.json --rules equal_highs,equal_lows --count 2 --prefix real-liq --first 14 --seed 14
python3 scripts/pick_candidates.py $N.clean.json $N.candidates.json --rules mss --count 3 --prefix real-mss --first 11 --seed 15
python3 scripts/pick_candidates.py $R.clean.json $R.candidates.json --rules mss --count 2 --prefix real-mss --first 14 --seed 23
python3 scripts/pick_candidates.py $N.clean.json $N.candidates.json --rules order_block --count 5 --prefix real-ob --first 1 --seed 21
python3 scripts/pick_candidates.py $R.clean.json $R.candidates.json --rules order_block --count 3 --prefix real-ob --first 6 --seed 22
python3 scripts/pick_candidates.py $N.clean.json $N.candidates.json --rules ny_am_high --count 3 --prefix real-tliq --first 1 --seed 31
python3 scripts/pick_candidates.py $N.clean.json $N.candidates.json --rules ny_am_low --count 3 --prefix real-tliq --first 4 --seed 32
```

That's 26 more recognition scenarios (`real-fvg-011`…`015`, `real-liq-011`…`015`, `real-mss-011`…`015`, `real-ob-001`…`008`, `real-tliq-001`…`006`). Notes:
- `pick_candidates.py`'s difficulty heuristic only covers `fvg`/`equal_*`/`mss` (see "Building a batch" above); `order_block` and the time-based rules always get difficulty 2 by default. The 8 Order Block scenarios were rebuilt with `build_scenario.py --candidate ... --difficulty <1-3>` directly, hand-set from each candidate's `displacement_ratio` (≥2.8× median range → 1, 2.3–2.8× → 2, below → 3) so the batch isn't uniformly "Medium". The 6 TimeLiquidity scenarios have no equivalent clarity signal in the candidate data (a session high/low is just the extreme, not a matter of degree) and were left at the default 2.
- One `pick_candidates.py` run (`mss --first 14 --seed 16`, not shown above) picked `mss-bearish-20230613T1415` — the exact same candidate already built as `real-mss-008`. Seeded random picks aren't checked against already-*built* scenarios, only against scenarios another *run in progress* would reuse, so an exact duplicate is possible by chance; this one was caught by hand (comparing every file's `provenance.candidate_id`) and rebuilt with `--seed 23` instead, which is what's shown above. Check for this before registering a future batch: `python3 -c "..."` comparing `candidate_id` across all `src/data/real-scenarios/real-<prefix>-*.json` files, same rule.
- TimeLiquidity's default window for a `ny_am_high`/`ny_am_low` candidate is exactly the 18-bar NY AM session (`build_scenario.py`'s `--window session` excludes context bars for every rule except `mss`/`order_block`) — every one of these scenarios would otherwise be the same fixed length, which `tests/framing.test.ts` catches as a chart-size clustering regression. They were rebuilt with `--start <day>T07:00:00<offset> --end <day>T10:55:00<offset>` to include the same 07:00 context bars MSS/Order Block scenarios get, then hand-patched to `setup_span: [30, 47]` (the original 18 session bars, offset by the 30 context bars) — the context bars are legitimate extra distractor history (a pre-market spike that isn't part of the NY AM session, exactly CURRICULUM.md's own "a lower pre-market spike... is a different level" distractor), not part of what the answer needs, so framing can vary how much of it is shown without ever hiding the session itself.

The third batch (2026-09-30; auto-approved 2026-10-03) adds the first-ever real IFVG and Premium/Discount content, plus a first difficulty-3 batch built from a relaxed detection profile (docs/CURRICULUM.md → Detection thresholds by difficulty tier):

```bash
N=data/clean/nq_nyam_ctx.5m; R=data/clean/nq_rth_full.15m
python3 scripts/pick_candidates.py $N.clean.json $N.candidates.json --rules ifvg --count 4 --prefix real-ifvg --first 1 --seed 41
python3 scripts/pick_candidates.py $R.clean.json $R.candidates.json --rules ifvg --count 3 --prefix real-ifvg --first 5 --seed 42
python3 scripts/pick_candidates.py $N.clean.json $N.candidates.json --rules dealing_range --count 4 --prefix real-pd --first 1 --seed 43
python3 scripts/pick_candidates.py $R.clean.json $R.candidates.json --rules dealing_range --count 3 --prefix real-pd --first 5 --seed 44
```

That's 14 scenarios (`real-ifvg-001`…`007`, `real-pd-001`…`007`), all difficulty 2 (`pick_candidates.py`'s difficulty heuristic doesn't cover `ifvg`/`dealing_range` either — see the Order Block note above).

**Difficulty-3 relaxed profile.** A separate detection pass, run only for this batch, with three thresholds pushed toward the legibility floor documented in Detection Parameters: `--fvg-min-range-mult 0.15 --equal-tolerance-pct 0.12 --ob-displacement-mult 1.5` (not `--mss-min-swing-mult`, which stays at its default 0.25 for every tier). The defaults `detect.py` ships with are unchanged — this is only ever invoked explicitly, into a separate candidates file:

```bash
python3 scripts/detect.py $N.clean.json -o /tmp/nyam_relaxed_d3.candidates.json \
    --rules fvg,equal_highs,equal_lows,order_block --fvg-min-range-mult 0.15 --equal-tolerance-pct 0.12 --ob-displacement-mult 1.5
python3 scripts/detect.py $R.clean.json -o /tmp/rth_relaxed_d3.candidates.json \
    --rules fvg,equal_highs,equal_lows,order_block --fvg-min-range-mult 0.15 --equal-tolerance-pct 0.12 --ob-displacement-mult 1.5
```

Then `build_scenario.py --candidate <id> --exercise-id <id> --difficulty 3` per candidate, same as any other batch — `pick_candidates.py`'s retry-to-success behavior hides how often a relaxed candidate actually gets rejected, so this batch was built with one attempt per candidate instead, to get an honest rejection rate (see CURRICULUM.md for the numbers: FVG specifically was rejected in the large majority of attempts, since a whole-session window at this floor almost always has a second marginal gap). Result: `real-fvg-016`…`021` (6), `real-liq-016`…`021` (6), `real-ob-009`…`013` (5) — 17 scenarios, `provenance.detection_params` recording the relaxed multiples.

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

**Second batch (2026-09-30):** `build_trade_scenarios.py` never reuses a session another scenario file already covers, so re-running the original commands against the now-larger registered set draws from what's left. Only 20 of 736 NY AM sessions ever pass the full valid-setup chain (CURRICULUM.md, Guided Entry → "How rare valid setups are"); the first batch (`valid=6`) and a second Guided Entry batch below already took 9 of them, leaving none for a second Free Trade `valid=` request — that command fails loudly (`ERROR: only 0 'valid' sessions available`) rather than silently building fewer, so a future batch must check what's left first.

```bash
N=data/clean/nq_nyam_ctx.5m
python3 scripts/build_trade_scenarios.py $N.clean.json $N.candidates.json --mode guided \
    --plan valid=3,no_shift=1,no_sweep=1 --prefix real-guided --first 11 --seed 41
python3 scripts/build_trade_scenarios.py $N.clean.json $N.candidates.json --mode free \
    --plan no_shift=2,no_sweep=1,no_entry=1,low_rr=1 --prefix real-ft --first 11 --seed 43
python3 scripts/register_scenarios.py
```

That's `real-guided-011`…`015` and `real-ft-011`…`015`, 10 more, all `human_reviewed: false`.

To try the pipeline without licensed data, generate synthetic bars first: `python3 scripts/sample/make_synthetic.py`, then run the same commands on `scripts/sample/synthetic_nq_5m.csv`. **Never promote a scenario built from synthetic data.**

**Schema (updated 2026-09-29, Phase B).** `build_trade_scenarios.py` now emits the zone/invalidation-level answer key `src/data/exercises.ts` expects (`PriceZoneAnswer` for entry/target, `StopAnswer` for stop — see docs/CURRICULUM.md's grading severity note under Guided Entry) instead of the old point + tolerance shape. The 20 already-registered `real-guided-*`/`real-ft-*` files (all `human_reviewed: false`, blocked on B1/B3 regardless) were converted to the new shape by a one-off script rather than rebuilt, preserving each one's previously-accepted range exactly — nothing about which placements would have graded correctly changed, only how that's expressed. A future re-run of the commands above produces the new shape natively.

Previous-day and weekly levels span a full day or week; build those from 1h (or 4h) bars so the chart stays around 40 candles. `build_scenario.py` warns when a window exceeds 120 bars.

## Chart framing

*Added 2026-09-27.* **Accuracy recorded before this change may be inflated, so accuracy from before and after it can't be compared.** Until then every chart was served whole, so the answer sat in the same place in a window of the same size. A user could learn where to look instead of what to look for.

### What was found

Measured over every registered recognition exercise:

| Finding | Detail |
|---|---|
| Fixed chart size | Every constructed chart was 40 candles (Order Block and Premium/Discount: 36). Every real chart was one whole session: 18 candles (NY AM 5m), 26 (RTH 15m) or 48 (NY AM with 07:00 context), always starting at 9:30 (or 07:00). |
| Identical answer positions | 3 of 4 IFVG answers on candle 9 of 40. 3 of 4 Order Blocks on candle 25 of 36. The gap in all 10 FVG/IFVG respected exercises at candles 8–10. All 5 Premium/Discount dealing ranges at candles 7 and 21. |
| Clustered constructed answers | Constructed FVG answers all fall between 33% and 59% of the window. Among constructed exercises, one tenth of the window held 50–75% of each concept's answers (FVG, Liquidity, MSS, IFVG, Order Block), and 60% for time-based levels. |
| Real MSS at the right | The context bars fill the left of every 48-candle chart, so the swing and break always sat in the right half. |

The answer's position is its middle candle for a zone. For a level, it's the swing that makes the level. Numbers come from `tests/framing.test.ts`, which calls the old whole-chart framing clustered.

### How charts are framed now

`src/lib/framing.ts` picks the window server-side each time an exercise is served (`loadSessionExercises` in `src/app/practice/actions.ts`):

- Each zone, level and choice exercise has a `setup_span`: the first and last candle that must always be on screen. That covers the setup, the swings or context it depends on, and anything the explanation refers to. For a no-answer exercise it's the near-miss. For a choice exercise it runs to the last candle, because the question is what price did afterwards. `build_scenario.py` writes it from the candidate: FVG candles; equal-high/low touches ± the swing lookback; MSS from the first swing (minus lookback) to the break; Order Block from the broken swing to the break or mitigation; the whole window for time-based levels. Constructed exercises have it written by hand.
- The window always contains the span, plus 3 lead-in candles for a zone. It is never shorter than half the stored window or 12 candles. Candles are only ever removed from the stored window, so framing can't cut off the setup, show price the scenario was built to hide, or add a second valid answer.
- The picker first chooses one of five position bands the setup allows, then a window within it. The answer lands near the start, middle or end about equally often wherever there's room, and the candle count varies with it.
- The window is picked from the session id and exercise id. Loading and grading agree without storing anything, and a refresh shows the same chart. A new session frames the exercise again.
- Grading moves a drawn box back into the stored window's candle indices before grading and saving. `user_candle_start`/`user_candle_end` stay in one coordinate system whatever was shown. To see what a post-fix attempt was shown, call `pickFrame(exercise, attempt.session_id)`.
- Guided Entry and Free Trade are shown whole. Their windows end at a decision point.

`tests/framing.test.ts` fails if, for any concept, one tenth of the window holds more than 45% of served answers, fewer than four tenths hold any, or chart sizes barely vary. It also fails if a frame could cut into a setup span, or if a span doesn't cover its answer.

### What framing can't fix yet

- **Constructed IFVG and Order Block charts have little room to move.** The IFVG gap sits at candles 8–10 and must stay on screen through the retest the explanation describes, so it still lands in the first half of the window. Order Blocks keep their preceding trend, so they stay in the right half. Fixing this means re-authoring these charts with more candles around the setup. Prepending candles would shift the candle indices of recorded attempts, so those candles have to go on the end, or the attempts need migrating.
- **Vertical position.** Many level answers sit at the top or bottom of the chart's price range: all 4 constructed Liquidity answers, 3 of 5 time-based levels, 6 of 10 real Liquidity scenarios, and all 4 Order Blocks within 8% of an extreme. "Mark the highest high" wins too often. Trimming can't add earlier price history, so this is a content fix: charts need earlier swings beyond the answer that don't compete with it. It needs a curriculum call on what outranks what (docs/CURRICULUM.md, Liquidity).

### Accuracy before and after

Accuracy recorded before framing shipped may be inflated. A user who had seen an exercise, or a few of its concept, could find the answer by position. Treat accuracy, per-concept accuracy and the D-3 tolerance check (PRD Section 13) as two separate series: attempts before the deploy of the 2026-09-27 framing commit, and attempts after. Don't pool or trend them together. Attempts don't record which framing they were shown, so the deploy date is the dividing line.

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
| `human_reviewed` | build → reviewer | `true` only when a person approved it at `/review`. Never set for an auto approval. |
| `auto_approved` | build / `auto_approve.py` | `true` when the pipeline approved it. Mutually exclusive with `human_reviewed`; dropped when a person approves it afterwards. |
| `reviewed_by`, `reviewed_at`, `review_notes` | approver | Who approved it (`"auto"` for the pipeline, the reviewer's email otherwise), when (YYYY-MM-DD), and anything notable. A scenario re-checked by code after a definition change says so in `review_notes`. |

**Enforcement in the app:**
- `isPracticeReady()` in `src/data/exercises.ts` — sessions are built only from exercises with no provenance (constructed) or `human_reviewed: true` or `auto_approved: true`, and never one flagged ambiguous or built under an out-of-date curriculum definition. A scenario with neither approval can be registered and still never appear in practice.
- `parseRealScenario()` in `src/data/real-scenarios/index.ts` — every registered file is validated at load. An approved scenario without `reviewed_by`/`reviewed_at`, one claiming both approvals, one recording `"auto"` as a human reviewer (or a person as the auto approver), or one still carrying the `[DRAFT` explanation, fails loudly instead of shipping.

## Review checklist

Used for every human review, including a spot-check of an auto-approved scenario. Work through every item for each candidate. One "no" means reject (or fix and re-build — never hand-edit the answer key).

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

`/review` is internal tooling. It needs a login (`src/proxy.ts`) and the `reviewer` or `admin` role on the signed-in user's profile. Roles are granted in the Supabase SQL editor (docs/SECURITY-AUDIT.md → Roles). Before 2026-09-27 access came from a `REVIEWER_EMAILS` env allowlist, which is no longer read.

**Layout:**
- Three views (tabs under the heading): **Needs a first look** (not yet approved by anyone, or stale), **Auto-approved** (live on the pipeline's approval; the spot-check queue) and **Flagged by use** (see [Auto-approval](#auto-approval); admins only). Flagged scenarios sort first.
- Candidates are grouped **by detection rule**, so you review one concept at a time. Counts show reviewed vs. remaining overall and per rule.
- Each candidate shows the chart with the detected answer key drawn on it, the rule that fired with its values and parameters, and the provenance.
- The **curriculum definition** the rule implements sits beside the chart, with its version. Definitions it also depends on are collapsed underneath.

**Three decisions:**
- **Approve:** requires the text users will see (anything still containing `[DRAFT` is refused). It updates the JSON file. On an auto-approved scenario the form is pre-filled with the live text; approving makes you the reviewer (`human_reviewed: true`, `auto_approved` dropped).
- **Reject:** pick a structured reason (wrong answer key, ambiguous, poor quality chart, doesn't match the definition, other + note). It deletes the JSON file and removes it from `index.ts`.
- **Flag ambiguous:** needs a note on what could be read two ways. It keeps the file, marked `review_status: "ambiguous"`, which is never practice-ready (and takes a live auto-approved one out of practice).

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

## Approval Summary

Generated from the scenario files and `docs/review-log.json`. Excludes scenarios flagged ambiguous (never live).

<!-- approval-summary:start -->
*Auto-approved scenarios went live from detection rules (docs/SCENARIO-VALIDATION.md → Auto-approval says what that vouches for) with explanations in the house style, without a person reading them (`reviewed_by: "auto"`). "Auto spot-checked" counts retroactive decisions at /review; a spot-check that approves one replaces its auto approval with a human one, so the Auto-approved column shrinks as checks happen. Overturned = rejected or flagged ambiguous.*

| Rule | Human-reviewed | Auto-approved | Auto-approved share | Auto spot-checked | Overturned by a person |
|---|---|---|---|---|---|
| dealing_range | 0 | 7 | 100% | 0 | 0 |
| equal_highs | 10 | 0 | 0% | 0 | 0 |
| equal_lows | 11 | 0 | 0% | 0 | 0 |
| free_trade_setup | 7 | 4 | 36% | 0 | 0 |
| fvg | 21 | 0 | 0% | 0 | 0 |
| guided_setup | 7 | 5 | 42% | 0 | 0 |
| ifvg | 0 | 7 | 100% | 0 | 0 |
| mss | 6 | 3 | 33% | 0 | 0 |
| ny_am_high | 0 | 3 | 100% | 0 | 0 |
| ny_am_low | 0 | 3 | 100% | 0 | 0 |
| order_block | 0 | 13 | 100% | 0 | 0 |
| **All rules** | **62** | **45** | **42%** | | |
<!-- approval-summary:end -->

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
| equal_highs | 0 | 10 | 10 | 0 | 0 | 0% | — |
| equal_lows | 0 | 11 | 11 | 0 | 0 | 0% | — |
| free_trade_setup | 0 | 14 | 10 | 0 | 4 | 29% | — |
| fvg | 0 | 21 | 21 | 0 | 0 | 0% | — |
| guided_setup | 0 | 13 | 10 | 0 | 3 | 23% | — |
| mss | 0 | 15 | 9 | 0 | 6 | 40% | — |

| Reason | Rejections | Share | Rules |
|---|---|---|---|
| Wrong answer key | 0 | — | — |
| Ambiguous | 0 | — | — |
| Poor quality chart | 0 | — | — |
| Doesn't match the definition | 0 | — | — |
| Other | 0 | — | — |

- **mss**: 40% of 15 reviewed were rejected or ambiguous — fix the rule before building more.
<!-- rejection-summary:end -->

## Review Log

Every candidate that reaches review gets a row: approvals and rejections alike. Rejected scenario files are deleted; the log keeps the reason so the same candidate isn't re-built and re-rejected. **This table and the two below are generated** from `docs/review-log.json` by `/review`. Edit the JSON, not the tables.

<!-- review-log:start -->
| Date | Exercise ID | Candidate ID | Rule | Decision | Reason | Reviewer | Notes |
|---|---|---|---|---|---|---|---|
| 2026-09-30 | real-fvg-001 | fvg-bearish-20230512T1000 | fvg | approved | — | lpshaven@gmail.com | — |
| 2026-09-30 | real-fvg-002 | fvg-bullish-20231211T1045 | fvg | approved | — | lpshaven@gmail.com | — |
| 2026-09-30 | real-fvg-003 | fvg-bearish-20240513T0940 | fvg | approved | — | lpshaven@gmail.com | — |
| 2026-09-30 | real-fvg-004 | fvg-bearish-20240930T0955 | fvg | approved | — | lpshaven@gmail.com | — |
| 2026-09-30 | real-fvg-005 | fvg-bearish-20250414T0935 | fvg | approved | — | lpshaven@gmail.com | — |
| 2026-09-30 | real-fvg-006 | fvg-bullish-20250725T0945 | fvg | approved | — | lpshaven@gmail.com | — |
| 2026-09-30 | real-fvg-007 | fvg-bearish-20230203T1245 | fvg | approved | — | lpshaven@gmail.com | — |
| 2026-09-30 | real-fvg-008 | fvg-bearish-20240112T1130 | fvg | approved | — | lpshaven@gmail.com | — |
| 2026-09-30 | real-fvg-009 | fvg-bullish-20241226T1430 | fvg | approved | — | lpshaven@gmail.com | — |
| 2026-09-30 | real-fvg-010 | fvg-bearish-20250509T1015 | fvg | approved | — | lpshaven@gmail.com | — |
| 2026-09-30 | real-liq-002 | equal_highs-20230712T1040 | equal_highs | approved | — | lpshaven@gmail.com | — |
| 2026-09-30 | real-liq-003 | equal_highs-20231222T1035 | equal_highs | approved | — | lpshaven@gmail.com | — |
| 2026-09-30 | real-liq-005 | equal_highs-20250103T1005 | equal_highs | approved | — | lpshaven@gmail.com | — |
| 2026-09-30 | real-liq-007 | equal_highs-20230217T1500 | equal_highs | approved | — | lpshaven@gmail.com | — |
| 2026-09-30 | real-liq-008 | equal_highs-20231208T1445 | equal_highs | approved | — | lpshaven@gmail.com | — |
| 2026-09-30 | real-liq-001 | equal_lows-20230301T1030 | equal_lows | approved | — | lpshaven@gmail.com | — |
| 2026-09-30 | real-liq-004 | equal_lows-20240923T1015 | equal_lows | approved | — | lpshaven@gmail.com | — |
| 2026-09-30 | real-liq-006 | equal_lows-20251120T1015 | equal_lows | approved | — | lpshaven@gmail.com | — |
| 2026-09-30 | real-liq-009 | equal_lows-20240912T1145 | equal_lows | approved | — | lpshaven@gmail.com | — |
| 2026-09-30 | real-liq-010 | equal_lows-20250923T1445 | equal_lows | approved | — | lpshaven@gmail.com | — |
| 2026-09-30 | real-mss-001 | mss-bearish-20230525T0930 | mss | approved | — | lpshaven@gmail.com | — |
| 2026-09-30 | real-mss-002 | mss-bearish-20230911T0935 | mss | approved | — | lpshaven@gmail.com | — |
| 2026-09-30 | real-mss-003 | mss-bullish-20240315T1035 | mss | approved | — | lpshaven@gmail.com | — |
| 2026-09-30 | real-mss-004 | mss-bearish-20240415T0930 | mss | approved | — | lpshaven@gmail.com | Superseded 2026-09-30: no longer qualifies under the tightened MSS minimum-structure rule - see the later ambiguous-log entry. |
| 2026-09-30 | real-mss-005 | mss-bearish-20241210T1050 | mss | approved | — | lpshaven@gmail.com | — |
| 2026-09-30 | real-mss-006 | mss-bullish-20250327T0955 | mss | approved | — | lpshaven@gmail.com | — |
| 2026-09-30 | real-mss-008 | mss-bearish-20230613T1415 | mss | approved | — | lpshaven@gmail.com | Superseded 2026-09-30: no longer qualifies under the tightened MSS minimum-structure rule - see the later ambiguous-log entry. |
| 2026-09-30 | real-mss-009 | mss-bullish-20240328T1445 | mss | approved | — | lpshaven@gmail.com | Superseded 2026-09-30: no longer qualifies under the tightened MSS minimum-structure rule - see the later ambiguous-log entry. |
| 2026-09-30 | real-mss-010 | mss-bullish-20250827T1330 | mss | approved | — | lpshaven@gmail.com | — |
| 2026-09-30 | real-guided-001 | setup-no_sweep-20240521 | guided_setup | approved | — | lpshaven@gmail.com | — |
| 2026-09-30 | real-guided-002 | setup-no_entry-20250107 | guided_setup | approved | — | lpshaven@gmail.com | — |
| 2026-09-30 | real-guided-003 | setup-valid-20231122 | guided_setup | approved | — | lpshaven@gmail.com | — |
| 2026-09-30 | real-guided-004 | setup-low_rr-20241212 | guided_setup | approved | — | lpshaven@gmail.com | — |
| 2026-09-30 | real-guided-005 | setup-valid-20240529 | guided_setup | approved | — | lpshaven@gmail.com | — |
| 2026-09-30 | real-guided-006 | setup-valid-20250805 | guided_setup | approved | — | lpshaven@gmail.com | — |
| 2026-09-30 | real-guided-007 | setup-valid-20230203 | guided_setup | approved | — | lpshaven@gmail.com | — |
| 2026-09-30 | real-guided-008 | setup-no_shift-20241220 | guided_setup | approved | — | lpshaven@gmail.com | — |
| 2026-09-30 | real-guided-009 | setup-valid-20230811 | guided_setup | approved | — | lpshaven@gmail.com | — |
| 2026-09-30 | real-guided-010 | setup-valid-20240419 | guided_setup | approved | — | lpshaven@gmail.com | — |
| 2026-09-30 | real-ft-001 | setup-valid-20250415 | free_trade_setup | approved | — | lpshaven@gmail.com | — |
| 2026-09-30 | real-ft-002 | setup-no_sweep-20230616 | free_trade_setup | approved | — | lpshaven@gmail.com | — |
| 2026-09-30 | real-ft-003 | setup-valid-20240221 | free_trade_setup | approved | — | lpshaven@gmail.com | — |
| 2026-09-30 | real-ft-004 | setup-no_entry-20241029 | free_trade_setup | approved | — | lpshaven@gmail.com | — |
| 2026-09-30 | real-ft-005 | setup-no_sweep-20240925 | free_trade_setup | approved | — | lpshaven@gmail.com | — |
| 2026-09-30 | real-ft-006 | setup-valid-20240229 | free_trade_setup | approved | — | lpshaven@gmail.com | — |
| 2026-09-30 | real-ft-007 | setup-low_rr-20240112 | free_trade_setup | approved | — | lpshaven@gmail.com | — |
| 2026-09-30 | real-ft-008 | setup-valid-20230720 | free_trade_setup | approved | — | lpshaven@gmail.com | — |
| 2026-09-30 | real-ft-009 | setup-no_shift-20230605 | free_trade_setup | approved | — | lpshaven@gmail.com | — |
| 2026-09-30 | real-ft-010 | setup-no_shift-20251117 | free_trade_setup | approved | — | lpshaven@gmail.com | — |
| 2026-09-30 | real-fvg-011 | fvg-bearish-20230906T1000 | fvg | approved | — | lpshaven@gmail.com | — |
| 2026-09-30 | real-fvg-012 | fvg-bearish-20240229T1010 | fvg | approved | — | lpshaven@gmail.com | — |
| 2026-09-30 | real-fvg-013 | fvg-bullish-20250616T0950 | fvg | approved | — | lpshaven@gmail.com | — |
| 2026-09-30 | real-fvg-014 | fvg-bullish-20231208T1000 | fvg | approved | — | lpshaven@gmail.com | — |
| 2026-09-30 | real-fvg-015 | fvg-bearish-20241125T1200 | fvg | approved | — | lpshaven@gmail.com | — |
| 2026-09-30 | real-fvg-016 | fvg-bullish-20221230T1015 | fvg | approved | — | lpshaven@gmail.com | — |
| 2026-09-30 | real-fvg-017 | fvg-bearish-20230224T0940 | fvg | approved | — | lpshaven@gmail.com | — |
| 2026-09-30 | real-fvg-018 | fvg-bullish-20230313T0945 | fvg | approved | — | lpshaven@gmail.com | — |
| 2026-09-30 | real-fvg-019 | fvg-bullish-20221227T1015 | fvg | approved | — | lpshaven@gmail.com | — |
| 2026-09-30 | real-fvg-020 | fvg-bearish-20230130T1015 | fvg | approved | — | lpshaven@gmail.com | — |
| 2026-09-30 | real-fvg-021 | fvg-bearish-20240923T1200 | fvg | approved | — | lpshaven@gmail.com | — |
| 2026-09-30 | real-liq-011 | equal_highs-20231012T1025 | equal_highs | approved | — | lpshaven@gmail.com | — |
| 2026-09-30 | real-liq-014 | equal_highs-20240404T1245 | equal_highs | approved | — | lpshaven@gmail.com | — |
| 2026-09-30 | real-liq-016 | equal_highs-20231114T1045 | equal_highs | approved | — | lpshaven@gmail.com | — |
| 2026-09-30 | real-liq-017 | equal_highs-20240710T1010 | equal_highs | approved | — | lpshaven@gmail.com | — |
| 2026-09-30 | real-liq-021 | equal_highs-20240529T1515 | equal_highs | approved | — | lpshaven@gmail.com | — |
| 2026-10-03 | real-liq-012 | equal_lows-20241125T1035 | equal_lows | approved | — | lpshaven@gmail.com | — |
| 2026-10-03 | real-liq-013 | equal_lows-20250521T1035 | equal_lows | approved | — | lpshaven@gmail.com | — |
| 2026-10-03 | real-liq-015 | equal_lows-20250630T1430 | equal_lows | approved | — | lpshaven@gmail.com | — |
| 2026-10-03 | real-liq-018 | equal_lows-20230104T1030 | equal_lows | approved | — | lpshaven@gmail.com | — |
| 2026-10-03 | real-liq-019 | equal_lows-20240319T1030 | equal_lows | approved | — | lpshaven@gmail.com | — |
| 2026-10-03 | real-liq-020 | equal_lows-20250605T1035 | equal_lows | approved | — | lpshaven@gmail.com | — |
<!-- review-log:end -->

## Ambiguous Log

Candidates flagged **ambiguous**: two reasonable traders would label the chart differently. Per the PRD's ambiguity rule (Section 5, "exactly one valid answer"), they never become exercises. Their files stay on disk with `provenance.review_status: "ambiguous"`, so they can be revisited once the definition behind them is settled (docs/CURRICULUM-REVIEW.md).

<!-- ambiguous-log:start -->
| Date | Exercise ID | Candidate ID | Rule | Decision | Reason | Reviewer | Notes |
|---|---|---|---|---|---|---|---|
| 2026-09-30 | real-mss-007 | mss-bearish-20250924T0930 | mss | ambiguous | — | lpshaven@gmail.com | The bearish break is clear, but the prior bullish structure is not well established. Confirm that the highlighted level is a valid higher low before labeling this a bearish Market Structure Shift. Auto-confirmed 2026-09-30: under the tightened MSS minimum-structure rule (docs/CURRICULUM.md, swing move >= 0.25x median bar range), both the prior swing high (0.33x) and swing low (0.22x) move too little to count as real structure - this is exactly the two-bar-wiggle case the rule was added to close. |
| 2026-09-30 | real-mss-004 | mss-bearish-20240415T0930 | mss | ambiguous | — | system (tightened MSS rule) | Auto-flagged 2026-09-30: under the tightened MSS minimum-structure rule (docs/CURRICULUM.md, Market Structure Shift - Minimum structure; swing move >= 0.25x median bar range), the prior swing high only moved 0.17x median bar range beyond the previous swing high - too small to count as real structure (swing low moved 0.89x). Confirm whether the trend this MSS breaks was actually established. |
| 2026-09-30 | real-mss-008 | mss-bearish-20230613T1415 | mss | ambiguous | — | system (tightened MSS rule) | Auto-flagged 2026-09-30: under the tightened MSS minimum-structure rule (docs/CURRICULUM.md, Market Structure Shift - Minimum structure; swing move >= 0.25x median bar range), the prior swing high only moved 0.05x median bar range beyond the previous swing high - too small to count as real structure (swing low moved 0.75x). Confirm whether the trend this MSS breaks was actually established. |
| 2026-09-30 | real-mss-009 | mss-bullish-20240328T1445 | mss | ambiguous | — | system (tightened MSS rule) | Auto-flagged 2026-09-30: under the tightened MSS minimum-structure rule (docs/CURRICULUM.md, Market Structure Shift - Minimum structure; swing move >= 0.25x median bar range), the prior swing high only moved 0.33x median bar range beyond the previous swing high - too small to count as real structure (swing low moved 0.88x). Confirm whether the trend this MSS breaks was actually established. |
| 2026-09-30 | real-mss-011 | mss-bearish-20230824T0930 | mss | ambiguous | — | system (tightened MSS rule) | Auto-flagged 2026-09-30: under the tightened MSS minimum-structure rule (docs/CURRICULUM.md, Market Structure Shift - Minimum structure; swing move >= 0.25x median bar range), the prior swing low only moved 0.15x median bar range beyond the previous swing low - too small to count as real structure (swing high moved 0.34x). Confirm whether the trend this MSS breaks was actually established. |
| 2026-09-30 | real-mss-012 | mss-bearish-20241004T0950 | mss | ambiguous | — | system (tightened MSS rule) | Auto-flagged 2026-09-30: under the tightened MSS minimum-structure rule (docs/CURRICULUM.md, Market Structure Shift - Minimum structure; swing move >= 0.25x median bar range), the prior swing high only moved 0.20x median bar range beyond the previous swing high - too small to count as real structure (swing low moved 5.59x). Confirm whether the trend this MSS breaks was actually established. |
| 2026-10-03 | real-ft-003 | setup-valid-20240221 | free_trade_setup | ambiguous | — | system (re-verification) | Auto-flagged 2026-10-03: re-derived from source data under the current detection rules (curriculum definitions changed since it was built) and the answer key no longer reproduces - now classified no_shift, was valid. Kept on disk, never live. |
| 2026-10-03 | real-ft-004 | setup-no_entry-20241029 | free_trade_setup | ambiguous | — | system (re-verification) | Auto-flagged 2026-10-03: re-derived from source data under the current detection rules (curriculum definitions changed since it was built) and the answer key no longer reproduces - now classified no_shift, was no_entry. Kept on disk, never live. |
| 2026-10-03 | real-ft-006 | setup-valid-20240229 | free_trade_setup | ambiguous | — | system (re-verification) | Auto-flagged 2026-10-03: re-derived from source data under the current detection rules (curriculum definitions changed since it was built) and the answer key no longer reproduces - now classified no_shift, was valid. Kept on disk, never live. |
| 2026-10-03 | real-ft-015 | setup-no_entry-20250421 | free_trade_setup | ambiguous | — | system (re-verification) | Auto-flagged 2026-10-03: re-derived from source data under the current detection rules (curriculum definitions changed since it was built) and the answer key no longer reproduces - now classified no_shift, was no_entry. Kept on disk, never live. |
| 2026-10-03 | real-guided-002 | setup-no_entry-20250107 | guided_setup | ambiguous | — | system (re-verification) | Auto-flagged 2026-10-03: re-derived from source data under the current detection rules (curriculum definitions changed since it was built) and the answer key no longer reproduces - now classified no_shift, was no_entry. Kept on disk, never live. |
| 2026-10-03 | real-guided-004 | setup-low_rr-20241212 | guided_setup | ambiguous | — | system (re-verification) | Auto-flagged 2026-10-03: re-derived from source data under the current detection rules (curriculum definitions changed since it was built) and the answer key no longer reproduces - now classified no_shift, was low_rr. Kept on disk, never live. |
| 2026-10-03 | real-guided-009 | setup-valid-20230811 | guided_setup | ambiguous | — | system (re-verification) | Auto-flagged 2026-10-03: re-derived from source data under the current detection rules (curriculum definitions changed since it was built) and the answer key no longer reproduces - now classified no_sweep, was valid. Kept on disk, never live. |
<!-- ambiguous-log:end -->
