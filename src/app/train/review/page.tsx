"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { reviewScenarioAttempt } from "@/app/train/actions";
import { ErrorBanner } from "@/components/error-banner";
import { LoadingState } from "@/components/loading-state";
import { ReviewView } from "@/components/sim/review-view";
import { useExperience } from "@/contexts/experience-context";
import { useRequireAuth } from "@/hooks/use-require-auth";
import { useTraining } from "@/hooks/use-training";
import { explanationTier } from "@/lib/engine/tier";
import type { AttemptResult, Scenario } from "@/lib/engine/types";

/** A journal entry reopened: the stored response is graded again on the
 * server (deterministically, so it matches what was recorded) and shown as
 * the completed review. */
function Review() {
  const { user, loading } = useRequireAuth();
  const t = useTraining();
  const { level } = useExperience();
  const id = useSearchParams().get("id") ?? "";
  const [data, setData] = useState<{ scenario: Scenario; result: AttemptResult } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const attempt = t.attempts?.find((a) => a.id === id) ?? null;

  useEffect(() => {
    if (!attempt) return;
    let cancelled = false;
    void reviewScenarioAttempt(attempt.response).then((res) => {
      if (cancelled) return;
      if (res.ok) setData({ scenario: res.scenario, result: res.result });
      else setError(res.error);
    });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  if (loading || !user || t.loading) return <LoadingState />;
  if (!attempt) {
    return (
      <main className="mx-auto w-full max-w-3xl px-4 pt-10 pb-16">
        <ErrorBanner message="That journal entry wasn't found." />
        <Link href="/train/journal" className="btn-link mt-4 inline-flex">
          Back to the journal
        </Link>
      </main>
    );
  }
  if (error) {
    return (
      <main className="mx-auto w-full max-w-3xl px-4 pt-10 pb-16">
        <ErrorBanner message={error} />
      </main>
    );
  }
  if (!data) return <LoadingState />;

  return (
    <main className="mx-auto w-full max-w-7xl px-4 pt-6 pb-16 sm:px-6 sm:pt-8">
      <p className="eyebrow">Journal entry · {new Date(attempt.created_at).toLocaleString()}</p>
      <h1 className="mb-6 text-lg font-semibold text-foreground">{data.scenario.title}</h1>
      <ReviewView
        scenario={data.scenario}
        result={data.result}
        response={attempt.response}
        tier={explanationTier(t.classification?.level ?? null, level)}
        actions={
          <>
            <Link href={`/train/play?mode=${attempt.mode_id}&scenario=${attempt.scenario_id}`} className="btn-primary">
              Try this one again
            </Link>
            <Link href="/train/journal" className="btn-secondary">
              Back to the journal
            </Link>
          </>
        }
      />
    </main>
  );
}

export default function ReviewPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <Review />
    </Suspense>
  );
}
