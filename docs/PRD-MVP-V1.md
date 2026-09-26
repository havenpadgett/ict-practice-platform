# Product Requirements Document — MVP V1
**Product:** ICT Concepts Practice Platform (working name)
**Version:** 1.0 (draft for review)
**Owner:** Haven Padgett — Product Owner / Business Analyst
**Date:** September 9, 2026
**Status:** Draft — pending sign-off on Open Decisions (Section 13). Milestone 1 (Section 10) is complete; the build has gone well beyond V1 scope. See Build Status below. *Last updated 2026-09-25.*

---

## Build Status by Phase

*Added 2026-09-25 (AI-DRAFTED, pending Haven's review).* This PRD never had a phase table. The phase numbers below come from the commit history and from where the PRD itself mentions "Phase 5" (database) and "Phase 7" (real data). Phases 6, 9 and 10 are inferred from build order.

| Phase | Scope | Status | Landed |
|---|---|---|---|
| 1 | UI shell: landing, dashboard, practice pages | ✅ Done | 2026-09-09 |
| 2 | One working FVG exercise with zone grading | ✅ Done | 2026-09-09 |
| 3 | Full 5-exercise FVG session with local persistence (Milestone 1, Section 10) | ✅ Done | 2026-09-09 |
| 4 | Multiple concepts: Liquidity (level answers), then MSS, FVG respected/disrespected (choice), IFVG | ✅ Done | 2026-09-09 → 09-19 |
| 5 | Accounts and database: Supabase Auth, `profiles` + `attempts` with RLS, local-attempt migration | ✅ Done | 2026-09-10 |
| 6 | User-facing analytics page | ✅ Done, extended 2026-09-24 (trend line, difficulty × concept, real vs constructed, process vs outcome) | 2026-09-10 |
| 7 | Real historical NQ data with a validation process: pipeline, provenance, review gate, `/review` | ✅ Built. **0 of 50 real scenarios approved yet**, so none are live | 2026-09-24 |
| 8 | Guided Entry mode (bias → entry → stop → target) | ✅ Done, including 10 real-data scenarios awaiting review | 2026-09-20 |
| 9 | Free Trade mode (candle-by-candle playback, graded on process) | ✅ Done, including 10 real sessions awaiting review | 2026-09-24 |
| 10 | Adaptive practice: recommendation engine, adaptive session mix | ✅ Done | 2026-09-24 |
| — | Order Blocks, Premium & Discount, Time-based liquidity concepts | ✅ Done (constructed exercises) | 2026-09-24 |
| — | Hardening: automated tests, error handling, CSV export, performance | ✅ Done. All tests pass (the live RLS check is skipped without test accounts) | 2026-09-25 |
| — | Analytics layer: SQL views, event tracking, `/admin`, Python analysis | ✅ Built. **Three migrations not yet applied** (`20260926120000`, `…130000`, `…140000`); the app falls back until they are | 2026-09-26 |

**Still open from the original requirements:** NFR-1/2 have never been verified on a real phone (Decision Log 2026-09-14 and 2026-09-24). D-3's tolerances still need re-checking against real beginner attempts. D-4 (product name) is still open.

---

## 1. MVP Objective

Prove one thing: **a beginner can be shown a candlestick chart, be asked to mark a Fair Value Gap, draw their answer, and get instant graded feedback that teaches them something.**

That is the entire scope of V1. Not five concepts. Not accounts. Not simulation. One concept, one interaction, done well enough to trust.

**Why this is the right first build:** every other mode in the long-term vision (Guided Entry, Free Trade) is a harder version of the same loop — show chart, take user input, grade it, explain it, record it. If we can't make the simplest version of that loop reliable, the complex versions are guaranteed to fail. We are de-risking the core mechanic.

**V1 is a success if:** you can hand this to a beginner trader with no explanation, and they complete five exercises and can tell you their score without asking you a question.

---

## 2. Target User

**Primary user (V1):** A beginner trader who has watched ICT content on YouTube, understands the *definition* of a Fair Value Gap, but cannot reliably spot one on a chart without someone pointing at it.

**Explicitly not our user in V1:** experienced traders, people who have never heard of ICT, anyone looking for signals or profits.

### The problem, stated plainly

Learning to read charts today is passive. You watch someone circle an FVG on a video, nod, and feel like you understand it. Then you open a live chart and freeze, because recognition and comprehension are different skills. There is no flashcard app for price action.

**The gap:** unlimited explanation, near-zero structured repetition with feedback.

### V1 User Stories

| ID | Story |
|----|-------|
| US-1 | As a beginner trader, I want to mark a Fair Value Gap on a chart myself, so I practice recognition instead of watching someone else do it. |
| US-2 | As a learner, I want to know immediately whether I was right or wrong, so I don't reinforce a mistake. |
| US-3 | As a learner, I want to see the correct area and read why it qualifies, so a wrong answer teaches me something. |
| US-4 | As a learner, I want to see my running accuracy, so my practice feels like progress instead of noise. |

---

## 3. V1 User Flow

```
Landing page
   ↓ [Start Practicing]
Dashboard (accuracy, exercises completed, continue button)
   ↓ [Start FVG Practice]
Exercise screen
   ├─ Candlestick chart (~40 candles, static)
   ├─ Prompt: "Mark the Fair Value Gap."
   ├─ User drags a rectangle on the chart
   ├─ [Submit]  (disabled until a box is drawn)
   ↓
Feedback state (same screen, chart stays put)
   ├─ CORRECT or NOT QUITE
   ├─ Correct FVG zone drawn over the chart in a second color
   ├─ User's own box remains visible for comparison
   ├─ 1–3 sentence explanation of why that zone qualifies
   ↓ [Next Exercise]
   └─ Attempt recorded → accuracy updates → repeat
        ↓ (after exercise 5)
     Session summary → back to Dashboard
```

**Deliberate constraint:** the chart does not move, zoom, or scroll in V1. Every exercise is a fixed static image of price with a fixed correct answer. Pan/zoom introduces coordinate math bugs that would eat the whole build.

---

## 4. Pages in Scope

| Page | Purpose | V1 contents |
|------|---------|-------------|
| **Landing** | Explain what this is in one screen | Headline, one-sentence value prop, 3 feature bullets, "Start Practicing" button, educational-use disclaimer |
| **Dashboard** | Show progress, launch practice | Overall accuracy %, exercises completed, current session, "Start FVG Practice" button |
| **Practice / Exercise** | The core loop | Chart, prompt, drawing surface, Submit, feedback, Next |
| **Session summary** | Close the loop | Score out of 5, which ones were missed, "Practice again" |

Four screens. Nothing else gets built. No Profile, no Analytics page, no settings — those need real accounts and real data to be meaningful, and we have neither yet.

---

## 5. Exercise Format

Each exercise is a data object, not hardcoded UI. This matters: it means adding exercise #6 or eventually concept #2 is a data change, not a code change.

```
Exercise {
  exercise_id:      "fvg-001"
  concept:          "FVG"
  instrument:       "NQ"          (prototype data, labeled as such)
  timeframe:        "5m"
  difficulty:       1 | 2 | 3
  candles:          [ {time, open, high, low, close}, ... ]   ~40 candles
  has_fvg:          true | false
  answer: {                       // null when has_fvg is false
    type:           "bullish" | "bearish"
    price_low:      number        (bottom of the gap)
    price_high:     number        (top of the gap)
    candle_start:   index         (candle 1 of the three)
    candle_end:     index         (candle 3 of the three)
  }
  explanation:      "Candle 1's high sits below candle 3's low, leaving an
                     unfilled imbalance across candle 2."
  distractor_note:  // required when has_fvg is false
                    "Candles 14–16 look close, but candle 14's high and
                     candle 16's low overlap by 2 points — no imbalance."
}
```

### V1 data source
Five hand-built, realistic-looking candle sets. **Not real market data, and labeled prototype data in the code.** Real verified NQ scenarios are Phase 7 — using them now would mean solving data sourcing and label validation before we've proven anyone wants to draw a box. We are testing the interaction, not the dataset.

### V1 ambiguity rule (important)
**Each exercise chart must contain exactly one valid FVG, or exactly zero.** Never two. We construct the candles so no second qualifying gap exists. This removes the "well, technically there's another one over there" problem entirely for V1.

**Exercise 4 of 5 contains no valid FVG.** It must contain a deliberate near-miss — three candles that almost form a gap but overlap slightly — so the correct answer requires actually applying the rule rather than glancing. When we move to real historical data, we will need a real answer-validation process — that's a known Phase 7 problem, deliberately deferred, not ignored.

---

## 6. Grading Methods

Every exercise carries an `answer_type` of `"zone"` or `"level"`. FVG is always `"zone"`; Liquidity is always `"level"`. They're graded by two different rules, described below — but both are built on the same principle: "correct" has to be a *rule*, not an eyeball match, and the rule has to be defensible — strict enough that guessing fails, loose enough that a genuinely correct answer isn't punished for being a few pixels off.

### 6.1 Zone Grading (FVG)

This is the heart of V1's original design and the part worth understanding deeply.

#### The problem
The correct answer is a rectangle. The user draws a rectangle. They will never match exactly.

#### The rule (three tests, all must pass)

Grading uses **price range** for accuracy, plus one time check.

**Test 1 — Coverage.** At least **60%** of the true gap's price range must fall inside the user's box.
> *Did they actually find it?*

```
overlap   = min(user_high, true_high) − max(user_low, true_low)
coverage  = overlap / (true_high − true_low)
PASS if coverage ≥ 0.60
```

**Test 2 — Precision.** The user's box height must be no more than **2.5×** the true gap's height.
> *Did they find it, or did they just draw a huge box over everything?*

```
precision_ratio = (user_high − user_low) / (true_high − true_low)
PASS if precision_ratio ≤ 2.5
```

**Test 3 — Time window.** The user's box must horizontally include the exercise's `key_candle_index` — the middle candle of the three-candle formation.
> *Are they pointing at the right moment in the chart?*

**Correct = all three pass.** Anything else is incorrect, with feedback that names *which* test failed:
- Failed coverage, box **not** fully inside the true zone → "You marked the wrong area."
- Failed coverage, box **fully inside** the true zone (correctly placed, just undersized) → "Right area, but your selection was too small to cover enough of the zone." (added 2026-09-10 — see Bug Log; the box-not-fully-inside check is what tells these two apart.)
- Passed coverage, failed precision → "You found it, but your selection was too broad — a Fair Value Gap is a specific price range."
- Failed time → "Right price level, wrong candles."

#### Grading matrix (with "no FVG present" answers)

The tests above only run in the top-left cell. The other three are separate paths:

| | User drew a box | User answered "No FVG present" |
|---|---|---|
| **Chart has an FVG** | Run the tests above | **Incorrect** — state the correct answer, reveal the zone, show explanation |
| **Chart has no FVG** | **Incorrect** — state that no FVG exists, then the distractor_note explaining why the tempting area doesn't qualify | **Correct** — state that no FVG exists, then the distractor_note as confirmation |

The bottom-left cell is the most educationally valuable moment in V1: the user was tempted by something that looked like a gap, and the app tells them precisely why it isn't one. That's why `distractor_note` is a required field, not optional flavor text.

#### Critical UX constraint
**The "No FVG present" button appears on every exercise, always.** If it only showed up on the no-FVG exercise, its presence would give away the answer and the exercise would measure nothing.

#### Why this design
Without the precision test, a user could draw a box around the entire chart and score 100%. Without the coverage test, a tiny box in the right neighborhood would fail unfairly. Together they measure *did you find it* and *do you know how big it is*.

**Interview answer for this (1–3 sentences):**
> "Grading a drawn region isn't a simple equality check, so I defined it as two measurable tests: coverage — how much of the correct zone the user captured — and precision — how much larger their selection was than the real one. That prevented users from passing by selecting everything, and it let the app tell them *how* they were wrong instead of just *that* they were wrong."

#### Tolerance values are provisional
60% and 2.5× are starting numbers, not truth (see the 2026-09-09 Decision Log entry confirming them for V1 after testing).

### 6.2 Level Grading (Liquidity)

A liquidity level is a price, not a zone — there's no box to measure coverage or precision against, and no time-window test (a resting level isn't tied to a fixed number of candles the way an FVG's three-candle formation is). This grading path was introduced 2026-09-10 when Liquidity moved from a drawn zone to a placed line (see Decision Log).

#### The rule (one test)

```
distance_from_level = user_price − true_price      // signed: positive = placed above, negative = below
PASS if |distance_from_level| ≤ tolerance
```

`true_price` is the average of the two equal highs/lows the level rests on. `tolerance` is set explicitly per exercise (currently **6 points** for every scored Liquidity exercise) rather than computed — the same reasoning as `key_candle_index`: a value that's cheap to author by hand and easy to tune later shouldn't be re-derived by a formula every time it's used. 6 points comfortably covers realistic click/drag imprecision while staying far below the 15+ point gap to the nearest *other* swing point in every exercise's data, so it can never accidentally validate the wrong level — and it's loose enough that placing the line at either raw touch (not just the averaged level) still grades correct, matching how a person would actually read "equal highs."

#### Feedback
Correct or incorrect, plus:
- The correct answer stated explicitly (see 6.3).
- The true level drawn on the chart as a second horizontal line, alongside the user's own line.
- The written explanation.
- When wrong: how far off and in which direction — "You were {distance} points too {high|low}."

#### Grading matrix (with "no liquidity level present" answers)
Same shape as the zone matrix — has_answer × user_answer_type — just with the single distance test instead of three:

| | User placed a line | User answered "No Liquidity Level present" |
|---|---|---|
| **Chart has a level** | PASS if within tolerance | **Incorrect** — state the correct answer, reveal the level, show explanation |
| **Chart has no level** | **Incorrect** — state that no level exists, then the distractor_note | **Correct** — state that no level exists, then the distractor_note as confirmation |

### 6.3 Feedback must always state the correct answer explicitly

Added 2026-09-10 after testing found this missing on `liq-004` (see Bug Log): feedback that only shows the distractor_note, with no plain statement of what the correct answer actually was, leaves the user to infer what they should have done. This applies to every exercise of both concepts, correct or incorrect:

- **Has no valid answer** (`has_answer: false`): feedback leads with "The correct answer was: no {answerLabel} on this chart." *before* the reasoning — there's nothing to point at, so this goes first.
- **Has a valid answer** (`has_answer: true`): feedback states "The correct answer was: a {answerLabel} between {low} and {high}" (zone) or "...a {answerLabel} level around {price}" (level) *after* the reasoning — numbers are supporting detail, not the lead.

Prices in this statement are rounded to whole numbers. Feedback sentences are kept short; numbers are never stacked into the same sentence as the reasoning.

---

## 7. Functional Requirements

| ID | Requirement | Priority | Story |
|----|-------------|----------|-------|
| FR-1 | Landing page displays value prop and routes to Dashboard | Must | — |
| FR-2 | Dashboard displays overall accuracy % and exercises completed | Must | US-4 |
| FR-3 | Exercise screen renders a candlestick chart from exercise data | Must | US-1 |
| FR-4 | Chart displays the prompt text for the current exercise | Must | US-1 |
| FR-5 | User can draw a rectangle on the chart by click-drag (mouse) or touch-drag (mobile) | Must | US-1 |
| FR-6 | User can redraw their box before submitting; only the latest counts | Must | US-1 |
| FR-7 | Submit is disabled until a box exists | Must | — |
| FR-8 | On Submit, system grades per Section 6 and displays Correct / Not quite | Must | US-2 |
| FR-9 | Feedback view overlays the correct FVG zone in a distinct color, keeping the user's box visible | Must | US-3 |
| FR-10 | Feedback view displays the exercise's written explanation | Must | US-3 |
| FR-11 | Failure feedback names which test failed (coverage / precision / time) | Should | US-3 |
| FR-12 | Next Exercise advances to the next unseen exercise | Must | — |
| FR-13 | Each attempt is recorded with the fields in Section 9 | Must | US-4 |
| FR-14 | Accuracy recalculates and displays after every attempt | Must | US-4 |
| FR-15 | After the 5th exercise, a session summary displays score and missed exercises | Should | US-4 |
| FR-16 | Progress persists in the browser between visits (localStorage, no login) | Should | US-4 |
| FR-17 | Educational-use disclaimer visible on Landing and Practice screens | Must | — |
| FR-18 | A "No FVG present" button is visible on **every** exercise and submits an answer without a box | Must | US-1 |
| FR-19 | Exercises with `has_fvg: false` grade per the matrix in Section 6 and display the distractor note | Must | US-3 |

---

## 8. Non-Functional Requirements

| ID | Requirement |
|----|-------------|
| NFR-1 | Responsive and usable from 375px (iPhone SE) to desktop |
| NFR-2 | Drawing works with touch, not only mouse |
| NFR-3 | Exercise screen interactive within 2 seconds |
| NFR-4 | Dark, minimal, professional visual style — no neon, no casino aesthetic |
| NFR-5 | No backend, no accounts, no server in V1 — runs entirely in the browser |
| NFR-6 | Exercise content lives in separate data files, not inside components |
| NFR-7 | Code organized into components and folders; no single-file app |
| NFR-8 | All code in one GitHub repository as the single source of truth |

**On NFR-5:** skipping the database in V1 is intentional, not lazy. A database is Phase 5, and it's genuinely valuable for your portfolio — but building auth and a schema before we know if the drawing interaction works would mean potentially rebuilding the schema around a mechanic we changed. We collect the *same data fields* now (Section 9), stored locally, so the eventual database schema is a migration, not a redesign.

---

## 9. Data Collected Per Attempt

Recorded now in browser storage, structured so it maps directly to a future `attempts` table.

| Field | Type | Why we collect it |
|-------|------|-------------------|
| attempt_id | string | Unique key |
| session_id | string | Groups attempts into a practice session |
| exercise_id | string | Which scenario |
| concept | string | "FVG" — future-proofs for multiple concepts |
| user_answer_type | "region" \| "none" | Distinguishes "drew a box" from "said there isn't one" — needed to spot users who never use "No FVG" |
| user_price_low | number | Raw answer |
| user_price_high | number | Raw answer |
| user_candle_start | number | Raw answer |
| user_candle_end | number | Raw answer |
| is_correct | boolean | The verdict |
| coverage | number | *How* right — enables partial-credit analysis later |
| precision_ratio | number | Detects "draws too big" as a behavior pattern |
| failure_reason | string/null | Which test failed |
| response_time_ms | number | Hesitation is a proxy for uncertainty |
| attempt_number | number | Repeat exposure to the same exercise |
| timestamp | datetime | Improvement over time |

**Why coverage and precision are stored as numbers, not just pass/fail:** this is the RAW DATA → METRIC → INSIGHT → ACTION principle in practice. A boolean tells us a user got it wrong. A precision_ratio of 4.1 across twelve attempts tells us *this user consistently draws too wide*, which is a specific, coachable weakness. You cannot recover that insight later if you only stored true/false.

---

## 10. Acceptance Criteria — Milestone 1 Complete

The milestone is done when all twelve of these pass on **both desktop and phone**:

1. Application opens without errors
2. Landing → Dashboard → Practice navigation works
3. A candlestick chart renders correctly
4. The question is understandable without explanation
5. A rectangle can be drawn on the chart
6. Submit registers the answer
7. Correct/incorrect feedback appears
8. The correct zone is displayed on the chart
9. An explanation is readable
10. Next Exercise loads a different scenario
11. The attempt is recorded
12. Accuracy updates to reflect the new attempt

---

## 11. Test Plan

| Type | What we check |
|------|---------------|
| Happy path | Draw correctly on all 5 → 5/5, accuracy 100% |
| Wrong answer | Draw in empty space → incorrect, correct zone shown, explanation shown |
| Gaming the system | Draw a box covering the whole chart → **must fail** on precision |
| Near-miss | Draw a slightly-off box → verify the verdict feels fair to a human |
| Edge case | Click without dragging (zero-area box) → Submit stays disabled, no crash |
| Edge case | Draw partially off-canvas → clamps to chart bounds, no crash |
| No-FVG path | On exercise 4, answer "No FVG present" → correct, distractor note shown |
| No-FVG path | On exercise 4, draw a box on the near-miss candles → incorrect, distractor note explains the overlap |
| No-FVG path | On an exercise that *does* have an FVG, answer "No FVG present" → incorrect, correct zone revealed |
| Answer validity | "No FVG present" button is visible on all 5 exercises, not just exercise 4 |
| Mobile | Complete a full exercise by touch on a real phone |
| Data integrity | Complete an exercise, inspect stored attempt, confirm all Section 9 fields present |
| Regression | After adding exercises 2–5, re-verify exercise 1 still grades correctly |

---

## 12. Out of Scope for V1

Written down so they stop being open questions:

Accounts and login · database and server · concepts other than FVG · real historical market data · Guided Entry mode · Free Trade mode · candle-by-candle playback · "No Trade" decisions · AI-generated feedback · adaptive practice recommendations · XP, streaks, levels, leaderboards · Power BI dashboard · payments · native mobile apps · chart pan/zoom · multiple correct answers per chart

Every one of these is in the vision document and most will get built. None belong in V1.

> **Update 2026-09-25:** V1 shipped, and most of this list has since been built on Haven's instruction: accounts, database, more concepts, real data, Guided Entry, Free Trade, playback, No Trade decisions, adaptive recommendations and streaks. See Build Status at the top and Backlog (Section 15) for what's still out.

---

## 13. Open Decisions — Need Sign-Off

| # | Decision | Recommendation |
|---|----------|----------------|
| D-1 | How the user marks the FVG | ✅ **RESOLVED — drag a box.** Closest to real chart analysis, richest data, hardest to guess. |
| D-2 | Should one exercise contain **no** valid FVG? | ✅ **RESOLVED — yes.** Product Owner overrode the recommendation to defer. Cost accepted: a second grading path and a required distractor note per Section 6. |
| D-3 | Starting tolerance values | Confirmed for V1 — 60% coverage, 2.5× precision, tested against all five exercises (see Decision Log, 2026-09-09). **Open assumption:** this testing was done by someone who already knows what an FVG looks like. It should be re-checked against beginner attempt data once real users are practicing — a beginner's "close but wrong" boxes may cluster differently than the tester's did. |
| D-4 | Working product name | Open — defer; not needed to build |

---

## 14. Decision Log

| Date | Decision | Why | Alternatives considered |
|------|----------|-----|-------------------------|
| 2026-09-09 | V1 covers FVG only | Prove the loop before scaling the curriculum | Ship 3 concepts at once — rejected, triples grading logic before validating any of it |
| 2026-09-09 | Prototype candle data, not real NQ data | Testing the interaction, not the dataset; real data requires a validation process (Phase 7) | Source real data now — rejected, blocks the build on an unsolved problem |
| 2026-09-09 | No database or accounts in V1 | Same data fields collected locally; schema becomes a migration, not a redesign | Build auth + Postgres first — rejected, risks rebuilding around a mechanic that may change |
| 2026-09-09 | Static chart, no pan/zoom | Coordinate math is the main source of bugs in drawing interfaces | Full interactive chart — deferred |
| 2026-09-09 | Coverage + precision grading | Prevents passing by over-selecting; produces diagnostic data | Simple overlap check — rejected, gameable |
| 2026-09-09 | Users mark the FVG by dragging a box | Mirrors real chart analysis; captures price range and time range as data instead of a single click | Click the middle candle (simpler, but teaches only location, not zone size); multiple choice (easiest to build, but recognition-from-options is a weaker skill than recall) |
| 2026-09-09 | One of five V1 exercises has no valid FVG | Teaches that "there isn't one" is a legitimate answer, consistent with the platform's patience-over-action philosophy; front-loads a design problem we'd otherwise hit in V2 | Defer to V2 — PM recommendation, overruled by Product Owner. Accepted cost: second grading path, distractor note content per exercise |
| 2026-09-09 | Kept grading tolerances at 60% coverage and 2.5x precision | Tested across all five exercises after Phase 3; verdicts felt fair, correct answers passed, oversized boxes failed. No adjustment needed. | Loosen or tighten after testing; rejected, no evidence supported a change |
| 2026-09-10 | Liquidity moved from a drawn zone to a placed horizontal line (new `answer_type: "level"`) | A liquidity level is a price, not a zone — grading a drawn box against an arbitrary band height produced unfair results (see Bug Log: a correctly-placed but thinner box failed coverage with an inaccurate "wrong area" message). A single price with a tolerance is the honest shape of the answer. | Keep the box and just widen the zone band — rejected, treats a real design mismatch as a tuning problem instead of fixing the underlying model |
| 2026-09-10 | SMT Divergence removed from the concept roadmap for now | SMT requires comparing two correlated instruments side by side, which needs a dual-chart component rather than a new exercise type. It is the only planned concept with that requirement, so the cost is high relative to one concept. | Build the dual-chart component to support SMT; deferred, not rejected |
| 2026-09-11 | Liquidity definition corrected: it rests above any swing high and below any swing low, with equal highs/lows representing a larger pool rather than the only valid case. Exercises re-authored to test strength ("mark the strongest...") rather than existence. See `docs/CURRICULUM.md`. | The earlier working definition treated liquidity as valid *only* at equal highs/lows, which is wrong — a single wick always has a pool above it, just a smaller one. Testing existence under that wrong definition meant every exercise except one had a trivially "no" answer, since equal highs/lows are rare; testing strength is the honest version of the skill. | Narrow V1 to equal highs/lows only, treating that as the whole of "liquidity" — rejected, it would teach an incomplete mental model that has to be un-learned later |
| 2026-09-11 | New York AM session (for the not-yet-examinable time-based liquidity levels) defined as 9:30–11:00 ET | Haven's actual practice window is roughly 9:30–10:30 or 11:00. The wider 11:00 boundary was chosen deliberately so a high forming between 10:30 and 11:00 isn't marked incorrect once these exercises exist. | Use the narrower 9:30–10:30 window matching practice exactly — rejected for now, since it would falsely mark a legitimate late-session high as outside the window; revisit once time-based exercises are actually built |
| 2026-09-14 | Mobile touch drawing (FVG box drag, Liquidity line placement) is implemented, not deferred — but NFR-1/NFR-2 are only partially verified: confirmed at a 375px viewport with realistically-timed *synthetic* pointer/touch events (see Polish Backlog, 2026-09-10), never yet on a real phone. Treat NFR-1 as unmet until a real-device pass confirms the same behavior, and re-verify before other users get access or before Guided Entry / Free Trade modes are built, since both add more on-chart interaction surface for touch to break on. | Synthetic events can't reproduce real touch quirks (multi-touch, momentum scrolling, browser chrome insets, actual finger imprecision), so "verified" here means "not known broken," not "confirmed working for a beginner on their own phone." | Ship without a real-device pass — rejected for V1 speed, but the risk is logged rather than assumed away |
| 2026-09-24 | Free Trade (Mode 3) graded on process, not outcome; overall pass = every applicable check passes | Consistent with Section 13 and Guided Entry — a loss with good process is a good decision, a win with bad process isn't. A candle touching both stop and target is scored as a stop (order within a candle is unknowable; assume the worse case). Attempts are stored with `answer_type = 'free'` as the mode discriminator, matching how Guided Entry used `'guided'`. | Grade on win/loss — rejected, rewards luck. Separate `mode` column — rejected, `answer_type` already plays that role |
| 2026-09-24 | Real data enters through a Python pipeline (`scripts/`). **Answer keys are derived by code from the curriculum's rules, never typed in, and no real scenario is served until a human approves it.** Every scenario carries provenance (source, raw-file hash, trading date, session, timeframe, rule, reviewer). | Phase 7's open problem was answer validity, not candles. Code applies a rule consistently; a human checks the rule fits what's on the chart. The app enforces the gate (`isPracticeReady`, `parseRealScenario`). | Hand-label real charts — rejected, the key is only as good as the labeller. Trust detection alone — rejected, rules match things a trader wouldn't call the concept. |
| 2026-09-24 | Data source: Kaggle "NQ Futures 1min Bar 2022-2025" (redistributed CME data). **License unverified; personal use only** until confirmed. The vendor stamps bars with their close time, so ingest shifts them to open time. The file is truncated at Excel's row limit (last day dropped). Holidays and data holes are listed in `scripts/calendars/nq_2022_2025.txt`. | The only 1-minute NQ history available. Close-time labels would have put every candle one bar late without any visible error (docs/SCENARIO-VALIDATION.md, data quality lessons). | Buy vendor data — not yet, pending a decision on public release |
| 2026-09-24 | Detection runs within one trading session. No setup may span a session break, and full-day levels are skipped on session-only data. | Gluing 10:55 one day to 9:30 the next produced fake FVGs and MSS (Bug Log 2026-09-24). | — |
| 2026-09-24 | **Adaptive detection thresholds (AI-DRAFTED):** FVG minimum = 0.25× the trailing median bar range; equal highs/lows within 0.05% of price. These replace the HAVEN-VALIDATED 10 points / 15 points, which came from ten unusually volatile sessions. | Across the full dataset, fixed points filtered far more in calm months. 0.25× is chosen for on-chart legibility, because no gap size predicted price reaction better than a random zone. 0.05% keeps every touch inside the level-grading tolerance. Details and counts in CURRICULUM.md → Detection Parameters. | Calibrate to the Nov 2025 slice — rejected, the slice was the problem |
| 2026-09-24 | RTH defined as 9:30–16:00 ET, the NYSE cash session (Haven's call). | The levels traders watch are cash-session levels. | CME's 16:15 close — rejected |
| 2026-09-24 | **MSS structure is read from 07:00 ET on NY AM charts (AI-DRAFTED).** The break must still happen in 9:30–11:00. | Only 35 MSS in 736 NY AM sessions, because 18 bars can't form the four swings the rule needs. Body-close and lookback weren't the cause. 07:00 context gives 435, with no empty months. CURRICULUM.md → MSS. | Lookback 1 — rejected, it counts minor internal swings as structure |
| 2026-09-24 | **Premium & Discount and Order Blocks added (definitions from Haven, operational details AI-DRAFTED).** P/D: the most recent unbroken swing range; judged on the last close; within 45–55% of the range counts as equilibrium. OB: last opposing candle before a 1–3 candle displacement of at least 2× median range that breaks a swing; zone = full candle range; invalidated by a body close through it. | Each operational detail is needed to derive an answer key by code. Choices and counts are in CURRICULUM.md. | — |
| 2026-09-24 | `/review` approves or rejects scenarios by editing repo files (dev server only), with access limited to logged-in `REVIEWER_EMAILS`. The same change moved `middleware.ts` to `src/proxy.ts`. | Exercise content stays version-controlled, never in the database (supabase migration header). The move to `src/proxy.ts` was a fix: at the repo root, Next 16 never ran the middleware, so pages were only protected client-side. | Store approvals in Supabase — rejected, it would split exercise content across code and the database |
| 2026-09-24 | **Real Guided Entry / Free Trade scenarios come from one setup finder (AI-DRAFTED):** MSS with a prior sweep → the FVG or OB it left (entry at the midpoint) → stop 0.1× median beyond the setup extreme → nearest untaken opposing swing as target → ≥ 2:1. No-trade sessions are built the same way. Real Guided charts end 3 bars after the entry forms. Real Free Trade hides dates during playback and only uses valid setups price actually returned to. | Levels must be derived, not assumed. Showing the aftermath or the date would leak the outcome. Only 20 of 736 sessions pass the whole chain, so no-trade is the usual correct answer. CURRICULUM.md → Guided Entry / Free Trade. | — |
| 2026-09-25 | Tests: Vitest for the TypeScript logic, Python `unittest` for detection (no new Python dependencies). **Tests that fail against current code are left failing and logged as bugs, never edited to pass.** | Grading, detection and the recommendation engine are the parts where a silent regression would teach users something wrong. | Jest — heavier setup for the same coverage |
| 2026-09-25 | Error handling: the app never renders blank. It has an error boundary; invalid scenario files are skipped and listed on /review; stale sessions and empty concepts are recovered; failed saves show plain messages with Retry or Log in again (Bug Log 2026-09-25). | A beginner who hits a crash loses trust in the grading too. | — |
| 2026-09-25 | CSV export for BI is user-scoped, has one denormalized row per attempt, and uses 1/0 booleans (docs/ANALYTICS.md). | RLS limits the anon key to the caller's rows. An all-users export needs a service-role key and an admin check that don't exist yet. | Build the Power BI dashboard in-app — deferred (Backlog) |
| 2026-09-25 | **Curriculum is versioned and review is structured (AI-DRAFTED).** Each CURRICULUM.md "## " section is a definition with a version and a text hash (`src/data/curriculum-versions.json`). Exercises record the versions their answer keys were built under. Changing a definition's text without a bump fails `npm test`. A bump fails `npm test` for every dependent exercise and pulls dependent real scenarios out of practice and back into `/review`. `/review` now works one rule at a time with the definition beside the chart, keyboard-only. It takes structured rejection reasons and a separate **ambiguous** decision, which keeps the file but never makes it an exercise, per this PRD's Section 5 ambiguity rule. The request cited "PRD Section 48", which doesn't exist; Section 5 is the ambiguity rule. A rejection-rate summary per rule and reason is generated into SCENARIO-VALIDATION.md. | Haven's review will change definitions. Without versions, an answer key built under old wording would stay live silently. Rejection patterns show which *rule* to fix instead of rejecting the same mistake repeatedly. | Hash-only (no version numbers) — rejected: a version number is what an exercise can record and a human can reason about |
| 2026-09-24 | **Adaptive practice (AI-DRAFTED, pending Haven's review).** `src/lib/recommendations.ts` is pure logic, separate from the UI. **Skill score per concept:** accuracy weighted by recency (half-life of 10 attempts within the concept), shrunk toward the user's overall accuracy with 4 pseudo-attempts, so 1–2 answers can't make a concept look weak or strong. **Weak** means a score below 70%. **Recommendation:** practice the weakest concept if it's weak, otherwise start the first concept not yet tried, otherwise push the weakest at a harder level. Difficulty comes from the score (<60% easy, <80% medium, else hard). Length is 5 when weak, else 10 (or "all" if fewer exist). For Guided Entry / Free Trade it also names the weakest step or check (at least 3 reached). The reason quotes the last-20 accuracy against overall, and notes when the last 5 are clearly better. **Adaptive session:** 10 exercises; if any concept is weak, 60% of slots come from weak concepts and 40% from the rest. Within each group a concept is drawn with weight (1 − score + 0.15), then a practice-ready exercise at the matching difficulty; the order is shuffled. Free Trade is left out of the mix (a long playback, its own mode). Surfaced on the dashboard (one-click recommended session) and analytics (full table). | The request asked for "PRD Phase 10", which isn't defined in this PRD. The adaptive engine was listed under Backlog → MAYBE and in Section 12 (out of scope for V1). It's built now on Haven's instruction. The constants are first guesses, chosen so behaviour is explainable. Revisit with real attempt data. | Plain lowest-accuracy concept (what the dashboard did) — rejected: one wrong answer on a new concept made it "weakest". Pure weighted-random mix — rejected: with many concepts, a weak one got only ~16% of slots, so the session didn't lean toward it. |
| 2026-09-24 | **Mobile audit at 375px and 414px (emulated viewport, synthetic touch events; still not a real device, so NFR-1 stays "not known broken" per 2026-09-14).** It covered box drawing, line placement, choice buttons, Guided Entry, Free Trade playback and stop/target placement, the concept and length pickers, the signed-in nav, and the /review forms. **Fixed:** (1) chart text rendered at ~4px on a phone, because the 800-unit viewBox was scaled down whole; the viewBox now tracks the rendered width (≥280 units, height ≥300), so axis and time labels stay 10–11px. The analytics trend line does the same. (2) Tap targets were 20–42px high; every button, nav link, Back link, playback speed toggle and review field is now at least 44×44 (`min-h-11`). (3) The signed-in nav (brand + 3 links + Log out) was wider than 375px; it now wraps to a second row. (4) Text inputs are 16px on mobile so iOS doesn't zoom on focus. (5) The practice header wraps instead of squeezing. **Verified unchanged:** zone and level charts, and Free Trade/Guided while a level is placeable, have `touch-action: none`, so a drag draws instead of scrolling. A touch-type drag produced the expected box and line with the new viewBox mapping. Choice charts and non-placing phases keep normal scrolling. No horizontal overflow at either width. | 44px follows Apple HIG and WCAG 2.5.5 (AAA). WCAG 2.2 AA's 24px minimum was already met by most controls, but not by the nav links or speed toggles. | Separate mobile components — rejected, the fixes are size and layout only |
| 2026-09-25 | **Performance pass (AI-DRAFTED).** (1) **Payload:** /dashboard and /analytics were shipping every exercise's candles (a 468 KB data chunk) just to read labels, concepts and difficulties. They now read `src/data/exercise-catalog.json`, candle-free metadata generated by `npm run catalog`. `tests/catalog.test.ts` fails if it goes stale, and /review updates it on approve/reject. Production JS: dashboard 1,296→858 KB raw (323→249 KB gzip), analytics 1,313→875 KB (328→253 KB gzip); practice +21 KB raw (+1.5 KB gzip) for the catalog. (2) **Queries:** the dashboard and adaptive-session loads select 16 of the 44 attempt columns (`DASHBOARD_COLUMNS`), about 1.25 KB → 0.45 KB per row. Analytics and the CSV export still need full rows. (3) **Re-renders:** the chart rebuilt its layout, time context and every candle mark on each pointer move while drawing. These are now memoized on the candles and chart size, and Free Trade memoizes its revealed-candle array. React Profiler, 200 drag moves on a 48-candle chart (dev build): 2.40 → 1.56 ms average render, 12.8 → 4.2 ms worst. (4) **Indexes:** `supabase/migrations/20260925120000_attempts_session_id_and_indexes.sql` (not yet applied) adds (user_id, created_at) for the ordered history fetch and (user_id, exercise_id) for the per-save attempt count, and drops the now-redundant user_id index. | Each change targets a path that runs on every page load or every pointer move. No database timing was possible without production access, so the indexes are justified by query shape, not a measured plan. | Code-splitting exercises per concept — deferred: the practice page needs the whole set for mixed adaptive sessions, and the dashboard/analytics saving came from the catalog alone |
| 2026-09-26 | **SQL analysis layer (AI-DRAFTED).** Ten views in `20260926120000_analytics_views.sql`, all `security_invoker` so RLS still applies. `/analytics` reads them and falls back to computing the same numbers in the browser if they're missing. Documented in docs/SQL-QUERIES.md. | One definition of each metric serves the app, the SQL editor and a BI connection. Invoker security means the same view is personal for a user and product-wide for the service role. `tests/sql/` runs every migration in PGlite and checks the views match the JS numbers. | Compute everything in the browser (what existed): rejected, because every consumer re-implements the metric. Materialized views: not needed at this volume. |
| 2026-09-26 | **Product event tracking (AI-DRAFTED).** New `practice_events` table (`20260926130000_practice_events.sql`) with its own RLS. It records session started (mode, concept, planned length, source: recommendation / adaptive mix / picker / deep link), completed, abandoned, and recommendation shown (at most once a day). Writes are fire-and-forget: a failed insert never affects practice. A session with no completed event counts as not completed. | Attempts can't answer "did they finish?", "did they follow the recommendation?" or "how long between sessions?". The recommendation is marked with `src=rec` on its link, so no guessing is needed. | Infer sessions from attempts only: can't see planned length, source or zero-answer sessions. A third-party analytics SDK: sends user data to another service for five event types. |
| 2026-09-26 | **/admin product health (AI-DRAFTED).** Needs a login. The page opens for `REVIEWER_EMAILS` or `app_admins`, but the all-user numbers come only from `security definer` functions (`20260926140000_admin_functions.sql`) that check `app_admins` themselves. Scenario review progress is read from repo files. | Keeps the anon-key-only architecture (no service-role key on the server). An env-file email alone can never expose other users' data. | Service-role key in a server route: rejected, one leaked env var exposes every row. Reuse REVIEWER_EMAILS for the data check: impossible, since the database can't read the app's env. |
| 2026-09-26 | **Python analysis (`analysis/`, AI-DRAFTED)** reads the CSV export and refuses to state findings below minimum samples (30 attempts per group, 5 users for a trend, 8 attempts and 3 users per exercise). It was validated on synthetic data with planted effects, never on real data: no real attempt data was accessible when it was written. | An analysis that prints a confident number from 4 attempts is worse than none. Planted effects show it finds what's there and stays quiet about what isn't. | Publish example "findings": rejected, because synthetic results would read as real ones. |
| 2026-09-27 | **Security audit and roles (AI-DRAFTED).** Findings are in docs/SECURITY-AUDIT.md: 3 Medium, 4 Low, 5 Info, all fixed or confirmed. Internal-tool access moved from the `REVIEWER_EMAILS` env allowlist (and the short-lived `app_admins` table) to `profiles.role` (`user`/`reviewer`/`admin`). A trigger stops API users from setting or changing a role. The UPDATE policy on attempts is dropped. `next` redirects are same-site only. CSV cells are protected against formulas. Security headers are added. | An email in an env file isn't an identity. A role in the database is tied to the user id, can be checked by the database functions, and can't be self-granted. Graded attempts are a record: the product-wide numbers depend on them not being rewritten. | Supabase `app_metadata` role: works, but only takes effect after a token refresh, and is less visible. Keep the env allowlist: rejected, per the audit finding. |
---

## 15. Backlog

*Rewritten 2026-09-25 (AI-DRAFTED). The seeded NOW/NEXT/LATER lists were all delivered apart from the items below. Status per phase is in Build Status at the top.*

**NEXT**
- Review the 50 real scenarios at `/review`. Nothing real is live until this happens.
- Confirm the Kaggle NQ data's license before any public release (docs/SCENARIO-VALIDATION.md).
- Real-device mobile pass (NFR-1/2).
- Re-check grading tolerances (D-3) against real beginner attempts.
- Haven to review every AI-DRAFTED definition and decision (CURRICULUM.md, this log).

**LATER**
- Real scenarios for Order Blocks, Premium & Discount, IFVG and time-based liquidity. Detection exists for all but IFVG; no batch has been built.
- Serve Free Trade candles from the server one at a time. Today unrevealed candles are never in the DOM, but they are in the page's JavaScript (CURRICULUM.md, Free Trade → no lookahead).
- An all-users CSV export for BI. It needs a server-side service-role key and an admin check (docs/ANALYTICS.md).
- Multi-level liquidity exercises (several lines on one chart). Needs a partial-credit grading design.
- Free Trade target grading (currently judged only through R:R; CURRICULUM.md "Known V1 gap").

**DEFERRED, with reasons**
- **SMT Divergence:** needs a dual-chart component for two correlated instruments (Decision Log 2026-09-10). Not started.
- **ES and SMT pairs:** depend on the dual-chart component above.
- **Internal Power BI dashboard:** replaced by the CSV export (`/api/export/attempts`, docs/ANALYTICS.md). A dashboard can be built in Power BI from that file without the app hosting one.
- **Google sign-in:** fully wired but switched off (`src/lib/auth-flags.ts`) until a Google Cloud OAuth client is configured in Supabase.
- **AI-generated feedback:** not started. Every explanation is written, and for real data human-reviewed, against the curriculum, which is the point of the validation process. Generated feedback would bypass it.
- **XP, levels, leaderboards:** only practice streaks were built. The rest adds competition before the practice loop is proven with real users.
- **Chart pan/zoom:** still out (Decision Log 2026-09-09), since coordinate math is where drawing bugs come from.
- **Native mobile apps:** out. The web app is the target and still needs a real-device check first.

---

## 16. Bug Log

| Date | Bug | Cause | Fix | Test performed |
|------|-----|-------|-----|-----------------|
| 2026-09-10 | Runtime `TypeError: Cannot read properties of undefined (reading 'title')` crashed `/practice` | `loadSession()` (`src/lib/storage.ts`) cast whatever was in localStorage to `SessionState` with `as SessionState` and no runtime validation. A session saved before the Phase 4 concept refactor had no `concept` field at all. `practice/page.tsx` then indexed `CONCEPTS[session.concept as Concept]` — indexing with `undefined` silently returned `undefined` instead of throwing there, and the crash surfaced one line later at `conceptMeta.title`. | Two layers: (1) `SessionState` gained a `version` field; `loadSession()` now runs `isValidSessionState()` and discards (removes from localStorage, returns null) anything with a missing/wrong version, an unrecognized `concept`, or any other shape mismatch — an invalid session falls back to the concept picker instead of being trusted. (2) `concepts.ts` gained `getConceptMeta()`, a safe lookup that falls back to FVG's copy instead of returning `undefined` for an unrecognized concept string, so even a bad value reaching render can't crash it. | Wrote a pre-Phase-4-shaped session object (no `concept`, no `version`) directly into localStorage and loaded `/practice`: confirmed the app discarded it and showed the concept picker, with no error reaching the UI. Ran a full 5-exercise session to completion for both FVG and Liquidity afterward — scores, session summary, and `version: 1` in the newly saved session all correct. |
| 2026-09-10 | A zone box that failed the coverage test always said "You marked the wrong area," even when the box was correctly centered and just too small | `gradeZoneAttempt` (`src/lib/grading.ts`) only checked `coverage >= 0.60`; it never distinguished a box that missed the true zone's location from a box that was entirely *inside* the true zone but undersized — both produced the same `failureReason: "coverage"` and the same message, and the message assumed the former. | Added a containment check: when coverage fails, test whether the user's box is fully inside `[price_low, price_high]` (never sticking out past either edge). If so, it's a new `failureReason: "too_small"` with the message "Right area, but your selection was too small to cover enough of the zone." Only a box that isn't fully contained keeps `"coverage"` / "You marked the wrong area." | Drew a box fully inside fvg-001's true zone (21107.25–21139.25, drawn ~21118–21128, well under the 60% coverage threshold) and submitted: confirmed `failure_reason: "too_small"` and the new message, with `precision_ratio` well under 2.5 (as expected for an undersized box). |
| 2026-09-10 | On `liq-004` (no-answer), feedback for submitting a level anyway only showed the distractor_note — it never stated that the correct answer was "no level here," leaving the user to infer it. Separately, prompts like "Mark the Buy-Side Liquidity." asserted a level existed even on no-answer exercises, inconsistently with exercises that had no answer. | `gradeZoneAttempt`/`gradeLevelAttempt` set `explanation` directly to `exercise.explanation` or `distractor_note`, with no leading statement of what the correct answer actually was. Prompts were hand-typed per exercise (`prompt` field) with no enforced template, so wording could — and did — vary in a way that leaked whether an answer existed. | Added `buildCorrectAnswerStatement()` + `composeExplanation()` (`src/lib/grading.ts`): every grading path now prepends "The correct answer was: no {answerLabel} on this chart." (no-answer case, stated first) or appends "...a {answerLabel} between/around {rounded price(s)}." (has-answer case, stated last, after the reasoning). Replaced the per-exercise `prompt` field with a derived `getPrompt()` (`src/data/exercises.ts`) built from a new `answerLabel` field via one template — "Identify the {answerLabel}, if there is one." — for every exercise of both concepts, so wording can't drift or leak existence. | Submitted a placed level on `liq-004`: confirmed feedback now leads with "The correct answer was: no Buy-Side Liquidity on this chart." before the distractor reasoning, for both the correct ("No Liquidity Level present") and incorrect (placed a line) responses. Confirmed every exercise of both concepts renders the identical "Identify the {X}, if there is one." template regardless of `has_answer`. |
| 2026-09-11 | `liq-004`'s answer key and explanation were incorrect under the corrected liquidity definition | `liq-004`'s `distractor_note` said the two near-miss highs meant "there's no real liquidity pool here." Under the corrected definition (`docs/CURRICULUM.md`), liquidity rests above *any* swing high — both wicks individually still have a (smaller) pool. The exercise was also framed as "is there buy-side liquidity" (answerLabel: "Buy-Side Liquidity"), a question that's trivially always "yes" under the corrected model, when the real teaching point is narrower: are these two highs equal. | Reframed `liq-004` around the actual question: prompt is now "Mark the equal highs, if there are any."; `answerLabel` changed to "equal highs"; `noAnswerLabel` to "No equal highs present"; rewrote the explanation to state plainly that each wick still has its own small pool, and that what's missing is a second touch reinforcing one shared level. Also re-authored `liq-001/002/003/005` to ask for the *strongest* buy/sell-side liquidity rather than testing existence, since existence is no longer a meaningful question under the corrected definition (see Decision Log). Candle data for all five exercises is unchanged — only the question, answer key, and explanation text. | Submitted a placed level on `liq-004`: confirmed "The correct answer was: no equal highs on this chart." followed by the corrected explanation, for both the correct and incorrect responses. Confirmed `liq-001`'s explanation now states the two-touches-means-stronger reasoning explicitly. |
| 2026-09-19 | FVG respected/disrespected was defined provisionally as "reacts from within the gap vs. closes through the far side," with wick-only penetration treated as tolerable but never precisely ruled out — the provisional text explicitly flagged itself as pending Haven's validation. The validated rule (`docs/CURRICULUM.md`) is stricter and clearer: respected as long as no candle *body* closes beyond the far boundary; wicks into or through the gap never invalidate it, matching the body-close confirmation rule already used for MSS. | The provisional definition was authored before body-close vs. wick was settled as the project's general confirmation standard, so it described the shape of the rule without pinning down the exact test. | Re-checked all five `fvg-resp-*` exercises' candle-by-candle body closes against the corrected boundary test. All five `correct_choice` answer keys already held under the corrected rule (no answer changes needed) — the original hand-built data never had a wick-only breach mislabeled as a body-close breach. Rewrote all five explanations to state the body-close rule plainly and name wicks that trade into the gap without invalidating it, so the reasoning shown to users matches the validated definition. | Re-derived each exercise's boundary crossings by hand from its candle data (`fvg-resp-001` through `fvg-resp-005` in `src/data/exercises.ts`) against the corrected rule and confirmed every existing `correct_choice` still matches. |
| 2026-09-24 | Real NQ data (Kaggle 1m file) placed every bar one minute late: bars at 17:00 ET inside the daily halt, trading days starting 18:01, the RTH opening bar stamped 9:31 | The vendor stamps bars with their close time; `scripts/ingest.py` assumed open time and had no check that would catch the difference | `ingest.py --timestamp-label close` shifts bars to open time; ingest now fails on any bar starting inside a scheduled CME closure, which surfaces the mislabeling. Documented as a data quality lesson in `docs/SCENARIO-VALIDATION.md` | Ingested the full file without the flag and confirmed it fails with 734 bars at 17:00. With the flag, confirmed there are no closure bars and the first NY AM bar is 9:30 |
| 2026-09-24 | `scripts/detect.py` built FVG and MSS candidates from bars on different days (e.g. 10:55 on one day next to 9:30 on the next) when fed an NY AM-only slice: 16 of 61 FVGs on 5m, 13 of 20 on 15m. Answer keys come from these candidates. | FVG, swing, equal highs/lows, and MSS detection ran over the whole series as one continuous sequence | Detection now runs within one trading day (18:00–17:00 ET) at a time and maps indices back to the full series. Time-based levels are unchanged. | Re-ran on the Nov 10–21 2025 NY AM slice: every candidate's involved timestamps now fall on a single date (0 cross-session, down from 18 FVG/MSS on 5m and 14 on 15m). The synthetic sample's candidates are unchanged. |
| 2026-09-24 | `scripts/detect.py` reported `previous_day_*` and `weekly_*` levels on NY AM-only and RTH-only data. Those were session highs/lows labelled as day/week levels, with the overnight session missing (1,778 wrong candidates per full-dataset run). | The time-based rules assumed the input held every bar of each day | `detect.py` now skips `previous_day` and `weekly` when the clean file's `meta.selection.session` isn't `all`, and prints why | Re-ran the full-dataset NY AM 5m and RTH 15m detection: both print the skip note and report no `previous_day_*`/`weekly_*` candidates. The synthetic sample (session `all`) still reports them. |
| 2026-09-25 | Attempts didn't record `session_id` (PRD Section 9). Found by `tests/data-integrity.test.ts`. | When attempts moved to Supabase (2026-09-10), `SessionState` stayed local and the column was never added. Analytics had to infer sessions from 30-minute gaps. | Migration `20260925120000_attempts_session_id_and_indexes.sql` added a nullable `session_id` column (applied by Haven). `src/lib/attempt-rows.ts` now writes `SessionState.session_id` for every mode, and so does the pre-login attempt migration. The CSV export has a `session_id` column. Analytics counts tagged sessions exactly and uses the gap rule only for older untagged attempts. | `npm test`: 65 passed, 1 skipped (live RLS); `npm run test:py`: 11 OK |
| 2026-09-25 | One wrong answer on a new concept made it the recommended "weakest" concept. Found by `tests/recommendations.test.ts`. | With 4 pseudo-attempts of prior, a single miss scores 0.8 × overall accuracy. Whenever overall accuracy is below 87.5%, that's under the 70% weak threshold, so the concept is flagged weak and recommended. | A concept needs at least 3 attempts before it can count as weak (`MIN_ATTEMPTS_FOR_WEAK` in `src/lib/recommendations.ts`). Below that it is still scored, and it is recommended as "keep going" only when nothing else is weak. | The test now passes; the other engine tests are unchanged |
| 2026-09-25 | Error-handling audit. Each of these crashed or blanked a page, or left the user stuck: (a) a stored session pointing at an exercise that no longer exists (e.g. a real scenario rejected at /review) threw `Missing exercise` and crashed /practice; (b) starting a concept with no practice-ready exercises made an empty session, which crashed the same way; (c) one malformed real-scenario JSON threw at module load and took down every page that imports exercises; (d) there was no error boundary, so any render error meant a blank page; (e) a failed save showed raw text ("Failed to fetch", "JWT expired", "row-level security") and couldn't be retried; (f) a grading error on bad data did nothing when Submit was clicked. | Paths only exercised by the happy case. | (a) A "no longer available" screen with Skip / Start over; (b) empty sessions are refused with a notice, and concepts with nothing ready are disabled in the picker; (c) invalid files are skipped, logged, and listed on /review; (d) `src/app/error.tsx` (Try again / Start over, which clears the stored session) and `global-error.tsx`; (e) `src/lib/errors.ts` classifies network, auth and other errors into plain messages, with "Retry save" (resends the kept row) or "Log in again"; (f) a "couldn't be graded" message with a Skip button. Empty states for a new account (dashboard, analytics, adaptive mix, /review) already rendered correctly. | `tests/error-handling.test.ts` covers error classification, malformed scenarios, and registry validity; `tsc` and `eslint` pass |

---

*For educational and practice purposes only. Not financial advice.*
