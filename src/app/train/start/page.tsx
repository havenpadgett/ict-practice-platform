"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";
import { LoadingState } from "@/components/loading-state";
import { useRequireAuth } from "@/hooks/use-require-auth";
import { getMode } from "@/lib/engine/modes";
import { nextScenarioFor } from "@/lib/engine/pick";
import { fetchScenarioAttempts } from "@/lib/scenario-attempts";

/** Picks the next scenario for a mode and goes there. */
function Start() {
  const { user } = useRequireAuth();
  const router = useRouter();
  const modeId = useSearchParams().get("mode") ?? "simulator";
  useEffect(() => {
    const mode = getMode(modeId);
    if (!user || !mode) return;
    void fetchScenarioAttempts(user.id)
      .catch(() => [])
      .then((history) => {
        const next = nextScenarioFor(mode.id, history);
        router.replace(next ? `/train/play?mode=${mode.id}&scenario=${next.id}` : "/train");
      });
  }, [user, modeId, router]);
  return <LoadingState />;
}

export default function StartPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <Start />
    </Suspense>
  );
}
