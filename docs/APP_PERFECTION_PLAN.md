# App Perfection Plan

*Started 2026-09-28 on branch `demo-mode`. Working checklist for the review/perfection phase. Items are checked off only once verified (lint, typecheck, tests, production build, desktop + 375px in the browser).*

**Branch rule.** Stay on `demo-mode` until Haven says the review phase is over. Don't delete the branch, the Vercel preview, or the `NEXT_PUBLIC_DEMO_MODE` preview variable.

**Getting back to `main`.** `docs/OPERATIONS.md` says demo mode must never be merged. So every polish commit here leaves the demo files alone (`src/lib/demo/*`, `src/app/api/demo/*`, `src/components/demo-banner.tsx`, the demo lines in `src/lib/supabase/*`, `src/proxy.ts`, `src/app/layout.tsx`'s banner, `next.config.ts`'s demo block, `tests/demo-mode.test.ts`). When it's time, a branch cut from `main` cherry-picks the polish commits and skips the three demo commits (`c1317c4`, `9b5a4df`, `6a85fee`) and any commit with "Demo mode:" in its subject. The subjects say which is which.

---

## Blocked on Haven (P0 decisions this code can't make)

These are launch blockers. None of them is worked around or quietly softened.

- [ ] **B1. Historical data license, and data already public.** The 50 real scenarios in `src/data/real-scenarios/*.json` are built from the Kaggle "NQ Futures 1min Bar 2022-2025" file (redistributed CME data, license unverified, personal use only per docs/SCENARIO-VALIDATION.md). They include real OHLC candles, and **the GitHub repo is public** (the unauthenticated API returns 200). So derived CME data is being redistributed publicly now, even though none of it is served in practice (`human_reviewed: false` on all 50). Decide: (a) confirm the license allows this, (b) move the files out of the public repo, and optionally purge them from history (destructive, needs your go-ahead), or (c) make the repo private. Until then no real scenario can be approved for users.
- [ ] **B2. Answer-key review of live constructed exercises.** Every live exercise is constructed. Several definitions behind them are AI-DRAFTED and say "treat as needing review before anyone other than Haven uses the app": MSS, IFVG, Order Block, Premium & Discount, Guided Entry rules, Free Trade rules, and the time-based session boundaries (docs/CURRICULUM.md, docs/CURRICULUM-REVIEW.md). Beta testers are "anyone other than Haven". This needs your review, not code.
- [ ] **B3. Real-scenario review.** 0 of 50 approved at `/review` (blocked on B1 anyway).
- [ ] **B4. Hosted migrations.** Six migrations are written but not applied to the hosted database: `20260926120000` analytics views, `…130000` practice events, `…140000` admin functions, `20260927120000` roles, `…130000` attempt integrity, `…140000` mistake events, `…150000` question reports, and **`20260928120000` report reasons + app version (new in this phase)**. Per the PRD, the app degrades gracefully without them, but reports and mistake events won't be recorded. Applying them to production needs your confirmation. They're tested in PGlite (`tests/sql/`).
- [ ] **B5. Live RLS test.** `tests/data-integrity.test.ts` skips the cross-user RLS check without two safe test accounts (env vars in the test file). Needs you to create them.
- [ ] **B6. Google OAuth.** Wired but switched off (`src/lib/auth-flags.ts`) until a Google Cloud client is configured in Supabase.
- [ ] **B7. Forgot-password redirect URL.** Password reset (added in P2 auth work) needs `…/auth/callback` allowed as a redirect URL in Supabase Auth settings for the production domain.
- [ ] **B8. Product name (PRD D-4).** Still "ICT Practice".
- [ ] **B9. Real-device mobile pass (NFR-1/2).** Everything here is verified in an emulated viewport only.

---

## Already good (verified in the audit, keep)

