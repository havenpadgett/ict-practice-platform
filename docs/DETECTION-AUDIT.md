# Detection Audit — code vs. written definition

*Generated 2026-09-25 by `scripts/audit_detection.py` (AI-DRAFTED analysis). Re-run it after any change to a rule:*

```bash
python3 scripts/audit_detection.py data/clean/nq_nyam_ctx.5m
python3 scripts/audit_detection.py data/clean/nq_nyam_ctx.5m --real
```

**Method:**
- For each detection rule, 20 candidates are sampled evenly across Dec 2022–Dec 2025 (seed 7), on 5m NY AM with 07:00 context and on 15m RTH.
- Every clause of the [CURRICULUM.md](CURRICULUM.md) definition is re-checked with code written separately from `detect.py`. That includes clauses `detect.py` doesn't implement, which are marked *not checked by detect.py*.
- Where a clause has no operational form in the curriculum ("structural, not minor"), a proxy is used and labelled as one.
- A second pass runs the same checks on only the candidates behind the 50 real scenarios awaiting review.

## Findings

### Code and definition disagree

1. **Guided Entry entries.** The definition allows only an FVG, an IFVG or a retest of the broken level. `scripts/setups.py` falls back to an **order block** when no FVG exists.
   - Affects 3 of 20 valid 5m setups and 5 of 12 valid 15m setups.
   - Among the real scenarios: **`real-guided-006`** (2025-08-05) and **`real-ft-003`** (2024-02-21).
   - Either add order blocks to the definition or drop the fallback (CURRICULUM-REVIEW §2, Q3).
2. **Guided Entry "unmitigated" entry.** The generator never checks whether the entry gap is closed through before the chart ends.
   - 3 of 20 valid 5m setups and 1 of 12 on 15m had the FVG body-closed through within the window shown.
   - None is in the current real batch, but the next batch could include one.
3. **Premium & Discount range choice.** The definition says "the most recent swing high and low **that price has not traded beyond**". The code takes the most recent swing high and low and gives up if either is broken. It never falls back to an older intact pair.
   - Result: no dealing range in 390 of 736 NY AM sessions.
   - There are no real P/D scenarios yet, so no live impact.

### Clauses the code doesn't check at all

4. **MSS: "fails to make a new higher high" first.** Recorded (`failed_new_extreme`) but not required.
   - Fails in 5 of 20 sampled on 5m and 2 of 20 on 15m.
   - Real: `real-mss` candidates `mss-bearish-20230911T0935` and `mss-bearish-20250924T0930`.
5. **MSS: "an immediate reversal back through the level" makes it weak.** Not checked.
   - Reversals within 2 bars: 8 of 20 (5m), 7 of 20 (15m).
   - Real: `mss-bullish-20250327T0955` and `mss-bearish-20230613T1415`.
