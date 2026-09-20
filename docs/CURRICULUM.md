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

## Liquidity — Time-Based Levels (defined, not yet examinable)

**Provenance:** HAVEN-VALIDATED.

**⚠️ Blocked.** These definitions exist so they aren't lost, but they cannot be turned into exercises yet — the chart currently shows no time context at all (no dates, session boundaries, or day separators), so there's no way for a user to tell where a "day" or "session" begins or ends on a static 40-candle chart. Unblocked when Phase 7 introduces real historical data with timestamps.

- Previous day high / previous day low
- New York AM session high / low — **9:30–11:00 ET** (see note below; exact window TBC by Haven)
- Weekly high / low

**Note on the NY AM window:** Haven's actual practice window is roughly 9:30–10:30 or 11:00. The wider 11:00 boundary above was chosen deliberately so that a high forming between 10:30 and 11:00 isn't marked incorrect. Revisit this exact boundary once time-based exercises are actually built — see the Decision Log in `docs/PRD-MVP-V1.md`.
