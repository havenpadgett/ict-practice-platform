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
| 2026-09-10 | Liquidity moved from a drawn zone to a placed horizontal line (new `answer_type: "level"`) | A liquidity level is a price, not a zone — grading a drawn box against an arbitrary band height produced unfair results (see Bug Log: a correctly-placed but thinner box failed coverage with an inaccurate "wrong area" message). A single price with a tolerance is the honest shape of the answer. | Keep the box and just widen the zone band — rejected, treats a real design mismatch as a tuning problem instead of fixing the underlying model |
| 2026-09-11 | Liquidity definition corrected: it rests above any swing high and below any swing low, with equal highs/lows representing a larger pool rather than the only valid case. Exercises re-authored to test strength ("mark the strongest...") rather than existence. See `docs/CURRICULUM.md`. | The earlier working definition treated liquidity as valid *only* at equal highs/lows, which is wrong — a single wick always has a pool above it, just a smaller one. Testing existence under that wrong definition meant every exercise except one had a trivially "no" answer, since equal highs/lows are rare; testing strength is the honest version of the skill. | Narrow V1 to equal highs/lows only, treating that as the whole of "liquidity" — rejected, it would teach an incomplete mental model that has to be un-learned later |
| 2026-09-11 | New York AM session (for the not-yet-examinable time-based liquidity levels) defined as 9:30–11:00 ET | Haven's actual practice window is roughly 9:30–10:30 or 11:00. The wider 11:00 boundary was chosen deliberately so a high forming between 10:30 and 11:00 isn't marked incorrect once these exercises exist. | Use the narrower 9:30–10:30 window matching practice exactly — rejected for now, since it would falsely mark a legitimate late-session high as outside the window; revisit once time-based exercises are actually built |

---

## 15. Backlog (seeded)

**NOW** — FR-1 through FR-17

**NEXT** — 5 more FVG exercises · "no valid FVG here" exercise type · liquidity (BSL/SSL) concept · accuracy-by-concept view

**LATER** — accounts + database · real historical NQ scenarios + validation process · MSS, IFVG, SMT · Guided Entry mode · analytics page · Power BI internal dashboard · multi-level liquidity exercises — user places multiple lines for several liquidity levels on one chart. Requires partial-credit grading design.

**MAYBE** — Free Trade simulation · adaptive practice engine · AI-generated feedback · XP/streaks/leaderboards · ES and SMT pairs · native mobile

---

## 16. Bug Log

