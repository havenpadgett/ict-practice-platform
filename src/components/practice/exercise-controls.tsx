export function ExerciseControls({
  hint,
  canSubmit,
  onSubmit,
  onNoAnswer,
  noAnswerLabel,
}: {
  /** How to answer on the chart — the chart itself is the selection
   * control; this row holds only the commit actions. */
  hint: string;
  canSubmit: boolean;
  onSubmit: () => void;
  onNoAnswer: () => void;
  noAnswerLabel: string;
}) {
  return (
    <div className="flex flex-col gap-4 border-t border-line pt-5 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-muted">{hint}</p>
      <div className="flex flex-wrap gap-3 sm:justify-end">
        {/* Visible on every exercise, has_answer or not — its presence must
            never hint at the answer. */}
        <button type="button" onClick={onNoAnswer} className="btn-secondary">
          {noAnswerLabel}
        </button>
        <button type="button" onClick={onSubmit} disabled={!canSubmit} className="btn-primary">
          Submit
        </button>
      </div>
    </div>
  );
}
