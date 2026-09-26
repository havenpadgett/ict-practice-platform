# Curriculum Review Brief

*Prepared 2026-09-25 by Claude (AI-DRAFTED), for Haven's review of every AI-DRAFTED definition in [CURRICULUM.md](CURRICULUM.md).*

This is a checklist, not a defence. Each section gives:
- the definition in plain language;
- claims that could be wrong, as yes/no questions (answer "no" and the definition needs changing);
- which exercises depend on it;
- what breaks if it changes;
- where two reasonable traders would label the same chart differently.

Where I'm genuinely unsure, I say so.

**Order:** by risk, meaning exercises affected (directly and downstream) times how likely the definition is to be wrong. Clause-by-clause checks against real data are in [DETECTION-AUDIT.md](DETECTION-AUDIT.md), cited as *(audit)*.

**Counting convention:**
- **"constructed":** hand-built exercises in `src/data/*.ts`. They are live in practice.
- **"real":** scenarios in `src/data/real-scenarios/`. All 50 are awaiting review, so none are live.
- **Curriculum version:** each definition carries one in `src/data/curriculum-versions.json`. Changing it flags every derived exercise for re-review (see the end of this doc).

## Summary

| # | Definition | Direct exercises | Downstream | Real uncertainty? |
|---|---|---|---|---|
| 1 | Market Structure Shift | 15 (5 constructed, 10 real) | +30: every Guided Entry and Free Trade bias | **Yes.** Three clauses aren't enforced by detection |
| 2 | Guided Entry rules (bias, entry, stop, target, R:R) | 30 (5 + 10 Guided, 5 + 10 Free Trade) | — | **Yes.** The generator uses an entry type the definition doesn't list; "not a minor swing" isn't operational |
| 3 | FVG respected / disrespected | 10 (5 FVG choice, 5 IFVG choice) | +5 IFVG zone exercises, the Guided "unmitigated" test | **Some.** No-reaction and never-revisited cases are undefined |
| 4 | Inverse FVG | 10 constructed | +1 (guided-005 entry) | **Yes.** Unclear whether a retest is required before it counts |
| 5 | Order Blocks | 5 constructed | +2 real (real-guided-006, real-ft-003 entries) | **Yes.** Every operational number is mine |
| 6 | Premium & Discount | 5 constructed | — | **Yes.** Swing choice and the 45–55% band are mine |
| — | Also AI-drafted, lower risk (end of doc) | Free Trade grading rules (15), time-based session boundaries (5), detection parameters (all real) | | Mostly low |

**Six definitions carry real uncertainty (1–6).** All six have at least one clause I couldn't verify against a source.

---

## 1. Market Structure Shift (MSS)

**As written:**
- Market structure is the sequence of swing highs and lows.
- In an uptrend (higher highs and higher lows), an MSS is when price **fails to make a new higher high** and then a **candle body closes below the most recent higher low**. A downtrend is the mirror.
- A wick through doesn't count. Breaking a *minor internal* swing doesn't count. An *immediate reversal* back through the level makes it weak.
- A break in the trend's own direction is continuation, not an MSS.
- On NY AM charts, structure is read from 07:00 ET (AI-DRAFTED, 2026-09-24).

**Yes/no:**
1. Must price **fail to make a new high first**? The code records this but doesn't require it; 5 of 20 sampled MSS broke the level without failing first *(audit)*.
2. Is a **body close** the confirmation, rather than a wick or a close on a higher timeframe?
3. Is the level the **most recent** higher low, not the low that started the leg or the lowest low of the range?
4. Is a swing a **lookback-2 fractal** (a high above the 2 bars before it and at least as high as the 2 after)? This is what separates "structural" from "minor internal" in code today.
5. Should an MSS with an **immediate reversal** (a close back above the level within 2 bars) be *excluded* rather than kept as "weak"? The code doesn't check this; 8 of 20 sampled MSS reversed within 2 bars *(audit)*.
6. Must an MSS be **accompanied by displacement** (or leave an FVG)? The definition says "often". If you'd say "must" (and count leaving an FVG as the test), 255 of the 435 detected 5m MSS would drop out: only 41% leave an FVG between the broken swing and two bars after the break.
7. Is **07:00 ET** the right start for NY AM structure (vs 08:30, 04:00, or the prior session)?
8. Does a trend need **both** the last two highs and the last two lows moving the same way? The code requires both; many traders need only the highs (uptrend) or only the lows.

