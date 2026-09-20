import { AccuracyBar } from "@/components/analytics/accuracy-bar";

const DIFFICULTY_LABELS: Record<number, string> = {
  1: "Difficulty 1 (easiest)",
  2: "Difficulty 2",
  3: "Difficulty 3 (hardest)",
};

export function DifficultyAccuracyBars({ byDifficulty }: { byDifficulty: Record<number, number> }) {
  const levels = [1, 2, 3].filter((level) => byDifficulty[level] !== undefined);
  if (levels.length === 0) return null;

  return (
    <div className="space-y-4">
      {levels.map((level) => (
        <AccuracyBar key={level} label={DIFFICULTY_LABELS[level]} accuracy={byDifficulty[level]} />
      ))}
    </div>
  );
}
