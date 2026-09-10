# Polish Backlog

A running list of non-blocking cosmetic, copy, and layout issues to address in a cleanup pass before release.

**Scope:** cosmetic, copy, and layout items only. Anything affecting grading correctness or recorded data is *not* logged here — it's a Bug Log entry (see `docs/PRD-MVP-V1.md` Section 16) and gets fixed immediately, not deferred.

## Open Items

- [ ] **(2026-09-10)** Confirm whether 16.25 points is the right threshold for "not equal highs" on NQ (the gap between the two near-miss highs in `liq-004`), or set a deliberate value — currently it's just whatever the hand-built candle data happened to produce, not a chosen number.
- [ ] **(2026-09-10)** Mobile touch interaction untested for both box drawing (FVG) and line placement (Liquidity) on a real device — verified so far only via synthesized pointer events in desktop browser automation.
