# Project Summary: ICT Concepts Practice Platform

*For portfolio reviewers. Written 2026-09-26 (AI-DRAFTED, pending Haven's review). Every claim links to where it can be checked. Where something is unfinished or unmeasured, this says so.*

**Owner:** Haven Padgett, Product Owner / Business Analyst. The requirements, curriculum definitions and key product calls are Haven's. The code was built with an AI coding assistant working from the PRD. Decisions it made on its own are marked **AI-DRAFTED** in the [Decision Log](PRD-MVP-V1.md#14-decision-log) and are pending Haven's review.

---

## 1. The problem

Beginner traders learn ICT (Inner Circle Trader) concepts such as Fair Value Gaps, liquidity and market structure shifts by watching videos. They can recite a definition and still freeze in front of a live chart, because **knowing a definition and recognizing it on a chart are different skills**. Explanation is plentiful. Structured, graded repetition is almost nonexistent.

The [PRD](PRD-MVP-V1.md) states the V1 goal narrowly: show a beginner a chart, ask them to mark one concept, grade the drawing, and explain the answer. Every later mode is a harder version of that loop, so the loop had to be trustworthy first.

## 2. The solution

A web app where the user answers **on the chart itself**, gets an instant verdict, and always sees the correct answer stated explicitly.

| Mode | What the user does | Graded on |
|---|---|---|
| **Recognition** (7 concept sets) | Draw a box, place a line, or choose | Coverage, precision and time for boxes. A tolerance for lines. |
| **Guided Entry** | Bias → entry → stop → target, or "No Trade" | Each step independently; 2:1 minimum R:R |
| **Free Trade** | Candle-by-candle playback; decide if and when to trade | **Process, not outcome.** A losing trade with a sound plan passes. A winning trade with a bad plan fails. |

Around the practice loop:
- accounts with per-user attempt history;
- an adaptive recommendation engine;
- user-facing analytics and a CSV export;
- an internal review tool for real-data scenarios;
- a product-health admin page.

**Content today:**
- **55 hand-built exercises** across 9 concept sets.
- **50 real-data scenarios built from historical NQ futures data. None has been approved yet, so none is in practice.**

**Users today:** no user research or real-user data exists yet. The app works end to end, but nothing below claims learning outcomes.

## 3. Architecture, and why each piece

| Piece | Choice | Why | Where |
|---|---|---|---|
| App | Next.js 16 (App Router) + TypeScript | Server and client in one codebase. Types keep the exercise data shape and the grading math honest. | `src/app/` |
| Chart | **Hand-built SVG, no charting library** | The core of the product is the coordinate math that turns a drawn pixel box into a price and candle range precisely enough to grade. A library would hide exactly that logic. | `src/components/` |
| Grading | Pure functions, separate from UI | Grading is where a silent bug teaches users something wrong, so it's tested in isolation. | `src/lib/grading.ts` |
| Exercise content | **Version-controlled TypeScript and JSON, not the database** | Every answer key is reviewable in a diff and tied to a versioned curriculum definition. | `src/data/` |
| User data | Supabase (Postgres + Auth), **Row Level Security** on every table | Users can only read and write their own rows, enforced by the database, not by app code. | `supabase/migrations/` |
| Route protection | `src/proxy.ts` (Next 16's renamed middleware) | Server-side redirect for signed-out users. The original root-level `middleware.ts` never ran under Next 16, a bug found and fixed. | `src/proxy.ts` |
| Real-data pipeline | Python, standard library only | Runs anywhere with Python 3.9+, and is easy to audit. | `scripts/` |
| Analytics | SQL views + event table + Python analysis | One definition of each metric shared by the app, the SQL editor and BI tools. | Section 5 |
| Tests | Vitest, Python `unittest`, **PGlite** (in-process Postgres) for SQL | Migrations, views, RLS and admin functions are tested against real Postgres without a hosted database. | `tests/`, `scripts/tests/` |

**Tests:** `npm test` passes 109 tests. It skips 1: a live RLS check that needs two real test accounts. `npm run test:py` passes 11.

## 4. The data pipeline and its validation

The hardest problem wasn't rendering real candles. It was **making sure an answer key built from real data is actually right.** The approach ([SCENARIO-VALIDATION.md](SCENARIO-VALIDATION.md)):

1. **Ingest** (`scripts/ingest.py`): validates 1-minute NQ bars, cuts trading sessions, and aggregates to 5m/15m. It fails loudly on data that can't be right: bars during scheduled exchange closures, gaps and duplicates.
2. **Detect** (`scripts/detect.py`): finds candidates using the rules written in [CURRICULUM.md](CURRICULUM.md). **Answer keys are derived by code from the rules, never typed by hand.**
3. **Build** (`scripts/build_scenario.py`, `build_trade_scenarios.py`): turns candidates into exercises. Each carries provenance: source file hash, trading date, session, timeframe, detection rule and curriculum version.
4. **Human review** (`/review`): a reviewer checks each chart against the definition shown beside it. They approve, reject with a structured reason, or flag it ambiguous. **The app refuses to serve any real scenario that isn't approved under the current version of every definition it depends on** (`isPracticeReady` in `src/data/exercises.ts`).
5. **Curriculum versioning:** changing a definition's text without bumping its version fails the test suite. A version bump pulls dependent scenarios back into review automatically.

**What validation caught** (all in the [Bug Log](PRD-MVP-V1.md#16-bug-log)):
- **Timestamps:** the vendor stamps bars with their *close* time, which put every candle one minute late with no visible error. It was caught by the closure-bar check.
- **Cross-session detection:** it paired 10:55 one day with 9:30 the next, producing fake FVGs and MSS in 16 of 61 FVG candidates on one slice.
- **Mislabeled levels:** day and week levels were computed from session-only data and labeled as full-day levels (1,778 wrong candidates per run).
- **Stale thresholds:** fixed-point thresholds were calibrated on ten unusually volatile sessions. They were replaced with volatility-relative ones (AI-DRAFTED).

**Open issues, stated plainly:**
- The dataset's license is unverified, so it is for personal use only.
- **0 of 50 real scenarios have been reviewed.**

## 5. Analytics: what's built and what it shows

**Built:**
- **SQL views** ([SQL-QUERIES.md](SQL-QUERIES.md)), all with invoker security so RLS still applies:
  - accuracy by concept and by difficulty;
  - improvement per 20-attempt block;
  - per-exercise success rate;
  - real vs constructed;
  - Guided Entry per-step accuracy;
  - Free Trade process pass rate vs win rate;
  - response time, correct vs incorrect;
  - session drop-off.

  `/analytics` reads them. It falls back to computing the same numbers in the browser if they're missing, and a test checks that both paths agree.
- **Event tracking** (`practice_events`):
  - sessions started, completed and abandoned, with the position reached;
  - the mode used;
  - whether a session came from the recommendation or the user's own pick;
  - time between sessions.

  Writes are fire-and-forget, so tracking can never break practice.
- **CSV exports** (per attempt and per session) for Power BI or Excel ([ANALYTICS.md](ANALYTICS.md)).
- **`/admin`:** product health across all users, served through `security definer` database functions that check an admin table. No service-role key ever sits on the app server.
- **Python analysis** (`analysis/`):
  - Wilson intervals;
  - a user-level bootstrap, because attempts from one person aren't independent;
  - a within-concept comparison of real vs constructed;
  - multiple-testing-corrected anomaly flags for suspect answer keys.

**What the analytics reveal: nothing about real users yet.** No real attempt data was available when the analysis was written.

The analysis was instead validated on **synthetic data with planted effects**, to show it finds what's there and stays quiet about what isn't:

| Planted effect | Result |
|---|---|
| Accuracy rises with practice | Recovered |
| MSS is the hardest concept | Recovered |
| Real scenarios are harder | Recovered |
| One broken answer key | Recovered, along with 2 chance flags. That is within its stated 10% false-discovery rate. |
| A deliberately weak speed effect | Correctly **not** claimed |

On a one-user, 40-attempt dataset it reports "not enough data" instead of a finding. Those results validate the method, not the product ([analysis/README.md](../analysis/README.md)).

**Migrations status:** the three analytics migrations (`20260926120000_analytics_views.sql`, `20260926130000_practice_events.sql`, `20260926140000_admin_functions.sql`) are written and tested against PGlite. **They have not been applied to the hosted database.** The app degrades gracefully until they are.

## 6. Significant decisions

From the [Decision Log](PRD-MVP-V1.md#14-decision-log). Alternatives and reasoning are there in full.

| Decision | Why | Rejected alternative |
|---|---|---|
| **V1 covered FVG only, on prototype data, with no accounts** | Prove the practice loop before scaling curriculum, data or infrastructure | Three concepts at once, which would triple grading logic before any of it was validated |
| **Users draw a box, graded on coverage + precision + time** | Mirrors real chart work. A simple overlap check can be gamed by drawing a huge box. | Click-the-candle, which teaches location only; multiple choice, a weaker skill than recall |
| **"There's nothing here" is a legitimate answer** | Patience over action is the platform's philosophy. The Product Owner overruled the PM's recommendation to defer this. | Defer to V2 |
| **Liquidity became a line, not a box** | A level is a price. Grading a box against an arbitrary band was unfair, and a bug exposed it. | Widen the band, which treats a model mismatch as a tuning problem |
| **Guided Entry and Free Trade graded on process, not win/loss** | Grading on outcomes rewards luck, which is the habit the product exists to break | Grade on P&L |
| **Real data only through code-derived keys + human approval** | A code rule is consistent. A human checks the rule matches what a trader would call the concept. | Hand-labeled charts, or trusting detection alone |
| **The curriculum is versioned** | Definitions will change under review, and a stale answer key must not stay live silently | Hash-only change detection |
| **Adaptive engine shrinks scores toward overall accuracy** (AI-DRAFTED) | One wrong answer on a new concept was making it "weakest". A test caught this. | Plain lowest-accuracy concept |
| **Analytics as SQL views, admin through `security definer` functions** (AI-DRAFTED) | One metric definition for every consumer. All-user access without putting a service-role key on the app server. | Browser-only metrics; a service-role key in a server route |
| **Tests that fail against current code stay failing and are logged as bugs** | Tests exist to find wrong behavior, not to be made green | Editing tests to pass |

## 7. What isn't done

From the PRD [Backlog](PRD-MVP-V1.md#15-backlog):
- **Review the 50 real scenarios.** Nothing real is live until then.
- **Confirm the NQ data license** before any public release.
- **A real-phone mobile pass:** mobile has only been tested in an emulated viewport.
- **Re-check grading tolerances** against real beginner attempts.
- **Apply the three analytics migrations.**
- **Review the AI-DRAFTED decisions and definitions:** Haven still needs to review all of them.

---

*For educational and practice purposes only. Not financial advice.*
