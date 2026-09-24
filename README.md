# ICT Concepts Practice Platform

A practice tool for learning to recognize ICT (Inner Circle Trader) chart concepts by drawing your answer directly on a chart and getting instant, specific feedback. It's built for beginner traders who already know the *definition* of a concept from watching videos but haven't practiced actually spotting it on a chart.

## The problem

Learning to read charts today is mostly passive: watch someone circle a pattern on a video, nod along, and feel like you understand it. Then you open a real chart and freeze, because recognizing a pattern and knowing its definition are different skills. There's unlimited explanation available and almost no structured, graded repetition. This app is the repetition — one concept (the Fair Value Gap), one interaction (draw a box), done well enough to trust before adding anything else.

## Status: Milestone 1 complete

- Five hand-built Fair Value Gap exercises: two bullish, one bearish, one bullish-but-harder (smaller gap, busier price action), and one with **no** valid FVG — including a deliberate near-miss designed to tempt the wrong answer
- Draw-a-box answers on a chart, graded automatically — no manual checking
- A "No FVG present" option, visible on every exercise regardless of whether one actually exists, so its presence never gives away the answer
- Session tracking: a running score as you go, and a summary at the end showing what you missed
- A dashboard showing lifetime accuracy and total exercises completed, read from what's actually been practiced

**Not built yet:** accounts, a database, real market data (the candles are constructed prototype data, clearly labeled as such in the code), or any concept other than the Fair Value Gap. The full scope — including everything deliberately deferred and why — is in [docs/PRD-MVP-V1.md](docs/PRD-MVP-V1.md).

## How grading works

A drawn box will almost never match the true gap's boundaries exactly, so "correct" can't be a simple equality check. Grading is two tests, and both have to pass:

- **Coverage** — how much of the true gap's price range falls inside your box. This catches a box that's just in the wrong place.
- **Precision** — how much bigger your box is than the true gap. This exists specifically to stop the obvious cheat: without it, drawing a box around the entire chart would pass coverage every time. Precision is what makes an oversized guess fail.

A third check — your box has to horizontally include the middle candle of the three-candle formation — catches a box that's the right size and price level but centered on the wrong moment in time. The exact thresholds (60% coverage, 2.5x precision) and the reasoning behind them are in the PRD's Decision Log, along with a note that they were only validated by someone who already knows what an FVG looks like — they still need checking against real beginner attempts.

## Tech stack, and why

- **Next.js (App Router) + TypeScript** — a standard, well-documented foundation. No backend is needed yet, and TypeScript keeps the exercise data shape and grading math honest as the project grows.
- **Tailwind CSS** — enough to build a consistent dark theme quickly without hand-rolling a design system for a project this size.
- **Hand-built SVG chart, no charting library** — the actual thing this project needs to prove out is the coordinate math: turning a drawn pixel box into a price range and a candle range, precisely enough to grade. A charting library would hide exactly the logic this app exists to own, and would add its own opinions about interaction that would just have to be fought when wiring up box-drawing.
- **localStorage, no backend** — V1 is testing whether the draw-and-grade interaction is worth building on top of, not testing a database schema. The fields saved locally now already match what a real `attempts` table would need later (see PRD Section 9), so adding a backend later is a migration, not a redesign.

## Real data pipeline

Every exercise so far uses hand-built prototype candles. Real historical NQ data is supported alongside them, through a pipeline in [`scripts/`](scripts/) (Python 3.9+, `pip install -r scripts/requirements.txt`):

1. **`ingest.py`** reads a raw OHLC CSV, validates it (ordering, duplicate timestamps, gaps outside scheduled market closures, bar integrity, sane price ranges), converts timestamps to New York time, and writes clean JSON. Any validation error stops it with nothing written.
2. **`detect.py`** scans the clean data and flags *candidate* setups using the exact rules in [docs/CURRICULUM.md](docs/CURRICULUM.md): three-candle FVGs, equal highs/lows, MSS by body close, previous day / NY AM session / weekly highs and lows.
3. **`build_scenario.py`** turns one chosen candidate plus a window of candles into an exercise in the app's format.

**Why it exists:** the hard part of real data isn't the candles, it's the answer key. On a real chart, "where is the FVG?" can have zero answers or three, and an answer typed in by eye is only as good as the person typing it. So answer keys here are **derived from the curriculum's rules by code**, never typed by hand, and `build_scenario.py` refuses a window that has more than one valid answer. Code is still not the judge, though. Detection only *finds* candidates. **Every scenario is reviewed by a human against the curriculum before anyone practices on it.** Each scenario carries a provenance record (data source, date range, the detection rule that flagged it, a hash of the raw file, and who reviewed it). The app refuses to serve any scenario that hasn't been reviewed. The full process and review checklist are in [docs/SCENARIO-VALIDATION.md](docs/SCENARIO-VALIDATION.md).

Charts show time context whenever an exercise's candles carry real timestamps: date/time labels, a separator at each trading-day boundary (18:00 ET), and shading for the New York AM session (9:30–11:00 ET).

## Running it locally

```bash
npm install
npm run dev
```

Then open http://localhost:3000.

## Documentation

The full requirements, exercise data format, grading rules, decision log, and open questions live in [docs/PRD-MVP-V1.md](docs/PRD-MVP-V1.md).

---

*For educational and practice purposes only. Not financial advice.*
