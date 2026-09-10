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
        className="inline-flex items-center justify-center rounded-md bg-accent px-6 py-2.5 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
      >
        Submit
      </button>
      {/* Visible on every exercise, has_answer or not — its presence must
          never hint at the answer. */}
      <button
        type="button"
        onClick={onNoAnswer}
        className="inline-flex items-center justify-center rounded-md border border-line px-6 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-surface"
      >
        {noAnswerLabel}
      </button>
    </div>
  );
}
