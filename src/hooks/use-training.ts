"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import type { StoredScenarioAttempt } from "@/lib/engine/attempt-row";
import { summarizeTraining } from "@/lib/engine/history";
import { classify, computeSkillVector, evidenceFromAttempts } from "@/lib/engine/skills";
import { fetchScenarioAttempts, SCENARIO_ATTEMPTS_CHANGED } from "@/lib/scenario-attempts";

/** Everything derived from a learner's scenario attempts: the skill vector,
 * the classification and the history figures. Recomputed whenever an attempt
 * is saved, so a screen never shows a stale label. */
export function useTraining() {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [attempts, setAttempts] = useState<StoredScenarioAttempt[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    const load = () =>
      void fetchScenarioAttempts(userId)
        .then((rows) => {
          if (!cancelled) {
            setAttempts(rows);
            setError(null);
          }
        })
        .catch(() => {
          if (!cancelled) setError("Couldn't load your training history.");
        });
    load();
    window.addEventListener(SCENARIO_ATTEMPTS_CHANGED, load);
    return () => {
      cancelled = true;
      window.removeEventListener(SCENARIO_ATTEMPTS_CHANGED, load);
    };
  }, [userId]);

  const derived = useMemo(() => {
    if (!attempts) return null;
    const vector = computeSkillVector(evidenceFromAttempts(attempts));
    return { vector, classification: classify(vector), summary: summarizeTraining(attempts) };
  }, [attempts]);

  return { attempts, error, loading: attempts === null && error === null, ...derived };
}
