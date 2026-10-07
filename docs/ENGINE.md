# Scenario engine, simulator and training

*Written 2026-10-06 (AI-DRAFTED, pending Haven's review). The direction: from a concept-learning app to a training and simulation platform that stays useful once a trader knows the vocabulary. The practice modes (Recognition, Guided Entry, Free Trade) are untouched; this sits beside them at `/train`.*

One reusable engine; every training mode is a configuration of it. Nothing below is a parallel implementation of marking, scoring or replay.

## Primitives (`src/lib/engine/types.ts`)

| Primitive | What it is |
|---|---|
| **Scenario** | Authored chart data plus a *reference analysis*. Immutable. |
| **Chart state** | Which timeframe is showing and how many stream candles are revealed (`candles.ts`, `replay.ts`). |
| **Visible timeframe / revealed candles** | History per timeframe up to the stream anchor, plus a 1-minute stream revealed a chunk at a time. |
| **Annotation** | A mark anchored in *price and time*, never pixels: `liquidity`, `zone`, `fvg`, `ob`, `swing_high`, `swing_low`, `note`, `long_position`, `short_position`. It means the same thing on every timeframe. |
| **Stage** | One question: an input kind (`choice`, `multi`, `mark`, `price`, `trade`, `replay`), the timeframes it allows, a checkpoint, a scorer. |
| **Response** | What the user did (`StageResponse`, `AttemptResponse`). |
| **Acceptable answer** | `AcceptableSet` (several options, each with credit), `AcceptableRange` (inside / soft edge / outside), reference annotations with a role and an optional `group` of equally valid alternatives. |
| **Scoring rule** | A scorer (`scoring.ts`) turning a response and the acceptable answers into dimension scores. |
| **Explanation** | `why`, `whyNot`, `decisionNote`, `lookFor`, `summary`, written per scenario; shown by tier (below). |
| **Attempt result** | Process score, dimensions, caps, mistakes, outcome, mark comparison, five-bucket review, skill evidence (`AttemptResult`). |

## Modes are configurations (`modes.ts`)

| Mode | Configuration |
|---|---|
| Simulator | one `replay` stage, playback on, all six timeframes |
| Blind Chart | the same `replay` stage with playback off and guidance `none`: no concept named, no setup hinted |
| Build Your Bias | stages on Daily/4H/1H only: bias, premium/discount, draw, HTF liquidity (marks), PD arrays (marks), expected target (price). Lower-timeframe price is revealed only in the review |
| HTF to LTF | bias (Daily/4H) → draw (1H) → area to wait for (15m, marks) → act at the `confirm` checkpoint on 5m/1m (long / short / wait / no trade) |
| Confluence Trainer | pick confluences from the scenario's checklist, then decide |
| Setup or Trap | one `answer_set` stage: take or skip. A correct skip scores the same as a correct take |
| Find Everything | one `mark` stage over every scorable kind |
| "Does it matter?" (false-positive training) | numbered candidate structures: tick the ones that matter |
| Placement | fifteen tasks, each a one-stage configuration (below) |

A scenario carries enough reference for a mode or it doesn't offer it (`supportedModes`). Adding a mode is adding an entry to `MODES`; adding a scorer is adding a case to `scoreStage`.

## Acceptable ranges and multiple valid answers

The engine never implies one perfect interpretation.

- **Sets with credit.** Bias and decision are sets: `neutral` can be full credit (a two-sided chart), a counter-trend long can be `0.9`, waiting `1.0`, standing aside `0.5`, all in one scenario (sim-025).
- **Ranges with a soft edge.** Entry, target and expected-target answers are bands. Inside earns the band's credit; within `soft` points it decays linearly from 0.6; beyond earns nothing. Several bands per question are normal (the FVG body *or* the order block under it, the equal lows *or* the previous day low). The best band wins, so the second area is never penalised.
- **Several valid markings.** Reference annotations share a `group`; matching any one satisfies it. A user's mark on an FVG satisfies "FVG or order block" (`poi`); an OB drawn as a plain zone earns less credit for the label, not the location.
- **Roles.** `key`, `valid`, `supporting`, `irrelevant` (real but doesn't matter), `trap` (looks valid and isn't), `invalidating` (weakens the idea). Marking a trap costs more than marking nothing; marking an irrelevant structure costs a little.
- **Matching.** Zones need ≥ 50% coverage of the reference and ≤ 3.5× its height (a box over everything isn't a read); lines match within a tolerance; swing markers match on price and time (a mark on a coarse candle covers that candle's whole span). A swing marker stands in for the liquidity resting on it at reduced credit.

All of it is in `accept.ts` and `config.ts`.

## Timeframes: nothing fabricated (`candles.ts`)

A scenario stores *one* 1-minute stream plus complete history per timeframe up to the stream's anchor, which is always a Daily boundary (18:00 ET). Every higher timeframe is **resampled from the finer candles** (`resample`), so the same moment is the same on every chart by construction. The forming candle at the cursor is built only from candles that have already happened: `tests/engine-candles.test.ts` proves no future candle contributes to any timeframe, and that revealing one candle only changes the last candle of each series.

`supportedTimeframes` offers a timeframe only if the data holds at least `MIN_BARS[tf]` of it and it is not finer than the stream. Switching timeframe keeps the same cursor.

## Simulator mechanics

- **Replay:** reset, back one, advance 1 / 5 / 15, play / pause, five speeds. The cursor only moves forward through what has been shown; *Back* and *Reset* stop at the decision moment. A commit or *Wait* is allowed only at the live edge, and a mark drawn while rewound is flagged `hindsight` and ignored by scoring.
- **Commitment:** Long, Short, Wait, No trade, with entry (at market, or a price: a limit if it rests away from price, a stop-entry if it must break through), stop and target, plus bias and an optional 1-5 confidence. Wait advances to the next candle of the timeframe being viewed.
- **After entry, nothing is revealed.** The replay keeps advancing until the stop or target is hit, a pending order is cancelled, or the scenario ends. The ticket says only "order working" or "in the trade for N candles".
- **Fill and exit rules** (`trade.ts`, stated because the data can't say what happened first inside one candle): market fills at the next open; a limit fills when price trades through it, at the open if it gaps; on a candle touching both stop and target the stop is assumed first; on the candle a resting order fills only the stop can end it; an unfilled order is cancelled if price reaches the target first ("the move happened without you") or the stop first.
- **Result:** R multiples only. R, planned R:R, MAE and MFE in R (at 1-minute granularity, stated in the review). Never dollars.
- **Markup:** horizontal liquidity line, zone, FVG, order block, swing high/low, text note, long and short position tools (draggable stop/target), undo, delete, clear. A compact vertical toolbar (a scrolling row on a phone); every control ≥ 44 px.
- **Keyboard:** Space plays and pauses, arrows step, Delete removes the selected mark.

## Process scoring (`scoring.ts`, numbers in `config.ts`)

**The R result never enters the score.** A losing trade with the right bias, liquidity read and entry logic scores like the winner it could have been; a winner taken before confirmation with a stop that didn't protect it scores low (`tests/engine-scoring.test.ts` proves both on real scenario data: the same process scores identically whether the path wins or is crashed to a loss; a large winner entered before confirmation with a tight stop scores under 60).

| Dimension | Weight | What it reads |
|---|---|---|
| HTF Bias | 15 | bias against the reference set |
| Liquidity Read | 15 | liquidity and swing marks against the key/valid groups, minus false positives |
| POI Selection | 14 | FVG/OB/zone marks; a trade entered inside a key area earns partial credit even if never drawn |
| Entry Location | 14 | the fill (or planned entry) against the acceptable areas |
| Confirmation | 10 | whether the fill came after the confirming candle closed |
| Stop Placement | 10 | beyond the invalidation level; a wide stop is a near miss, never a fail on width; one *inside* it is "measuring noise" |
| Target Selection | 10 | the target against the acceptable draws, times a factor if R:R is under the scenario's minimum |
| Trade Selection / No-Trade | 12 | the decision against the decision set |

Applicable dimensions are renormalised, so a scenario with no defensible trade is scored on what exists for it. Modes ask for subsets. **Critical failures cap the score**: entering before (or without) confirmation, a stop that doesn't protect, trading where the decision wasn't supported, and chasing a move that left the entry area. One caps at 70, two or more at 58 (`CRITICAL_CAPS`); the review says which cap held the score down and why.

## Post-simulation review (`review-view.tsx`, `review.ts`)

Side by side on the completed chart: your marks and trade (solid) against the reference (dashed, numbered with a legend), at any supported timeframe, with a "you decided here" marker. Then: your bias, decision, markings, entry, stop and target against the acceptable areas; what price did next; the process breakdown with a sentence per dimension; structured mistakes; and five buckets: **what you read correctly, what you missed, what was on the chart but didn't matter, what weakened or invalidated the setup, what to look for next time.** "Why not the other one?" appears wherever several candidates exist.

**Explanations mature with skill** (`tier.ts`, `kind-definitions.ts`): *define* (beginner or Foundation: terms defined), *relate* (Developing / Intermediate: how the pieces relate), *decide* (Advanced: context and decision-making, via `decisionNote`; an advanced reader is never told what an FVG is). The tier follows the classification once there is one, and the beginner/experienced preference until then.

## Mistakes (structured IDs, human copy on top)

`PREMATURE_ENTRY`, `AGAINST_HTF_BIAS`, `CHASED_DISPLACEMENT`, `WRONG_DRAW`, `STOP_TOO_TIGHT`, `IGNORED_OPPOSING_HTF`, `INTERNAL_EXTERNAL_CONFUSION`, `FORCED_SETUP`, `NO_CONFIRMATION`. Computed from the attempt where the data allows (fill before confirmation; stop inside invalidation; a fill beyond every entry area on the chase side; a target beyond a trap pool of the wrong scope; a trade against the only clear bias; an opposing HTF structure between entry and target) and authored per scenario where it can't be (`trapMistakes`: "if you take this decision here, this is what you did"). Labels and one-line tips are in `review.ts`; the journal's mistake library and the dashboard's "most frequent" line read the same IDs.

## Skill vector, classification, placement

- **Seven skills, never one score:** Concept Recognition, Market Structure, Liquidity, HTF Bias, Entry Models, Confluence, Execution. Every applicable process dimension is evidence for the skills it implies (`DIMENSION_SKILLS`), weighted by how much the scenario exercises that skill. Recent evidence counts more (half-life 12 items per skill), estimates are shrunk toward a prior, and a skill with too little evidence is "not measured" (`skills.ts`).
- **Classification** (`classify`): Foundation (still developing recognition), Developing (concepts understood, context inconsistent), Intermediate (good recognition and context, execution weaknesses), Advanced (consistently strong context and execution). Gated step by step: recognition alone reaches Developing; Intermediate needs context (HTF Bias, Liquidity, Confluence) and no weak skill; Advanced needs context *and* execution (Entry Models, Execution) and no skill under the floor. Terminology alone can't produce Advanced (`tests/engine-skills.test.ts`).
- **All thresholds, weights, half-life, labels and floors are in `skill-config.ts`.** Nothing is hard-coded elsewhere.
- **Not permanent.** The label is recomputed from the evidence every time. Retaking the placement test replaces the previous full placement; a skill test-out (`/train/placement?skill=…`) replaces that skill's previous test-out; practice keeps adjusting both.
- **Placement test** (`placement-tasks.ts`, `placement-keys.ts`): fifteen tasks, easy to hard, mostly chart interaction (marks, a price, a trade) with a few single judgments over a chart on screen. Early: FVG, liquidity, swing points, displacement, order block. Middle: sweep, MSS, premium vs discount, which FVG matters, likely draw. Advanced: bias on a large chart, take-or-skip, whether the HTF supports the LTF setup, entry/stop/target, is-there-a-trade. No feedback until the end. Contextual and execution tasks weigh more (`PLACEMENT_TASK_WEIGHT`).

## Weakness selection (`weakness.ts`)

Deterministic, no AI: the weakest measured skills (round-robin so one weakness doesn't take a whole session), scenarios that exercise them (skill weight ≥ 0.4), skipping the last six distinct scenarios attempted, at a difficulty the score calls for (under 45% → foundation, under 70% → intermediate, otherwise advanced), in the mode best suited to the skill that the scenario supports. The same history always gives the same picks.

## Confidence and correct avoidance

A 1-5 confidence rating is asked at submission and stored with the attempt. `history.ts` finds confidence 4-5 with a score under 55 and confidence 1-2 with a score of 80 or more, and the average score at each level. **Correct Avoidance Rate** = no-trade scenarios where the user took no trade; the mirror, valid setups skipped, is tracked separately. Neither is quoted as a percentage below three samples. No Trade is first-class in every mode, and 9 of the 25 scenarios have no defensible trade.

## Content (`scripts/scenarios/`, `src/data/sim-scenarios/`)

**All 25 scenarios are seeded: constructed price paths, labelled "seeded scenario, not market history" on screen, in the scenario data and in the tests.** None is presented as history, and none is a fabricated "real" scenario. They are built so real history can replace them (below), and the limitation is real: see *Real data* below.

15 intermediate (difficulty 2), 10 advanced (difficulty 3), every one with a distinct lesson, covering every messy type asked for:

| Type | Scenarios |
|---|---|
| valid setup | 001 sweep, displace, retrace (long) · 002 the short mirror · 013 the afternoon sweep · 015 the block under the move (order block) · 024 London sweeps Asia · 025 the week's low and a shift (several valid reads) |
| almost valid | 003 a wick is not a break · 019 displacement from nowhere (no liquidity taken) |
| failed setup | 004 right, and it still lost · 014 it worked, then it didn't (+1R then stop) · 020 stopped on the wick |
| no-trade environment | 005 nothing to do here · 016 bias is a coin flip (advanced) |
| HTF/LTF conflict | 006 against the higher timeframe · 017 under the supply (two valid answers) |
| multiple valid-looking FVGs | 007 four gaps, one that matters |
| internal vs external liquidity | 008 internal first, external never · 018 two pools, both reached |
| late or extended entry | 009 already gone · 021 the first tap doesn't count |
| chop | 010 two sweeps, no move · 022 expansion, then rest |
| good structure, bad location | 011 right pattern, wrong place (premium) · 023 selling the low (discount) |
| good location, no confirmation | 012 in the right place, too early |

**What makes a scenario trustworthy** (`validateScenario`, run by the build and by the tests): the data is sound and starts on a Daily boundary; all six timeframes are supported at the decision moment; **every reference marking sits on structure that actually exists in the candles** (an FVG marked must be a real gap, a liquidity line a real high or low or session extreme, a swing a real swing); the reference trade's invalidation lies beyond every entry area; the *ideal* order a careful trader would place **does in the generated data exactly what the spec claims** (reaches the target, or is stopped, or never fills) and plans at least the reference's minimum R:R and fills after confirmation. A spec whose story the path doesn't deliver doesn't build. Specs can also assert their own narrative (a wick that never closed through the level, a target price never reached).

**Authoring (the smallest useful tool, against the actual schema):**

```bash
npm run scenarios -- new sim-026 [noTrade]            # scaffold a spec and register it
npm run scenarios -- structure sim-026 5m 11 09:15 11 10:30   # swings and gaps the path produced
npm run scenarios -- inspect sim-026 5m 11 09:15 11 10:30     # the candles
npm run scenarios                                      # build, validate, write the JSON, catalog and registry
```

A spec is: a seed, a calendar, a generated backdrop for the higher-timeframe context, the story as *legs* between clock times (`sweepSkeleton` for the usual sweep, displacement and retrace), the decision moment, and a `build(c)` that **reads structure off the data** with finders (`c.fvg`, `c.fvgAt`, `c.fvgIn`, `c.swingHigh`, `c.extremes`, `c.candle`, `c.revealedAtClose`…) and writes the reference with small constructors (`line`, `zone`, `swingRef`, `band`, `set`, `confluence`). Answers are derived from the data, never typed in, which is the project's standing rule for answer keys. No CMS: a CMS before the schema settles would be wrong half the time.

## Real data: not done, and why

The Kaggle NQ file is licensed for personal use only (B1), so no real multi-timeframe scenario is shipped, and a *reference analysis* on real data (bias, acceptable entry area, which pool is the draw) is a human judgment that code can't derive the way it derives a detected FVG. What exists: the schema already has `provenance: { kind: "real" }`, the resampling and review code is data-agnostic, and the existing pipeline (`scripts/`) produces the 1-minute clean series a scenario needs. What is missing: a script turning a 1-minute window into a scenario file (history per timeframe up to a Daily boundary, the stream, the cursor), and a human review step for the reference. Both are blocked on B1 and on Haven's time, not on engineering.

## Security and the known limit

Server Functions (`src/app/train/actions.ts`, `placement-actions.ts`) check the session and every input (`response-validation.ts` rebuilds a response from checked parts, with bounds). The browser receives a scenario **without its reference** and with the stream **up to the cursor**; it fetches further candles in chunks as the replay needs them, and gets the reference back only with a graded attempt (`tests/engine-validation.test.ts`). Candidate and confluence labels shown before an answer are neutral (what and where, never what they mean). **Known limit (as with Free Trade, docs/ANSWER-KEYS.md):** the client holds a prefetched buffer of up to a few hundred future candles, and someone calling the reveal action directly can read ahead. This is a training tool whose results are the user's own; it isn't a competition.

## Persistence

`supabase/migrations/20261006120000_scenario_attempts.sql` (**written, not run**): one row per finished attempt with the process score and R apart, structured mistakes, 1-5 confidence, dimension scores, skill evidence and the full response (so a journal entry reopens the completed review). Integrity constraints, RLS (no update or delete: rows are records) and three views (`v_mistake_counts`, `v_scenario_calibration`, `v_correct_avoidance`), all tested in PGlite (`tests/sql/scenario-attempts.test.ts`). Until it is applied, results are kept on the device and copied up the first time the table exists (`src/lib/scenario-attempts.ts`), so nothing is lost.

## Not built, on purpose

Leaderboards, friends, private groups, community comparison, premium tiers, XP and levels, speed drills, economic event context, SMT functionality (it's in the skill tree marked *coming later* and excluded from mastery), additional instruments. Also not built: trade management after entry (moving a stop, partials), resuming an interrupted replay after a refresh (the server reveals candles statelessly), and a polished "Train my weaknesses" session flow (the selection logic and a pick list exist).
