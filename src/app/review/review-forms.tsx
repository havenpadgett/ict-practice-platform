"use client";

import { useActionState } from "react";
import { approveAction, rejectAction, type ReviewActionState } from "@/app/review/actions";

const initial: ReviewActionState = { error: null, done: null };

function Status({ state }: { state: ReviewActionState }) {
  if (state.error) return <p className="mt-2 text-sm" style={{ color: "#e2685f" }}>{state.error}</p>;
  if (state.done) return <p className="mt-2 text-sm text-accent">{state.done}</p>;
  return null;
}

const field = "mt-1 w-full rounded border border-line bg-background p-2 text-sm text-foreground";
const button = "mt-2 rounded border border-line px-4 py-1.5 text-sm text-foreground hover:bg-background disabled:opacity-40";

export type ReviewText = { key: string; label: string; draft: string };

export function ReviewForms({ id, texts, disabled }: { id: string; texts: ReviewText[]; disabled: boolean }) {
  const [approveState, approve, approving] = useActionState(approveAction, initial);
  const [rejectState, reject, rejecting] = useActionState(rejectAction, initial);

  return (
    <div className="mt-4 grid gap-6 sm:grid-cols-2">
      <form action={approve}>
        <input type="hidden" name="id" value={id} />
        <p className="text-xs text-muted">
          Rewrite the draft text users will see: plain language, no candle numbers, state the answer.
        </p>
        {texts.map((t) => (
          <label key={t.key} className="mt-2 block text-xs text-muted">
            {t.label}
            <textarea
              name={`text:${t.key}`}
              rows={t.key === "explanation" ? 6 : 3}
              className={field}
              defaultValue={t.draft}
              required
            />
          </label>
        ))}
        <label className="mt-2 block text-xs text-muted">
          Review notes (optional)
          <input name="notes" className={field} />
        </label>
        <button type="submit" className={button} disabled={disabled || approving}>
          {approving ? "Approving…" : "Approve"}
        </button>
        <Status state={approveState} />
      </form>
      <form action={reject}>
        <input type="hidden" name="id" value={id} />
        <label className="text-xs text-muted">
          Reason for rejecting (logged in docs/SCENARIO-VALIDATION.md)
          <textarea name="reason" rows={3} className={field} required />
        </label>
        <button type="submit" className={button} disabled={disabled || rejecting}>
          {rejecting ? "Rejecting…" : "Reject"}
        </button>
        <Status state={rejectState} />
      </form>
    </div>
  );
}
