import { challengeOgImage, OG_SIZE } from "@/lib/card/og";
import { shareableExercise } from "@/lib/challenge-source";

// The link preview for a challenge: the chart and the question, never the answer.

export const alt = "A chart challenge: mark your answer on the chart";
export const size = OG_SIZE;
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  return challengeOgImage(shareableExercise((await params).id));
}