6. **MSS: "structural, not minor internal" swing.** No operational form, so any lookback-2 fractal counts.
   - By a proxy (the broken swing's leg is at least one median bar range): 7 of 20 (5m) and 5 of 20 (15m) are small swings.
   - Real: 4 of the 7 real 5m MSS candidates.
7. **FVG: "leaving an unfilled imbalance".** Checked only at formation. Price trades back through the gap later in the same session in 8 of 20 sampled (5m) and 8 of 20 (15m).
   - Real FVG scenarios show the whole session, so on `real-fvg` charts built from `fvg-bearish-20240513T0940`, `fvg-bearish-20250414T0935`, `fvg-bearish-20240112T1130` and `fvg-bullish-20241226T1430` the gap is visibly filled later on the same chart.
   - The constructed FVG explanation says "price hasn't come back to trade through that range since".
8. **Liquidity: "resting" / "strongest".**
   - `detect.py` doesn't check that an equal-highs/lows pool is still untaken; `build_scenario.py` does, so no real scenario is affected. 6–10 of 20 sampled pools were taken later in the session.
   - Nothing compares the pool against other liquidity on the chart (session high, previous-day high) when the prompt asks for the *strongest*.
9. **Guided target "not the next minor swing".** No operational form; the code takes the nearest untaken swing. By the same proxy: 0 of 20 flagged on 5m, 4 of 12 on 15m.
10. **IFVG and respected/disrespected.** No detection rule exists, so nothing real is checked. Only the 20 constructed exercises depend on these definitions.

### Clauses that hold

Every sampled candidate satisfied:
- **FVG:** the core three-candle gap test, the session boundary, the size floor, and the direction of the expansion candle.
- **Equal highs/lows:** the fractal-swing test, the 0.05% tolerance, and "nothing beyond the pool between touches".
- **MSS:** trend, most-recent level, and body-close confirmation.
- **Order blocks:** every written clause.
- **Dealing ranges:** range intact and band classification.

## Raw results — 5m NY AM (random sample)

Data: `../data/clean/nq_nyam_ctx.5m` (2022-12-27 → 2025-12-11), seed 7.

### Fair Value Gap — 20 checked

| Clause | Holds | Fails (examples) |
|---|---|---|
| Candle 1 high below candle 3 low (bullish) / candle 1 low above candle 3 high (bearish) | 20/20 | — |
| Three consecutive bars of one session (no time gap) | 20/20 | — |
| Gap ≥ 0.25 × trailing median bar range (CURRICULUM Detection Parameters) | 20/20 | — |
| Middle candle is the expansion candle, closing in the gap's direction (*not checked by detect.py*) | 20/20 | — |
| Still unfilled at the session's end — 'an unfilled imbalance' (*not checked by detect.py*) | 12/20 | `fvg-bearish-20230303T1000`, `fvg-bullish-20231122T1030`, `fvg-bearish-20240328T1005` … |

### Equal highs — 20 checked

| Clause | Holds | Fails (examples) |
|---|---|---|
| Every touch is a swing point (lookback-2 fractal) | 20/20 | — |
| Touches within 0.05% of the first touch's price | 20/20 | — |
| Nothing trades beyond the pool between the touches | 20/20 | — |
| Pool still resting at the session's end — 'resting stops' (*detect.py doesn't check; build_scenario.py does*) | 14/20 | `equal_highs-20230302T1030`, `equal_highs-20230612T1030`, `equal_highs-20230628T0955` … |

### Equal lows — 20 checked

| Clause | Holds | Fails (examples) |
|---|---|---|
| Every touch is a swing point (lookback-2 fractal) | 20/20 | — |
| Touches within 0.05% of the first touch's price | 20/20 | — |
| Nothing trades beyond the pool between the touches | 20/20 | — |
| Pool still resting at the session's end — 'resting stops' (*detect.py doesn't check; build_scenario.py does*) | 15/20 | `equal_lows-20230126T1010`, `equal_lows-20240112T1015`, `equal_lows-20240618T1020` … |

### Market Structure Shift — 20 checked

