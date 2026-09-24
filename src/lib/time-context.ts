// Time context for candles that carry a real timestamp (Candle.timestamp).
// Timestamps are ISO 8601 in New York wall-clock time with the ET offset
// attached, e.g. "2026-03-03T09:30:00-05:00" — scripts/ingest.py converts
// every source timestamp to that form. Because the wall-clock fields are
// already ET, they're read straight off the string: no timezone database is
// needed in the browser, and a viewer in any timezone sees the same labels.
//
// Session rules follow docs/CURRICULUM.md (Liquidity — Time-Based Levels):
// a CME trading day runs 18:00 ET to 17:00 ET the next calendar day, so a
// candle at or after 18:00 belongs to the next trading date; the NY AM
// session is 9:30-11:00 ET.

import type { Candle } from "@/data/exercises";

export type EtParts = {
  /** Calendar date in ET, "YYYY-MM-DD". */
  date: string;
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  /** Minutes since ET midnight. */
  minutesOfDay: number;
};

const ET_TIMESTAMP = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::\d{2})?(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;

export function parseEt(timestamp: string): EtParts | null {
  const m = ET_TIMESTAMP.exec(timestamp);
  if (!m) return null;
  const [year, month, day, hour, minute] = m.slice(1, 6).map(Number);
  return {
    date: `${m[1]}-${m[2]}-${m[3]}`,
    year,
    month,
    day,
    hour,
    minute,
    minutesOfDay: hour * 60 + minute,
  };
}

function addDays(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d + days));
  return utc.toISOString().slice(0, 10);
}

function weekdayOf(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export const TRADING_DAY_START_MINUTES = 18 * 60;
export const NY_AM_START_MINUTES = 9 * 60 + 30;
export const NY_AM_END_MINUTES = 11 * 60;

/** The trading date a candle belongs to — its ET calendar date, or the next
 * one if it opens at/after 18:00 ET. */
export function tradingDate(parts: EtParts): string {
  return parts.minutesOfDay >= TRADING_DAY_START_MINUTES ? addDays(parts.date, 1) : parts.date;
}

/** The Monday of the trading date's week — a trading week runs Sunday
 * 18:00 ET to Friday 17:00 ET, so Sunday evening's candles fall on Monday's
 * trading date and land in the same week as the rest of it. */
export function tradingWeek(parts: EtParts): string {
  const date = tradingDate(parts);
  return addDays(date, -((weekdayOf(date) + 6) % 7));
}

/** Whether a candle opening at `parts` and lasting `timeframeMinutes`
 * overlaps the NY AM session. */
export function overlapsNyAm(parts: EtParts, timeframeMinutes: number): boolean {
  const start = parts.minutesOfDay;
  const end = start + timeframeMinutes;
  return start < NY_AM_END_MINUTES && end > NY_AM_START_MINUTES;
}

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** e.g. "Tue 3/3". */
export function formatTradingDate(date: string): string {
  const [, m, d] = date.split("-").map(Number);
  return `${WEEKDAY_LABELS[weekdayOf(date)]} ${m}/${d}`;
}

/** e.g. "09:30". */
export function formatEtTime(parts: EtParts): string {
  return `${String(parts.hour).padStart(2, "0")}:${String(parts.minute).padStart(2, "0")}`;
}

export type TimeContext = {
  parts: EtParts[];
  /** Smallest gap between consecutive candles, in minutes. */
  timeframeMinutes: number;
};

/** Time context for a candle series, or null if any candle lacks a
 * parseable timestamp — constructed exercises without timestamps render
 * exactly as before. */
export function buildTimeContext(candles: Candle[]): TimeContext | null {
  if (candles.length === 0) return null;
  const parts: EtParts[] = [];
  for (const candle of candles) {
    if (!candle.timestamp) return null;
    const p = parseEt(candle.timestamp);
    if (!p) return null;
    parts.push(p);
  }
  let timeframeMinutes = Infinity;
  for (let i = 1; i < candles.length; i++) {
    const diff = (Date.parse(candles[i].timestamp!) - Date.parse(candles[i - 1].timestamp!)) / 60000;
    if (diff > 0) timeframeMinutes = Math.min(timeframeMinutes, diff);
  }
  return { parts, timeframeMinutes: Number.isFinite(timeframeMinutes) ? timeframeMinutes : 0 };
}