| Date | Bug | Cause | Fix | Test performed |
|------|-----|-------|-----|-----------------|
| 2026-09-10 | Runtime `TypeError: Cannot read properties of undefined (reading 'title')` crashed `/practice` | `loadSession()` (`src/lib/storage.ts`) cast whatever was in localStorage to `SessionState` with `as SessionState` and no runtime validation. A session saved before the Phase 4 concept refactor had no `concept` field at all. `practice/page.tsx` then indexed `CONCEPTS[session.concept as Concept]` — indexing with `undefined` silently returned `undefined` instead of throwing there, and the crash surfaced one line later at `conceptMeta.title`. | Two layers: (1) `SessionState` gained a `version` field; `loadSession()` now runs `isValidSessionState()` and discards (removes from localStorage, returns null) anything with a missing/wrong version, an unrecognized `concept`, or any other shape mismatch — an invalid session falls back to the concept picker instead of being trusted. (2) `concepts.ts` gained `getConceptMeta()`, a safe lookup that falls back to FVG's copy instead of returning `undefined` for an unrecognized concept string, so even a bad value reaching render can't crash it. | Wrote a pre-Phase-4-shaped session object (no `concept`, no `version`) directly into localStorage and loaded `/practice`: confirmed the app discarded it and showed the concept picker, with no error reaching the UI. Ran a full 5-exercise session to completion for both FVG and Liquidity afterward — scores, session summary, and `version: 1` in the newly saved session all correct. |
| 2026-09-10 | A zone box that failed the coverage test always said "You marked the wrong area," even when the box was correctly centered and just too small | `gradeZoneAttempt` (`src/lib/grading.ts`) only checked `coverage >= 0.60`; it never distinguished a box that missed the true zone's location from a box that was entirely *inside* the true zone but undersized — both produced the same `failureReason: "coverage"` and the same message, and the message assumed the former. | Added a containment check: when coverage fails, test whether the user's box is fully inside `[price_low, price_high]` (never sticking out past either edge). If so, it's a new `failureReason: "too_small"` with the message "Right area, but your selection was too small to cover enough of the zone." Only a box that isn't fully contained keeps `"coverage"` / "You marked the wrong area." | Drew a box fully inside fvg-001's true zone (21107.25–21139.25, drawn ~21118–21128, well under the 60% coverage threshold) and submitted: confirmed `failure_reason: "too_small"` and the new message, with `precision_ratio` well under 2.5 (as expected for an undersized box). |
| 2026-09-10 | On `liq-004` (no-answer), feedback for submitting a level anyway only showed the distractor_note — it never stated that the correct answer was "no level here," leaving the user to infer it. Separately, prompts like "Mark the Buy-Side Liquidity." asserted a level existed even on no-answer exercises, inconsistently with exercises that had no answer. | `gradeZoneAttempt`/`gradeLevelAttempt` set `explanation` directly to `exercise.explanation` or `distractor_note`, with no leading statement of what the correct answer actually was. Prompts were hand-typed per exercise (`prompt` field) with no enforced template, so wording could — and did — vary in a way that leaked whether an answer existed. | Added `buildCorrectAnswerStatement()` + `composeExplanation()` (`src/lib/grading.ts`): every grading path now prepends "The correct answer was: no {answerLabel} on this chart." (no-answer case, stated first) or appends "...a {answerLabel} between/around {rounded price(s)}." (has-answer case, stated last, after the reasoning). Replaced the per-exercise `prompt` field with a derived `getPrompt()` (`src/data/exercises.ts`) built from a new `answerLabel` field via one template — "Identify the {answerLabel}, if there is one." — for every exercise of both concepts, so wording can't drift or leak existence. | Submitted a placed level on `liq-004`: confirmed feedback now leads with "The correct answer was: no Buy-Side Liquidity on this chart." before the distractor reasoning, for both the correct ("No Liquidity Level present") and incorrect (placed a line) responses. Confirmed every exercise of both concepts renders the identical "Identify the {X}, if there is one." template regardless of `has_answer`. |
| 2026-09-11 | `liq-004`'s answer key and explanation were incorrect under the corrected liquidity definition | `liq-004`'s `distractor_note` said the two near-miss highs meant "there's no real liquidity pool here." Under the corrected definition (`docs/CURRICULUM.md`), liquidity rests above *any* swing high — both wicks individually still have a (smaller) pool. The exercise was also framed as "is there buy-side liquidity" (answerLabel: "Buy-Side Liquidity"), a question that's trivially always "yes" under the corrected model, when the real teaching point is narrower: are these two highs equal. | Reframed `liq-004` around the actual question: prompt is now "Mark the equal highs, if there are any."; `answerLabel` changed to "equal highs"; `noAnswerLabel` to "No equal highs present"; rewrote the explanation to state plainly that each wick still has its own small pool, and that what's missing is a second touch reinforcing one shared level. Also re-authored `liq-001/002/003/005` to ask for the *strongest* buy/sell-side liquidity rather than testing existence, since existence is no longer a meaningful question under the corrected definition (see Decision Log). Candle data for all five exercises is unchanged — only the question, answer key, and explanation text. | Submitted a placed level on `liq-004`: confirmed "The correct answer was: no equal highs on this chart." followed by the corrected explanation, for both the correct and incorrect responses. Confirmed `liq-001`'s explanation now states the two-touches-means-stronger reasoning explicitly. |

---

*For educational and practice purposes only. Not financial advice.*
