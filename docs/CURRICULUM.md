# Curriculum

Source of truth for concept definitions. Every exercise's answer key is written against this document. No AI-generated definition may override it — if code, an explanation, or a distractor note disagrees with this file, this file is right and the code is a bug.

**Provenance:** every definition below is tagged **HAVEN-VALIDATED** (Haven checked it against source material independently) or **AI-DRAFTED** (written by AI and approved by Haven on a read-through, without independent verification against source material). Treat an AI-DRAFTED definition as needing review before anyone other than Haven uses the app — a quick approval is not the same guarantee as independent validation.

**Versioning (2026-09-25):** every "## " section below is a versioned definition (`src/data/curriculum-versions.json`, managed by `npm run curriculum`). To change one:
1. Edit the text.
2. Run `npm run curriculum -- bump <id>`.
3. Every exercise built on it is flagged for re-review:
   - `npm test` fails and lists the constructed ones;
   - `/review` requeues the real ones, and they leave practice until re-approved.

The workflow is in [CURRICULUM-REVIEW.md](CURRICULUM-REVIEW.md).

## Fair Value Gap (FVG)

**Provenance:** HAVEN-VALIDATED.

**As currently implemented:** a three-candle formation where candle 1's high sits below candle 3's low (bullish) or candle 1's low sits above candle 3's high (bearish), leaving an unfilled imbalance.

## Liquidity

**Provenance:** HAVEN-VALIDATED.

**What it is:** resting stop orders. Traders place stops above highs and below lows, so those areas become pools of orders that price is drawn toward.

- **Buy-side liquidity** sits above highs (stops from short positions).
- **Sell-side liquidity** sits below lows (stops from long positions).

**Where it rests:** above any swing high and below any swing low. A single wick has a pool above it.

**Strength:** equal highs or equal lows hold a larger pool, because orders from multiple touches cluster at the same price. More touches at a level means more stops resting there. A single wick is a small pool; equal highs/lows is a big one.

> **Correction (2026-09-11):** this replaces an earlier incorrect working definition that treated liquidity as valid *only* at equal highs/lows. See the Decision Log in `docs/PRD-MVP-V1.md`.

## Market Structure Shift (MSS)

**Provenance:** AI-DRAFTED — approved by Haven on a read-through, not independently verified.

**Market structure** is the sequence of swing highs and lows. An uptrend makes higher highs and higher lows; a downtrend makes lower highs and lower lows.

**A Market Structure Shift** is when that sequence breaks against the prevailing direction — in an uptrend, price fails to make a new higher high and then breaks below the most recent higher low (mirrored for a downtrend: price fails to make a new lower low and then breaks above the most recent lower high).

- **Confirmation:** a candle body closes beyond the swing point, not just a wick through it. Often accompanied by a strong displacement move, which frequently leaves an FVG.
- **Weak or invalid:** only a wick through the level; a break of a minor internal swing rather than a structural one (see **Minimum structure** below); an immediate reversal back through the level.
- **Not an MSS:** a break in the same direction as the trend — that is continuation, not a shift.
- **Terminology:** this project uses MSS. Do not introduce BOS or CHoCH terminology.

### Minimum structure (AI-DRAFTED, 2026-09-30 — pending Haven's review)

**The gap this closes:** `detect_mss` reads "higher high" / "higher low" as a strict price comparison between the two most recent lookback-2 fractal swings, with no minimum move. A fractal only needs to be higher than its two neighbours on each side, so a one- or two-point wiggle inside normal noise qualifies exactly the same as a genuine trend leg. `real-mss-007` (flagged ambiguous 2026-09-30) was exactly this: the bearish break itself was clean, but the "uptrend" it broke was a swing high +3.75 and a swing low +2.5 above the previous ones — 0.33x and 0.22x the session's median bar range, not a real higher high/higher low a trader would draw.

**The requirement:** a swing only counts toward "higher high" / "higher low" (or the downtrend mirror) if it moved **at least 0.25× the trailing median bar range** beyond the previous swing of the same type. Below that, the pair doesn't establish or continue a trend, and no MSS is read from it. `scripts/detect.py --mss-min-swing-mult` (default 0.25, matching the FVG floor's use of the same multiple — see Detection Parameters below). Nothing else about MSS changed: swing lookback 2, structure context, and body-close confirmation are the same.

**Why 0.25× and not a bar-count or a strict-alternation rule:** three candidates were tested against the full Dec 2022–Dec 2025 dataset (5m NY AM +07:00 context, 15m RTH):

| Candidate | What it requires | 5m NY AM MSS (baseline 435) | 15m RTH MSS (baseline 161) | Fixes `real-mss-007`? |
|---|---|---|---|---|
| **Minimum swing magnitude** (chosen) | each new same-type swing moves >= mult x median bar range past the last one | 340 @ 0.25x · 255 @ 0.5x · 166 @ 1.0x | 104 @ 0.25x · 71 @ 0.5x · 34 @ 1.0x | **Yes**, already at 0.25x (0.33x/0.22x both below) |
| Minimum bars between swings | consecutive same-type swings >= N bars apart, closer ones collapse to the more extreme | 435 @ N=3 · 399 @ N=5 · 260 @ N=8 | 161 @ N=3 · 110 @ N=5 · 41 @ N=8 | Only at N>=5 (≈25 min on 5m, 75 min on 15m — the same bar range varies too much by volatility to fix at one N) |
| Prevailing-trend sequence (strict alternation: highs and lows must alternate in time, collapsing repeats to the more extreme) | 391 | 128 | **No** — `real-mss-007`'s swings already alternate; the problem is size, not order |

