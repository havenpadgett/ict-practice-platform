# Curriculum

Source of truth for concept definitions. Every exercise's answer key is written against this document. No AI-generated definition may override it — if code, an explanation, or a distractor note disagrees with this file, this file is right and the code is a bug.

## Fair Value Gap (FVG)

**As currently implemented:** a three-candle formation where candle 1's high sits below candle 3's low (bullish) or candle 1's low sits above candle 3's high (bearish), leaving an unfilled imbalance.

## Liquidity

**What it is:** resting stop orders. Traders place stops above highs and below lows, so those areas become pools of orders that price is drawn toward.

- **Buy-side liquidity** sits above highs (stops from short positions).
- **Sell-side liquidity** sits below lows (stops from long positions).

**Where it rests:** above any swing high and below any swing low. A single wick has a pool above it.

**Strength:** equal highs or equal lows hold a larger pool, because orders from multiple touches cluster at the same price. More touches at a level means more stops resting there. A single wick is a small pool; equal highs/lows is a big one.

> **Correction (2026-09-11):** this replaces an earlier incorrect working definition that treated liquidity as valid *only* at equal highs/lows. See the Decision Log in `docs/PRD-MVP-V1.md`.

## Market Structure Shift (MSS)

**Market structure** is the sequence of swing highs and lows. An uptrend makes higher highs and higher lows; a downtrend makes lower highs and lower lows.

**A Market Structure Shift** is when that sequence breaks against the prevailing direction — in an uptrend, price fails to make a new higher high and then breaks below the most recent higher low (mirrored for a downtrend: price fails to make a new lower low and then breaks above the most recent lower high).

- **Confirmation:** a candle body closes beyond the swing point, not just a wick through it. Often accompanied by a strong displacement move, which frequently leaves an FVG.
- **Weak or invalid:** only a wick through the level; a break of a minor internal swing rather than a structural one; an immediate reversal back through the level.
- **Not an MSS:** a break in the same direction as the trend — that is continuation, not a shift.
- **Terminology:** this project uses MSS. Do not introduce BOS or CHoCH terminology.

## Fair Value Gap — Respected vs. Disrespected **(PROVISIONAL — pending Haven's validation)**

**What it is:** after an FVG forms, price may later trade back into it. If price reacts from within the gap — reversing back out the side it came in from — the gap is **respected**. If price instead closes through the far side of the gap and continues, the gap is **disrespected**. A brief pause or a shallow wick inside the gap isn't itself the deciding factor — what matters is which way price leaves the zone.

**Applies to:** FVG and IFVG only — not Liquidity or MSS, which don't have a "gap" for price to return to. IFVG exercises are not yet built; only FVG's respected/disrespected exercises exist so far.

## Liquidity — Time-Based Levels (defined, not yet examinable)

**⚠️ Blocked.** These definitions exist so they aren't lost, but they cannot be turned into exercises yet — the chart currently shows no time context at all (no dates, session boundaries, or day separators), so there's no way for a user to tell where a "day" or "session" begins or ends on a static 40-candle chart. Unblocked when Phase 7 introduces real historical data with timestamps.

- Previous day high / previous day low
- New York AM session high / low — **9:30–11:00 ET** (see note below; exact window TBC by Haven)
- Weekly high / low

**Note on the NY AM window:** Haven's actual practice window is roughly 9:30–10:30 or 11:00. The wider 11:00 boundary above was chosen deliberately so that a high forming between 10:30 and 11:00 isn't marked incorrect. Revisit this exact boundary once time-based exercises are actually built — see the Decision Log in `docs/PRD-MVP-V1.md`.
