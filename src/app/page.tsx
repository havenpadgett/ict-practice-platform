import Link from "next/link";
import { PrimaryButton } from "@/components/primary-button";
import { GlossaryText } from "@/components/glossary/glossary-text";
import { HeroExercise } from "@/components/landing/hero-exercise";
import { TrainingPreview } from "@/components/landing/training-preview";
import { buildLandingSample } from "@/lib/landing-sample";
import { LANDING_EXERCISE_ID } from "@/lib/challenge";
import { shareableExercise } from "@/lib/challenge-source";
import { toPublicExercise } from "@/lib/public-exercise";
import { realApprovalCounts } from "@/lib/real-data-provenance";

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
  {
    eyebrow: "Mode 4",
    name: "Simulator and training",
    detail:
      "Seeded scenarios with a bias, liquidity, entry, stop and target to decide, or no trade at all. Scored on process; sessions are picked from the skills you are weakest at.",
  },
];

const LOOP = [
  { step: "1", name: "Draw", detail: "Mark the setup on the chart: a box, a line, or \u201cthere isn\u2019t one\u201d." },
  { step: "2", name: "Submit", detail: "Graded against a written rule with fixed tolerances, never by eye." },
  { step: "3", name: "Compare", detail: "Your answer stays solid; the correct one appears dashed beside it." },
  { step: "4", name: "Understand", detail: "Each test is measured: coverage, size, candles, distance, with the rule behind it." },
];

const HOW = (real: { human: number; auto: number }) => [
  {
    name: "Hand-built and real practice charts",
    detail: `Every hand-built chart is built around one written definition, with deliberate near-misses, and graded by the same explicit rule every time. Alongside them, a growing set of charts are real historical NQ price action: ${real.human} checked by hand against the same rules, and ${real.auto} approved automatically by the same detection rules that derive their answer keys, with no one reading them first, and spot-checked afterwards.`,
  },
  {
    name: "Adaptive practice",
    detail:
      "The app tracks accuracy per concept and seven separate skills, weighting your recent attempts most. It recommends what to practice next, at what difficulty, and tells you why: no AI picking scenarios, the same history gives the same picks.",
  },
  {
    name: "Performance analytics",
    detail:
      "Accuracy over time, by concept and difficulty, process scores by setup and session, your most common mistakes, confidence against accuracy, and what you know versus what you can apply. A rate is only shown with its sample size. CSV export for your own analysis.",
  },
];

export default async function Home() {
  const sample = await buildLandingSample();
  const how = HOW(realApprovalCounts());
  const heroSource = shareableExercise(LANDING_EXERCISE_ID);
  const hero = heroSource ? toPublicExercise(heroSource) : null;
  return (
    <div className="flex flex-1 flex-col">
      <div className="mx-auto w-full max-w-6xl flex-1 px-4 pt-12 pb-20 sm:px-6 sm:pt-20">
        {/* Hero */}
        <section className="grid items-start gap-x-12 gap-y-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:grid-rows-[auto_1fr]">
          <div className="max-w-xl lg:col-start-1 lg:row-start-1 lg:pt-8">
            <p className="eyebrow">ICT training · NQ-style charts · Deliberate practice</p>
            <h1 className="mt-4 text-4xl leading-[1.05] sm:text-6xl">
              Don&apos;t memorize ICT. Train it.
            </h1>
            <p className="mt-5 text-base sm:mt-6 sm:text-lg">
              Trading concepts don&apos;t become skills until you can find them yourself. Learn the concepts. Read the
              chart. Execute the model. Try the exercise on the right now: mark it on the chart and see how it&apos;s
              graded.
            </p>
          </div>
          {/* On a phone the exercise follows the headline directly; the
              actions come after it. */}
          <div className="lg:col-start-2 lg:row-span-2 lg:row-start-1">
            {hero && hero.answer_type === "zone" ? (
              <HeroExercise exercise={hero} />
            ) : (
              <PrimaryButton href="/try">Try 3 charts, no account</PrimaryButton>
            )}
          </div>
          <div className="max-w-xl lg:col-start-1 lg:row-start-2">
            <div className="flex flex-wrap items-center gap-3">
              <PrimaryButton href="/login?mode=signup">Create a free account</PrimaryButton>
              <Link href="/try" className="btn-secondary">
                Try 3 more charts
              </Link>
              <Link href="/daily" className="btn-link">
                Today&apos;s daily challenge
              </Link>
            </div>
            <p className="mt-6 text-xs">
              For educational purposes only. Not financial advice, and not a trading system: this trains chart
              reading and makes no claim about trading results.
            </p>
          </div>
        </section>

        {/* The product, in miniature */}
        {sample && (
          <section className="mt-24" aria-labelledby="train-heading">
            <p className="eyebrow">The simulator</p>
            <h2 id="train-heading" className="mt-3 text-2xl sm:text-3xl">
              Read it. Mark it. Decide. Watch it play out.
            </h2>
            <p className="mt-3 max-w-2xl">
              Replay a chart with only what was visible at the time, take, wait on or skip the trade, and get scored on how you read and executed it. Then train the part that was weak.
            </p>
            <div className="mt-8">
              <TrainingPreview sample={sample} />
            </div>
          </section>
        )}

        {/* The loop */}
        <section className="mt-24" aria-labelledby="loop-heading">
          <h2 id="loop-heading" className="sr-only">
            How practice works
          </h2>
          <ol className="grid gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
            {LOOP.map((l) => (
              <li key={l.name} className="bg-background p-5 sm:p-6">
                <p className="eyebrow">Step {l.step}</p>
                <h3 className="mt-2 text-base">{l.name}</h3>
                <p className="mt-1.5 text-sm">{l.detail}</p>
              </li>
            ))}
          </ol>
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
                <p className="mt-2 text-sm">
                  <GlossaryText text={c.detail} />
                </p>
              </li>
            ))}
          </ul>
        </section>

        {/* Modes */}
        <section className="mt-24">
          <p className="eyebrow">Four ways to practice</p>
          <h2 className="mt-3 text-2xl sm:text-3xl">From spotting a pattern to running a model</h2>
          <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {MODES.map((m) => (
              <div key={m.name} className="card">
                <p className="eyebrow">{m.eyebrow}</p>
                <h3 className="mt-2 text-lg">{m.name}</h3>
                <p className="mt-2 text-sm">
                  <GlossaryText text={m.detail} />
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Data, adaptive, analytics */}
        <section className="mt-24">
          <p className="eyebrow">How it works</p>
          <h2 className="mt-3 text-2xl sm:text-3xl">Honest answers, and practice that adapts</h2>
          <dl className="mt-8 space-y-8 border-t border-line pt-8">
            {how.map((h) => (
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
            <h2 className="text-xl">Start with three charts.</h2>
            <p className="mt-1 text-sm">No account needed to try it. Sign up to save your answers; they&apos;re visible only to you.</p>
          </div>
          <PrimaryButton href="/try">Try 3 charts, no account</PrimaryButton>
        </section>
      </div>

    </div>
  );
}
