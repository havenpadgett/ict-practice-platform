// Server half of the error log (src/lib/error-log.ts): errors thrown while
// rendering, in Server Functions and in route handlers, reported by
// onRequestError (src/instrumentation.ts). Writes with the publishable key
// as the request's own user, read from its cookies, so no service-role key
// is involved. Best-effort: never throws.

import { createServerClient, parseCookieHeader } from "@supabase/ssr";
import { errorRow } from "@/lib/error-log";
import { isDemoMode } from "@/lib/demo/gate";
import { getSupabaseKey, getSupabaseUrl } from "@/lib/supabase/env";

export async function logServerError(error: unknown, request: { path: string; headers: Record<string, string | string[] | undefined> }): Promise<void> {
  if (process.env.NEXT_PUBLIC_DEMO_MODE === "true" && isDemoMode()) return;
  try {
    const header = request.headers.cookie;
    const cookieHeader = Array.isArray(header) ? header.join("; ") : (header ?? "");
    const supabase = createServerClient(getSupabaseUrl(), getSupabaseKey(), {
      cookies: {
        getAll: () => parseCookieHeader(cookieHeader).map((c) => ({ name: c.name, value: c.value ?? "" })),
        // Read-only: a refreshed session can't be written back from here.
        setAll: () => {},
      },
    });
    const {
      data: { user },
    } = await supabase.auth.getUser();
    await supabase.from("errors").insert(errorRow(error, "server", request.path, user?.id ?? null));
  } catch {
    // Ignore: the log is best-effort.
  }
}
