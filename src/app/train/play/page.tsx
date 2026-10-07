"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { startScenario } from "@/app/train/actions";
import { ErrorBanner } from "@/components/error-banner";
import { LoadingState } from "@/components/loading-state";
import { ReplayRunner } from "@/components/sim/replay-runner";
import { StagedRunner } from "@/components/sim/staged-runner";
import { useRequireAuth } from "@/hooks/use-require-auth";
import { getMode } from "@/lib/engine/modes";
import { nextScenarioFor } from "@/lib/engine/pick";
import { scenarioMeta } from "@/lib/engine/store";
import type { PublicScenario } from "@/lib/engine/types";
import { fetchScenarioAttempts } from "@/lib/scenario-attempts";

function Play() {
  const params = useSearchParams();
  const modeId = params.get("mode") ?? "simulator";
  const scenarioId = params.get("scenario") ?? "";
  const mode = getMode(modeId);
  const meta = scenarioMeta(scenarioId);
  const { user, loading } = useRequireAuth();
  const [scenario, setScenario] = useState<PublicScenario | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [nextId, setNextId] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  const valid = mode !== null && mode.stages.length > 0 && meta !== null && meta.modes.includes(mode.id);

  useEffect(() => {
    if (!user || !valid || !mode) return;
    let cancelled = false;
    void (async () => {
      const [res, history] = await Promise.all([startScenario(scenarioId, mode.id), fetchScenarioAttempts(user.id).catch(() => [])]);
      if (cancelled) return;
      if (!res.ok) return setError(res.error);
      setScenario(res.scenario);
      setNextId(nextScenarioFor(mode.id, history, scenarioId)?.id ?? scenarioId);
    })();
    return () => {
      cancelled = true;
    };
  }, [user, valid, mode, scenarioId, attempt]);

  if (!mode || mode.stages.length === 0 || !meta || !meta.modes.includes(mode.id)) {
    return (
      <main className="mx-auto w-full max-w-3xl px-4 pt-10 pb-16">
        <ErrorBanner message="That scenario isn't available in this mode." />
      </main>
    );
  }
  if (loading || !user) return <LoadingState />;
  if (error) {
    return (
      <main className="mx-auto w-full max-w-3xl px-4 pt-10 pb-16">
        <ErrorBanner message={error} onRetry={() => { setError(null); setAttempt((n) => n + 1); }} />
      </main>
    );
  }
  if (!scenario) return <LoadingState />;

  const nextHref = `/train/play?mode=${mode.id}&scenario=${nextId ?? scenarioId}`;
  const againHref = `/train/play?mode=${mode.id}&scenario=${scenarioId}`;
  const replayLike = mode.stages.length === 1 && mode.stages[0].input.kind === "replay";

  return (
    <main className="mx-auto w-full max-w-7xl px-4 pt-6 pb-16 sm:px-6 sm:pt-8">
      {replayLike ? (
        <ReplayRunner key={`${scenario.id}-${attempt}`} scenario={scenario} mode={mode} nextHref={nextHref} againHref={againHref} />
      ) : (
        <StagedRunner key={`${scenario.id}-${attempt}`} scenario={scenario} mode={mode} nextHref={nextHref} againHref={againHref} />
      )}
    </main>
  );
}

export default function PlayPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <Play />
    </Suspense>
  );
}
