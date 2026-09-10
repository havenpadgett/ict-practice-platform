// Server-side Supabase client for Server Components and Route Handlers —
// reads/writes the session via Next.js's cookie store instead of
// localStorage, which is what lets auth state survive a server render.

import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabaseKey, getSupabaseUrl } from "@/lib/supabase/env";

export async function createClient() {
  const cookieStore = await cookies();

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
          // written. Safe to ignore — middleware refreshes the session
          // cookie on every request regardless.
        }
      },
    },
  });
}
