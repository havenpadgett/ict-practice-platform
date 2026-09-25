export function ExerciseControls({
  canSubmit,
  onSubmit,
  onNoAnswer,
  noAnswerLabel,
}: {
  canSubmit: boolean;
  onSubmit: () => void;
  onNoAnswer: () => void;
  noAnswerLabel: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        onClick={onSubmit}
        disabled={!canSubmit}
        className="btn-primary"
      >
        Submit
      </button>
      {/* Visible on every exercise, has_answer or not — its presence must
          never hint at the answer. */}
      <button
        type="button"
        onClick={onNoAnswer}
        className="btn-secondary"
      >
        {noAnswerLabel}
      </button>
    </div>
  );
}
