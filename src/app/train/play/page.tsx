"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { startScenario } from "@/app/train/actions";
import { ErrorBanner } from "@/components/error-banner";
import { LoadingState } from "@/components/loading-state";
import { ReplayRunner } from "@/components/sim/replay-runner";
import { StagedRunner } from "@/components/sim/staged-runner";
import { useExperience } from "@/contexts/experience-context";
import { useRequireAuth } from "@/hooks/use-require-auth";
import { useTraining } from "@/hooks/use-training";
import { explanationTier } from "@/lib/engine/tier";
import { getMode } from "@/lib/engine/modes";
import { nextScenarioFor } from "@/lib/engine/pick";
import { doneHref, encodePlan, parsePlan, playHref, roleFor, runKindOf, runSessionId } from "@/lib/engine/run";
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
  const training = useTraining();
  const { level } = useExperience();
  const tier = explanationTier(training.classification?.level ?? null, level);
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

  // Inside a guided run the next step is the next one in the plan, then the summary.
  const run = params.get("run");
  const plan = parsePlan(params.get("plan"));
  const index = Number(params.get("i"));
  const inRun = run !== null && Number.isInteger(index) && plan[index]?.scenarioId === scenarioId && plan[index]?.mode === mode.id;
  const planParam = encodePlan(plan);
  const nextHref = inRun
    ? index + 1 < plan.length
      ? playHref(plan[index + 1], run, planParam, index + 1)
      : doneHref(run, planParam)
    : `/train/play?mode=${mode.id}&scenario=${nextId ?? scenarioId}`;
  const nextLabel = inRun ? (index + 1 < plan.length ? `Next: ${index + 2} of ${plan.length}` : "Finish and see summary") : undefined;
  const sessionId = inRun ? runSessionId(run, index) : undefined;
  const againHref = `/train/play?mode=${mode.id}&scenario=${scenarioId}`;
  const replayLike = mode.stages.length === 1 && mode.stages[0].input.kind === "replay";

  return (
    <main className="mx-auto w-full max-w-7xl px-4 pt-6 pb-16 sm:px-6 sm:pt-8">
      {inRun && (
        <p className="mb-3 text-xs text-muted tabular-nums" aria-label="Progress through this run">
          Step {index + 1} of {plan.length} · {roleFor(plan[index], runKindOf(run), index)}
        </p>
      )}
      {replayLike ? (
        <ReplayRunner key={`${scenario.id}-${attempt}`} scenario={scenario} mode={mode} tier={tier} nextHref={nextHref} againHref={againHref} sessionId={sessionId} nextLabel={nextLabel} />
      ) : (
        <StagedRunner key={`${scenario.id}-${attempt}`} scenario={scenario} mode={mode} tier={tier} nextHref={nextHref} againHref={againHref} sessionId={sessionId} nextLabel={nextLabel} />
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
