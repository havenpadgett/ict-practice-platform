# Curriculum

Source of truth for concept definitions. Every exercise's answer key is written against this document. No AI-generated definition may override it — if code, an explanation, or a distractor note disagrees with this file, this file is right and the code is a bug.

**Provenance:** every definition below is tagged **HAVEN-VALIDATED** (Haven checked it against source material independently) or **AI-DRAFTED** (written by AI and approved by Haven on a read-through, without independent verification against source material). Treat an AI-DRAFTED definition as needing review before anyone other than Haven uses the app — a quick approval is not the same guarantee as independent validation.

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
- **Weak or invalid:** only a wick through the level; a break of a minor internal swing rather than a structural one; an immediate reversal back through the level.
- **Not an MSS:** a break in the same direction as the trend — that is continuation, not a shift.
- **Terminology:** this project uses MSS. Do not introduce BOS or CHoCH terminology.

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

## Free Trade

**Provenance:** AI-DRAFTED — the mode's rules and all five scenario definitions below were written by AI and have **not** been reviewed by Haven yet. Treat every scenario answer key as pending review before anyone other than Haven uses the app.

**What it is:** historical playback. The user sees a starting window of candles, then reveals the rest one candle at a time — no future candle is rendered, and the chart's price axis is scaled to revealed candles only, so it never hints at where price goes next. At any revealed candle the user may go **Long** or **Short** (a market order filled at that candle's close), then place a stop and a target. The trade closes when a later candle's high/low touches the stop or target; if one candle touches both, the stop is assumed hit first. One trade per scenario. Ending the session without a trade is a **No Trade** decision.

**Graded on process, not outcome** — same principle as [Guided Entry](#guided-entry). Each check is pass/fail:

1. **Direction** — matches the scenario's intended bias (read from [MSS](#market-structure-shift-mss) and which side's liquidity was taken).
2. **Entry** — the fill price sits inside the scenario's ideal entry zone, and only once the setup has actually formed (an entry at the same price before the MSS isn't the same trade).
3. **Stop** — inside the scenario's stop zone: just beyond the swing point that would invalidate the idea. Inside that swing point is too tight; well past it is too wide.
4. **Risk-to-reward** — the user's own planned R:R (the entry, stop, and target they placed) is at least **2:1**.
5. **Trade decision** — traded a scenario that has a valid setup, or sat out one that doesn't.

The overall verdict passes only if every check that applies passes. Win/loss and the result in R are reported alongside but never change the verdict: a losing trade with good process passes; a winning trade with bad process fails. A trade still open when the session ends is marked at the last revealed close.

**Known V1 gap:** the target is not graded on its own — only through the R:R check. A target placed far beyond the nearest opposing liquidity inflates planned R:R. Revisit with Haven before wider use.

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

## Liquidity — Time-Based Levels (defined, not yet examinable)

**Provenance:** HAVEN-VALIDATED.

**⚠️ Blocked.** These definitions exist so they aren't lost, but they cannot be turned into exercises yet — the chart currently shows no time context at all (no dates, session boundaries, or day separators), so there's no way for a user to tell where a "day" or "session" begins or ends on a static 40-candle chart. Unblocked when Phase 7 introduces real historical data with timestamps.

- Previous day high / previous day low
- New York AM session high / low — **9:30–11:00 ET** (see note below; exact window TBC by Haven)
- Weekly high / low

**Note on the NY AM window:** Haven's actual practice window is roughly 9:30–10:30 or 11:00. The wider 11:00 boundary above was chosen deliberately so that a high forming between 10:30 and 11:00 isn't marked incorrect. Revisit this exact boundary once time-based exercises are actually built — see the Decision Log in `docs/PRD-MVP-V1.md`.
