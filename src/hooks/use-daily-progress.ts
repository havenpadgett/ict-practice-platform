"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { ATTEMPTS_CHANGED_EVENT, fetchAttempts } from "@/lib/attempts";
import { bestStreak, completedDays, currentStreak, recentDays } from "@/lib/daily";
import { loadPending, PENDING_CHANGED_EVENT } from "@/lib/pending-attempts";

export type DailyProgress = {
  /** False until the first read finishes. */
  ready: boolean;
  done: ReadonlySet<string>;
  streak: number;
  best: number;
  total: number;
  week: { date: string; done: boolean }[];
};

const EMPTY: ReadonlySet<string> = new Set();

/** Daily-challenge completion and streak for a viewer. Signed in: derived
 * from their attempts (session ids "daily:<date>"). Signed out: from the
 * results kept on this device, which become attempts when they sign up, so
 * the streak carries over. Refreshes when either changes. */
export function useDailyProgress(today: string): DailyProgress {
  const { user, loading } = useAuth();
  const [done, setDone] = useState<ReadonlySet<string>>(EMPTY);
  const [ready, setReady] = useState(false);

  const load = useCallback(async () => {
    try {
      if (user) {
        setDone(completedDays(await fetchAttempts(user.id, "session_id,created_at")));
      } else {
        setDone(completedDays(loadPending().map((p) => ({ session_id: p.row.session_id }))));
      }
    } catch {
      // Streaks are a nicety: a failed read leaves them blank, not broken.
    } finally {
      setReady(true);
    }
  }, [user]);

  useEffect(() => {
    if (loading) return;
    // Reading storage or Supabase is the external sync this effect is for.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
    window.addEventListener(ATTEMPTS_CHANGED_EVENT, load);
    window.addEventListener(PENDING_CHANGED_EVENT, load);
    return () => {
      window.removeEventListener(ATTEMPTS_CHANGED_EVENT, load);
      window.removeEventListener(PENDING_CHANGED_EVENT, load);
    };
  }, [loading, load]);

  return {
    ready,
    done,
    streak: currentStreak(done, today),
    best: bestStreak(done),
    total: done.size,
    week: recentDays(done, today),
  };
}
