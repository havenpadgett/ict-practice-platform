import { AccuracyBar } from "@/components/analytics/accuracy-bar";
import type { ExerciseAccuracy } from "@/lib/analytics";

export function ExerciseAccuracyList({ exercises }: { exercises: ExerciseAccuracy[] }) {
  if (exercises.length === 0) return null;

  return (
    <div className="space-y-4">
      {exercises.map((exercise) => (
        <AccuracyBar
          key={exercise.exerciseId}
          label={`${exercise.exerciseId} · ${exercise.label}`}
          accuracy={exercise.accuracy}
          sublabel={`${exercise.missed} missed / ${exercise.total}`}
        />
      ))}
    </div>
  );
}
