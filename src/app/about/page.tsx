import type { Metadata } from "next";
import Link from "next/link";
import { DisclaimerFooter } from "@/components/disclaimer-footer";
import { PrimaryButton } from "@/components/primary-button";
import { realApprovalCounts } from "@/lib/real-data-provenance";

export const metadata: Metadata = {
  title: "How it works",
  description:
    "What ICT Practice is for, how answers are graded, how practice adapts, and how it's built, in plain product language.",
};

// For someone who knows software but not ICT trading. Every claim here is
// something the app does today (docs/PROJECT-SUMMARY.md has the long form
// with links into the code).

const GRADING = [
  { name: "Coverage", detail: "At least 60% of the correct price range has to be inside your box. Did you find it?" },
  { name: "Size", detail: "Your box can be at most 2.5× as tall as the correct one. Did you find it, or cover everything?" },
  { name: "Candles", detail: "Your box has to span the candle that defines the setup. Right price, right moment?" },
  { name: "Lines", detail: "A placed line passes within a fixed number of points of the correct level, and feedback says how far off it was." },
];

const BUILT = [
  {
    name: "Interactive chart",
    detail:
      "Hand-built SVG, no charting library: pointer and touch drawing, coordinate math from pixels to price and candle, and typed entry as a keyboard alternative.",
  },
  { name: "Deterministic grading", detail: "Pure, unit-tested functions. Answer keys stay on the server and come back only with a verdict." },
  {
    name: "Adaptive practice",
    detail:
      "Per-concept skill scores weighted toward recent answers and pulled toward overall accuracy when there are few, so one miss can't label a concept weak.",
  },
  { name: "Data and auth", detail: "Supabase Postgres with row-level security on every table, and migrations tested against an in-process Postgres." },
  { name: "Resilience", detail: "Every answer autosaves, so a refresh resumes the same exercise. A failed save keeps the attempt for a retry." },
  {
    name: "Responsive and accessible",
    detail: "A mobile tab bar, 44px targets, a visible focus ring, answers told apart by line style as well as color, and reduced-motion support.",
  },
];

export default function AboutPage() {
  const real = realApprovalCounts();
  return (
    <div className="flex flex-1 flex-col">
      <div className="page">
        <p className="eyebrow">How it works</p>
        <h1 className="page-title mt-2">Graded chart practice, in plain terms</h1>

        <section className="mt-10" aria-labelledby="about-problem">
          <h2 id="about-problem" className="text-lg">
            The problem
          </h2>
          <p className="mt-2">
            Traders learn chart patterns from ICT (Inner Circle Trader) videos by watching someone else circle them.
            Knowing a definition and spotting it on a live chart are different skills, and there&apos;s almost nowhere to
            practice the second with feedback. It&apos;s like learning a language from lectures with no exercises.
          </p>
        </section>

        <section className="mt-10" aria-labelledby="about-solution">
          <h2 id="about-solution" className="text-lg">
            The solution
          </h2>
          <p className="mt-2">
            You answer on the chart itself: draw a box around a pattern, place a line at a price level, or say there
            isn&apos;t one. The app grades it against a written rule and draws the correct answer (dashed) next to yours
            (solid). Three modes build on each other: recognizing one concept, planning a trade step by step, and trading
            a chart that plays forward candle by candle, where the grade is for the process, not whether it won.
          </p>
        </section>

        <section className="mt-10" aria-labelledby="about-grading">
          <h2 id="about-grading" className="text-lg">
            How a drawn answer is graded
          </h2>
          <p className="mt-2">
            A drawn box never matches exactly, so &ldquo;correct&rdquo; is a set of tolerances rather than a pixel match.
            Each is reported back with the measured value.
          </p>
          <dl className="mt-4 divide-y divide-line border-y border-line">
            {GRADING.map((g) => (
              <div key={g.name} className="grid gap-1 py-3 sm:grid-cols-[8rem_1fr] sm:gap-6">
                <dt className="text-sm font-semibold text-foreground">{g.name}</dt>
                <dd className="text-sm">{g.detail}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="mt-10" aria-labelledby="about-built">
          <h2 id="about-built" className="text-lg">
            What&apos;s built
          </h2>
          <dl className="mt-4 divide-y divide-line border-y border-line">
            {BUILT.map((b) => (
              <div key={b.name} className="grid gap-1 py-3 sm:grid-cols-[12rem_1fr] sm:gap-6">
                <dt className="text-sm font-semibold text-foreground">{b.name}</dt>
                <dd className="text-sm">{b.detail}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="mt-10" aria-labelledby="about-status">
          <h2 id="about-status" className="text-lg">
            Where it stands
          </h2>
          <p className="mt-2">
            Practice mixes hand-built charts with real historical NQ futures charts. The real ones come from a pipeline whose
            answer keys are derived by code from the written definitions, never typed in. {real.human} of them were also
            checked by hand; the other {real.auto} were approved automatically from the same detection rules, with no one
            reading them first, and are spot-checked after the fact. There&apos;s no data on learning outcomes yet, so none
            is claimed.
          </p>
        </section>

        <div className="mt-12 flex flex-wrap gap-3">
          <PrimaryButton href="/try">Try 3 charts, no account</PrimaryButton>
          <Link href="/" className="btn-secondary">
            Overview
          </Link>
        </div>
      </div>
      <DisclaimerFooter />
    </div>
  );
}
