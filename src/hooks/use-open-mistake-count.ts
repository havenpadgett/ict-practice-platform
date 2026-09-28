"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ATTEMPTS_CHANGED_EVENT, fetchAttempts } from "@/lib/attempts";
import { mistakeCounts } from "@/lib/mistakes";

/** Open mistakes for the nav badge: refreshed on navigation and whenever an
 * attempt is saved. Reads three columns only. Null until known (or if the
 * read fails; the badge is a hint, never a reason to show an error). */
export function useOpenMistakeCount(userId: string | null): number | null {
  const pathname = usePathname();
  const [count, setCount] = useState<number | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const bump = () => setVersion((v) => v + 1);
    window.addEventListener(ATTEMPTS_CHANGED_EVENT, bump);
    return () => window.removeEventListener(ATTEMPTS_CHANGED_EVENT, bump);
  }, []);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    fetchAttempts(userId, "exercise_id,is_correct,created_at")
      .then((rows) => {
        if (!cancelled) setCount(mistakeCounts(rows).open);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [userId, pathname, version]);

  return userId ? count : null;
}
