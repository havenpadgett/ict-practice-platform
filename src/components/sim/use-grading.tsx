"use client";

import { useCallback, useRef, useState } from "react";
import { gradeScenarioAttempt, type GradedScenario } from "@/app/train/actions";
import { useAuth } from "@/contexts/auth-context";
import type { AttemptResponse } from "@/lib/engine/types";
import { describeError } from "@/lib/errors";
import { saveScenarioAttempt } from "@/lib/scenario-attempts";

export type SaveState = "idle" | "saving" | "account" | "device" | "error";

/** Grades a finished attempt on the server and saves it: to the account when
 * there is one and the table exists, otherwise to this device. The graded
 * result is shown whether or not the save worked, and a failed save can be
 * retried without grading again. */
export function useGrading(sessionId: string) {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [graded, setGraded] = useState<(GradedScenario & { response: AttemptResponse }) | null>(null);
  const [grading, setGrading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [save, setSave] = useState<SaveState>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const inFlight = useRef(false);

  const persist = useCallback(
    async (row: GradedScenario["row"]) => {
      setSave("saving");
      setSaveError(null);
      try {
        const res = await saveScenarioAttempt(userId, row);
        setSave(res.source);
      } catch (err) {
        setSaveError(describeError(err, "save this result").message);
        setSave("error");
      }
    },
    [userId],
  );

  const submit = useCallback(
    async (response: AttemptResponse) => {
      if (inFlight.current) return;
      inFlight.current = true;
      setGrading(true);
      setError(null);
      try {
        const res = await gradeScenarioAttempt(response, { sessionId });
        if (!res.ok) {
          setError(res.error);
          return;
        }
        setGraded({ ...res, response });
        void persist(res.row);
      } catch (err) {
        setError(describeError(err, "grade this attempt").message);
      } finally {
        inFlight.current = false;
        setGrading(false);
      }
    },
    [persist, sessionId],
  );

  const retrySave = useCallback(() => {
    if (graded) void persist(graded.row);
  }, [graded, persist]);

  return { graded, grading, error, save, saveError, submit, retrySave, retry: () => setError(null) };
}

export function SaveNote({ save, error, onRetry }: { save: SaveState; error: string | null; onRetry: () => void }) {
  if (save === "idle") return null;
  if (save === "saving") return <p className="text-xs text-muted">Saving…</p>;
  if (save === "account") return <p className="text-xs text-muted">Saved to your history.</p>;
  if (save === "device") return <p className="text-xs text-muted">Saved on this device. It will join your account history once the database is updated.</p>;
  return (
    <p role="alert" className="text-xs text-danger">
      {error} Your result is shown above.{" "}
      <button type="button" onClick={onRetry} className="font-medium text-accent underline">
        Retry save
      </button>
    </p>
  );
}
