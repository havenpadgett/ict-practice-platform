"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ErrorBanner } from "@/components/error-banner";
import { LoadingState } from "@/components/loading-state";
import { StatCard } from "@/components/stat-card";
import { useRequireAuth } from "@/hooks/use-require-auth";
import { describeError } from "@/lib/errors";
import { MISTAKES_SESSION_CAP } from "@/lib/mistakes";
import { loadMistakes, type MistakeItem } from "@/app/mistakes/actions";

const DIFFICULTY_LABELS = { 1: "Easy", 2: "Medium", 3: "Hard" } as const;

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function MistakeCard({ item }: { item: MistakeItem }) {
  return (
    <li className="card">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="eyebrow">
          {item.conceptLabel} · {DIFFICULTY_LABELS[item.difficulty]}
        </p>
        <p className={`eyebrow ${item.status === "mastered" ? "text-accent" : ""}`}>
          {item.status === "mastered"
            ? `Mastered ${item.masteredAt ? formatDate(item.masteredAt) : ""}`
            : `Missed ${item.missed === 1 ? "once" : `${item.missed} times`} · last ${formatDate(item.lastMissedAt)}`}
        </p>
      </div>
      <h2 className="mt-2 text-base font-semibold text-foreground">{item.answerLabel}</h2>
      <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-[8rem_1fr]">
        <dt className="text-muted">Your answer</dt>
        <dd className="text-foreground">{item.yourAnswer}</dd>
        <dt className="text-muted">Correct answer</dt>
        <dd className="text-foreground">{item.correctAnswer}</dd>
      </dl>
      <p className="mt-3 text-sm text-muted">{item.explanation}</p>
      <div className="mt-4">
        {item.retryable ? (
          <Link href={`/practice?retry=${encodeURIComponent(item.exercise_id)}`} className="btn-secondary">
            {item.status === "mastered" ? "Practice again" : "Retry"}
          </Link>
        ) : (
          <p className="text-xs text-muted">This exercise has been withdrawn, so it can&apos;t be retried.</p>
        )}
      </div>
    </li>
  );
}

export default function MistakesPage() {
  const { user, loading: authLoading } = useRequireAuth();
  const [items, setItems] = useState<MistakeItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setError(null);
    try {
      const res = await loadMistakes();
      if (res.ok) setItems(res.items);
      else setError(res.error);
    } catch (err) {
      setError(describeError(err, "load your mistakes").message);
    }
  }

  // Fetching from the server is the external sync this effect exists for.
  useEffect(() => {
    if (!user) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [user]);

  const open = items?.filter((i) => i.status === "open") ?? [];
  const mastered = items?.filter((i) => i.status === "mastered") ?? [];
  const retryableOpen = open.filter((i) => i.retryable).length;

  return (
    <div className="page">
      <h1 className="page-title">Review Mistakes</h1>
      <p className="page-lede">
        Every exercise you&apos;ve answered incorrectly, with what you answered and why the correct answer is right.
      </p>

      {authLoading || !user || (items === null && !error) ? (
        <div className="mt-8">
          <LoadingState label="Loading your mistakes…" variant="stats" />
        </div>
      ) : error ? (
        <div className="mt-8">
          <ErrorBanner message={error} onRetry={load} />
        </div>
      ) : items && items.length === 0 ? (
        <div className="card mt-8">
          <p className="eyebrow">Nothing to review</p>
          <p className="mt-2 text-sm text-muted">
            You haven&apos;t missed an exercise yet. Anything you get wrong will show up here to practice again.
          </p>
          <Link href="/practice" className="mt-4 btn-primary">
            Start practicing
          </Link>
        </div>
      ) : (
        <>
          <div className="mt-8 grid grid-cols-2 gap-4">
            <StatCard label="To review" value={String(open.length)} />
            <StatCard label="Mastered" value={String(mastered.length)} />
          </div>
          {retryableOpen > 0 && (
            <Link href="/practice?mode=mistakes" className="mt-6 btn-primary">
              Practice {retryableOpen === 1 ? "this mistake" : retryableOpen > MISTAKES_SESSION_CAP ? `your ${MISTAKES_SESSION_CAP} latest mistakes` : `all ${retryableOpen} mistakes`}
            </Link>
          )}

          {open.length > 0 && (
            <section className="mt-10">
              <h2 className="eyebrow">To review</h2>
              <ul className="mt-3 space-y-4">
                {open.map((item) => (
                  <MistakeCard key={item.exercise_id} item={item} />
                ))}
              </ul>
            </section>
          )}
          {mastered.length > 0 && (
            <section className="mt-10">
              <h2 className="eyebrow">Mastered</h2>
              <p className="mt-1 text-sm text-muted">Missed before, answered correctly since.</p>
              <ul className="mt-3 space-y-4">
                {mastered.map((item) => (
                  <MistakeCard key={item.exercise_id} item={item} />
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}
