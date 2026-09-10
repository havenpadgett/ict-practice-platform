# Polish Backlog

A running list of non-blocking cosmetic, copy, and layout issues to address in a cleanup pass before release.

**Scope:** cosmetic, copy, and layout items only. Anything affecting grading correctness or recorded data is *not* logged here — it's a Bug Log entry (see `docs/PRD-MVP-V1.md` Section 16) and gets fixed immediately, not deferred.

## Open Items

- [ ] **(2026-09-10)** Confirm whether 16.25 points is the right threshold for "not equal highs" on NQ (the gap between the two near-miss highs in `liq-004`), or set a deliberate value — currently it's just whatever the hand-built candle data happened to produce, not a chosen number.
- [x] **(2026-09-10)** Mobile touch interaction for both box drawing (FVG) and line placement (Liquidity): confirmed `touch-action: none` on the chart SVG correctly suppresses page scroll/zoom during a drag or tap, and added `-webkit-touch-callout: none` so an iOS long-press doesn't surface a callout mid-gesture. Verified at a 375px viewport with realistically-timed synthetic touch pointer events (drag draws/moves a box, a tap places a level, chart and controls fit with no horizontal overflow) — still not a physical device, so keep an eye out for real-device reports.
- [ ] **(2026-09-11)** Build time-based liquidity exercises (previous day high/low, NY AM session high/low, weekly high/low) once the chart supports time context — blocked until Phase 7 introduces real historical data with timestamps. Definitions are recorded in `docs/CURRICULUM.md`.
- [ ] **(2026-09-12)** Enable Google OAuth in Supabase (requires Google Cloud Console credentials) before other users have access. The button, sign-in handler, and `/auth/callback` route are already wired — currently hidden behind `GOOGLE_AUTH_ENABLED` in `src/lib/auth-flags.ts` because the provider isn't configured yet and returns a 400.
