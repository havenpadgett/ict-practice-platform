import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DailyChallenge } from "@/components/daily/daily-challenge";
import { shareableExercise } from "@/lib/challenge-source";
import { conceptDisplayName } from "@/lib/concepts";
import { dailyExerciseId, dailyPath, isDateKey, utcDateKey } from "@/lib/daily";
import { toPublicExercise } from "@/lib/public-exercise";

// The daily challenge for a date (src/lib/daily.ts): the same chart for
// everyone, with its own link. Today and earlier days only; a future date
// would show tomorrow's chart early. The page carries the chart and prompt,
// never the key, exactly like /c/<id>.

export const dynamic = "force-dynamic";

type Params = { date: string };

function exerciseFor(date: string) {
  if (!isDateKey(date) || date > utcDateKey()) return null;
  const id = dailyExerciseId(date);
  return id ? shareableExercise(id) : null;
}

const longDate = (date: string) =>
  new Date(`${date}T00:00:00Z`).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { date } = await params;
  const e = exerciseFor(date);
  if (!e) return { title: "Daily challenge", robots: { index: false } };
  const title = `Daily challenge, ${longDate(date)}`;
  const description = `Today's chart: ${conceptDisplayName(e.concept)}. ${e.prompt} The same chart for everyone. No account needed.`;
  return {
    title,
    description,
    alternates: { canonical: dailyPath(date) },
    openGraph: { title, description, url: dailyPath(date), type: "website" },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function DailyPage({ params }: { params: Promise<Params> }) {
  const { date } = await params;
  if (!isDateKey(date) || date > utcDateKey()) notFound();
  const e = exerciseFor(date);

  if (!e) {
    // A date before the first daily is a 404; a scheduled chart that can't be
    // served right now (withdrawn, or real-data charts switched off) is not.
    if (dailyExerciseId(date) === null) notFound();
    return (
      <div className="flex flex-1 flex-col">
        <div className="page">
          <h1 className="page-title">Daily challenge</h1>
          <p className="page-lede">This day&apos;s chart isn&apos;t available right now.</p>
          <div className="mt-6 flex gap-3">
            <Link href="/try" className="btn-primary">
              Try a few charts
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const exercise = toPublicExercise(e);
  if (exercise.answer_type === "free") notFound();
  const today = utcDateKey();

  return (
    <div className="flex flex-1 flex-col">
      <div className="page max-w-7xl pt-6 sm:pt-8">
        <h1 className="eyebrow">Daily challenge · {longDate(date)}</h1>
        <p className="mt-2 mb-6 text-sm text-muted">One chart a day, the same for everyone. No account needed; the answer stays hidden until you submit.</p>
        <DailyChallenge exercise={exercise} date={date} today={today} />
      </div>
    </div>
  );
}
