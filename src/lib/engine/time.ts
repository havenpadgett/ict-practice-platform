// Scenario-engine time. Every scenario candle carries `t`, an integer count
// of minutes since 1970-01-01T00:00 read as New York wall-clock time (the ET
// fields treated as if they were UTC). That keeps bucket math pure arithmetic
// with no timezone database and no daylight-saving edge cases, and it is
// exactly how src/lib/time-context.ts already reads the ET timestamps the
// chart shows. A scenario that spans a clock change would need a different
// scheme; seeded scenarios are all authored inside one offset.

export const TIMEFRAMES = ["1D", "4H", "1H", "15m", "5m", "1m"] as const;
export type Timeframe = (typeof TIMEFRAMES)[number];

export const TIMEFRAME_MINUTES: Record<Timeframe, number> = {
  "1D": 1440,
  "4H": 240,
  "1H": 60,
  "15m": 15,
  "5m": 5,
  "1m": 1,
};

export const TIMEFRAME_LABEL: Record<Timeframe, string> = {
  "1D": "Daily",
  "4H": "4H",
  "1H": "1H",
  "15m": "15m",
  "5m": "5m",
  "1m": "1m",
};

export function isTimeframe(x: unknown): x is Timeframe {
  return typeof x === "string" && (TIMEFRAMES as readonly string[]).includes(x);
}

/** Daily and 4H buckets open at 18:00 ET (the CME trading-day start), so a
 * Daily candle is one trading day, not one calendar day. */
export const SESSION_ANCHOR_MINUTES = 18 * 60;

/** The open time of the `tf` bucket containing `t`. */
export function bucketStart(t: number, tf: Timeframe): number {
  const size = TIMEFRAME_MINUTES[tf];
  if (tf === "1D" || tf === "4H") return Math.floor((t - SESSION_ANCHOR_MINUTES) / size) * size + SESSION_ANCHOR_MINUTES;
  return Math.floor(t / size) * size;
}

/** Minutes since the epoch for an ET wall-clock moment. */
export function etMinutes(year: number, month: number, day: number, hour = 0, minute = 0): number {
  return Date.UTC(year, month - 1, day, hour, minute) / 60000;
}

const pad = (n: number) => String(n).padStart(2, "0");

export type EtFields = { year: number; month: number; day: number; hour: number; minute: number; weekday: number };

export function etFields(t: number): EtFields {
  const d = new Date(t * 60000);
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
    hour: d.getUTCHours(),
    minute: d.getUTCMinutes(),
    weekday: d.getUTCDay(),
  };
}

/** The ISO-with-offset form src/lib/time-context.ts parses. Fixed -05:00:
 * only the wall-clock fields are ever read from it. */
export function toEtTimestamp(t: number): string {
  const f = etFields(t);
  return `${f.year}-${pad(f.month)}-${pad(f.day)}T${pad(f.hour)}:${pad(f.minute)}:00-05:00`;
}

/** "HH:MM". */
export function formatClock(t: number): string {
  const f = etFields(t);
  return `${pad(f.hour)}:${pad(f.minute)}`;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** "Tue 09:30" — enough to orient on any timeframe. */
export function formatMoment(t: number): string {
  const f = etFields(t);
  return `${WEEKDAYS[f.weekday]} ${pad(f.hour)}:${pad(f.minute)} ET`;
}