Minimum swing magnitude is the only one of the three that actually fixes the case it was written for, at the mildest threshold tested. Min-bars needs a threshold well past what fixes the flagged case, and — like the 10-point FVG floor and 15-point equal-highs tolerance superseded in Detection Parameters below — a fixed bar count doesn't scale with volatility or timeframe (5 bars is 25 minutes on 5m data and 75 minutes on 15m). Alternation is orthogonal to the actual problem: `real-mss-007`'s swings never had an ordering issue, only a magnitude one. 0.25x reuses the FVG minimum's exact multiple and reasoning (below that, the move isn't legibly different from noise), so MSS, FVG, and Order Blocks now share one scale-with-volatility idiom instead of three.

**Scope:** this requirement changes how `detect_mss` reads "higher high" / "higher low" only. It does not change the underlying lookback-2 fractal swing points themselves — Order Blocks' structure break and the dealing range's swings (Premium and Discount, below) still read the raw fractal list, unfiltered by this rule.

**Existing real scenarios:** re-run against the tightened rule, 6 of the 15 `real-mss-*` scenarios built before 2026-09-30 no longer qualify (`real-mss-004`, `-007`, `-008`, `-009`, `-011`, `-012` — see the Ambiguous Log in docs/SCENARIO-VALIDATION.md for each one's specific swing move). They were flagged `review_status: "ambiguous"` and pulled from practice rather than deleted, pending Haven's confirmation.

**Structure context on session charts (AI-DRAFTED, 2026-09-24 — pending Haven's review).** When a chart covers only the NY AM session (9:30–11:00 ET), the trend and swing points are read from **07:00 ET** onward. The break that confirms the MSS must still happen inside the session. Real NY AM scenarios therefore show the 07:00–9:30 bars as context. Nothing else changed: swing lookback 2 and the body-close confirmation are the same.

*Why:* only 35 MSS were found in 736 NY AM sessions, and 18 of 37 months had none. The investigation (5m bars, Dec 2022–Dec 2025) showed the cause is the 90-minute window, not the confirmation rule:
- **Structure has to start from nothing at 9:30.** With 18 bars and a lookback of 2, only 34% of sessions ever confirm the two swing highs and two swing lows a trend needs, and only 24% ever show a clear up- or downtrend.
- **Body-close confirmation is not the bottleneck.** On NY AM-only charts, a wick through the swing happens in 7% of sessions and a body close in 6%. With context, the figures are 75% and 61%.
- **A shorter lookback isn't the answer.** Lookback 1 raises NY AM-only MSS to 228, but only by treating minor internal swings as structure — the "weak or invalid" case above. Lookback 3 or 4 leaves almost none (2 and 0).
- **Structure before the open is what's missing.** With the same rule, counting only breaks inside 9:30–11:00:

| Structure read from | Lookback 2 | Lookback 3 | Months with none (lookback 2) |
|---|---|---|---|
| 9:30 (session only) | 35 | 2 | 18 / 37 |
| 8:30 | 202 | 63 | 0 / 37 |
| 8:00 | 349 | 161 | 0 / 37 |
| **7:00** | **435** | **312** | **0 / 37** |
| 4:00 | 437 | 364 | 0 / 37 |

  07:00 captures essentially all of it: going back to 04:00 adds 2 at lookback 2. It keeps a chart to 48 bars at 5m. Over a full 5m RTH session the rule finds 1.63 MSS per session, so shifts are common; the 90-minute window was simply too short to show the structure they break. The 15m RTH data (26 bars per session) already has enough structure and is unchanged.

## Detection Parameters (real data)

**Provenance:** AI-DRAFTED (2026-09-24) — chosen by Claude from the full Dec 2022–Dec 2025 NQ dataset under Haven's delegated authority; pending Haven's review. These are the defaults in `scripts/detect.py`. They decide which real-chart setups count as candidates (and therefore which answer keys exist), not how user answers are graded.

**Why adaptive:** the first thresholds — a 10-point FVG floor and a 15-point equal-highs tolerance, set 2026-09-24 — came from ten unusually volatile sessions (Nov 10–21 2025, median 5m bar range 62.5 points). Across the full dataset the median 5m NY AM bar range varies from 21 to 65 points by month and price ranges from 11,500 to 25,000. A fixed 10-point floor threw away far more gaps in calm months than in volatile ones: the monthly FVG rate tracked volatility with a correlation of +0.80. A fixed 15 points is 0.06% of price at 25,000 but 0.13% at 11,500. Both thresholds now scale with the market.

### FVG minimum size: 0.25 × trailing median bar range

A gap counts as an FVG only if it is at least **0.25 × the median high–low range of the 100 bars ending at candle 1**. Only past bars are used, so there's no lookahead. The same multiple applies to every timeframe.

**How it was chosen:**
- **First test: do bigger gaps behave differently? They don't.** For every gap on 5m NY AM, 5m RTH and 15m RTH, the test measured how often price, after returning into the gap, moved one median bar range away in the gap's direction before a body closed through the far side. That was compared with a same-size, same-direction zone placed at a random bar in the same session. At every size from 0.05× to 1× the median range, real gaps did no better than the random zones: the difference was within about ±5 points on 5m RTH, the largest sample. The only exception was 15m gaps over 1×, at +12 points.
- **So "noise" can't be defined by what happens after the gap.** It is defined by legibility instead: a beginner has to be able to see the gap. On a one-session chart the price span is typically 4.6× (5m NY AM) to 5.9× (15m RTH) the median bar range. At 0.25× a median-sized gap is about 16–21 px of the 380 px plot, roughly 8–10 px on a phone. At 0.1× it is 3–4 px on a phone, which can't be distinguished from candles touching.
- 0.25 also sits just above the 0.2× that reproduced the earlier 10-point floor in November 2025.
- **Consequence for the definition:** a three-candle gap smaller than the floor is not treated as an FVG in any real scenario. When real scenarios are built, windows are chosen so that no smaller gap is visible, so a beginner is never marked wrong for spotting one.

### Equal highs/lows tolerance: 0.05% of price

Swing highs (lows) count as equal when they are within **0.05% of the first touch's price**: about 6 points at 11,500 and 12.5 points at 25,000.

**How it was chosen:** a liquidity exercise grades a placed line against the pool's average price with a tolerance of half the window's median bar range (`build_scenario.py`). For the answer key to be fair, every touch in a pool must sit inside that tolerance. 0.05% is the widest setting where that holds for 90% of the dataset on both timeframes: the spread is at most 0.43× the median bar range (5m) and 0.38× (15m) at the 90th percentile. At 0.06% the 5m figure is already 0.52×, over the line.

| Tolerance | 5m NY AM highs / lows (per session) | 15m RTH highs / lows (per session) |
|---|---|---|
| 0.03% | 102 / 92 (0.26) | 213 / 181 (0.54) |
| 0.04% | 138 / 118 (0.35) | 254 / 232 (0.66) |
| **0.05%** | **168 / 139 (0.42)** | **298 / 267 (0.77)** |
| 0.06% | 185 / 160 (0.47) | 332 / 299 (0.86) |
| 0.08% | 242 / 205 (0.61) | 404 / 353 (1.03) |
| 0.10% | 278 / 231 (0.69) | 454 / 416 (1.18) |
| 0.12% | 301 / 255 (0.76) | 491 / 458 (1.29) |

> Superseded (2026-09-24, same day): FVG minimum 10 points on 5m and equal tolerance 15 points (both HAVEN-VALIDATED from the Nov 2025 slice). An interim adaptive version (0.2×, 0.06%) calibrated to reproduce those point values in November 2025 was never committed.

## Detection thresholds by difficulty tier

**Provenance:** AI-DRAFTED (2026-09-30) — chosen by Claude under Haven's delegated authority; pending Haven's review.

**Kept as a separate section on purpose:** this describes a difficulty-3-only detection pass layered on top of the FVG/Equal-highs-lows/Order-Blocks defaults above. It doesn't change what those defaults are or how existing difficulty-1/2 content was calibrated, so it's versioned separately from Detection Parameters (real data) — editing this section re-reviews difficulty-3 relaxed-profile content only, not every piece of real content those other defaults back.

The multiples above are calibrated for **legibility** — a beginner has to be able to see the setup — which is a difficulty-1/2 concern. A difficulty-3 exercise is supposed to be hard to read: a real, valid setup sitting close to the floor of what still counts. Rather than lower the multiples project-wide (which would let difficulty-1/2 content drift toward noise too — the exact failure the Minimum structure section above and the original FVG/tolerance calibration were both written to prevent), `scripts/detect.py`'s CLI flags support a **difficulty-3-only relaxed profile**, run as a separate detection pass whose candidates are only ever built with `--difficulty 3`:

| Parameter | Default (all tiers) | Relaxed (difficulty 3 only) |
|---|---|---|
| `--fvg-min-range-mult` | 0.25 | 0.15 |
| `--equal-tolerance-pct` | 0.05% | 0.12% (the widest value tested in the table above) |
| `--ob-displacement-mult` | 2.0 | 1.5 (the floor tested in Order Blocks, below) |
| `--mss-min-swing-mult` | 0.25 | unchanged — not part of this profile |

**The defaults in `detect.py` do not change** — a fresh `python3 scripts/detect.py <clean>` with no flags still uses 0.25 / 0.05% / 2.0, so every difficulty-1/2 real scenario and the main candidates files (`data/clean/nq_nyam_ctx.5m.candidates.json`, `nq_rth_full.15m.candidates.json`) are untouched. The relaxed profile is only ever invoked explicitly, into a separate candidates file, for a difficulty-3 batch.

**Generating a batch means expecting rejections.** `build_scenario.py` still enforces the PRD's one-valid-answer rule — no other candidate of the same rule in the window, and (for FVG) no other visible gap at or above `--visible-gap-mult` (0.1× by default) anywhere in frame. At 0.15× FVG floor, almost every full-session window has a second gap somewhere between 0.1× and 0.15× that now counts as "visible" without being the target candidate — that's the mechanism, not a bug. A first batch attempt (22 relaxed FVG candidates on 5m NY AM, 16 on 15m RTH, one build attempt each, no retry) built **1 of 38**. A broader sweep across the full relaxed FVG pool (not spread-by-date, since spread sampling kept hitting the same failure) found enough clean windows to round the batch out. Equal highs/lows and Order Blocks rejected far less often at these settings (Equal highs/lows: 3/6 across both timeframes in the spread sample; Order Blocks: 5/7) since their ambiguity check only looks for *another candidate of the same rule*, not a second near-miss anywhere in frame. Across every rule and both timeframes, the first representative sweep built 12 of 54 attempts (78% rejected) — a non-zero, occasionally very high rejection rate is the expected behavior of this profile, not a sign it's broken.

**First difficulty-3 batch** (2026-09-30, awaiting review): `real-fvg-016`–`021` (6), `real-liq-016`–`021` (6), `real-ob-009`–`013` (5) — 17 scenarios, all `difficulty: 3`, `provenance.detection_params` recording the relaxed multiples used.

## Fair Value Gap — Respected vs. Disrespected

**Provenance:** AI-DRAFTED — approved by Haven on a read-through, not independently verified. (The body-close-not-wicks principle this definition applies is itself HAVEN-VALIDATED, below — what's AI-drafted here is its application to gap invalidation specifically.)

**What it is:** after an FVG forms, price may later trade back into it. An FVG is **respected** as long as no candle *body* closes beyond the far boundary of the gap — price may wick into or through the zone without invalidating it, and the imbalance holds, so price continues in the original direction. An FVG is **disrespected** the moment a candle body closes beyond the far boundary.

- **Bullish FVG:** respected while no candle body closes below the gap's lower boundary. Disrespected when a candle body closes below it.
- **Bearish FVG:** respected while no candle body closes above the gap's upper boundary. Disrespected when a candle body closes above it.

**Shared principle — confirmation by body close, not wicks (HAVEN-VALIDATED):** this project confirms events by candle body closes rather than wicks. This is the same rule used for [MSS confirmation](#market-structure-shift-mss) above, applied here to gap invalidation.

**Applies to:** FVG and IFVG only — not Liquidity or MSS, which don't have a "gap" for price to return to.

## Inverse Fair Value Gap (IFVG)

**Provenance:** AI-DRAFTED — approved by Haven on a read-through (2026-09-19), not independently verified. Exercises have been built against this definition on that approval; treat the definition itself as still needing review before anyone other than Haven uses the app.

**What it is:** an Inverse Fair Value Gap is an FVG that has been disrespected — a candle body closed beyond its far boundary — and which then acts as the opposite kind of level when price returns to it. A bullish FVG that fails becomes resistance; a bearish FVG that fails becomes support.

**Confirmation:** the flip is confirmed the same way as [respected/disrespected](#fair-value-gap--respected-vs-disrespected) above — by a candle body close, not a wick.

## Order Blocks

**Provenance:** AI-DRAFTED (2026-09-24). The core definition was given by Haven; the operational details were chosen by Claude. Pending Haven's review.

**What it is:** the **last opposing candle before a displacement move that breaks structure**. For a bullish block, that is the last down-close candle before a strong move up; for a bearish block, the last up-close candle before a strong move down. It marks where institutional orders were placed. The zone is that candle's range.

- **Confirmation:** the move away must be a genuine **displacement**, not ordinary movement, and it must **break a structural level**. A fast move that stalls below the last swing high is just a bounce, so there's no order block.
- **Mitigated:** price later returns into the block and reacts. It trades into the zone and a candle then closes back out on the favourable side (above the block for bullish, below for bearish).
- **Invalidated:** a candle **body closes through** the block (below its low for bullish, above its high for bearish). Wicks through it don't count. This is the same body-close principle used for FVG respect and MSS.

**Operational details (AI-DRAFTED):**
- **Zone = the candle's full high–low range**, not just its body. The wicks are part of where the orders filled, and a range is easier for a beginner to see and draw than a body.
- **Structure break** = the first body close beyond the most recent confirmed swing (the same lookback-2 fractal swings as MSS). A break in the trend's own direction counts too, so an order block can form on a continuation as well as on a shift. On NY AM charts the swings are read from 07:00 ET, the same structure context as MSS. The block itself and the break must be inside the session.
- **Displacement** = **1 to 3 consecutive candles closing in the move's direction**, ending with the break candle, that cover at least **2× the trailing median bar range** from the first candle's open to the break candle's close. That is the same median-range measure as the FVG floor. Twice a typical bar's range within at most three candles is clearly faster than normal movement. A slow grind that eventually breaks a swing doesn't qualify, however far it goes. The candle right before the leg must actually close the opposite way; a doji is not an order block.

**How often it appears** (Dec 2022–Dec 2025, the same data as the other rules): 207 order blocks on 5m NY AM (79 bullish, 128 bearish), in 188 of 736 sessions (26%). There are 209 on 15m RTH (75 bullish, 134 bearish), in 177 of 736 sessions (24%). Within the session they formed in:

| | Mitigated | Invalidated | Neither |
|---|---|---|---|
| 5m NY AM | 60 | 15 | 132 |
| 15m RTH | 67 | 17 | 125 |

The displacement threshold decides most of the count:

| Displacement threshold | 1.5× | 2× | 2.5× |
|---|---|---|---|
| 5m NY AM | 398 | 207 | 101 |
| 15m RTH | 383 | 209 | 123 |

**Exercises** (`src/data/order-block-exercises.ts`, zone answer type, constructed and verified with the same detection rule):
- a clean bullish block;
- a clean bearish block;
- a bullish block that price later mitigates;
- a bearish block preceded by several up-close candles, where only the last counts;
- a no-answer chart where a sharp bounce off a low stalls below the lower high without breaking structure.

## Premium and Discount

**Provenance:** AI-DRAFTED (2026-09-24) — the core definition was given by Haven; the operational details (which swings, how current price is read, the equilibrium band) were chosen by Claude. Pending Haven's review.

**Dealing range:** the range between a swing high and a swing low. **Equilibrium** is its midpoint.
- **Premium:** price above equilibrium, the expensive half of the range, where **selling is favoured**.
- **Discount:** price below equilibrium, the cheap half, where **buying is favoured**.

**Operational details (AI-DRAFTED):**
- **Which swings:** the most recent swing high and swing low (the same fractal swings as MSS, lookback 2) that price has not traded beyond since they formed. Once price breaks out of the range, that range no longer frames the market, and a new range forms from the next swings.
- **Current price** is the last candle's **close**. A wick that pokes into the other half and gets rejected doesn't move price there, consistent with the body-close rule used for FVG respect and MSS.
- **Equilibrium band:** a close within **5% of the range's height either side of the midpoint** (45–55% of the range) is *at equilibrium*: neither premium nor discount has an edge from location alone. On a 180-point range that is ±9 points. The band exists because a close a point or two from the midpoint would otherwise flip between answers on noise. The teaching point is that location only helps when price is clearly in one half.

**Exercises** (`src/data/premium-discount-exercises.ts`, choice answer type): the chart marks the dealing range's swing high and swing low. The user answers Premium, Discount, or At equilibrium (neither). The equilibrium line and band are revealed after grading. Five constructed exercises cover a deep discount, a high premium, a close-call premium, a discount where a wick spikes above equilibrium but the close doesn't, and one at equilibrium.

**Detection:** `scripts/detect.py` rule `dealing_range`. At the end of each session it reports the current dealing range, its equilibrium, and whether the last close is premium, discount, or equilibrium.

## Guided Entry

**Provenance:** AI-DRAFTED — approved by Haven on a read-through, not independently verified. Exercises have been built against this definition on that approval; treat the definition itself as still needing review before anyone other than Haven uses the app.

**What it is:** a four-step framework for building a trade idea from market structure, rather than testing recognition of a single concept in isolation. Each step depends on the ones before it — a valid setup is a chain, not four independent guesses.

1. **Directional bias** — the expected next move, read from market structure and which side's resting liquidity is likely being targeted. Bullish after a bullish [MSS](#market-structure-shift-mss) with sell-side liquidity already taken (the downside stop-run is done; price is expected to seek buy-side liquidity next). Bearish after a bearish MSS with buy-side liquidity already taken (mirrored). When structure hasn't shifted, or it's unclear which side's liquidity was actually targeted, bias is **unclear** — that's a legitimate answer, not a fallback for not knowing.

2. **Entry** — sits at a level, never in open space. A valid entry is one of:
   - an unmitigated [Fair Value Gap](#fair-value-gap-fvg) (price hasn't traded back through it since it formed),
   - an [IFVG](#inverse-fair-value-gap-ifvg) acting as an inverse level (support after a bearish-to-bullish flip, resistance after a bullish-to-bearish flip),
   - or a retest of a broken structural level (the swing point whose break confirmed the MSS, now acting as support/resistance from the other side).

   An entry that isn't anchored to one of these — a round number, "it looks like it'll bounce here," the middle of a range — is not valid, regardless of how the rest of the setup reads.

3. **Stop loss** — placed beyond the level that would invalidate the idea if reached: below the swing low that formed the setup for a long, above the swing high that formed the setup for a short. Not an arbitrary distance or a fixed point count — it's tied to the specific structural point whose violation means the read was wrong.

4. **Target** — the next opposing liquidity pool. For a long, the nearest buy-side liquidity above; for a short, the nearest sell-side liquidity below. Not the next minor swing or a round-number level — the target is liquidity-based, same as [Liquidity](#liquidity)'s definitions above.

**Risk-to-reward (R:R)** — the distance from entry to target divided by the distance from entry to stop:

```
R:R = (target − entry) / (entry − stop)     // for a long; mirrored for a short
```

**Minimum 2:1 is required for a valid setup.** A setup that's correct on bias, entry, and stop but whose best available target only reaches 1.5:1 is not a valid trade — the framework rejects it on R:R alone.

**No trade** is the correct answer whenever any one of these holds:
- bias is unclear,
- no valid entry level exists (per the definition above),
- or the best available risk-to-reward is below 2:1.

**Why grade the process, not the outcome (PRD Section 13):** a setup that satisfies all four steps and clears 2:1 is a *valid* setup even if the trade would have lost — market structure describes probability, not certainty. Conversely, a setup that happened to work out but skipped a step (no real entry level, R:R below 2:1, bias never actually confirmed) is not a good decision that got lucky. Guided Entry exercises are graded against whether the four-step process was followed correctly, never against what price did afterward.

**Grading severity (Phase B, docs/APP_PERFECTION_PLAN.md; `src/lib/verdict.ts`).** Each step is CORRECT, COULD IMPROVE, or INCORRECT — never a flat pass/fail — and the overall verdict is the worst of its steps, so one imperfect piece never fails an otherwise-sound setup:

- **Entry** is graded as zone membership, not distance from a single "true" price: anywhere inside the valid entry model (an unmitigated FVG, an IFVG, or a retested broken structural level) is CORRECT, including its far edge. Just outside it is COULD IMPROVE; well outside, or anchored to nothing at all, is INCORRECT.
- **Stop** is graded on whether it protects the trade against the specific level that would invalidate the idea, not distance from a reference price. Beyond that level by a reasonable amount is CORRECT; further out is COULD IMPROVE (it still protects the trade, just costs R:R for no benefit — width alone never fails a stop that protects); on the wrong side — it wouldn't actually trigger before the idea is already invalidated — is always INCORRECT, regardless of how close.
- **Target** is graded the same way as entry: inside the liquidity zone is CORRECT, a near miss is COULD IMPROVE, aimed at the wrong thing entirely is INCORRECT.
- **Risk-to-reward** below the 2:1 minimum but at or above 1.5:1 (75% of it) is COULD IMPROVE — a weak but real setup; below that is INCORRECT.
- **Bias** and the **No Trade decision** stay binary: a categorical read is either right or wrong, with no partial credit.
- **Trading a scenario with no valid setup at all is always INCORRECT**, regardless of how well the user's own invented levels read — there's no real level to have been anchored to either way.

### Real-data Guided Entry scenarios (AI-DRAFTED, 2026-09-24 — pending Haven's review)

`scripts/setups.py` applies the four steps above to a real session (5m NY AM, structure read from 07:00 ET) as a chain. Each level comes from detected structure, not typed in:

1. **Bias:** the session's first MSS that breaks inside 9:30–11:00. The setup swing (the extreme between the broken swing and the break) must have **taken the previous confirmed swing on the opposing side** first: for a long, the setup low traded below the prior swing low. An MSS without that sweep is scored *unclear*, as the definition above says ("unclear which side's liquidity was actually targeted").
2. **Entry:** the first Fair Value Gap (at or above the FVG floor) left by the move from the setup extreme to the break, with its third candle at most two bars after the break. If there is none, the [order block](#order-blocks) whose displacement made the break. The entry price is the **zone's midpoint**, and the tolerance is half the zone, so anywhere inside the gap or block passes.
3. **Stop:** **0.1× the median bar range beyond the setup extreme**. That is just past the swing whose violation proves the read wrong, rounded to the tick.
4. **Target:** the **nearest confirmed swing high (low for a short) that is still untaken** when the entry level forms and sits beyond both the entry and current price. This is the next opposing liquidity; not a round number or an arbitrary extension.
5. **R:R** is measured from the entry midpoint. Below 2:1 means no trade.

The stop and target tolerances are half the median bar range, the same rule as liquidity exercises.

**The chart ends three candles after the entry level forms** (or three after the break, or at the session end, when there's no level). The user decides from what was knowable then, not from what price did next. The hand-built Guided Entry charts show the aftermath; real ones deliberately don't.

**How rare valid setups are:** of the 736 NY AM sessions, only **20 (2.7%)** pass the whole chain. The rest:

| Outcome | Sessions |
|---|---|
| No MSS inside the session | 362 |
| MSS but no FVG or order block to enter from | 124 |
| MSS without a liquidity sweep | 104 |
| Best R:R below 2:1 | 71 |
| No untaken target beyond the entry | 55 |

No-trade is the correct answer most days. The real batch mixes 6 valid setups with 4 no-trade sessions, one for each reason except "no untaken target". Those sessions are skipped because there's no clean reference level to teach from.

## Free Trade

**Provenance:** AI-DRAFTED — the mode's rules and all five scenario definitions below were written by AI and have **not** been reviewed by Haven yet. Treat every scenario answer key as pending review before anyone other than Haven uses the app.

**What it is:** historical playback. The user sees a starting window of candles, then reveals the rest one candle at a time — no future candle is rendered, and the chart's price axis is scaled to revealed candles only, so it never hints at where price goes next. At any revealed candle the user may go **Long** or **Short** (a market order filled at that candle's close), then place a stop and a target. The trade closes when a later candle's high/low touches the stop or target; if one candle touches both, the stop is assumed hit first. One trade per scenario. Ending the session without a trade is a **No Trade** decision.

**Graded on process, not outcome** — same principle as [Guided Entry](#guided-entry). Each check is CORRECT, COULD IMPROVE, or INCORRECT (Phase B — see the severity rules under Guided Entry above, which apply here unchanged):

1. **Direction** — matches the scenario's intended bias (read from [MSS](#market-structure-shift-mss) and which side's liquidity was taken). Binary — no partial credit.
2. **Entry** — the fill price sits inside the scenario's ideal entry zone (or COULD IMPROVE just outside it), and only once the setup has actually formed — entering before that is always INCORRECT, regardless of price (an entry at the same price before the MSS isn't the same trade).
3. **Stop** — graded on whether it protects against the swing point that would invalidate the idea, same rule as Guided Entry: beyond it is CORRECT, further beyond is COULD IMPROVE (never a hard fail on width alone), on the wrong side is always INCORRECT.
4. **Target** — the fill's planned exit sits inside the scenario's ideal target zone (or COULD IMPROVE just outside it), graded on its own — not only through the R:R check below. *(Closed the V1 gap this used to have: a target placed far beyond the nearest opposing liquidity used to inflate planned R:R without being caught. It's now graded directly, same zone reasoning as entry.)*
5. **Risk-to-reward** — the user's own planned R:R (the entry, stop, and target they placed) is CORRECT at or above **2:1**, COULD IMPROVE from 1.5:1 up to it, INCORRECT below that.
6. **Trade decision** — traded a scenario that has a valid setup, or sat out one that doesn't. Binary. Trading a no-setup scenario is always INCORRECT overall, regardless of how the placed levels read.

The overall verdict is the worst of every check that applies — one COULD IMPROVE never fails an otherwise-sound trade, but any INCORRECT does. Win/loss and the result in R are reported alongside but never change the verdict: a losing trade with good process passes; a winning trade with bad process fails. A trade still open when the session ends is marked at the last revealed close.

### Scenarios (AI-DRAFTED — pending Haven's review)

All five are hand-authored prototype NQ 5m data (`src/data/free-trade-scenarios.ts`): 40 candles visible at the start, 40 revealed during playback.

| ID | Title | Difficulty | Intended bias | Valid setup? | Ideal entry zone | Stop zone | Target |
|---|---|---|---|---|---|---|---|
| `ft-001` | Sweep and Reclaim | 1 | Long | Yes | 21,335–21,362 (bullish FVG) | 21,250–21,284 | 21,520 (untouched high) |
| `ft-002` | Equal Highs Raid | 2 | Short | Yes | 21,405–21,430 (bearish FVG, forms during playback) | 21,479–21,510 | 21,260 (swing low) |
| `ft-003` | The Retest That Failed | 3 | Long | Yes — but the trade loses | 21,172–21,190 (retest of the broken lower high) | 21,090–21,119 | 21,330 (untouched high) |
| `ft-004` | Range Chop | 2 | None | No — no bias, no level | — | — | — |
| `ft-005` | Too Close to Call | 3 | Short | No — best R:R ≈ 1.4:1 | 21,455–21,470 (reference only) | 21,521–21,550 (reference only) | 21,400 (equal lows, reference only) |

- **ft-001 — Sweep and Reclaim.** Downtrend sweeps a prior low (sell-side liquidity), then a displacement candle closes above the most recent lower high — bullish MSS — leaving a bullish FVG. Long on the pullback into the gap, stop below the sweep low, target the untouched high (buy-side liquidity). Wins.
- **ft-002 — Equal Highs Raid.** Uptrend prints equal highs (a large buy-side pool). The setup forms only during playback: price raids the equal highs, then closes below the recent higher low — bearish MSS — leaving a bearish FVG. Short the pullback into the gap, stop above the raid high, target the sell-side liquidity under the earlier swing low. Wins. Tests patience: nothing is tradable at the start.
- **ft-003 — The Retest That Failed.** Sweep of a prior low, then a close above the lower high — bullish MSS — but no FVG is left behind, so the entry is the retest of the broken structural level. Stop below the sweep low, target the untouched high. **Loses:** the bounce stalls and price runs the stop. Exists specifically to show a correct-process loss passing.
- **ft-004 — Range Chop.** Sideways the entire session; no MSS in either direction, no qualifying FVG, and the one poke above the range is a wick with no follow-through. Correct decision: no trade.
- **ft-005 — Too Close to Call.** A clean bearish MSS after a buy-side sweep, with a bearish FVG — but the nearest sell-side liquidity (equal lows) is so close that the best available R:R from the gap is about 1.4:1, and a typical fill is nearer 1:1. Correct decision: no trade. Price does reach the equal lows, then reverses back through the highs.

### Real-data Free Trade scenarios (AI-DRAFTED, 2026-09-24 — pending Haven's review)

Real sessions use the same setup finder as real Guided Entry (see above). Each scenario is one NY AM day on 5m:
- **Visible at the start:** 07:00–09:25 ET, the structure context.
- **Revealed one candle at a time:** the 9:30–11:00 session.

The answer key comes from the detected levels:
- **Entry zone:** the FVG or order block. Its earliest index is the candle after the zone forms.
- **Stop zone:** from the setup extreme to 1× the median bar range beyond it. Inside the extreme is too tight; further out is too wide.
- **Target:** the nearest untaken opposing swing.

A valid setup is only used if **a later session candle actually closes inside the entry zone**. A Free Trade fill is at a candle's close, so a setup price never returns to can't be traded correctly, and sitting it out would be graded as a missed trade. The batch mixes 4 valid sessions with 6 no-trade sessions. That is one fewer valid than planned: after the Guided Entry batch took 6, only 4 takeable valid sessions were left in the dataset.

**No lookahead:**
- Only revealed candles are passed to the chart, and the price axis is scaled to them alone. This was already true for the hand-built scenarios.
- **During playback on real data the time axis shows times only, not the date.** A date would let the user look up what the market did next. It appears once the scenario ends.
- The title ("Real NY AM session N") doesn't name the day either.

Verified 2026-09-24 against `real-ft-003` by scanning the rendered DOM after each revealed candle:
- The candle count grew by exactly one per click.
- No unrevealed price or timestamp appeared anywhere in the HTML.
- The axis range matched the revealed candles only (19,414–19,488 before playback, when the hidden session goes down to 19,389.5).

**Known limit:** the hidden candles are in the page's JavaScript data, as every exercise's answer key is. They are never in the DOM, but someone reading the source or React devtools could see them. Closing that means serving candles from the server one at a time, per user. That wasn't built; it matters once scores count for anything.

## Liquidity — Time-Based Levels

**Provenance:** the list of levels and the NY AM window are HAVEN-VALIDATED. The session-boundary definitions below (trading day, trading week, which candles count toward a session) and all five exercises are **AI-DRAFTED** — not yet reviewed by Haven.

> **Unblocked (2026-09-24):** charts now carry real ET timestamps when an exercise provides them, and render date/time labels, trading-day separators, and NY AM session shading (`src/lib/time-context.ts`). The five exercises below use constructed candles with realistic timestamps until reviewed real scenarios exist (`docs/SCENARIO-VALIDATION.md`).

Same idea as [Liquidity](#liquidity): resting stops sit above highs and below lows. These levels are defined by *time* rather than by shape — the highest and lowest prices of a specific period — and are watched by enough traders that stops cluster there.

- Previous day high / previous day low
- New York AM session high / low — **9:30–11:00 ET** (see note below; exact window TBC by Haven)
- Weekly high / low

**Definitions (AI-DRAFTED):**
- **Trading day:** a CME futures trading day runs **18:00 ET to 17:00 ET** the next calendar day. A candle opening at or after 18:00 ET belongs to the *next* trading date — so Thursday's trading day begins Wednesday evening, and a low printed at 20:00 ET Wednesday is part of Thursday. The market is closed 17:00–18:00 ET each weekday.
- **Previous day high/low:** the highest high / lowest low of the trading day before the current one.
- **Regular trading hours (RTH):** **9:30–16:00 ET**, the NYSE cash session — **HAVEN-VALIDATED (2026-09-24)**. The levels traders watch are cash-session levels, so CME's 16:15 ET equity-futures close is deliberately not used.
- **NY AM session high/low:** the highest high / lowest low among candles inside 9:30–11:00 ET. Only candles within that window count — a lower pre-market spike or a later afternoon move is a different level. On charts with bars of an hour or less, the session is shaded.
- **Trading week:** Sunday 18:00 ET to Friday 17:00 ET. The **weekly high/low** is the highest high / lowest low of that span; on the chart a heavier separator marks the weekend.

**Note on the NY AM window:** Haven's actual practice window is roughly 9:30–10:30 or 11:00. The wider 11:00 boundary above was chosen deliberately so that a high forming between 10:30 and 11:00 isn't marked incorrect. Revisit this exact boundary now that time-based exercises are built — see the Decision Log in `docs/PRD-MVP-V1.md`.

### Exercises (AI-DRAFTED — pending Haven's review)

All use the existing `level` answer type (`src/data/time-liquidity-exercises.ts`, concept `TimeLiquidity`).

| ID | Level | Timeframe | Difficulty | Answer | What it tests |
|---|---|---|---|---|---|
| `tliq-001` | Previous day high | 1h | 1 | 21,486 | Reading the day separator; the current day stays below it |
| `tliq-002` | Previous day low | 1h | 2 | 21,338 | The 18:00 ET boundary — the low prints Wednesday evening but belongs to Thursday; a lower low two days back is a distractor |
| `tliq-003` | NY AM session high | 15m | 1 | 21,522 | Reading the shaded session |
| `tliq-004` | NY AM session low | 15m | 2 | 21,338 | Only 9:30–11:00 counts — a lower pre-market spike and a later sell-off are distractors |
| `tliq-005` | Previous week high | 4h | 3 | 21,632 | The weekend separator (and a DST switch); Friday's near-miss and the current week's high are distractors |
