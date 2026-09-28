export function ExerciseControls({
  hint,
  canSubmit,
  onSubmit,
  onNoAnswer,
  noAnswerLabel,
  onClear,
}: {
  /** How to answer on the chart — the chart itself is the selection
   * control; this row holds only the commit actions. */
  hint: string;
  canSubmit: boolean;
  onSubmit: () => void;
  onNoAnswer: () => void;
  noAnswerLabel: string;
  /** Removes the box or line drawn so far; absent when there's none. */
  onClear?: () => void;
}) {
  return (
    <div className="border-t border-line pt-5 lg:border-t-0 lg:pt-0">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <p className="text-sm text-muted">{hint}</p>
        {onClear && (
          <button type="button" onClick={onClear} className="btn-link text-sm">
            Clear
          </button>
        )}
      </div>
      <div className="mt-4 flex flex-wrap gap-3">
        <button type="button" onClick={onSubmit} disabled={!canSubmit} className="btn-primary">
          Submit
        </button>
        {/* Visible on every exercise, has_answer or not — its presence must
            never hint at the answer. */}
        <button type="button" onClick={onNoAnswer} className="btn-secondary">
          {noAnswerLabel}
        </button>
      </div>
    </div>
  );
}
