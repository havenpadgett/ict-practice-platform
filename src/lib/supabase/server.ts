// Server-side Supabase client for Server Components and Route Handlers —
// reads/writes the session via Next.js's cookie store instead of
// localStorage, which is what lets auth state survive a server render.

import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

function requireEnv(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`Missing ${name}. Set it in .env.local.`);
  }
  return value;
}

export async function createClient() {
  const supabaseUrl = requireEnv("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL);
  const supabaseAnonKey = requireEnv(
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
  const cookieStore = await cookies();

  return createServerClient(supabaseUrl, supabaseAnonKey, {
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