- [x] Demo isolation: two-condition gate (`src/lib/demo/gate.ts`), every call site re-checks the flag inline so non-demo builds drop the code, `/api/demo` 404s outside demo, 80 gate tests.
- [x] Answer keys stay on the server; grading runs in Server Functions (docs/ANSWER-KEYS.md).
- [x] Deterministic, tolerance-based grading: coverage ≥ 60%, precision ≤ 2.5×, time window for zones; ± tolerance for levels (PRD §6).
- [x] Solid = user's answer, dashed mint = correct answer, with a legend after grading. Up candles hollow, down candles solid.
- [x] Verdicts use an icon shape plus a word (`Verdict`, `CheckRow`), not color alone.
- [x] Session persistence: exercise autosave, restore after refresh, guard before leaving mid-answer (`NavigationGuard`).
- [x] Save-failure recovery: the row is kept and "Retry save" resends it; session progress never depends on the save.
- [x] Free Trade: future candles never passed to the chart, dates hidden during real playback, process graded separately from outcome.
- [x] Adaptive engine with small-sample shrinkage (`src/lib/recommendations.ts`, `MIN_ATTEMPTS_FOR_WEAK`).
- [x] Question reporting with structured reasons, server-validated.
- [x] Skip-to-content link, one global `:focus-visible` ring, 44px `min-h-11` controls, 16px inputs on mobile.
- [x] Error boundary (`src/app/error.tsx`, `global-error.tsx`), branded 404, favicon (three-candle gap SVG), per-route titles, Open Graph image.
- [x] Security headers, same-site redirects, CSV formula guard, role trigger, no UPDATE policy on attempts.
- [x] `.env*` git-ignored; a secret-pattern scan of tracked files found no keys or tokens.
- [x] Baseline at audit: `tsc` clean, `eslint` clean, 405 tests pass (1 skipped: live RLS), no console errors or React warnings on the pages walked.

---

## Bugs found in the audit

- [ ] **Login/sign-up inputs are styled as buttons** (`className="btn-secondary"` on `<input>` in `auth-form.tsx`). Should use `.field`.
- [x] **Session summary shows raw exercise ids** (`fvg_03`-style `missed_exercise_ids`) as chips.
- [x] **"Session Score" stat on the dashboard** reads localStorage's current session and usually shows "—". It means nothing to a returning user.
- [x] **Every accuracy percentage lacks a sample size.** Dashboard concept tiles show "Liquidity 100%" from a handful of attempts. Analytics "Strongest & Weakest" picks from any sample size.
- [x] **Analytics "Real Market Data vs Constructed"** is always shown, though 0 real scenarios are live.
- [x] **Analytics listed exercises by database id** ("fvg-003 · Fair Value Gap"). Now concept, difficulty and timeframe.
- [x] **Free Trade reimplements button classes** (`primaryClass`/`secondaryClass`/`activeClass` strings) instead of the design-system classes, with a `border-line` (1.3:1) outline that fails the 3:1 control-boundary rule from DESIGN-SYSTEM.md.
- [x] **Free Trade "End Session"** only ends the current scenario.
- [x] **Free Trade scenario titles leaked the answer during playback** ("Range Chop", "Too Close to Call", "The Retest That Failed" sat above the chart before any decision). The title now appears only after the scenario ends. *(Content clue, Phase 14.)*
- [x] **Session length picker buttons** use a one-off card style instead of `.btn-option`.
- [x] **Mistakes isn't in the nav**, and "Mastered" after one correct retry overstates it.

---

## P0: correctness and launch blockers

- [ ] **P0-1 Landing claim "Real historical NQ scenarios"** is false today: every live exercise is constructed. Rewrite honestly. Also fix the hero eyebrow, the analytics empty state ("how real market data compares…"), and the site description.
- [ ] **P0-2 Demo safeguard, belt and braces.** The gate trusts build-time `NEXT_PUBLIC_VERCEL_ENV`. Promoting a demo-mode preview build to production could carry an open gate. Add a server-side runtime check (`VERCEL_ENV === "production"` → closed), plus tests. *(Demo-branch file; stays out of main.)*
- [ ] **P0-3 Licensing and public data:** blocked, see B1.
- [ ] **P0-4 Constructed answer-key review:** blocked, see B2.
- [x] **P0-5 Secret scan** of tracked files (service role, JWTs, GitHub/Vercel/ngrok tokens). Nothing found. Only `NEXT_PUBLIC_SUPABASE_URL` and the anon/publishable key reach the browser, which is correct.
- [ ] **P0-6 Broken-flow check** of every route in demo mode (desktop + 375px): no blank pages, no console errors. The raw-id and input-styling bugs above are fixed under P1/P2.

