"use client";

// One candidate at a time, grouped by detection rule, with the curriculum
// definition beside the chart and keyboard shortcuts for every action.

import { useActionState, useEffect, useRef, useState } from "react";
import {
  ambiguousAction,
  approveAction,
  rejectAction,
  type ReviewActionState,
} from "@/app/review/actions";
import { Markdown } from "@/app/review/markdown";
import { ReviewChart } from "@/app/review/review-chart";
import type { RealScenario } from "@/data/real-scenarios";

export type QueueItem = {
  scenario: RealScenario;
  texts: { key: string; label: string; draft: string }[];
  /** e.g. "Built under MSS v1; current is v2" — set when re-review is due. */
  stale: string | null;
};

export type QueueGroup = {
  rule: string;
  label: string;
  items: QueueItem[];
  reviewed: number;
  definitions: { id: string; title: string; version: number; markdown: string }[];
};

const initial: ReviewActionState = { error: null, done: null };

function isTyping(el: EventTarget | null): boolean {
  return el instanceof HTMLElement && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT");
}

function Status({ state }: { state: ReviewActionState }) {
  if (state.error) return <p className="text-error mt-2" role="alert">{state.error}</p>;
  if (state.done) return <p className="mt-2 text-sm text-accent" role="status">{state.done}</p>;
  return null;
}

function Kbd({ children }: { children: string }) {
  return <kbd className="rounded border border-control px-1.5 py-0.5 font-mono text-[11px] text-foreground">{children}</kbd>;
}

