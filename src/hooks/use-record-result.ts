"use client";

import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { insertAttempt, nextAttemptNumber, type NewAttempt } from "@/lib/attempts";
import { describeError } from "@/lib/errors";
import { addPending } from "@/lib/pending-attempts";

export type RecordState = "idle" | "saving" | "saved" | "kept" | "error";

/** Where a graded answer from a public page goes: straight into the
 * signed-in user's history, or onto this device until they have an account
 * (src/lib/pending-attempts.ts). The row comes from the server, built from
 * the grade the visitor sees. */
export function useRecordResult() {
  const { user } = useAuth();
  const userRef = useRef(user);
  useEffect(() => {
    userRef.current = user;
  }, [user]);
  const [state, setState] = useState<RecordState>("idle");
  const [error, setError] = useState<string | null>(null);
  const lastRow = useRef<NewAttempt | null>(null);

  async function record(row: NewAttempt): Promise<void> {
    lastRow.current = row;
    const current = userRef.current;
    if (!current) {
      addPending(row);
      setState("kept");
      return;
    }
    setState("saving");
    setError(null);
    try {
      await insertAttempt(current.id, { ...row, attempt_number: await nextAttemptNumber(current.id, row.exercise_id) });
      setState("saved");
    } catch (err) {
      setError(describeError(err, "save this result").message);
      setState("error");
    }
  }

  return { state, error, signedIn: user !== null, record, retry: () => (lastRow.current ? record(lastRow.current) : Promise.resolve()) };
}
