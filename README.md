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
