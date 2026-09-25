# ICT Concepts Practice Platform

A practice tool for learning to read ICT (Inner Circle Trader) concepts on NQ futures charts. You mark your answer directly on a chart and get instant, specific feedback. It's built for beginner traders who already know the *definition* of a concept from watching videos but haven't practiced spotting it or trading from it.

## The problem

Learning to read charts today is mostly passive. You watch someone circle a pattern on a video, nod along, and feel like you understand it. Then you open a real chart and freeze, because recognizing a pattern and knowing its definition are different skills. There's unlimited explanation available and almost no structured, graded repetition. This app is the repetition.

## What's built

### Six concepts (Mode 1: recognition)

Every definition lives in [docs/CURRICULUM.md](docs/CURRICULUM.md). Each is tagged HAVEN-VALIDATED or AI-DRAFTED, and answer keys are written against it.

| Concept | You answer by | Hand-built exercises |
|---|---|---|
| **Fair Value Gap** | drawing a box; plus "respected or disrespected?" as a choice | 10 |
| **Inverse FVG** | drawing a box; plus respected/disrespected | 10 |
| **Liquidity** (strongest buy/sell-side pool) | placing a line | 5 |
| **Time-based liquidity** (previous day, NY AM session, weekly highs/lows) | placing a line | 5 |
| **Market Structure Shift** | placing a line on the broken swing | 5 |
| **Order Block** | drawing a box | 5 |
| **Premium & Discount** | choosing premium, discount, or at equilibrium | 5 |

Liquidity and time-based liquidity are one concept family with separate practice sets, which is why the table has seven rows. Recognition exercises that can have no answer include a deliberate near-miss. The "none present" option is on every such exercise, so its presence never gives the answer away.

### Three practice modes

1. **Recognition:** the concepts above.
2. **Guided Entry:** build a trade in four graded steps: bias, entry, stop and target, with a 2:1 minimum risk-to-reward. "No Trade" is often the right answer. 5 hand-built scenarios.
3. **Free Trade:** candle-by-candle playback. Decide if and when to go long or short, then place a stop and target. Future candles are never rendered and the price axis scales to revealed candles only. Graded on process (direction, entry, stop, R:R, trade decision), never on whether the trade won. 5 hand-built scenarios.

### Grading

- **Zone answers** (drawn boxes) must pass three tests:
  - **Coverage:** at least 60% of the true zone's price range.
  - **Precision:** the box no more than 2.5× the zone's height, so a box over the whole chart fails.
  - **Time:** the box includes the key candle.

  A correctly placed but too-small box is told so, not "wrong area".
- **Level answers:** the line must be within a per-exercise tolerance.
- **Every response states the correct answer explicitly.**

Rules and reasoning: [docs/PRD-MVP-V1.md](docs/PRD-MVP-V1.md), Section 6.

### Real market data, with human validation

A Python pipeline in [`scripts/`](scripts/) turns historical NQ 1-minute bars into exercises:

