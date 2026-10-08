// Which trading session a moment falls in, from the ET wall-clock minute
// count the engine uses everywhere (time.ts). Boundaries follow the
// curriculum's time-based levels: Asia from the 18:00 ET open, London from
// 03:00, NY AM 08:30 to 11:59, NY PM after that until the 17:00 close.

export const SESSIONS = ["asia", "london", "ny_am", "ny_pm"] as const;
export type SessionId = (typeof SESSIONS)[number];

export const SESSION_LABEL: Record<SessionId, string> = { asia: "Asia", london: "London", ny_am: "NY AM", ny_pm: "NY PM" };

export function sessionOf(t: number): SessionId {
  const m = ((t % 1440) + 1440) % 1440;
  if (m >= 18 * 60 || m < 3 * 60) return "asia";
  if (m < 8 * 60 + 30) return "london";
  if (m < 12 * 60) return "ny_am";
  return "ny_pm";
}