export function ReviewQueue({ groups, disabled }: { groups: QueueGroup[]; disabled: boolean }) {
  const firstWithWork = Math.max(0, groups.findIndex((g) => g.items.length > 0));
  const [g, setG] = useState(firstWithWork);
  const [i, setI] = useState(0);
  const group = groups[g];
  const item = group?.items[Math.min(i, Math.max(0, group.items.length - 1))];

  const approveRef = useRef<HTMLFormElement>(null);
  const rejectNoteRef = useRef<HTMLTextAreaElement>(null);
  const ambiguousRef = useRef<HTMLTextAreaElement>(null);
  const [approveState, approve, approving] = useActionState(approveAction, initial);
  const [rejectState, reject, rejecting] = useActionState(rejectAction, initial);
  const [ambState, flag, flagging] = useActionState(ambiguousAction, initial);

  const total = groups.reduce((n, x) => n + x.items.length, 0);
  const reviewed = groups.reduce((n, x) => n + x.reviewed, 0);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && isTyping(e.target)) {
        (e.target as HTMLElement).blur();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && isTyping(e.target)) {
        (e.target as HTMLElement).closest("form")?.requestSubmit();
        e.preventDefault();
        return;
      }
      if (isTyping(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
      const n = group?.items.length ?? 0;
      if (e.key === "j" || e.key === "ArrowRight") setI((x) => Math.min(x + 1, Math.max(0, n - 1)));
      else if (e.key === "k" || e.key === "ArrowLeft") setI((x) => Math.max(0, x - 1));
      else if (e.key === "]") {
        setG((x) => Math.min(x + 1, groups.length - 1));
        setI(0);
      } else if (e.key === "[") {
        setG((x) => Math.max(0, x - 1));
        setI(0);
      } else if (e.key === "a") approveRef.current?.requestSubmit();
      else if (e.key === "r") rejectNoteRef.current?.focus();
      else if (e.key === "f") ambiguousRef.current?.focus();
      else return;
      e.preventDefault();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [group, groups.length]);

  if (!group) return <p className="mt-8 text-sm">Nothing to review.</p>;
  const s = item?.scenario;
  const p = s?.provenance;

  return (
    <div className="mt-8">
      <p className="text-sm text-foreground tabular-nums" aria-live="polite">
        <span className="font-semibold">{reviewed}</span> reviewed · <span className="font-semibold">{total}</span> remaining
      </p>

      <nav aria-label="Rules" className="mt-4 flex flex-wrap gap-2">
        {groups.map((x, idx) => (
          <button
            key={x.rule}
            type="button"
            aria-pressed={idx === g}
            className="btn-option px-3"
            onClick={() => {
              setG(idx);
              setI(0);
            }}
          >
            {x.label}
            <span className="tabular-nums text-xs opacity-80">
              {x.reviewed}/{x.reviewed + x.items.length}
            </span>
          </button>
        ))}
      </nav>

      <p className="mt-3 text-xs">
        <Kbd>j</Kbd>/<Kbd>k</Kbd> next/previous · <Kbd>[</Kbd>/<Kbd>]</Kbd> rule · <Kbd>a</Kbd> approve · <Kbd>r</Kbd>{" "}
        reject · <Kbd>f</Kbd> flag ambiguous · <Kbd>⌘/Ctrl</Kbd>+<Kbd>Enter</Kbd> submit the field you&apos;re in ·{" "}
        <Kbd>Esc</Kbd> leave a field
      </p>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="min-w-0">
          {!s || !p ? (
            <div className="card">
              <p className="eyebrow">{group.label}</p>
              <p className="mt-2">Nothing left to review for this rule.</p>
            </div>
          ) : (
            <section className="card" aria-label={`Candidate ${s.exercise_id}`}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-lg">{s.exercise_id}</h2>
                <p className="eyebrow tabular-nums">
                  {Math.min(i, group.items.length - 1) + 1} / {group.items.length} in {group.label}
                </p>
              </div>
              {item.stale && <p className="text-error mt-1">Needs re-review: {item.stale}</p>}
              <p className="mt-1 text-sm">
                {s.concept} · {p.timeframe} · {p.session}
                {p.context_start ? ` (structure from ${p.context_start})` : ""} · {p.trading_date} · difficulty {s.difficulty}
              </p>
              <p className="mt-3 text-base text-foreground">{s.prompt}</p>
              {s.answer_type === "free" && (
                <p className="mt-1 text-xs">
                  Whole session shown. In practice the first {s.candles.length} candles are visible and the rest are revealed one
                  at a time.
                </p>
              )}
              <div className="mt-4 overflow-hidden rounded border border-line p-2">
                <ReviewChart exercise={s} />
              </div>

              <div className="mt-5 grid gap-4 text-sm sm:grid-cols-2">
                <div>
                  <p className="eyebrow">Rule fired</p>
                  <p className="mt-1 font-mono text-foreground">
                    {p.detection_rule} · {p.candidate_id}
                  </p>
                  <p className="mt-2">{p.detection_notes}</p>
                  <p className="eyebrow mt-3">Parameters</p>
                  <p className="mt-1 font-mono text-xs break-all">{JSON.stringify(p.detection_params)}</p>
                </div>
                <div>
                  <p className="eyebrow">Detected answer key</p>
                  <pre className="mt-1 overflow-x-auto whitespace-pre-wrap text-xs text-foreground">
                    {JSON.stringify(s.answer, null, 2)}
                  </pre>
                </div>
              </div>

              <details className="mt-4 text-xs">
                <summary className="cursor-pointer">Provenance</summary>
                <dl className="mt-2 grid grid-cols-[max-content_1fr] gap-x-3 gap-y-0.5">
                  <dt>Source</dt>
                  <dd className="text-foreground">{p.data_source}</dd>
                  <dt>Window</dt>
                  <dd className="text-foreground">
                    {p.date_range.start} → {p.date_range.end}
                  </dd>
                  <dt>Input sha256</dt>
                  <dd className="break-all text-foreground">{p.input_sha256}</dd>
                  <dt>Built</dt>
                  <dd className="text-foreground">{p.built_at}</dd>
                </dl>
              </details>

              <div className="mt-6 space-y-6 border-t border-line pt-5">
                <form ref={approveRef} action={approve} key={`a-${s.exercise_id}`}>
                  <input type="hidden" name="id" value={s.exercise_id} />
                  <p className="eyebrow">Approve</p>
                  <p className="mt-1 text-xs">Rewrite the draft text users will see: plain language, no candle numbers, state the answer.</p>
                  {item.texts.map((t) => (
                    <label key={t.key} className="mt-2 block text-xs">
                      {t.label}
                      <textarea name={`text:${t.key}`} rows={t.key === "explanation" ? 4 : 2} className="field" defaultValue={t.draft} required />
                    </label>
                  ))}
                  <label className="mt-2 block text-xs">
                    Review notes (optional)
                    <input name="notes" className="field" />
                  </label>
                  <button type="submit" className="btn-primary mt-3" disabled={disabled || approving}>
                    {approving ? "Approving…" : "Approve"} <Kbd>a</Kbd>
                  </button>
                  <Status state={approveState} />
                </form>

                <div className="grid gap-6 sm:grid-cols-2">
                  <form action={reject} key={`r-${s.exercise_id}`}>
                    <input type="hidden" name="id" value={s.exercise_id} />
                    <input type="hidden" name="reason" value="other" />
                    <label className="block text-xs">
                      <span className="eyebrow">Reject</span> — why
                      <textarea ref={rejectNoteRef} name="note" rows={2} className="field" required />
                    </label>
                    <button type="submit" className="btn-secondary mt-2" disabled={disabled || rejecting}>
                      {rejecting ? "Rejecting…" : "Reject"}
                    </button>
                    <Status state={rejectState} />
                  </form>
                  <form action={flag} key={`f-${s.exercise_id}`}>
                    <input type="hidden" name="id" value={s.exercise_id} />
                    <label className="block text-xs">
                      <span className="eyebrow">Flag ambiguous</span> — what could be read two ways
                      <textarea ref={ambiguousRef} name="note" rows={2} className="field" required />
                    </label>
                    <button type="submit" className="btn-secondary mt-2" disabled={disabled || flagging}>
                      {flagging ? "Flagging…" : "Flag ambiguous"}
                    </button>
                    <Status state={ambState} />
                  </form>
                </div>
              </div>
            </section>
          )}
        </div>

        <aside className="lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto" aria-label="Curriculum definition">
          {group.definitions.map((d, idx) =>
            idx === 0 ? (
              <div key={d.id} className="card">
                <p className="eyebrow">
                  Definition · {d.title} · v{d.version}
                </p>
                <div className="mt-3">
                  <Markdown text={d.markdown} />
                </div>
              </div>
            ) : (
              <details key={d.id} className="card mt-3">
                <summary className="cursor-pointer text-sm text-foreground">
                  Also depends on: {d.title} · v{d.version}
                </summary>
                <div className="mt-3">
                  <Markdown text={d.markdown} />
                </div>
              </details>
            ),
          )}
        </aside>
      </div>
    </div>
  );
}
