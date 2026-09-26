import Link from "next/link";
import { DisclaimerFooter } from "@/components/disclaimer-footer";
import { PrimaryButton } from "@/components/primary-button";

// Every claim here describes something that exists in the app today
// (README.md "What's built"). No statistics, testimonials or performance
// claims — this is a practice tool, not a trading system.

const CONCEPTS = [
  {
    name: "Fair Value Gap",
    detail: "Mark the gap a displacement leaves behind, and judge whether price later respected it.",
  },
  {
    name: "Inverse FVG",
    detail: "Spot a gap that failed and now acts from the other side.",
  },
  {
    name: "Liquidity",
    detail: "Place the level where stops rest: equal highs and lows, and previous-day, NY AM and weekly extremes.",
  },
  {
    name: "Market Structure Shift",
    detail: "Find the swing whose body-close break turned the trend.",
  },
  {
    name: "Order Block",
    detail: "Mark the last opposing candle before a move that broke structure.",
  },
  {
    name: "Premium & Discount",
    detail: "Read where price sits in its dealing range, and when it's too close to equilibrium to call.",
  },
];

const MODES = [
  {
    eyebrow: "Mode 1",
    name: "Recognition",
    detail:
      "One concept, one chart. Draw a box, place a line or pick an answer, and \"there isn't one\" is always an option. Graded by explicit rules on coverage, precision and tolerance, not by eye.",
  },
  {
    eyebrow: "Mode 2",
    name: "Guided Entry",
    detail:
      "Build a trade idea in order: bias, entry, stop, target, at 2:1 or better. Each step is graded on its own, and No Trade is often the right answer.",
  },
  {
    eyebrow: "Mode 3",
    name: "Free Trade",
    detail:
      "Play a session forward candle by candle, with no future candles on screen. Graded on your process: a good trade that loses still passes, and a lucky one doesn't.",
  },
];

const HOW = [
  {
    name: "Real historical NQ scenarios",
    detail:
      "Scenarios cut from historical NQ futures data, with answer keys derived from the curriculum's rules by code. None reaches practice until a person has checked it.",
  },
  {
    name: "Adaptive practice",
    detail:
      "The app tracks accuracy per concept, weighting your recent attempts most, and recommends what to practice next and at what difficulty. It tells you why.",
  },
  {
    name: "Performance analytics",
    detail:
      "Accuracy over time, by concept and difficulty, per Guided Entry step, and Free Trade process versus win rate, plus a CSV export for your own analysis.",
  },
];

export default function Home() {
  return (
    <div className="flex flex-1 flex-col">
      <div className="mx-auto w-full max-w-4xl flex-1 px-4 pt-16 pb-20 sm:px-6 sm:pt-24">
        {/* Hero */}
        <section className="max-w-2xl">
          <p className="eyebrow">ICT concepts · NQ futures · Practice</p>
          <h1 className="mt-4 text-4xl leading-[1.05] sm:text-6xl">
            Stop watching setups. Start spotting them.
          </h1>
          <p className="mt-6 text-base sm:text-lg">
            Graded practice for reading ICT concepts on NQ charts. Mark your answer on the chart and get immediate
            feedback that explains the rule, whether you were right or wrong.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <PrimaryButton href="/dashboard">Start practicing</PrimaryButton>
            <Link href="/login" className="btn-secondary">
              Log in
            </Link>
          </div>
          <p className="mt-6 text-xs">
            For educational purposes only. Not financial advice, and not a trading system: this trains chart
            reading and makes no claim about trading results.
          </p>
        </section>

        {/* Concepts */}
        <section className="mt-24">
          <p className="eyebrow">Six concepts</p>
          <h2 className="mt-3 text-2xl sm:text-3xl">The building blocks, one at a time</h2>
          <p className="mt-3 max-w-2xl">
            Each concept has a written definition that every answer key is checked against, and exercises that include
            deliberate near-misses.
          </p>
          <ul className="mt-8 grid gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-2 lg:grid-cols-3">
            {CONCEPTS.map((c) => (
              <li key={c.name} className="bg-surface p-5 sm:p-6">
                <h3 className="text-base">{c.name}</h3>
                <p className="mt-2 text-sm">{c.detail}</p>
              </li>
            ))}
          </ul>
        </section>

        {/* Modes */}
        <section className="mt-24">
          <p className="eyebrow">Three practice modes</p>
          <h2 className="mt-3 text-2xl sm:text-3xl">From spotting a pattern to deciding on a trade</h2>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {MODES.map((m) => (
              <div key={m.name} className="card">
                <p className="eyebrow">{m.eyebrow}</p>
                <h3 className="mt-2 text-lg">{m.name}</h3>
                <p className="mt-2 text-sm">{m.detail}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Data, adaptive, analytics */}
        <section className="mt-24">
          <p className="eyebrow">How it works</p>
          <h2 className="mt-3 text-2xl sm:text-3xl">Honest answers, and practice that adapts</h2>
          <dl className="mt-8 space-y-8 border-t border-line pt-8">
            {HOW.map((h) => (
              <div key={h.name} className="grid gap-2 sm:grid-cols-[14rem_1fr] sm:gap-8">
                <dt className="text-base font-semibold text-foreground">{h.name}</dt>
                <dd className="text-sm sm:text-base">{h.detail}</dd>
              </div>
            ))}
          </dl>
        </section>

        {/* Closing CTA */}
        <section className="card mt-24 flex flex-col items-start gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl">Start with a short session.</h2>
            <p className="mt-1 text-sm">Sign up with an email and password. Your attempts are visible only to you.</p>
          </div>
          <PrimaryButton href="/dashboard">Start practicing</PrimaryButton>
        </section>
      </div>

      <DisclaimerFooter />
    </div>
  );
}