| Script | What it does |
|---|---|
| `ingest.py` | Validates bars (including the vendor's close-time labels), cuts sessions and aggregates to 5m/15m. |
| `detect.py` | Finds candidates with the curriculum's rules: FVG, equal highs/lows, MSS, order blocks, dealing ranges, time-based levels. Thresholds adapt to volatility, and no setup spans a session break. |
| `build_scenario.py`, `pick_candidates.py` | Build recognition exercises. |
| `build_trade_scenarios.py` | Builds Guided Entry and Free Trade scenarios from detected setups, no-trade sessions included. |

Answer keys come from the rules, never typed by hand. **No real scenario is served until a human approves it** at `/review` (login plus an allow-listed email). Each scenario carries provenance: source, trading date, session, timeframe, detection rule and reviewer.

**Status:** 50 real scenarios are built and all 50 are awaiting review, so none are in practice yet:
- 10 FVG, 10 liquidity and 10 MSS recognition exercises;
- 10 Guided Entry scenarios;
- 10 Free Trade sessions.

The data's license is unverified (personal use only; see [docs/SCENARIO-VALIDATION.md](docs/SCENARIO-VALIDATION.md)).

### Accounts, adaptive practice and analytics

- **Accounts:** email/password via Supabase Auth. Attempts are stored per user and protected by Row Level Security. Google sign-in is wired but disabled until the provider is configured.
- **Adaptive practice:** a recommendation engine (`src/lib/recommendations.ts`) scores each concept. It weights recent attempts more heavily, and concepts with few attempts are pulled toward your overall accuracy. It recommends a specific next session (concept, difficulty, length) with a plain-English reason, naming the weakest Guided Entry step where relevant. There is also an **Adaptive mix** session that leans toward weak concepts while keeping some strong ones.
- **Dashboard:** overall accuracy, per-concept accuracy, practice streak, and the recommended session (one click to start).
- **Analytics:**
  - accuracy trend line;
  - accuracy by concept, by difficulty, and by difficulty within each concept;
  - real-data vs constructed accuracy;
  - Guided Entry per-step accuracy;
  - Free Trade process pass rate beside win rate;
  - most-missed exercises and response times;
  - the recommendation engine's full breakdown.
- **CSV export** (`/api/export/attempts`, login required): one flat row per attempt for Power BI or Excel. Columns are documented in [docs/ANALYTICS.md](docs/ANALYTICS.md).

### Tests

- **`npm test`:** Vitest suite for grading (every answer type and the no-answer matrix), attempt records against PRD Section 9, session-data validation, RLS policies, the recommendation engine, error handling and the CSV export.
- **`npm run test:py`:** detection-rule fixtures.

One test fails on purpose, until a pending migration is applied: attempts don't yet record `session_id` (PRD Bug Log, 2026-09-25).

### Mobile

Charts resize their coordinate space to the screen so labels stay readable. Every control is at least 44×44 px, and dragging on a chart draws instead of scrolling. This has been checked at 375px and 414px in an emulated browser, **not yet on a real phone**.

## Tech stack, and why

- **Next.js (App Router) + TypeScript:** a standard, well-documented foundation. TypeScript keeps the exercise data shape and grading math honest.
- **Supabase (Postgres + Auth):** user attempts and profiles only. Exercise content stays in version-controlled code and JSON, reviewed against the curriculum; nothing about exercises lives in the database.
- **Tailwind CSS:** a consistent dark theme without a hand-rolled design system.
- **Hand-built SVG chart, no charting library:** the project's core is the coordinate math that turns a drawn pixel box into a price range and candle range precisely enough to grade. A library would hide exactly that logic.
- **Python for the data pipeline:** standard library only (plus `tzdata`), so it runs anywhere with Python 3.9+.

## Running it locally

```bash
npm install
npm run dev
```

Create `.env.local` with `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` (or `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`). Add `REVIEWER_EMAILS` (a comma-separated list of emails) to use `/review`. Apply the SQL in `supabase/migrations/` to your Supabase project in order.

Then open http://localhost:3000. Other commands:

```bash
npm test
```

```bash
npm run test:py
```

```bash
npm run catalog
```

`npm run catalog` regenerates the exercise metadata catalog after exercises change.

## Documentation

- [docs/PRD-MVP-V1.md](docs/PRD-MVP-V1.md): requirements, grading rules, build status by phase, decision log, backlog, bug log.
- [docs/CURRICULUM.md](docs/CURRICULUM.md): every concept definition and detection parameter, with provenance.
- [docs/SCENARIO-VALIDATION.md](docs/SCENARIO-VALIDATION.md): the real-data pipeline, data sources, and review checklist and log.
- [docs/ANALYTICS.md](docs/ANALYTICS.md): the CSV export's columns and example questions.

---

*For educational and practice purposes only. Not financial advice.*
