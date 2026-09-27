"use client";

import { useState } from "react";
import { reportQuestion } from "@/app/report/actions";
import { describeError } from "@/lib/errors";
import { REPORT_NOTE_MAX, REPORT_REASONS, type ReportReason, type ReportStage } from "@/lib/report-reasons";

/** "Report a problem" on an exercise, while answering or from feedback.
 * The exercise id and session come from the page, never from the user. */
export function ReportQuestion({
  exerciseId,
  stage,
  sessionId,
}: {
  exerciseId: string;
  stage: ReportStage;
  sessionId: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const needsNote = reason === "other" && note.trim().length === 0;

  async function submit() {
    if (!reason || needsNote || sending) return;
    setSending(true);
    setError(null);
    try {
      const res = await reportQuestion({ exerciseId, reason, note, stage, sessionId });
      if (res.ok) setSent(true);
      else setError(res.error);
    } catch (err) {
      setError(describeError(err, "send your report").message);
    } finally {
      setSending(false);
    }
  }

  if (sent) {
    return (
      <p className="mt-4 text-sm text-muted" role="status">
        Thanks, your report was sent. It&apos;ll be looked at when this exercise is reviewed.
      </p>
    );
  }

  if (!open) {
    return (
      <div className="mt-2 flex justify-end">
        <button type="button" onClick={() => setOpen(true)} className="btn-link">
          Report a problem
        </button>
      </div>
    );
  }

  return (
    <form
      className="card mt-4"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <fieldset>
        <legend className="text-sm font-semibold text-foreground">What&apos;s wrong with this exercise?</legend>
        <div className="mt-3 flex flex-wrap gap-2">
          {REPORT_REASONS.map((r) => (
            <button
              key={r.value}
              type="button"
              aria-pressed={reason === r.value}
              onClick={() => setReason(r.value)}
              className="btn-option"
            >
              {r.label}
            </button>
          ))}
        </div>
      </fieldset>
      <label className="mt-4 block text-sm text-muted">
        {reason === "other" ? "What's wrong? (required)" : "Anything to add? (optional)"}
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={REPORT_NOTE_MAX}
          rows={3}
          className="field"
        />
      </label>
      {error && (
        <p className="text-error mt-3" role="alert">
          {error}
        </p>
      )}
      <div className="mt-4 flex flex-wrap gap-3">
        <button type="submit" disabled={!reason || needsNote || sending} className="btn-primary">
          {sending ? "Sending…" : "Send report"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="btn-secondary">
          Cancel
        </button>
      </div>
    </form>
  );
}
