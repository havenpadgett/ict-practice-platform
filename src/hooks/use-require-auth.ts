"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/contexts/auth-context";

/** Client-side backstop for middleware's route protection — redirects to
 * /login if auth resolves to signed-out. Pages using this should render a
 * loading state while `loading` is true or `user` is null, rather than the
 * page content, since middleware should already be redirecting in that
 * window. */
export function useRequireAuth() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [loading, user, router]);

  return { user, loading };
}
