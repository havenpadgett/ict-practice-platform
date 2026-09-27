// DEMO MODE (see src/lib/demo/gate.ts). On every page while demo mode is
// on, so seeded numbers are never mistaken for real performance.

import { isDemoMode } from "@/lib/demo/gate";

export function DemoBanner() {
  if (process.env.NEXT_PUBLIC_DEMO_MODE !== "true" || !isDemoMode()) return null;
  return (
    <div role="status" className="border-b border-accent/40 bg-accent/10 px-4 py-2 text-center text-xs text-foreground sm:text-sm">
      <strong className="font-semibold">Demo mode: all data here is made up.</strong> You&apos;re signed in as a demo
      reviewer. Nothing you do is saved to a real account, and it resets when the server restarts.
    </div>
  );
}
