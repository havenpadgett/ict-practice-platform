"use client";

import type { User } from "@supabase/supabase-js";
import { useCallback, useEffect, useState } from "react";
import { migrateLocalAttempts, savePendingResults } from "@/lib/attempts";
import { clearPending, loadPending } from "@/lib/pending-attempts";
import { clearLocalAttempts, loadAttempts } from "@/lib/storage";

/** Answers given on this device before there was an account: the old local
 * attempts ("Try a sample") and results from public challenges. Offers to
 * add them to the signed-in user's history, once. */
export function useLocalResults(user: User | null, onSaved?: () => void) {
  const [count, setCount] = useState(0);
  const [dismissed, setDismissed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reading localStorage is a one-time sync from a browser-only store, so
  // the setState-in-effect here is intentional.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCount(loadAttempts().length + loadPending().length);
  }, [user]);

  const save = useCallback(async () => {
    if (!user) return;
    setSaving(true);
    setError(null);
    try {
      const local = loadAttempts();
      const pending = loadPending();
      if (local.length > 0) await migrateLocalAttempts(user.id, local);
      if (local.length > 0) clearLocalAttempts();
      if (pending.length > 0) await savePendingResults(user.id, pending.map((p) => p.row));
      if (pending.length > 0) clearPending();
      setCount(0);
      onSaved?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Saving failed. Your results are still on this device, nothing was lost.");
    } finally {
      setSaving(false);
    }
  }, [user, onSaved]);

  return { count: dismissed ? 0 : count, saving, error, save, dismiss: () => setDismissed(true) };
}
