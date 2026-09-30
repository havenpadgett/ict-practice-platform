# App Perfection Plan

*Started 2026-09-28 on branch `demo-mode`. Working checklist for the review/perfection phase. Items are checked off only once verified (lint, typecheck, tests, production build, desktop + 375px in the browser).*

**Branch rule.** Stay on `demo-mode` until Haven says the review phase is over. Don't delete the branch, the Vercel preview, or the `NEXT_PUBLIC_DEMO_MODE` preview variable.

---

## Resume point (read this first — updated 2026-09-29)

**1. Fully complete phases.** P0 (except P0-3/P0-4, blocked on Haven), P1 (all 11), P2 (all 7), Phase B (grading redesign), Phase C (feedback rewrite). Every `[x]` line under P0–P2 and Phases B–C below is verified: `tsc`, `eslint`, full test suite, production build, and a live browser walkthrough — see the Verification log and Phase B/C sections for exact commits.

**2. Partially done, and exactly where they stopped.**
- **P3 (maintainability):** P3-1 and P3-5/P3-6 done. P3-2 (`usePracticeSession()` hook) — not started, needs session-recovery tests extended first, then the refactor. P3-3 (E2E tests) — not started, needs a decision to add Playwright as a dependency. P3-4 (per-exercise abandonment tracking) — investigated, not built: session-level abandonment already exists, but per-exercise needs either persisting the planned exercise sequence or an inference from attempt order — a design decision, not a quick add.
- **Phase D (synchronized multi-timeframe charts):** not started at all. Stopped at the architecture-planning stage — see Phase D below for the 6-step concrete plan (data model, offline pipeline extension, runtime resampling, per-timeframe hidden-candle security, chart UI with zoom/pan, and a decision needed from Haven on reversing the "charts stay static" constraint).
- **Phase E (drawing tools):** not started. Deliberately sequenced after Phase D (would otherwise mean building the drawing layer twice). Architecture plan (Drawing data model, toolbar, hit-testing, undo/redo, localStorage persistence) is written below, ready to execute once D lands.
- **Phase F (new exercise flow CONTEXT→BIAS→CONFLUENCES→CONFIRMATION→EXECUTION):** not started. Hard-depends on Phase D, soft-depends on Phase E. Plan is written below.
- **Phase G (difficulty):** not started, but has no independent work — it falls out of Phase F's content authoring, so nothing to build until F exists.

**3. Migrations written but not run (all in `supabase/migrations/`, confirmed on disk 2026-09-29), oldest first:**
- `20260926120000_analytics_views.sql`
- `20260926130000_practice_events.sql`
- `20260926140000_admin_functions.sql`
- `20260927120000_roles.sql`
- `20260927130000_attempt_integrity.sql`
- `20260927140000_mistakes_session_events.sql`
- `20260927150000_question_reports.sql`
- `20260928120000_report_reasons_app_version.sql`
- `20260929120000_add_verdict_to_attempts.sql` (Phase B — verdict columns)
- `20260929130000_analytics_could_improve.sql` (Phase B — analytics could-improve breakdown)

All are PGlite-tested (`tests/sql/`). The app degrades gracefully without them (see B4 and the Phase B production-safety fallback in `src/lib/attempts.ts`), but reports, mistake events, roles, attempt integrity checks, and per-attempt `verdict` won't be live until Haven applies them to the hosted database.

**4. Everything blocked on Haven, with the exact action needed** (full detail in "Blocked on Haven" below):
- **B1** — decide the license/visibility of `src/data/real-scenarios/*.json` (confirm license, move files out of the public repo, or make the repo private).
- **B2** — review the AI-drafted answer keys/definitions (MSS, IFVG, Order Block, Premium & Discount, Guided Entry rules, Free Trade rules, session boundaries) before any non-Haven user sees them.
- **B3** — approve real scenarios at `/review` (blocked on B1 first).
- **B4** — apply the 10 migrations listed above to the hosted database.
- **B5** — create two test accounts (env vars) so the cross-user RLS test can run instead of skip.
- **B6** — configure a Google Cloud OAuth client in Supabase to turn on Google sign-in.
- **B7** — add `…/auth/callback` as an allowed redirect URL in Supabase Auth settings for production.
- **B8** — decide the product name (still "ICT Practice").
- **B9** — do a real-device mobile pass (everything so far is verified in an emulated viewport only).
- **Phase D decision** — confirm reversing the PRD's "charts stay static on purpose" constraint is intended, since Phase D's whole premise depends on it.

**5. What the next session should pick up first.** Read Phase D's "Concrete plan for the next session" section below in full before writing code — it's an architecture handoff, not a stub. Do not start Phase E or F before Phase D lands (both explicitly depend on it). If Haven has answered any Blocked-on-Haven items or run migrations between sessions, check that first and update the relevant checkboxes/fallback logic before continuing feature work. No code changes were made in this update — this section only clarifies resume state.

