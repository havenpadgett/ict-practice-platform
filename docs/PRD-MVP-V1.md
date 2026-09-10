# Product Requirements Document — MVP V1
**Product:** ICT Concepts Practice Platform (working name)
**Version:** 1.0 (draft for review)
**Owner:** Haven Padgett — Product Owner / Business Analyst
**Date:** September 9, 2026
**Status:** Draft — pending sign-off on Open Decisions (Section 13)

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

## 6. FVG Grading Method

This is the heart of V1 and the part worth understanding deeply.

### The problem
The correct answer is a rectangle. The user draws a rectangle. They will never match exactly. So "correct" has to be a *rule*, and the rule has to be defensible — strict enough that guessing fails, loose enough that a genuinely correct answer isn't punished for being three pixels off.

### The rule (two tests, both must pass)

Grading uses **price range only** for accuracy, plus one time check.

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

**Test 3 — Time window.** The user's box must horizontally include the middle candle of the three-candle formation.
> *Are they pointing at the right moment in the chart?*

**Correct = all three pass.** Anything else is incorrect, with feedback that names *which* test failed:
- Failed coverage → "You marked the wrong area."
- Passed coverage, failed precision → "You found it, but your selection was too broad — an FVG is a specific price range."
- Failed time → "Right price level, wrong candles."

### Grading matrix (with "no FVG present" answers)

The three tests above only run in the top-left cell. The other three are separate paths:

| | User drew a box | User answered "No FVG present" |
|---|---|---|
| **Chart has an FVG** | Run tests 1–3 | **Incorrect** — reveal the zone, show explanation |
| **Chart has no FVG** | **Incorrect** — show the distractor_note explaining why the tempting area doesn't qualify | **Correct** — show the distractor_note as confirmation |

The bottom-left cell is the most educationally valuable moment in V1: the user was tempted by something that looked like a gap, and the app tells them precisely why it isn't one. That's why `distractor_note` is a required field, not optional flavor text.

### Critical UX constraint
**The "No FVG present" button appears on every exercise, always.** If it only showed up on exercise 4, its presence would give away the answer and the exercise would measure nothing. This sounds obvious and is the kind of thing that quietly breaks a study design.

### Why this design
Without Test 2, a user could draw a box around the entire chart and score 100%. Without Test 1, a tiny box in the right neighborhood would fail unfairly. Together they measure *did you find it* and *do you know how big it is* — which are the two things the skill actually consists of.

**Interview answer for this (1–3 sentences):**
> "Grading a drawn region isn't a simple equality check, so I defined it as two measurable tests: coverage — how much of the correct zone the user captured — and precision — how much larger their selection was than the real one. That prevented users from passing by selecting everything, and it let the app tell them *how* they were wrong instead of just *that* they were wrong."

### Tolerance values are provisional
60% and 2.5× are starting numbers, not truth. After the five exercises exist, we test them ourselves and tune. That tuning process — and writing down why we changed the numbers — is legitimate product analytics work and goes in the decision log.

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

---

## 13. Open Decisions — Need Sign-Off

| # | Decision | Recommendation |
|---|----------|----------------|
| D-1 | How the user marks the FVG | ✅ **RESOLVED — drag a box.** Closest to real chart analysis, richest data, hardest to guess. |
| D-2 | Should one exercise contain **no** valid FVG? | ✅ **RESOLVED — yes.** Product Owner overrode the recommendation to defer. Cost accepted: a second grading path and a required distractor note per Section 6. |
| D-3 | Starting tolerance values | Confirmed for V1 — 60% coverage, 2.5× precision, tested against all five exercises (see Decision Log, 2026-09-09). **Open assumption:** this testing was done by someone who already knows what an FVG looks like. It should be re-checked against beginner attempt data once real users are practicing — a beginner's "close but wrong" boxes may cluster differently than the tester's did. |
| D-4 | Working product name | Open — defer; not needed to build |

---

## 14. Decision Log (seeded)

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

---

## 15. Backlog (seeded)

**NOW** — FR-1 through FR-17

**NEXT** — 5 more FVG exercises · "no valid FVG here" exercise type · liquidity (BSL/SSL) concept · accuracy-by-concept view

**LATER** — accounts + database · real historical NQ scenarios + validation process · MSS, IFVG, SMT · Guided Entry mode · analytics page · Power BI internal dashboard

**MAYBE** — Free Trade simulation · adaptive practice engine · AI-generated feedback · XP/streaks/leaderboards · ES and SMT pairs · native mobile

---

*For educational and practice purposes only. Not financial advice.*