## P1: core UX

- [x] **P1-1 Navigation (Phase 1).** Primary nav: Dashboard, Practice, Mistakes (with open count), Analytics. Account menu (email, log out). Active-page state (`aria-current`). Mobile: a compact top bar plus a fixed bottom tab bar, not the wrapped desktop nav.
- [x] **P1-2 Practice picker (Phase 2).** Sections: Recommended (the engine's pick with its reason, Continue session, Review mistakes if pending). An in-progress session now has an Exit link back to the picker (before, the only way out was finishing), and a finished session no longer reopens its summary on the next visit, Recognition (FVG, IFVG, Liquidity incl. time-based, MSS, Order Block, Premium/Discount), Trade Practice (Guided Entry, Free Trade), Mixed/Review (Adaptive mix, Review mistakes). Each row: name, purpose, difficulty range, approximate length, accuracy with attempts (only at ≥ 5 attempts), recommended flag, CTA. Hierarchy instead of nine equal cards.
- [x] **P1-3 Dashboard (Phase 3).** Order: welcome/status → what to practice next (recommendation card with why, difficulty, time, CTA) → pending mistakes → summary metrics → concept skill rows (bar, attempts, "not enough data" below 5) → recent activity. "Session Score" is replaced by "This week" (attempts in the last 7 days). Metrics are one divided strip rather than four cards, and a concept below 5 attempts shows "N of 5 attempts needed", not a percentage.
- [x] **P1-4 Session complete (Phase 10).** Human labels, score, %, concept, difficulty mix, correct/missed counts, a one-line insight, "Review N mistakes" as the primary CTA when there are misses, missed items as friendly rows.
- [x] **P1-5 Recognition feedback (Phase 7).** Diagnostics checklist: zones get Coverage / Location (time window) / Size, with the measured value; levels get "N points too high/low" and the tolerance. "Show me exactly why" expander. "Retry this chart": graded but **never recorded** (not in stats, score or mistakes), since an immediate retry isn't independent evidence. Presence-only answers ("No FVG present" on a chart with one, or a box on a chart without) get no checklist; the explanation already states the answer.
- [x] **P1-6 Chart layout (Phase 6).** Chart routes use a wide layout (`max-w-6xl`), with the chart as the main column and controls in a narrower side column on desktop. Hover crosshair with a price readout (tick-rounded) for every drawing mode, a price tag on the placed line, a Clear control, and manual entry (see P2-4). Cursor states and touch-action were already right. **Zoom/pan not added:** PRD keeps charts static on purpose, and every chart is framed to fit; see Later. **Undo not added:** each recognition answer is a single mark, so Clear covers it.
- [x] **P1-7 Guided Entry (Phase 8).** A visible stepper (Bias ✓ / Entry ● / Stop / Target) with selected values. "Unclear" and "No Trade" collapsed into one path: choosing Unclear already submitted as No Trade, so the bias step has no separate No Trade button; its commit button reads "Submit as No Trade" when Unclear is picked, and No Trade stays on the entry/stop/target steps (a direction with no valid setup). Back button between steps. Levels snap to the 0.25 tick. Feedback leads with "Your plan: …" then each step. On phones the chart scrolls back into view at each placement step. Beginner-only guidance: risk distance and the 2R target level shown on the target step, difficulty 1 only.
- [x] **P1-8 Free Trade (Phase 9).** "End Session" → "Finish scenario" (or "End as No Trade" before any trade). Playback progress bar, candle count, play/pause, speed kept in localStorage. Keyboard: Space play/pause, → next candle, L long, S short, Esc cancel, ? help. Entry mechanics stated next to Long/Short.
- [x] **P1-9 Mistakes (Phase 11).** Chart thumbnail with your answer (solid) and the correct answer (dashed) for every mode (zone, level, choice context, Guided lines, Free Trade lines). Clicking the thumbnail or Review expands the full chart with your answer, the correct one and the explanation. Charts are drawn in stored coordinates, which is how answers are recorded (not the framed window a session showed). Filters: to review / cleared, concept, difficulty. "Mastered" → "Cleared". Spaced repetition documented as future work.
- [x] **P1-10 Analytics (Phase 12).** A lead insight sentence. Time filter (7d / 30d / all). Every percentage shows attempts. Strongest/weakest only from concepts with ≥ 5 attempts (reusing the engine's scores). Real-vs-constructed hidden with 0 real attempts. CSV exports moved to an overflow menu. Sections grouped: Overview, Concepts, Trade practice (only with Guided/Free Trade attempts in view), Details (collapsible: most-missed, difficulty within concept, answer time, how recommendations are chosen, real vs constructed only with real attempts). The SQL views still serve the default all-time view; any filter is computed from the fetched attempts. Five now-unused analytics components removed; account and overflow menus share one `Menu` component.
- [x] **P1-11 Landing (Phase 4).** A product preview near the hero: a real chart component with a user box (solid), the correct zone (dashed) and a feedback card, showing draw → submit → compare → understand. A public "Try a sample" route (`/try`): three constructed practice exercises (FVG box, liquidity line, order block box) graded on the server without an account; nothing is recorded server-side, and a signed-out visitor's answers are kept on the device so the dashboard's existing migration prompt offers to save them after sign-up. `tests/sample.test.ts`: no keys served, only the three ids gradeable, malformed answers refused. **Trade-off:** anyone can see the answers to those three practice exercises. The preview chart is a separate preview-only dataset, so it reveals nothing.

## P2: polish

- [x] **P2-1 Design-system consistency.** Free Trade and the length picker use `.btn-*`; no copied button class strings remain. No legacy `uppercase tracking-wide` labels remain. Stat cards replaced by `MetricStrip`/`SkillRows` (`StatCard` survives only on `/admin`). Radius standardized on `rounded-lg`. Loading skeleton matches the new dashboard/analytics shape. DESIGN-SYSTEM.md documents the shared components, page widths, navigation, card rule, sample-size rule and motion.
- [x] **P2-2 Auth (Phase 13).** `.field` inputs, show/hide password (`PasswordField`), the 6-character hint on sign-up (Supabase's default; the project setting is the real rule), client checks before any request, forgot password → Supabase reset email → `/auth/callback` → new `/reset-password` page, `aria-invalid` and `role="alert"` errors, busy labels, plain-language Supabase errors (`src/lib/auth-errors.ts`), and `?mode=signup`. Verified on the normal (non-demo) dev server with client-side validation only; no request reached Supabase. **Needs B7** for the reset link to work in production. **Onboarding questions not built:** see Later.
- [x] **P2-3 Empty/loading/error states (Phase 18).** Route-level `loading.tsx` isn't needed (the client pages render their own skeletons, which reserve the loaded layout's shape). Every async screen has an intentional state: dashboard, practice (load error with retry, withdrawn exercise, grading error with retry or skip, save error with retry), mistakes, analytics, /try. The root `error.tsx` covers every route, with the branded 404 and `global-error.tsx`. Empty states say what to do ("Start FVG practice", "Complete your first practice session to unlock…").
- [x] **P2-4 Accessibility (Phase 16).** Account menu: Escape closes, focus returns to the trigger, `aria-expanded`. `aria-current` on nav. Icon-only buttons labelled. `prefers-reduced-motion` disables the skeleton pulse and transitions. Browser zoom never disabled (no `maximum-scale`). **Manual numeric entry for every chart answer:** recognition lines and boxes, Guided Entry's entry/stop/target, and Free Trade's stop/target. The chart redraws from what's typed. The hover price tag's contrast was fixed (dark text on `--control` was ~3.6:1, now `--muted` at ~7:1). Chart `aria-label`s mention the manual alternative. No modals exist, so there's no focus trap to add; both menus close on Escape and return focus. **Still not accessible:** reading the chart itself with a screen reader (the SVG is one `role="img"`). A data-table alternative is a Later item.
- [x] **P2-5 Microinteractions (Phase 20).** Transitions are 150ms colors only. No scale or float effects added.
- [x] **P2-6 Copy (Phase 19).** Terminology: "Fair Value Gap (FVG)" on first use and in picker titles, "FVG" in compact labels. Same for MSS and IFVG. "No Trade", "Guided Entry", "Free Trade", "Recognition". Buttons name their action ("Start FVG practice", "Review 3 mistakes", "Exit trade and finish") and use sentence case ("Next exercise", "See results"). "No Trade" is capitalized everywhere as a term. "Mistakes" is the page, "Review Mistakes" the session. **Not done:** hover tooltips for jargon (unreliable on touch); the full names with abbreviations and "Show me exactly why" carry the definitions instead.
- [ ] **P2-7 Performance (Phase 21).** Lighthouse not run in this environment (no Chrome CLI). Bundle sizes checked from `next build` output (see Verification log).

## P3: maintainability

- [x] **P3-1 Recognition component.** `RecognitionExercise` pulled out of `practice/page.tsx`, like Guided Entry and Free Trade.
- [ ] **P3-2 `usePracticeSession()` hook.** Not done. The page still owns session orchestration, persistence and save/retry. It's a larger refactor that should be done properly on its own, with the session-recovery tests extended first.
- [ ] **P3-3 E2E tests (Phase 25).** Not done: there's no browser test runner in the repo (Playwright would be a new dependency). Unit tests cover grading, the engine, recovery, errors and the demo gate. Flows were walked by hand in the browser pane each batch.
- [x] **P3-5 Reporting (Phase 26).** After feedback the link reads "Think this answer is wrong? Report it". New reason "The explanation is unclear", and the app version (package version + Vercel commit) is stored with each report (migration `20260928120000`, PGlite-tested). Until that migration runs, the action falls back to the old columns and files unclear-explanation reports as "other" with a note. The user's answer, concept and difficulty aren't copied: `session_id` + `exercise_id` join to the attempt row, and the expected answer is the key in the repo.
- [ ] **P3-4 Scenario metadata tracking (Phase 14/26).** Report count and miss rate per exercise already exist on `/admin` (once B4's migrations run). Abandonment per exercise isn't tracked.

---

## Later ideas (document only, Phases 27–28)

**Do not build yet:** community, chat, feeds, leaderboards, P&L competitions, subscriptions, big achievement systems, marketplace, copy trading, signals, AI chatbot, many markets.

**Future:** candle-by-candle replay for recognition; adaptive difficulty within a session; **spaced repetition** (a cleared mistake resurfaces after 1, 3 and 7 days, and is "mastered" only after correct answers in separate sessions); top-down multi-timeframe analysis; a confidence rating before answering, with confidence-vs-accuracy analytics; timed challenge; mixed-concept exam; daily challenge; more instruments and SMT (needs a dual chart); user-uploaded charts; AI-simplified explanations. **If AI is ever used, the validated deterministic answer key stays the source of truth. AI may rephrase or tutor, never write keys.**

**Onboarding (Phase 13), deferred:** three questions (experience, concepts known, goal) that would seed the first recommendation. Deferred because the engine already sends a new user to FVG difficulty 1, and a profile column needs a migration (B4 applies there too).

**Pan/zoom (Phase 6), deferred:** the PRD keeps the chart static on purpose (coordinate bugs), and every chart is framed to fit. A focus mode wasn't needed once the chart got the wide layout.

---

## Verification log

Each batch: `npx tsc --noEmit`, `npm run lint`, `npm test`, `npm run build`, walk in the browser at desktop and 375px, check the console.

| Batch | Commit | Checks |
|---|---|---|
| Audit + plan | — | baseline: tsc ✓ lint ✓ tests 405/406 (1 skipped) |
