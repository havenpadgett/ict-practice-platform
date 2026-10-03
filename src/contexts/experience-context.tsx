"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useSyncExternalStore, type ReactNode } from "react";
import { useAuth } from "@/contexts/auth-context";
import { DEFAULT_EXPERIENCE, EXPERIENCE_EVENT, EXPERIENCE_KEY, isExperience, readExperience, writeExperience, type Experience } from "@/lib/experience";
import { createClient } from "@/lib/supabase/client";

type Value = {
  level: Experience;
  /** The learner has made the choice (onboarding or Settings). */
  chosen: boolean;
  setLevel: (level: Experience) => void;
};

const ExperienceContext = createContext<Value | null>(null);

function subscribe(onChange: () => void) {
  window.addEventListener(EXPERIENCE_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(EXPERIENCE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}
const getSnapshot = (): string => readExperience() ?? "";
const getServerSnapshot = (): string => "";

/** The experience preference for the whole app. The device copy is the
 * source of truth; a signed-in learner's choice is mirrored to their profile
 * (best effort: the column arrives with a migration that may not be applied),
 * and adopted from it on a device that hasn't chosen yet. */
export function ExperienceProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const stored = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const level: Experience = isExperience(stored) ? stored : DEFAULT_EXPERIENCE;
  const chosen = isExperience(stored);

  // The page's data attribute lets plain CSS follow the preference (term underlines).
  useEffect(() => {
    document.documentElement.dataset.experience = level;
  }, [level]);

  // A new device: take the choice made on the account.
  useEffect(() => {
    if (!user || chosen) return;
    let cancelled = false;
    void (async () => {
      try {
        const { data } = await createClient().from("profiles").select("experience_level").eq("id", user.id).maybeSingle();
        const remote = (data as { experience_level?: unknown } | null)?.experience_level;
        if (!cancelled && isExperience(remote) && readExperience() === null) writeExperience(remote);
      } catch {
        // Column not there yet, or offline: the device copy stands.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, chosen]);

  const userId = user?.id ?? null;
  const setLevel = useCallback(
    (next: Experience) => {
      writeExperience(next);
      if (!userId) return;
      void (async () => {
        try {
          await createClient().from("profiles").update({ experience_level: next }).eq("id", userId);
        } catch {
          // Mirrored when the column exists; otherwise the device keeps it.
        }
      })();
    },
    [userId],
  );

  const value = useMemo(() => ({ level, chosen, setLevel }), [level, chosen, setLevel]);
  return <ExperienceContext.Provider value={value}>{children}</ExperienceContext.Provider>;
}

export function useExperience(): Value {
  const ctx = useContext(ExperienceContext);
  // Outside the provider (tests, isolated renders): the default, unchosen.
  return ctx ?? { level: DEFAULT_EXPERIENCE, chosen: false, setLevel: () => {} };
}

export { EXPERIENCE_KEY };
