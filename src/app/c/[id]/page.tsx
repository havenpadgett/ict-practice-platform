import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ChallengeRunner } from "@/components/challenge/challenge-runner";
import { DisclaimerFooter } from "@/components/disclaimer-footer";
import { challengePath } from "@/lib/challenge";
import { shareableExercise } from "@/lib/challenge-source";
import { conceptDisplayName } from "@/lib/concepts";
import { toPublicExercise } from "@/lib/public-exercise";

// A public chart challenge (src/lib/challenge.ts). The page carries the
// chart and the prompt and nothing that grades them: toPublicExercise drops
// the key, the explanation and the provenance (docs/ANSWER-KEYS.md).

type Params = { id: string };

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const e = shareableExercise((await params).id);
  if (!e) return { title: "Challenge not found", robots: { index: false } };
  const title = `Chart challenge: ${conceptDisplayName(e.concept)}`;
  const description = `${e.prompt} Mark your answer on the chart and see how it compares. No account needed.`;
  return {
    title,
    description,
    alternates: { canonical: challengePath(e.exercise_id) },
    openGraph: { title, description, url: challengePath(e.exercise_id), type: "website" },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function ChallengePage({ params }: { params: Promise<Params> }) {
  const e = shareableExercise((await params).id);
  if (!e || e.answer_type === "free") notFound();
  const exercise = toPublicExercise(e);
  if (exercise.answer_type === "free") notFound();

  return (
    <div className="flex flex-1 flex-col">
      <div className="page max-w-7xl pt-6 sm:pt-8">
        <div className="flex items-baseline justify-between gap-4">
          <h1 className="eyebrow">Chart challenge · no account needed</h1>
        </div>
        <p className="mt-2 mb-6 text-sm text-muted">Mark your answer on the chart. The correct answer stays hidden until you submit.</p>
        <ChallengeRunner exercise={exercise} source="challenge" sharePath={challengePath(e.exercise_id)} />
      </div>
      <DisclaimerFooter />
    </div>
  );
}
