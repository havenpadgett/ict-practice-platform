import { challengeOgImage, OG_SIZE } from "@/lib/card/og";
import { shareableExercise } from "@/lib/challenge-source";
import { dailyExerciseId, isDateKey, utcDateKey } from "@/lib/daily";

// The link preview for a daily challenge: that day's chart, never its answer.

export const alt = "The daily chart challenge";
export const size = OG_SIZE;
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ date: string }> }) {
  const { date } = await params;
  const id = isDateKey(date) && date <= utcDateKey() ? dailyExerciseId(date) : null;
  const label = isDateKey(date)
    ? `Daily challenge · ${new Date(`${date}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })}`
    : "Daily challenge";
  return challengeOgImage(id ? shareableExercise(id) : null, label);
}
