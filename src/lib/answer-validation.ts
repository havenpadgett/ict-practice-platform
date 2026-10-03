// Input checks shared by every Server Function that grades an answer
// (practice, public challenges, the daily challenge, the landing sample).
// Server Functions are reachable by direct POST, so nothing here trusts the
// shape of what the browser sends.

import type { FreeTradeExit, FreeTradePosition } from "@/lib/free-trade-grading";
import { isStopOnLosingSide, isTargetOnWinningSide } from "@/lib/free-trade-grading";
import type { UserAnswer } from "@/lib/grading";
import type { GuidedUserAnswer } from "@/lib/guided-grading";

/** Matches the attempts_ranges constraint (20260927130000_attempt_integrity.sql). */
export const MAX_RESPONSE_MS = 24 * 60 * 60 * 1000;

export function isNum(x: unknown): x is number {
  return typeof x === "number" && Number.isFinite(x);
}

export function isNumOrNull(x: unknown): x is number | null {
  return x === null || isNum(x);
}

/** A confidence rating: 1 (a guess), 2 (fairly sure) or 3 (certain). Null
 * and anything else mean "skipped" (docs/ANALYTICS.md → Confidence). */
export type Confidence = 1 | 2 | 3;

export function readConfidence(x: unknown): Confidence | null {
  return x === 1 || x === 2 || x === 3 ? x : null;
}

export function isUserAnswer(a: unknown): a is UserAnswer {
  if (typeof a !== "object" || a === null) return false;
  const x = a as Record<string, unknown>;
  switch (x.type) {
    case "none":
      return true;
    case "level":
      return isNum(x.price);
    case "choice":
      return typeof x.choice === "string" && x.choice.length <= 100;
    case "region": {
      const r = x.region as Record<string, unknown> | null;
      return (
        typeof r === "object" && r !== null &&
        isNum(r.priceLow) && isNum(r.priceHigh) && isNum(r.candleIndexLow) && isNum(r.candleIndexHigh)
      );
    }
    default:
      return false;
  }
}

export function isGuidedAnswer(a: unknown): a is GuidedUserAnswer {
  if (typeof a !== "object" || a === null) return false;
  const x = a as Record<string, unknown>;
  return (
    (x.bias === "bullish" || x.bias === "bearish" || x.bias === "unclear") &&
    isNumOrNull(x.entry) && isNumOrNull(x.stop) && isNumOrNull(x.target) &&
    typeof x.declaredTrade === "boolean"
  );
}

export function isPosition(p: unknown): p is FreeTradePosition | null {
  if (p === null) return true;
  if (typeof p !== "object") return false;
  const x = p as Record<string, unknown>;
  if (!((x.direction === "long" || x.direction === "short") && isNum(x.entryIndex) && isNum(x.entry) && isNum(x.stop) && isNum(x.target))) {
    return false;
  }
  // The UI only confirms a trade with the stop and target on the right
  // sides; anything else is a forged request.
  return isStopOnLosingSide(x.direction, x.entry, x.stop) && isTargetOnWinningSide(x.direction, x.entry, x.target);
}

export function isExit(p: unknown): p is FreeTradeExit | null {
  if (p === null) return true;
  if (typeof p !== "object") return false;
  const x = p as Record<string, unknown>;
  return isNum(x.index) && isNum(x.price) && (x.reason === "stop" || x.reason === "target" || x.reason === "session_end");
}

/** Clamp what the browser reports about an attempt to storable values. */
export function clampContext(c: { sessionId?: unknown; responseTimeMs?: unknown } | null | undefined) {
  return {
    sessionId: typeof c?.sessionId === "string" ? c.sessionId.slice(0, 100) : "",
    responseTimeMs: isNum(c?.responseTimeMs) ? Math.min(MAX_RESPONSE_MS, Math.max(0, Math.round(c.responseTimeMs))) : 0,
    attemptNumber: 0,
  };
}
