// Product analytics events (public.practice_events,
// supabase/migrations/20260926130000_practice_events.sql). Fire-and-forget:
// tracking must never slow down or break practice, so every failure —
// offline, signed out, or the table not created yet — is swallowed.

import { createClient } from "@/lib/supabase/client";

export type EventMode = "recognition" | "guided_entry" | "free_trade" | "adaptive";
export type SessionSource = "recommendation" | "adaptive_mix" | "picker" | "deep_link";

export type PracticeEvent =
  | { event_type: "session_started"; session_id: string; mode: EventMode; concept: string; source: SessionSource; planned_length: number }
  | { event_type: "session_completed"; session_id: string; position: number }
  | { event_type: "session_abandoned"; session_id: string; position: number }
  | { event_type: "recommendation_shown"; recommended_concept: string; recommended_difficulty: number };

/** The mode a session's `concept` (SessionState.concept) belongs to. */
export function modeFor(concept: string): EventMode {
  if (concept === "Adaptive") return "adaptive";
  if (concept === "GuidedEntry") return "guided_entry";
  if (concept === "FreeTrade") return "free_trade";
  return "recognition";
}

export function track(event: PracticeEvent): void {
  void (async () => {
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      await supabase.from("practice_events").insert({ ...event, user_id: user.id });
    } catch {
      // Analytics only — never surface.
    }
  })();
}

const SHOWN_KEY = "ict-practice:recommendation-shown";

/** At most once per day per browser, so "shown" counts days a user saw a
 * recommendation, not dashboard reloads. */
export function trackRecommendationShown(concept: string, difficulty: number): void {
  try {
    const today = new Date().toLocaleDateString("en-CA");
    if (window.localStorage.getItem(SHOWN_KEY) === today) return;
    window.localStorage.setItem(SHOWN_KEY, today);
  } catch {
    return;
  }
  track({ event_type: "recommendation_shown", recommended_concept: concept, recommended_difficulty: difficulty });
}
