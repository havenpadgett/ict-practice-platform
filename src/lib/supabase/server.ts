// Server-side Supabase client for Server Components and Route Handlers —
// reads/writes the session via Next.js's cookie store instead of
// localStorage, which is what lets auth state survive a server render.

import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { isDemoMode } from "@/lib/demo/gate";
import { getSupabaseKey, getSupabaseUrl } from "@/lib/supabase/env";

export async function createClient(): Promise<ReturnType<typeof supabaseClient>> {
  // DEMO MODE (src/lib/demo/gate.ts): seeded fake data, never Supabase.
  // The inline NODE_ENV check folds to false in production builds, which
  // then drop this branch and never load the demo store.
  if (process.env.NODE_ENV !== "production" && isDemoMode()) {
    const { createDemoServerClient } = await import("@/lib/demo/store");
    return createDemoServerClient() as unknown as ReturnType<typeof supabaseClient>;
  }
  return supabaseClient(await cookies());
}

function supabaseClient(cookieStore: Awaited<ReturnType<typeof cookies>>) {
  return createServerClient(getSupabaseUrl(), getSupabaseKey(), {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Called from a Server Component, where cookies can't be
          // written. Safe to ignore — src/proxy.ts refreshes the session
          // cookie on every request regardless.
        }
      },
    },
  });
}
