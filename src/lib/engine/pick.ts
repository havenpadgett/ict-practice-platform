// Choosing a scenario to start: the next one not yet attempted in this mode,
// otherwise the one attempted longest ago. The weakness trainer's selection
// (src/lib/engine/weakness.ts) is the smarter version of the same idea; this
// is the plain fallback a mode card uses.

import type { ScenarioMeta } from "@/lib/engine/store";
import { scenariosForMode } from "@/lib/engine/store";
import type { ModeId } from "@/lib/engine/types";

type Seen = { scenario_id: string; mode_id: string; created_at: string };

export function nextScenarioFor(mode: ModeId, history: Seen[], avoid?: string): ScenarioMeta | null {
  const pool = scenariosForMode(mode).filter((m) => m.id !== avoid);
  if (pool.length === 0) return scenariosForMode(mode)[0] ?? null;
  const lastSeen = new Map<string, string>();
  for (const a of history) if (a.mode_id === mode) lastSeen.set(a.scenario_id, a.created_at);
  const unseen = pool.filter((m) => !lastSeen.has(m.id));
  if (unseen.length > 0) return unseen[0];
  return [...pool].sort((a, b) => (lastSeen.get(a.id) ?? "").localeCompare(lastSeen.get(b.id) ?? ""))[0];
}