| Clause | Holds | Fails (examples) |
|---|---|---|
| Prevailing trend: last two swing highs and last two swing lows both in one direction | 20/20 | — |
| The broken level is the most recent higher low / lower high | 20/20 | — |
| Confirmed by a candle body close beyond the level | 20/20 | — |
| Price first failed to make a new higher high / lower low (*detect.py records it, doesn't require it*) | 15/20 | `mss-bearish-20240125T0935`, `mss-bearish-20240730T0940`, `mss-bullish-20250311T0935` … |
| The broken swing is structural, not minor: its leg ≥ 1 median bar range (*not checked; proxy*) | 13/20 | `mss-bullish-20231113T1050`, `mss-bearish-20240125T0935`, `mss-bearish-20240730T0940` … |
| No immediate reversal: the next two closes stay beyond the level (*not checked by detect.py*) | 12/20 | `mss-bullish-20230224T0935`, `mss-bullish-20230426T0955`, `mss-bearish-20230713T1025` … |
| Break inside the session (not the 07:00 context) | 20/20 | — |

### Order block — 20 checked

| Clause | Holds | Fails (examples) |
|---|---|---|
| Candle before the move closes the opposite way (last opposing candle) | 20/20 | — |
| The move is 1–3 consecutive candles in its direction | 20/20 | — |
| Displacement ≥ 2 × median bar range | 20/20 | — |
| Breaks the most recent confirmed swing with a body close | 20/20 | — |
| Zone is the candle's full high–low range | 20/20 | — |
| Block and break inside the session | 20/20 | — |

### Premium / discount (dealing range) — 20 checked

| Clause | Holds | Fails (examples) |
|---|---|---|
| Range still intact (price hasn't traded beyond either swing) | 20/20 | — |
| Zone matches last close vs 45–55% band | 20/20 | — |
| Range swings are session bars, not context | 20/20 | — |

### Guided Entry setup chain (all valid sessions) — 20 checked

| Clause | Holds | Fails (examples) |
|---|---|---|
| Entry is an FVG, IFVG or retest of the broken level (definition's list) | 17/20 | `setup-2023-04-28`, `setup-2024-02-21`, `setup-2025-08-05` |
| Entry level unmitigated on the chart shown | 17/20 | `setup-2023-02-24`, `setup-2023-05-10`, `setup-2024-01-22` |
| Stop beyond the setup's swing extreme | 20/20 | — |
| Target is 'not the next minor swing': its leg ≥ 1 median bar range (*not checked; proxy*) | 20/20 | — |
| R:R ≥ 2 from the entry midpoint | 20/20 | — |


## Raw results — 15m RTH (random sample)

Data: `../data/clean/nq_rth_full.15m` (2022-12-27 → 2025-12-11), seed 7.

### Fair Value Gap — 20 checked

| Clause | Holds | Fails (examples) |
|---|---|---|
| Candle 1 high below candle 3 low (bullish) / candle 1 low above candle 3 high (bearish) | 20/20 | — |
| Three consecutive bars of one session (no time gap) | 20/20 | — |
| Gap ≥ 0.25 × trailing median bar range (CURRICULUM Detection Parameters) | 20/20 | — |
| Middle candle is the expansion candle, closing in the gap's direction (*not checked by detect.py*) | 20/20 | — |
| Still unfilled at the session's end — 'an unfilled imbalance' (*not checked by detect.py*) | 12/20 | `fvg-bearish-20230117T1100`, `fvg-bullish-20230501T1215`, `fvg-bullish-20230707T1045` … |

### Equal highs — 20 checked

| Clause | Holds | Fails (examples) |
|---|---|---|
| Every touch is a swing point (lookback-2 fractal) | 20/20 | — |
| Touches within 0.05% of the first touch's price | 20/20 | — |
| Nothing trades beyond the pool between the touches | 20/20 | — |
| Pool still resting at the session's end — 'resting stops' (*detect.py doesn't check; build_scenario.py does*) | 10/20 | `equal_highs-20230126T1245`, `equal_highs-20230814T1315`, `equal_highs-20230828T1300` … |

### Equal lows — 20 checked

| Clause | Holds | Fails (examples) |
|---|---|---|
| Every touch is a swing point (lookback-2 fractal) | 20/20 | — |
| Touches within 0.05% of the first touch's price | 20/20 | — |
| Nothing trades beyond the pool between the touches | 20/20 | — |
| Pool still resting at the session's end — 'resting stops' (*detect.py doesn't check; build_scenario.py does*) | 13/20 | `equal_lows-20230227T1215`, `equal_lows-20230418T1130`, `equal_lows-20230817T1130` … |

### Market Structure Shift — 20 checked

| Clause | Holds | Fails (examples) |
|---|---|---|
| Prevailing trend: last two swing highs and last two swing lows both in one direction | 20/20 | — |
| The broken level is the most recent higher low / lower high | 20/20 | — |
| Confirmed by a candle body close beyond the level | 20/20 | — |
| Price first failed to make a new higher high / lower low (*detect.py records it, doesn't require it*) | 18/20 | `mss-bullish-20230314T1545`, `mss-bullish-20250630T1445` |
| The broken swing is structural, not minor: its leg ≥ 1 median bar range (*not checked; proxy*) | 15/20 | `mss-bearish-20230522T1530`, `mss-bearish-20230801T1545`, `mss-bearish-20231218T1545` … |
| No immediate reversal: the next two closes stay beyond the level (*not checked by detect.py*) | 13/20 | `mss-bearish-20230522T1530`, `mss-bearish-20230613T1415`, `mss-bearish-20230925T1500` … |
| Break inside the session (not the 07:00 context) | 20/20 | — |

### Order block — 20 checked

| Clause | Holds | Fails (examples) |
|---|---|---|
| Candle before the move closes the opposite way (last opposing candle) | 20/20 | — |
| The move is 1–3 consecutive candles in its direction | 20/20 | — |
| Displacement ≥ 2 × median bar range | 20/20 | — |
| Breaks the most recent confirmed swing with a body close | 20/20 | — |
| Zone is the candle's full high–low range | 20/20 | — |
| Block and break inside the session | 20/20 | — |

### Premium / discount (dealing range) — 20 checked

| Clause | Holds | Fails (examples) |
|---|---|---|
| Range still intact (price hasn't traded beyond either swing) | 20/20 | — |
| Zone matches last close vs 45–55% band | 20/20 | — |
| Range swings are session bars, not context | 20/20 | — |

### Guided Entry setup chain (all valid sessions) — 12 checked

| Clause | Holds | Fails (examples) |
|---|---|---|
| Entry is an FVG, IFVG or retest of the broken level (definition's list) | 7/12 | `setup-2023-10-02`, `setup-2024-01-02`, `setup-2024-03-05` … |
| Entry level unmitigated on the chart shown | 11/12 | `setup-2025-08-20` |
| Stop beyond the setup's swing extreme | 12/12 | — |
| Target is 'not the next minor swing': its leg ≥ 1 median bar range (*not checked; proxy*) | 8/12 | `setup-2023-10-02`, `setup-2025-05-02`, `setup-2025-08-20` … |
| R:R ≥ 2 from the entry midpoint | 12/12 | — |


## Raw results — real scenarios awaiting review (5m)

Data: `../data/clean/nq_nyam_ctx.5m` (2022-12-27 → 2025-12-11), seed 7.

### Fair Value Gap — 7 checked

| Clause | Holds | Fails (examples) |
|---|---|---|
| Candle 1 high below candle 3 low (bullish) / candle 1 low above candle 3 high (bearish) | 7/7 | — |
| Three consecutive bars of one session (no time gap) | 7/7 | — |
| Gap ≥ 0.25 × trailing median bar range (CURRICULUM Detection Parameters) | 7/7 | — |
| Middle candle is the expansion candle, closing in the gap's direction (*not checked by detect.py*) | 7/7 | — |
| Still unfilled at the session's end — 'an unfilled imbalance' (*not checked by detect.py*) | 5/7 | `fvg-bearish-20240513T0940`, `fvg-bearish-20250414T0935` |

### Equal highs — 3 checked

| Clause | Holds | Fails (examples) |
|---|---|---|
| Every touch is a swing point (lookback-2 fractal) | 3/3 | — |
| Touches within 0.05% of the first touch's price | 3/3 | — |
| Nothing trades beyond the pool between the touches | 3/3 | — |
| Pool still resting at the session's end — 'resting stops' (*detect.py doesn't check; build_scenario.py does*) | 3/3 | — |

### Equal lows — 3 checked

| Clause | Holds | Fails (examples) |
|---|---|---|
| Every touch is a swing point (lookback-2 fractal) | 3/3 | — |
| Touches within 0.05% of the first touch's price | 3/3 | — |
| Nothing trades beyond the pool between the touches | 3/3 | — |
| Pool still resting at the session's end — 'resting stops' (*detect.py doesn't check; build_scenario.py does*) | 3/3 | — |

### Market Structure Shift — 7 checked

| Clause | Holds | Fails (examples) |
|---|---|---|
| Prevailing trend: last two swing highs and last two swing lows both in one direction | 7/7 | — |
| The broken level is the most recent higher low / lower high | 7/7 | — |
| Confirmed by a candle body close beyond the level | 7/7 | — |
| Price first failed to make a new higher high / lower low (*detect.py records it, doesn't require it*) | 5/7 | `mss-bearish-20230911T0935`, `mss-bearish-20250924T0930` |
| The broken swing is structural, not minor: its leg ≥ 1 median bar range (*not checked; proxy*) | 3/7 | `mss-bearish-20230911T0935`, `mss-bearish-20240415T0930`, `mss-bullish-20250327T0955` … |
| No immediate reversal: the next two closes stay beyond the level (*not checked by detect.py*) | 6/7 | `mss-bullish-20250327T0955` |
| Break inside the session (not the 07:00 context) | 7/7 | — |

### Order block — 0 checked

| Clause | Holds | Fails (examples) |
|---|---|---|

### Premium / discount (dealing range) — 0 checked

| Clause | Holds | Fails (examples) |
|---|---|---|

### Guided Entry setup chain (all valid sessions) — 10 checked

| Clause | Holds | Fails (examples) |
|---|---|---|
| Entry is an FVG, IFVG or retest of the broken level (definition's list) | 8/10 | `setup-2024-02-21`, `setup-2025-08-05` |
| Entry level unmitigated on the chart shown | 10/10 | — |
| Stop beyond the setup's swing extreme | 10/10 | — |
| Target is 'not the next minor swing': its leg ≥ 1 median bar range (*not checked; proxy*) | 10/10 | — |
| R:R ≥ 2 from the entry midpoint | 10/10 | — |


## Raw results — real scenarios awaiting review (15m)

Data: `../data/clean/nq_rth_full.15m` (2022-12-27 → 2025-12-11), seed 7.

### Fair Value Gap — 5 checked

| Clause | Holds | Fails (examples) |
|---|---|---|
| Candle 1 high below candle 3 low (bullish) / candle 1 low above candle 3 high (bearish) | 5/5 | — |
| Three consecutive bars of one session (no time gap) | 5/5 | — |
| Gap ≥ 0.25 × trailing median bar range (CURRICULUM Detection Parameters) | 5/5 | — |
| Middle candle is the expansion candle, closing in the gap's direction (*not checked by detect.py*) | 5/5 | — |
| Still unfilled at the session's end — 'an unfilled imbalance' (*not checked by detect.py*) | 3/5 | `fvg-bearish-20240112T1130`, `fvg-bullish-20241226T1430` |

### Equal highs — 2 checked

| Clause | Holds | Fails (examples) |
|---|---|---|
| Every touch is a swing point (lookback-2 fractal) | 2/2 | — |
| Touches within 0.05% of the first touch's price | 2/2 | — |
| Nothing trades beyond the pool between the touches | 2/2 | — |
| Pool still resting at the session's end — 'resting stops' (*detect.py doesn't check; build_scenario.py does*) | 2/2 | — |

### Equal lows — 2 checked

| Clause | Holds | Fails (examples) |
|---|---|---|
| Every touch is a swing point (lookback-2 fractal) | 2/2 | — |
| Touches within 0.05% of the first touch's price | 2/2 | — |
| Nothing trades beyond the pool between the touches | 2/2 | — |
| Pool still resting at the session's end — 'resting stops' (*detect.py doesn't check; build_scenario.py does*) | 2/2 | — |

### Market Structure Shift — 3 checked

| Clause | Holds | Fails (examples) |
|---|---|---|
| Prevailing trend: last two swing highs and last two swing lows both in one direction | 3/3 | — |
| The broken level is the most recent higher low / lower high | 3/3 | — |
| Confirmed by a candle body close beyond the level | 3/3 | — |
| Price first failed to make a new higher high / lower low (*detect.py records it, doesn't require it*) | 3/3 | — |
| The broken swing is structural, not minor: its leg ≥ 1 median bar range (*not checked; proxy*) | 3/3 | — |
| No immediate reversal: the next two closes stay beyond the level (*not checked by detect.py*) | 2/3 | `mss-bearish-20230613T1415` |
| Break inside the session (not the 07:00 context) | 3/3 | — |

### Order block — 0 checked

| Clause | Holds | Fails (examples) |
|---|---|---|

### Premium / discount (dealing range) — 0 checked

| Clause | Holds | Fails (examples) |
|---|---|---|

### Guided Entry setup chain (all valid sessions) — 0 checked

| Clause | Holds | Fails (examples) |
|---|---|---|

