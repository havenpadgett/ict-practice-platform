import { AccuracyBar } from "@/components/analytics/accuracy-bar";
import { getExerciseMeta } from "@/data/catalog";
import { conceptDisplayName, DIFFICULTY_LABELS } from "@/lib/concepts";
import type { ExerciseAccuracy } from "@/lib/analytics";

/** Most-missed first. Named by concept, difficulty and timeframe, never by
 * database id. */
export function ExerciseAccuracyList({ exercises }: { exercises: ExerciseAccuracy[] }) {
  const missed = exercises.filter((e) => e.missed > 0);
  if (missed.length === 0) return <p className="text-sm text-muted">No exercise missed in this view.</p>;

  return (
    <div className="space-y-4">
      {missed.map((exercise) => {
        const meta = getExerciseMeta(exercise.exerciseId);
        const name = meta
          ? `${meta.concept === "FreeTrade" ? `Free Trade: ${meta.answerLabel}` : conceptDisplayName(meta.concept)} · ${DIFFICULTY_LABELS[meta.difficulty]} · ${meta.timeframe}`
          : "An exercise that's no longer available";
        return (
          <AccuracyBar
            key={exercise.exerciseId}
            label={name}
            accuracy={exercise.accuracy}
            sublabel={`missed ${exercise.missed} of ${exercise.total}`}
          />
        );
      })}
    </div>
  );
}