**Exercises (15 direct):**
- Constructed: `mss-001`…`mss-005`.
- Real: `real-mss-001`…`real-mss-010`.
- Downstream: the bias step of `guided-001`…`005`, `ft-001`…`005`, and all 20 real Guided and Free Trade scenarios.

**If it changes:**
- `detect.py` (`detect_mss`) and `setups.py` (bias) need editing.
- All 10 real MSS scenarios and 20 real trade scenarios must be regenerated or re-reviewed.
- Constructed MSS and Guided exercises must be re-checked by hand.
- Clause 1, 5 or 6 would *remove* candidates. That shrinks the real pool, which is already thin (435 MSS; only 20 valid Guided setups).

**Where traders would disagree:**
- **Structural vs internal:** the definition relies on this, but a lookback-2 fractal can be a two-bar wiggle. By a proxy (the broken swing's leg is at least one median bar range), 7 of 20 sampled and 4 of 7 real 5m MSS were small swings *(audit)*.
- **Which trend is prevailing** when the 07:00 context and the 9:30 session disagree.

**My uncertainty:** high on clauses 1, 5 and 6. I wrote them as teaching language, and the code implements a looser rule than the words.

---

## 2. Guided Entry rules (also used by Free Trade)

**As written:**
- **Bias:** bullish after a bullish MSS with sell-side liquidity already taken (mirrored for bearish); otherwise unclear.
- **Entry:** only at an unmitigated FVG, an IFVG, or a retest of the broken structural level. Never open space.
- **Stop:** beyond the swing that formed the setup.
- **Target:** the next opposing liquidity pool ("not the next minor swing").
- **R:R:** reward ÷ risk must be at least 2:1.
- **No Trade:** if any step fails.

**Yes/no:**
1. Does bias require a **prior liquidity sweep** (the setup low took an earlier swing low), not just an MSS?
2. Is **"the previous swing low"** the right liquidity to have been swept? Or should it be a named pool (equal lows, previous-day low, session low)?
3. Is the entry list **complete**? In particular, is an **order block** a valid entry? The definition doesn't list it, but the real-data generator uses one when no FVG exists: `real-guided-006` and `real-ft-003` *(audit)*.
4. Is the entry price the **midpoint** of the zone? Real scenarios use the midpoint; constructed `guided-001` uses a price near the proximal edge (21,335 in 21,328–21,350).
5. Is "unmitigated" a **body close through the far side**? Or does any trade back into the gap count as mitigation?
6. Is the stop **just beyond** the extreme? Real scenarios use 0.1 × median bar range; constructed ones use ~5 points.
7. Is the target the **nearest** untaken opposing swing? The code does this. The definition says "not the next minor swing", and the code has no test for minor.
8. Is **2:1** the minimum? Is it measured from the planned entry, not the fill?
9. Is "No Trade when the best R:R is under 2:1" right even when a *different* valid target further out would give 2:1?

**Exercises (30):**
- Guided Entry: `guided-001`…`005` and `real-guided-001`…`010`.
- Free Trade: `ft-001`…`005` and `real-ft-001`…`010`.

**If it changes:**
- `setups.py` and `build_trade_scenarios.py` need editing.
- All 20 real trade scenarios must be regenerated.
- Constructed `step_explanations` need rewriting.
- The Free Trade grading zones (entry zone, stop zone) are derived from these rules.

**Where traders would disagree:**
- **Target:** "nearest liquidity" is the weakest clause. One trader targets the session high, another the nearest swing, a third a higher-timeframe level.
- **Sweep:** "which side's liquidity was targeted" is unclear on choppy mornings.

**Known disagreements** *(audit)*:
- The generator uses order-block entries, which the definition's list doesn't include.
- In 3 of 20 valid sessions, the entry FVG was closed through before the chart ends. None of these are among the 20 real scenarios.

**My uncertainty:** high on 3, 4 and 7.

---

## 3. FVG respected / disrespected

**As written:**
- After an FVG forms, it is **respected** while no candle **body** closes beyond its far boundary.
- It is **disrespected** the moment one does.
- Wicks into or through the gap don't count.

**Yes/no:**
1. Is the far boundary the test? That is, does a body close *inside* the gap still count as respected?
2. Is **one** body close beyond enough to disrespect it (no displacement needed)?
3. If price returns, closes inside the gap, and then **goes sideways without continuing**, is that still "respected"? The definition says respected, and adds "so price continues", which reads as a consequence, not a condition.
4. If price **never returns** to the gap, is it "respected"? No exercise tests this; the definition doesn't say.
5. Is there a **time limit**, e.g. the gap only matters within the session?

**Exercises (10 direct):**
- `fvg-resp-001`…`005`.
- `ifvg-resp-001`…`005`, which apply the same test to the flipped zone.
- Downstream: every IFVG zone exercise (the flip is defined by disrespect) and Guided Entry's "unmitigated FVG".

**If it changes:**
- `correct_choice` on up to 10 exercises.
- IFVG answer keys, where the flip candle moves.
- Guided `step_explanations`.

**Where traders would disagree:**
- `fvg-resp-005`: price chops inside the gap for two candles before breaking. It is marked disrespected, and the explanation argues a pause isn't a reaction. Some traders would say the gap was "respected then lost".

**My uncertainty:** moderate. The body-close principle itself is HAVEN-VALIDATED; its application to the edge cases (3, 4) isn't.

---

## 4. Inverse FVG (IFVG)

**As written:**
- An FVG that has been disrespected (a body close beyond its far boundary)
- and which then acts as the **opposite** level when price returns.
- A failed bullish gap becomes resistance; a failed bearish gap becomes support.

**Yes/no:**
1. Is it an IFVG **as soon as it's disrespected**, or only once price has **returned and reacted** from the other side? The zone exercises mark it after the flip; the wording "then acts as" implies a retest.
2. Is the IFVG zone the **original gap's boundaries**, unchanged?
3. Can any FVG become an IFVG, including one smaller than the FVG floor?
4. When two gaps overlap or stack (`ifvg-003` has two), is only the one that was disrespected the answer?
5. Is disrespect by a single body close enough, or must the break be a displacement?

**Exercises (10 constructed):**
- Zone exercises: `ifvg-001`…`005`.
- Choice exercises: `ifvg-resp-001`…`005`.
- `guided-005` uses an IFVG entry.
- No IFVG detection or real scenarios exist *(audit)*.

**If it changes:**
- Answer keys on `ifvg-001`…`005` if a retest becomes required (several charts have one, but not all were checked for it).
- Adding IFVG detection would be new code, not a change.

**Where traders would disagree:**
- Clause 1 is the classic split: some mark the IFVG the moment the gap fails, others only after a successful retest.

**My uncertainty:** high on clause 1.

---

## 5. Order Blocks

**As written:**
- The last opposing candle before a displacement that breaks structure.
- **Zone:** the candle's full high–low range.
- **Displacement:** 1–3 same-direction candles covering at least 2 × the median bar range.
- **Structure break:** the first body close beyond the most recent confirmed swing, in either direction (continuation counts).
- **Mitigated:** price returns and reacts. **Invalidated:** a body closes through the block.
- The core definition is Haven's; every number is mine.

**Yes/no:**
1. Is the zone the **full high–low range**, rather than the body, or open to 50% (the "mean threshold")?
2. Is it **only the last** opposing candle, or all consecutive opposing candles before the move?
3. Does a **continuation** break (with the trend) produce a valid order block, or only a shift (an MSS)?
4. Is **2× the median range within 1–3 candles** a fair stand-in for "genuine displacement"? At 1.5× there would be ~2× as many order blocks; at 2.5×, half as many.
5. Is a **doji** before the move correctly excluded?
6. Is **invalidation** a body close through the whole block, rather than through its midpoint?
7. Must the displacement **leave an FVG** to count? Many ICT teachers say yes; the code doesn't require it. On 5m NY AM, 171 of the 207 detected order blocks do leave one, so requiring it would drop 36.

**Exercises:**
- Constructed: `ob-001`…`ob-005`.
- Downstream: entries in `real-guided-006` and `real-ft-003`, which are also a definition disagreement (see §2).
- No real order-block recognition scenarios.

**If it changes:**
- `detect.py` (`detect_order_blocks`) and the 5 constructed charts, which were generated to satisfy these exact numbers and would need regenerating.
- The two real trade scenarios above.

**Where traders would disagree:** clauses 1, 2 and 7 are genuinely contested among ICT educators.

**My uncertainty:** high. These are my operational choices, checked only against the data's counts, not against a source.

---

## 6. Premium & Discount

**As written:**
- **Dealing range:** the most recent swing high and swing low that price hasn't traded beyond.
- **Equilibrium:** the midpoint.
- **Premium:** the last close above 55% of the range. **Discount:** below 45%. In between is equilibrium.
- Premium favours selling; discount favours buying.

**Yes/no:**
1. Is the dealing range the **most recent unbroken swing pair**? The alternatives are the swings of the current leg, the session's range, or a higher-timeframe range.
2. Is **current price the last close**, not the last traded price?
3. Is an **equilibrium band** (45–55%) right? Or is every price strictly premium or discount?
4. Is "premium favours selling" true **regardless of bias**? ICT usually teaches "buy in discount *in a bullish context*", which is conditional.
5. When the latest swings are broken, should the rule fall back to an **older intact** pair? The code reports no range at all, and did so in 390 of 736 sessions *(audit)*.

**Exercises:** `pd-001`…`pd-005`, constructed. No real scenarios.

**If it changes:**
- Correct answers on up to 5 exercises, especially `pd-003` (63%) and `pd-005` (51%, the equilibrium case).
- The equilibrium band drawn on the chart after grading.

**Where traders would disagree:** clause 1 is the big one. On the same chart, "the dealing range" can be three different ranges.

**My uncertainty:** high on 1, 3 and 4.

---

## Also AI-drafted (lower risk)

- **Free Trade grading rules** (15 scenarios):
  - Stop zone = setup extreme to 1× median range beyond it.
  - A candle touching both stop and target counts as the stop.
  - Target is graded only through R:R (a known gap).
  - Question: should a far-away target that inflates R:R fail?
- **Time-based session boundaries** (`tliq-001`…`005`): trading day 18:00–17:00 ET and week Sun 18:00–Fri 17:00. Both are standard CME conventions. Low risk.
- **Detection parameters:** FVG floor 0.25× median range; equal highs/lows 0.05%; MSS context 07:00. These change which real candidates exist, not constructed answer keys. The reasoning and counts are in CURRICULUM.md.

## How a definition change is handled now

Every definition above is a "## " section of CURRICULUM.md with an id, a version and a hash of its text in `src/data/curriculum-versions.json`. The same file records:
- which detection rules depend on which definitions (`rules`);
- which constructed exercise groups depend on which definitions, and the version each group was last checked against (`constructed`, matched by id prefix: `mss-`, `guided-`, …).

Real scenarios record the versions they were built and approved under in `provenance.curriculum_versions`.

**When you change a definition:**
1. **Edit its text.** `npm test` now fails: `<id> changed without a version bump`. A definition can't change silently.
2. **Bump the version:** `npm run curriculum -- bump <id>`. `npm test` then fails again, listing every exercise built under the old version, constructed and real.
3. **Constructed exercises:** re-check each listed exercise against the new wording, fix its answer key or explanation if needed, then run `npm run curriculum -- verify <prefix> <id>` (e.g. `verify mss- mss`).
4. **Real scenarios:** they go back into the `/review` queue marked "Needs re-review: … changed", and **leave practice until re-approved** (`isPracticeReady` checks the versions). Approving records the current versions. Pending ones can also be rebuilt with the scripts, which read the current versions.

Checked on 2026-09-25 by editing the MSS text:
- The hash test failed.
- After `bump mss`, the test listed `mss-001`…`005`, `guided-*`, `ft-*`, `ob-*`, `pd-*` and all 30 MSS-dependent real scenarios (MSS, Guided Entry and Free Trade).
- Restoring the file cleared it.
