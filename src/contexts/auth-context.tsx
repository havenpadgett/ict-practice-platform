"use client";

import type { Session, User } from "@supabase/supabase-js";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { ensureProfile } from "@/lib/profiles";
import { createClient } from "@/lib/supabase/client";
import { clearSession } from "@/lib/storage";

type AuthContextValue = {
  user: User | null;
  session: Session | null;
  /** True until the initial session check completes. */
  loading: boolean;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  // Distinct from a normal "not signed in" state — this means Supabase
  // itself couldn't be reached (e.g. missing/bad env vars), so the whole
  // app is unusable rather than just showing signed-out. Surfaced as a
  // message instead of an uncaught crash.
  const [initError, setInitError] = useState<string | null>(null);

  // Reading the session is a one-time sync from a browser-only store
  // (cookies aren't readable this way during SSR), so this can't be lazy
  // initial state — the setState-in-effect here is intentional.
  useEffect(() => {
    let supabase;
    try {
      supabase = createClient();
    } catch (err) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setInitError(err instanceof Error ? err.message : "Couldn't connect to Supabase.");
      setLoading(false);
      return;
    }

    supabase.auth
      .getSession()
      .then(({ data }) => {
        setSession(data.session);
        setLoading(false);
      })
      .catch((err: unknown) => {
        setInitError(err instanceof Error ? err.message : "Couldn't load your session.");
        setLoading(false);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, newSession) => {
      setSession(newSession);
      if (event === "SIGNED_IN" && newSession?.user) {
        // Best-effort — a failure here shouldn't block sign-in.
        ensureProfile(newSession.user).catch(() => {});
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    // In-progress practice session is local, per-device state — clear it on
    // sign-out so a different account signing in on the same device never
    // sees the previous account's exercise progress.
    clearSession();
  }

  if (initError) {
    return (
      <div className="flex min-h-screen flex-1 flex-col items-center justify-center gap-2 bg-background px-4 text-center">
        <p className="text-sm font-medium text-foreground">Can&apos;t connect right now.</p>
        <p className="max-w-sm text-sm text-muted">{initError}</p>
      </div>
    );
  }

  return (
    <AuthContext.Provider
      value={{ user: session?.user ?? null, session, loading, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}