---

**Getting back to `main`.** `docs/OPERATIONS.md` says demo mode must never be merged. So every polish commit here leaves the demo files alone (`src/lib/demo/*`, `src/app/api/demo/*`, `src/components/demo-banner.tsx`, the demo lines in `src/lib/supabase/*`, `src/proxy.ts`, `src/app/layout.tsx`'s banner, `next.config.ts`'s demo block, `tests/demo-mode.test.ts`). When it's time, a branch cut from `main` cherry-picks the polish commits and skips the three demo commits (`c1317c4`, `9b5a4df`, `6a85fee`) and any commit with "Demo mode:" in its subject. The subjects say which is which.

---

## Blocked on Haven (P0 decisions this code can't make)

These are launch blockers. None of them is worked around or quietly softened.

- [ ] **B1. Historical data license, and data already public.** The 50 real scenarios in `src/data/real-scenarios/*.json` are built from the Kaggle "NQ Futures 1min Bar 2022-2025" file (redistributed CME data, license unverified, personal use only per docs/SCENARIO-VALIDATION.md). They include real OHLC candles, and **the GitHub repo is public** (the unauthenticated API returns 200). So derived CME data is being redistributed publicly now, even though none of it is served in practice (`human_reviewed: false` on all 50). Decide: (a) confirm the license allows this, (b) move the files out of the public repo, and optionally purge them from history (destructive, needs your go-ahead), or (c) make the repo private. Until then no real scenario can be approved for users.
- [ ] **B2. Answer-key review of live constructed exercises.** Every live exercise is constructed. Several definitions behind them are AI-DRAFTED and say "treat as needing review before anyone other than Haven uses the app": MSS, IFVG, Order Block, Premium & Discount, Guided Entry rules, Free Trade rules, and the time-based session boundaries (docs/CURRICULUM.md, docs/CURRICULUM-REVIEW.md). Beta testers are "anyone other than Haven". This needs your review, not code.
- [ ] **B3. Real-scenario review.** 0 of 50 approved at `/review` (blocked on B1 anyway).
- [ ] **B4. Hosted migrations.** Ten migrations are written but not applied to the hosted database: `20260926120000` analytics views, `…130000` practice events, `…140000` admin functions, `20260927120000` roles, `…130000` attempt integrity, `…140000` mistake events, `…150000` question reports, `20260928120000` report reasons + app version, and **`20260929120000` verdict columns + `…130000` analytics could-improve breakdown (new in this phase — Phase B)**. Per the PRD, the app degrades gracefully without them, but reports and mistake events won't be recorded, and every attempt's `verdict` stays null (the dashboard/analytics/mistakes pages fall back to the binary `is_correct` reading they always had). Applying them to production needs your confirmation. They're tested in PGlite (`tests/sql/`).
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

- [x] **Login/sign-up inputs are styled as buttons** (`className="btn-secondary"` on `<input>` in `auth-form.tsx`). Should use `.field`.
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

- [x] **P0-1 Landing claim "Real historical NQ scenarios"** is false today: every live exercise is constructed. Rewrite honestly. Also fix the hero eyebrow, the analytics empty state ("how real market data compares…"), and the site description.
- [x] **P0-2 Demo safeguard, belt and braces.** The gate trusts build-time `NEXT_PUBLIC_VERCEL_ENV`. Promoting a demo-mode preview build to production could carry an open gate. Add a server-side runtime check (`VERCEL_ENV === "production"` → closed), plus tests. *(Demo-branch file; stays out of main.)*
- [ ] **P0-3 Licensing and public data:** blocked, see B1.
- [ ] **P0-4 Constructed answer-key review:** blocked, see B2.
- [x] **P0-5 Secret scan** of tracked files (service role, JWTs, GitHub/Vercel/ngrok tokens). Nothing found. Only `NEXT_PUBLIC_SUPABASE_URL` and the anon/publishable key reach the browser, which is correct.
- [x] **P0-6 Broken-flow check** of every route in demo mode (desktop + 375px, plus 320px and 768px for the main pages): no blank pages, no page-level horizontal overflow, no React errors. The raw-id and input-styling bugs above are fixed under P1/P2. Production build (`next start`, no demo): protected routes redirect to login, `/api/demo` answers 404, no demo banner.

## P1: core UX

