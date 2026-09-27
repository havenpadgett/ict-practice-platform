// Browser-side Supabase client. Create a fresh one per call rather than
// caching a singleton — this is the pattern @supabase/ssr expects, and it's
// cheap (it doesn't open a new connection, just wraps fetch/localStorage).

import { createBrowserClient } from "@supabase/ssr";
import { createDemoBrowserClient } from "@/lib/demo/fake-supabase";
import { isDemoMode } from "@/lib/demo/gate";
import { getSupabaseKey, getSupabaseUrl } from "@/lib/supabase/env";

function supabaseClient() {
  return createBrowserClient(getSupabaseUrl(), getSupabaseKey());
}

export function createClient(): ReturnType<typeof supabaseClient> {
  // DEMO MODE (src/lib/demo/gate.ts): seeded fake data, never Supabase.
  // The inline NODE_ENV check folds to false in production builds, which
  // then drop this branch and the unused demo client with it.
  if (process.env.NODE_ENV !== "production" && isDemoMode()) {
    return createDemoBrowserClient() as unknown as ReturnType<typeof supabaseClient>;
  }
  return supabaseClient();
}