- [x] **P1-1 Navigation (Phase 1).** Primary nav: Dashboard, Practice, Mistakes (with open count), Analytics. Account menu (email, log out). Active-page state (`aria-current`). Mobile: a compact top bar plus a fixed bottom tab bar, not the wrapped desktop nav.
- [x] **P1-2 Practice picker (Phase 2).** Sections: Recommended (the engine's pick with its reason, Continue session, Review mistakes if pending). An in-progress session now has an Exit link back to the picker (before, the only way out was finishing), and a finished session no longer reopens its summary on the next visit, Recognition (FVG, IFVG, Liquidity incl. time-based, MSS, Order Block, Premium/Discount), Trade Practice (Guided Entry, Free Trade), Mixed/Review (Adaptive mix, Review mistakes). Each row: name, purpose, difficulty range, approximate length, accuracy with attempts (only at ≥ 5 attempts), recommended flag, CTA. Hierarchy instead of nine equal cards.
- [x] **P1-3 Dashboard (Phase 3).** Order: welcome/status → what to practice next (recommendation card with why, difficulty, time, CTA) → pending mistakes → summary metrics → concept skill rows (bar, attempts, "not enough data" below 5) → recent activity. "Session Score" is replaced by "This week" (attempts in the last 7 days). Metrics are one divided strip rather than four cards, and a concept below 5 attempts shows "N of 5 attempts needed", not a percentage.
- [x] **P1-4 Session complete (Phase 10).** Human labels, score, %, concept, difficulty mix, correct/missed counts, a one-line insight, "Review N mistakes" as the primary CTA when there are misses, missed items as friendly rows.
- [x] **P1-5 Recognition feedback (Phase 7).** Diagnostics checklist: zones get Coverage / Location (time window) / Size, with the measured value; levels get "N points too high/low" and the tolerance. "Show me exactly why" expander. "Retry this chart": graded but **never recorded** (not in stats, score or mistakes), since an immediate retry isn't independent evidence. Presence-only answers ("No FVG present" on a chart with one, or a box on a chart without) get no checklist; the explanation already states the answer.
- [x] **P1-6 Chart layout (Phase 6).** Chart routes use a wide layout (`max-w-7xl`), with the chart as the main column and controls in a narrower side column on desktop. Hover crosshair with a price readout (tick-rounded) for every drawing mode, a price tag on the placed line, a Clear control, and manual entry (see P2-4). Cursor states and touch-action were already right. **Zoom/pan not added:** PRD keeps charts static on purpose, and every chart is framed to fit; see Later. **Undo not added:** each recognition answer is a single mark, so Clear covers it.
- [x] **P1-7 Guided Entry (Phase 8).** A visible stepper (Bias ✓ / Entry ● / Stop / Target) with selected values. "Unclear" and "No Trade" collapsed into one path: choosing Unclear already submitted as No Trade, so the bias step has no separate No Trade button; its commit button reads "Submit as No Trade" when Unclear is picked, and No Trade stays on the entry/stop/target steps (a direction with no valid setup). Back button between steps. Levels snap to the 0.25 tick. Feedback leads with "Your plan: …" then each step. On phones the chart scrolls back into view at each placement step. Beginner-only guidance: risk distance and the 2R target level shown on the target step, difficulty 1 only.
- [x] **P1-8 Free Trade (Phase 9).** "End Session" → "End as No Trade" before a trade, "Exit trade and finish" during one. Playback progress bar, candle count, play/pause, speed kept in localStorage. Keyboard: Space play/pause, → next candle, L long, S short, Esc cancel, ? help. Entry mechanics stated next to Long/Short.
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
- [x] **P2-7 Performance (Phase 21), measured without Lighthouse.** Lighthouse wasn't run (it isn't installed here, and I didn't download it). Measured on `next start`: the landing page loads 11 JS files, ~217 KB transferred, CLS 0.03. The largest client chunks are React DOM (~73 KB gzip), the Supabase client (~69 KB gzip, loaded everywhere because the nav shows auth state) and the Next runtime. The answer-free catalog is ~11 KB gzip. No real-scenario candles are in any client chunk. Chart re-renders were already memoized (PRD perf pass). The crosshair adds one state update per pointer move over the chart; candle marks stay memoized. **Not done:** lazy-loading Supabase on public pages (small win, touches auth). Pages still fetch the user's whole attempt history, which is fine at beta scale; see Known issues.

## P3: maintainability

- [x] **P3-1 Recognition component.** `RecognitionExercise` pulled out of `practice/page.tsx`, like Guided Entry and Free Trade.
- [ ] **P3-2 `usePracticeSession()` hook.** Not done. The page still owns session orchestration, persistence and save/retry. It's a larger refactor that should be done properly on its own, with the session-recovery tests extended first.
- [ ] **P3-3 E2E tests (Phase 25).** Not done: there's no browser test runner in the repo (Playwright would be a new dependency). Unit tests cover grading, the engine, recovery, errors and the demo gate. Flows were walked by hand in the browser pane each batch.
- [x] **P3-5 Reporting (Phase 26).** After feedback the link reads "Think this answer is wrong? Report it". New reason "The explanation is unclear", and the app version (package version + Vercel commit) is stored with each report (migration `20260928120000`, PGlite-tested). Until that migration runs, the action falls back to the old columns and files unclear-explanation reports as "other" with a note. The user's answer, concept and difficulty aren't copied: `session_id` + `exercise_id` join to the attempt row, and the expected answer is the key in the repo.
- [x] **P3-6 Portfolio page (Phase 30).** `/about` ("How it works", linked from every footer): the problem, the solution, how a drawn answer is graded, what's built, and an honest status line. For someone who knows software but not ICT.
- [ ] **P3-4 Scenario metadata tracking (Phase 14/26).** Report count and miss rate per exercise already exist on `/admin` (once B4's migrations run), and review flags fire on several open reports or an abnormal failure rate. Abandonment per exercise isn't tracked.

## Phases checked but not changed (status)

- **Phase 14, content/curriculum.** I can't validate trading correctness myself, so that's B2. What code could find: Free Trade titles leaked outcomes (fixed). The pool is small: 5–10 constructed exercises per concept, 55 in total. Memorization is a real risk until B1/B3 unlock real scenarios or more constructed ones are written and reviewed. Framing randomization already varies the window.
- **Phase 15, adaptive learning.** Already weighs recency (half-life 10), sample size (shrinkage, 3-attempt minimum), difficulty, sub-skills (Guided steps, Free Trade checks) and recent improvement, and explains itself. Open mistakes and days since last practice aren't inputs. Adding them changes the AI-drafted constants the PRD says Haven should review, so it's a **decision for Haven**, not done.
- **Phase 23, storage.** Verified after the refactors: refresh mid-recognition (answer and feedback restored), mid-Guided (step and levels restored), and Free Trade (unchanged restore path). Indexes `(user_id, created_at)` and `(user_id, exercise_id)` exist.
- **Phase 24, security.** Secret scan clean. `/try` is the only new public server action: three ids, strict input checks, pure computation, no writes (tests). **Rate limiting not added:** grading is pure, reports are per-user under RLS, and auth relies on Supabase's own limits. The live RLS test is still B5.
- **Phase 29, historical scenarios.** Pipeline unchanged. Blocked on B1 and B3.

## Known issues (open at the end of this pass)

- **Demo mode only:** "Log out" does nothing, because the demo reviewer is always signed in. In a real build it signs out and returns home.
- **Console noise in automated walks:** "Blocked attempt to show a 'beforeunload' confirmation panel" appears when a script navigates away mid-exercise without a user gesture. It's the leave-page guard working. A real user sees the browser's leave-page prompt instead.
- **Whole-history fetches:** the dashboard, picker, analytics and nav badge read all of a user's attempts (the nav badge only 3 columns). Fine for hundreds or low thousands of rows. At scale this needs SQL summaries, which means a migration.
- **Mobile Free Trade:** during playback the chart can scroll out of view while the controls are used. Minor, and there's no fix without a sticky chart that would crowd a small screen.
- **PGlite SQL suites** occasionally fail under heavy machine load (a dev server compiling during `npm test`) and pass on re-run.
- Everything in "Blocked on Haven" above.

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
| P0 claims, auth field; demo runtime backstop | `0c3414d`, `8eeb247` | tsc ✓ lint ✓ tests 417 ✓ build ✓ |
| Navigation | `718d705` | ✓ all; desktop + 375 |
| Practice picker | `36929c7` | ✓ all; desktop + 375 |
| Dashboard | `2bb138f` | ✓ all; desktop + 375 |
| Session complete | `ee43ade` | ✓ all; desktop |
| Recognition (layout, feedback, retry, manual entry) | `a4a0130` | ✓ all; desktop + 375 |
| Guided Entry | `9226a15` | ✓ all; desktop + 375 |
| Free Trade | `b112d9c` | ✓ all; desktop + 375 |
| Mistakes | `4daedd6` | ✓ all; desktop + 375 |
| Analytics | `cab3786` | ✓ all; desktop + 375 |
| Landing + /try | `c3455d8` | ✓ all; desktop + 375; /try also signed out on the normal server |
| Auth | `21f5eb6` | ✓ all; 375 on the normal server |
| Consistency pass | `595541a` | ✓ all |
| Accessibility | `41f5f07` | ✓ all; typed entry walked |
| Reporting | `d9e9d3a` | ✓ all (PGlite migration tests included) |
| How it works | `7c02849` | ✓ all; 375 |
| Final QA | (this commit) | tsc ✓ lint ✓ tests 447 passed / 1 skipped ✓ build ✓; routes walked at 1280, 768, 375, 320; production build checked for demo isolation |

---

## Practice redesign, Phases B–H (session started 2026-09-29)

*Working from Haven's brief covering grading, feedback, multi-timeframe charts, drawing tools, a new exercise flow, difficulty, and a return pass over the P0–P3 list above. Phases B and C are complete, verified, and committed. Phases D, E, F, and G are each independently substantial — the plan below is deliberately an architecture handoff, not a shallow start, per the brief's own instruction: "Half-built drawing tools, faked timeframe synchronization, or a partial accessibility pass are worse than an honest 'not done.'"*

### Phase B — Grading redesign: done

- [x] Three-state verdict (CORRECT / COULD_IMPROVE / INCORRECT) replacing all-or-nothing, everywhere: Recognition (zone/level), Guided Entry (bias/entry/stop/target/R:R), Free Trade (direction/entry/stop/target/R:R/decision). `src/lib/verdict.ts` is the shared domain and severity math.
- [x] Entry and target graded as zone membership (an entry at the far edge of a valid zone is correct, not wrong); stop graded on whether it protects against the invalidation level, never on distance from a reference price — a wide-but-protecting stop is a near miss, never a hard fail.
- [x] Free Trade's target is now graded on its own, closing the V1 gap docs/CURRICULUM.md flagged.
- [x] Overall verdict is the worst of its components — one imperfect piece never fails an otherwise-sound attempt; trading a no-setup scenario is always INCORRECT regardless of placement quality.
- [x] `is_correct` stays populated for backward compatibility (COULD_IMPROVE counts as correct) — every existing view, dashboard, and analytics computation keeps working unchanged.
- [x] Migration written, not run: `20260929120000_add_verdict_to_attempts.sql` (verdict columns, nullable, no backfill — see the migration's own comment for why a blanket UPDATE would have been unsafe against the grandfathered-historical-row pattern in `20260927130000_attempt_integrity.sql`) and `20260929130000_analytics_could_improve.sql` (view column addition). Both added to the B4 list below.
- [x] **Production-safety fix applied proactively:** the new columns don't exist on the hosted database yet. `fetchAttempts`/`insertAttempt`/`migrateLocalAttempts` catch the Postgres "column does not exist" error and retry without the verdict columns — the same fallback pattern already used for report reasons (`src/app/report/actions.ts`). Grading and the dashboard keep working on `is_correct` alone until Haven applies the migrations, then upgrade automatically with no further code change.
- [x] Dashboard and analytics "Concepts" rows draw a COULD_IMPROVE segment inside the accuracy bar (`SkillRows`), with a percentage note.
- [x] Content: the 5 hand-authored Guided Entry exercises and 5 Free Trade scenarios got real answer keys grounded in each chart's actual swing structure (not a mechanical transform — each was read from its candles and comments). The 20 pending-review real-data scenarios (`real-guided-*`, `real-ft-*`, still blocked on B1/B3) got a faithful mechanical schema conversion that preserves their previously-accepted range exactly. `scripts/build_trade_scenarios.py` now emits the new schema natively for any future pipeline run, using the setup finder's actual swing extreme for the stop rather than an already-buffered reference price.
- [x] Curriculum versions bumped (`guided_entry` v2, `free_trade` v2) since the grading rules changed; constructed exercises re-verified, real scenarios' recorded versions updated.
- [x] Verified live in the browser (demo mode): all three verdict states — correct, could improve, incorrect — render correctly with real computed distances, on both Guided Entry and Recognition (Liquidity level).

**Commits:** `a6f7c96` (grading engine + content + migration), `6709d3e` (could-improve UI, docs, degrade-safely fix), `f6ea487` (Phase C sentence tightening).

### Phase C — Feedback rewrite: done, now covering all three answer families

- [x] Guided Entry and Free Trade entry/stop/target feedback is one self-contained mentor sentence per component, generated from the attempt's own numbers (real computed distance, real formatted zone bounds or invalidation price) — never a hard-coded generic string, and never claims something the data doesn't support.
- [x] Bias feedback keeps the exercise's authored paragraph (already mentor-style and data-grounded per exercise — "Price swept below the prior swing low around 21,300 ... A liquidity sweep followed by a structural break the other way is a confirmed bullish Market Structure Shift.") — that's the right place for the fuller setup narrative; entry/stop/target no longer concatenate onto it, keeping each within the one-or-two-sentence target.
- [x] Correct answers get short, real feedback too ("Good target — you aimed at the actual liquidity this setup was drawing toward (21,455–21,470).").
- [x] Recognition's existing checklist details (coverage %, box height ratio, points off a level) were already data-driven per-attempt; unchanged, now feeding three-state verdicts instead of pass/fail.
- [x] ICT terminology (buy-side/sell-side liquidity, sweep, MSS, FVG, IFVG) appears only where the exercise's own detected structure actually uses it — nothing new was invented for feedback text.
- [x] **Follow-up session:** extended the same mentor-style rewrite to Recognition (zone/level/choice, `src/lib/grading.ts`), which Phase C originally left on the old grader-style composed text (`buildCorrectAnswerStatement` + `explanation` concatenation with a "The correct answer was: ..." lead-in). `zoneExplanation`/`levelExplanation`/`choiceExplanation` now generate the same one-or-two-sentence, data-driven feedback: correct answers confirm what was read right (`Right — {exercise.explanation}`); near-misses (too-small box, too-wide box) say what to look for instead using the concept's own plain-English rule (`src/lib/concepts.ts`'s `rule` field, e.g. FVG's "the gap is the price range between those two wicks..."); a wrong-area or wrong-candles box, or a missed/false-positive no-answer read, uses the exercise's own authored `explanation`/`distractor_note` rather than a generic phrase. Level near-misses name the actual level in terms of what it represents (`answerLabel`, e.g. "the actual buy-side liquidity, at 21,315") instead of a bare distance. `buildCorrectAnswerStatement` itself is untouched — Review Mistakes (`src/lib/mistake-text.ts`) still uses it for its separate "correct answer" field, which is a different UI surface and out of scope here. Three-state (COULD_IMPROVE) grading for zone/level was already in place from the original Phase B work; nothing changed there. Verified live in demo mode: a too-wide FVG box now reads "You found the right area, but marked it too wide" plus the FVG rule; an off-level Liquidity answer reads "You were 15 points too high of the actual buy-side liquidity, at 21,315." Three grading tests that asserted the old boilerplate string were updated to assert the new mentor-style text instead (`tests/grading.test.ts`); full suite (454 tests) still green.

**Not done, out of scope for this pass:** a systematic audit of every existing exercise's step-explanation prose for redundancy with the new lead sentences. The two now sit back-to-back (lead sentence, then the exercise's own paragraph) rather than being merged into one voice. Low risk, cosmetic, logged as a polish item below.

### Phase D — Synchronized multi-timeframe charts: not done

**Why not attempted:** this is a new data model, a new offline+runtime resampling pipeline, and a substantially rebuilt chart UI (zoom, pan, historical navigation, fast timeframe switching, a layout that dominates the page) — independently comparable in size to Phase B. Starting it shallow would mean either fake synchronization (unrelated charts labelled with timeframes, explicitly forbidden by the brief) or a chart that can't actually do what's asked (pan/zoom/switch). Neither is acceptable half-done.

**What exists to build on:**
- `scripts/ingest.py` already resamples 1-minute source bars to N-minute buckets offline (`--resample 5,15`), anchored to session boundaries. This is the "pipeline already resamples offline" the brief refers to — it needs extending to emit *multiple simultaneous* timeframes from one source range with shared anchoring, not just one target timeframe per ingest run.
- `src/lib/framing.ts` already has the concept of a server-computed viewing window over a stored candle array, and a `hidden_candles`-style pattern already exists end to end in Free Trade (`src/data/exercises.ts`, `FreeTradeExercise.hidden_candles`) — future data never reaches the client until revealed, verified by `tests/framing.test.ts` and a DOM-scan noted in docs/CURRICULUM.md.
- `src/components/practice/candlestick-chart.tsx` (819 lines) is a hand-rolled SVG chart with its own coordinate/layout system (`src/lib/coordinates.ts`) — no charting library is installed. Phase D's zoom/pan/switching needs either a substantial extension of this component or a decision to adopt a library (a real product decision, not a code-only one: bundle size, license, and rewrite cost all matter).

**Concrete plan for the next session:**
1. **Data model** (`src/data/exercises.ts`): a new exercise shape (or a variant of the existing ones) carrying `{ timeframe: "4H"|"1H"|"15M"|"5M"|"1M", candles: Candle[], hidden_candles: Candle[] }[]` for the timeframes a given scenario actually uses ("not every exercise needs all five" — the brief is explicit), plus a single `current_time` cutoff shared across all of them. Same-moment swings must be the same market moment across timeframes — that has to be true by construction (built from one shared underlying 1-minute series), not by review.
2. **Offline pipeline** (`scripts/`): extend `ingest.py` or add a sibling script that, given a `current_time` cutoff and a set of target timeframes, resamples one source range into all of them at once from the same 1-minute rows, splitting each at the cutoff into `candles`/`hidden_candles`. Reuse the existing bucket-alignment logic in `ingest.py`'s `resample()` rather than re-deriving it.
3. **Runtime resampling** (new `src/lib/resample.ts`): for constructed (hand-authored) scenarios that don't have a pre-built htf file, or for on-the-fly timeframe switches the offline pipeline didn't precompute, mirror the Python bucket logic in TypeScript. This needs its own unit tests asserting a swing high on the 1H bucket is the same price/time as on the 5M series it was built from (same spirit as `tests/framing.test.ts`).
4. **Security**: `hidden_candles` must exist and be enforced *per timeframe*, not just per exercise — a user on the 1H view must not be able to read future 5M structure through a timeframe switch. Needs the same DOM-scan verification method docs/CURRICULUM.md already used for Free Trade, repeated per timeframe.
5. **Chart UI**: the practice route for this mode should not be constrained to the shared `max-w-7xl`/`ChartFrame` used everywhere else (`src/components/practice/exercise-layout.tsx`) — it needs its own wider layout. Zoom/pan needs real state (visible candle range, not the whole stored array) layered onto `buildChartLayout`/`priceToY`/`candleIndexToX` in `src/lib/coordinates.ts`, which currently assumes the full passed-in array is what's drawn. Timeframe switching needs a control that swaps the active `candles` array while keeping the visible time window aligned across timeframes (the same real moment stays centered).
6. **Decision needed from Haven either way:** the PRD's existing note ("charts stay static on purpose — coordinate bugs") was a deliberate constraint from an earlier phase. Phase D reverses it. Confirm that's intended before this ships, since it changes the answer-recording coordinate system's assumptions (`user_candle_start`/`user_candle_end` are stored candle-array indices today — panning changes what's "on screen" but must not change what's stored, same principle `src/lib/framing.ts` already established for the existing single-timeframe case).

### Phase E — Chart drawing tools: not done

**Why not attempted:** genuine objects with hit-testing, move/resize/edit, and an undo stack are a real feature, not a styling pass — the brief is explicit that faking this is worse than not building it. It also has a natural dependency on Phase D's chart rebuild: building a drawing layer twice (once for the current static chart, once for the Phase D zoom/pan chart) is wasted work, so this should follow Phase D, not precede it.

**Concrete plan for the next session:**
1. **Data model** (new `src/lib/drawings.ts`): a `Drawing` union (`{ id, type: "hline"|"ray"|"trendline"|"rect"|"text", ...type-specific anchors, style }`). Horizontal lines and rectangles are price-anchored (persist across compatible timeframes per the brief — "a 1H high marked as buy-side liquidity stays visible on 5M"); trend lines and rays need both a price and a candle-index (or timestamp) anchor per point, which only makes sense once Phase D's shared time axis exists across timeframes.
2. **Toolbar** (new component, left rail or a collapsible panel per the brief): cursor/select, horizontal line, ray, trend line, rectangle, text, delete, clear all, undo/redo. A dealing-range tool (premium/equilibrium/discount) is explicitly optional ("if it doesn't require disproportionate architecture") — Premium/Discount's existing `EQUILIBRIUM_BAND` constant and rendering in `candlestick-chart.tsx` is the reusable piece.
3. **Hit-testing and interaction**: real pointer-based selection (distance-to-line-segment for trend lines/rays, point-in-rect for rectangles, a fixed hit radius for handles), drag-to-move, handle-drag-to-resize, all layered into the existing pointer-event handling in `candlestick-chart.tsx` (`toSvgPoint`, the existing drag-start/drag-end state machine used for zone/level answers today).
4. **Undo/redo**: a command stack (push on every create/move/resize/delete; undo/redo replay it), not just an array of current state — needed for real undo semantics, not just "clear."
5. **Persistence**: drawings are the user's own analysis and are explicitly never graded — `src/lib/storage.ts`'s existing per-exercise-session localStorage pattern (used today for in-progress answers) is the right place, keyed by exercise id, not a new DB table.
6. **Extensibility the brief asks for without building it now**: keep `Drawing` tagged with enough (`id`, `type`, a stable anchor shape) that a later "compare to reference analysis" feature could diff against a stored reference set — don't design the comparison now, just don't paint into a corner (e.g., don't use untyped free-form SVG paths for lines/rects where a structured anchor would do).

### Phase F — Exercise flow (CONTEXT → BIAS → CONFLUENCES → CONFIRMATION → EXECUTION): not done

**Why not attempted:** this is a new exercise runner (the brief is explicit it should not be a copy of the Guided Entry stepper) plus a new content-authoring effort (confluence checklists and an HTF-to-LTF progression don't exist in any current exercise), and it has a hard dependency on Phase D (HTF/LTF multi-timeframe charts) and a soft dependency on Phase E (marking liquidity/dealing range during the Context and Confirmation stages is explicitly part of the flow). Building the runner without real multi-timeframe data or real drawing tools would mean faking the two things the flow is built around.

**Concrete plan for the next session, once D and E exist:**
1. **New exercise type**, e.g. `MultiStepExercise` in `src/data/exercises.ts`: `htf_timeframes`/`ltf_timeframes` (from Phase D's per-timeframe data), a `confluences: { id, label }[]` checklist with no revealed correct/incorrect until grading, a `bias_options` set (bullish/bearish/neutral-unclear, draw-on-liquidity buy-side/sell-side/unclear — "don't force every question in every scenario," so these are per-exercise optional), and the eventual trade decision (long/short/no-trade + entry/stop/target when trading).
2. **New runner component** (`src/components/practice/multi-step-exercise.tsx` or similar), its own stepper distinct from `GuidedStepper` — five stages, each gated on the previous, matching the pattern `guided-exercise.tsx` already establishes for a gated multi-step flow (state machine, autosave draft, restore-after-refresh) without literally reusing its bias/entry/stop/target shape.
3. **Grading**: every component graded (HTF Context, Bias, Confluences, LTF Confirmation, Trade Decision, Entry, Stop, Target) — Confluences grading is new: a set-comparison against which pieces of evidence actually apply on this chart (true positives, false positives, missed ones), most naturally expressed as its own three-state-per-item checklist reusing `src/lib/verdict.ts`'s primitives, not a single pass/fail.
4. **Content**: enough scenarios to make the mode usable, explicitly including ones where No Trade is correct (HTF/LTF conflict, mid-range price, no sweep, no displacement, no MSS, no clean entry, poor R:R, confirmation hasn't happened, unclear draw — the brief's own list). This is a real authoring effort, not a code task — likely the single largest piece of Phase F by hours. Any real-data version of this content routes through the existing `/review` workflow (docs/SCENARIO-VALIDATION.md), never published directly, same rule as every other real scenario.
5. **Difficulty (Phase G) falls out of this content**, not a separate mechanism: Level 1 scenarios are clean with 2–3 confluences and optional hints; Level 3 scenarios are messy with conflicting signals and minimal hints. This is an authoring property of Phase F's scenario set, so there's nothing to build for Phase G beyond what Phase F's content already needs to vary.

### Phase H — Resume the perfection plan: mostly already true

Re-checked against the checklist above (P0–P3): everything with `[x]` was already verified before this session and nothing in Phases B/C touched it in a way that would invalidate that verification (grading changes are additive to `GradeResult`/`GuidedGradeResult`/`FreeTradeGradeResult`, not removals; every consumer was updated and re-verified in this session's test runs). Remaining open items, unchanged from before this session and still accurate:

- [ ] **P3-2 `usePracticeSession()` hook** — not attempted this session either, for the same reason noted when it was first deferred: it's a real refactor that needs the session-recovery tests extended first, not a drive-by change alongside Phases B/C.
- [ ] **P3-3 E2E tests** — not attempted. Adding Playwright is a real dependency/infrastructure decision, not something to slip in as a side effect of a grading rewrite.
- [ ] **P3-4 Scenario abandonment tracking (per exercise, not per session)** — investigated this session: session-level abandonment already exists (`practice_events.session_abandoned`, `v_session_abandonment`, `position` reached). Per-exercise abandonment (which specific exercise a user was on when they left) isn't recoverable from what's recorded today — a session's planned exercise order isn't persisted anywhere, only individual attempts are. Building it means either persisting the planned sequence or accepting a fragile inference from attempt order; a real (if small) design decision, not a quick add, so left as-is.

### Polish backlog added this session

- Phase C's step-explanation prose (bias step) and the new lead sentences (entry/stop/target) read as two adjacent voices rather than one merged paragraph. Cosmetic, low priority — logged here instead of docs/POLISH-BACKLOG.md since it's specific to this session's change, not a general UI nit.

### Summary for Haven

**Completed and verified this session:** Phase B (three-state grading, everywhere) and Phase C (mentor-style, data-driven feedback for Guided Entry and Free Trade). Both are fully wired end to end — grading, DB schema (written, not run), dashboard, analytics, mistakes, content, docs — and verified with `tsc`, `eslint`, the full test suite (454 passing, 1 skipped), a production build, and a live walkthrough in the browser covering all three verdict states.

**Deliberately not done, and why:** Phases D (multi-timeframe charts), E (drawing tools), and F (the new exercise flow) are each independently large — comparable in scope to Phase B on their own — and F structurally depends on D and E. Starting any of them shallow would produce exactly what the brief calls out as worse than not doing it: fake timeframe sync, a drawing layer that doesn't really support move/resize/undo, or a new exercise runner built against multi-timeframe data and drawing tools that don't actually exist yet. Phase G has no independent content — it falls out of Phase F's authoring. Detailed architecture plans for each are above, grounded in what already exists in this codebase (the offline resampling in `scripts/ingest.py`, the `hidden_candles` security pattern, the SVG chart's coordinate system, the drawing-persistence precedent in `src/lib/storage.ts`), so the next session can start building rather than re-investigating.

**Migrations awaiting Haven's action:** unchanged from the B4 list above, plus the two new ones from this session (`20260929120000_add_verdict_to_attempts.sql`, `20260929130000_analytics_could_improve.sql`). Nothing in this session requires them to be applied immediately — the app degrades to its pre-Phase-B behavior (binary `is_correct`, no could-improve breakdown) until they run, verified by the fallback logic in `src/lib/attempts.ts`.

**Blocked on Haven, unchanged:** everything in "Blocked on Haven" above (B1–B9) is still exactly as blocked as before this session; nothing in Phases B–D changes any of those decisions. Phase D adds one more question for Haven specifically (see Phase D above): confirming that trading away the PRD's original "charts stay static" decision is intended, since Phase D's whole premise is reversing it.
