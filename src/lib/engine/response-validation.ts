// Input checks for an attempt sent to a Server Function. Reachable by direct
// POST, so nothing about its shape is trusted; every field is checked and
// bounded, and what comes out is rebuilt from the checked parts.

import { ANNOTATION_KINDS, type Annotation, type AnnotationKind, type AttemptResponse, type Bias, type Confidence5, type Decision, type ModeConfig, type Order, type StageResponse } from "@/lib/engine/types";
import { isTimeframe } from "@/lib/engine/time";
import { isNum } from "@/lib/answer-validation";

const MAX_ANNOTATIONS = 80;
const MAX_TEXT = 200;
const MAX_VALUES = 40;
const MAX_MS = 24 * 60 * 60 * 1000;

const BIASES: Bias[] = ["bullish", "bearish", "neutral"];
const DECISIONS: Decision[] = ["long", "short", "wait", "no_trade"];

function cleanAnnotation(x: unknown): Annotation | null {
  if (typeof x !== "object" || x === null) return null;
  const a = x as Record<string, unknown>;
  if (typeof a.id !== "string" || a.id.length === 0 || a.id.length > 60) return null;
  if (typeof a.kind !== "string" || !(ANNOTATION_KINDS as readonly string[]).includes(a.kind)) return null;
  const out: Annotation = { id: a.id, kind: a.kind as AnnotationKind };
  for (const key of ["price", "priceLow", "priceHigh", "t", "tStart", "tEnd", "entry", "stop", "target", "drawnAt"] as const) {
    if (a[key] !== undefined) {
      if (!isNum(a[key])) return null;
      out[key] = a[key] as number;
    }
  }
  if (a.text !== undefined) out.text = String(a.text).slice(0, MAX_TEXT);
  if (typeof a.tf === "string" && isTimeframe(a.tf)) out.tf = a.tf;
  if (a.hindsight === true) out.hindsight = true;
  return out;
}

function cleanAnnotations(x: unknown): Annotation[] | null {
  if (!Array.isArray(x) || x.length > MAX_ANNOTATIONS) return null;
  const out: Annotation[] = [];
  for (const item of x) {
    const a = cleanAnnotation(item);
    if (!a) return null;
    out.push(a);
  }
  return out;
}

function cleanOrder(x: unknown): Order | null | undefined {
  if (x === null) return null;
  if (typeof x !== "object") return undefined;
  const o = x as Record<string, unknown>;
  if (!((o.direction === "long" || o.direction === "short") && isNum(o.stop) && isNum(o.target) && isNum(o.placedAt))) return undefined;
  if (!(o.entry === null || isNum(o.entry))) return undefined;
  if (o.placedAt < 1 || !Number.isInteger(o.placedAt)) return undefined;
  return { direction: o.direction, entry: o.entry as number | null, stop: o.stop, target: o.target, placedAt: o.placedAt };
}

function cleanStage(x: unknown): StageResponse | null {
  if (typeof x !== "object" || x === null) return null;
  const r = x as Record<string, unknown>;
  switch (r.kind) {
    case "choice":
      return typeof r.value === "string" && r.value.length <= 60 ? { kind: "choice", value: r.value } : null;
    case "multi":
      return Array.isArray(r.values) && r.values.length <= MAX_VALUES && r.values.every((v) => typeof v === "string" && v.length <= 60) ? { kind: "multi", values: r.values as string[] } : null;
    case "price":
      return isNum(r.price) ? { kind: "price", price: r.price } : null;
    case "mark": {
      const annotations = cleanAnnotations(r.annotations);
      return annotations ? { kind: "mark", annotations } : null;
    }
    case "trade": {
      const order = cleanOrder(r.order);
      if (order === undefined || !DECISIONS.includes(r.decision as Decision)) return null;
      const d = r.decision as Decision;
      // An order only goes with a long or short, and the reverse.
      if ((d === "long" || d === "short") !== (order !== null)) return null;
      if (order && order.direction !== d) return null;
      return { kind: "trade", decision: d, order };
    }
    case "replay": {
      const annotations = cleanAnnotations(r.annotations);
      const order = cleanOrder(r.order);
      if (!annotations || order === undefined || !DECISIONS.includes(r.decision as Decision)) return null;
      const bias = r.bias === null ? null : BIASES.includes(r.bias as Bias) ? (r.bias as Bias) : undefined;
      if (bias === undefined || !isNum(r.waits) || !isNum(r.decidedAtRevealed)) return null;
      const d = r.decision as Decision;
      if ((d === "long" || d === "short") !== (order !== null)) return null;
      if (order && order.direction !== d) return null;
      return { kind: "replay", annotations, bias, decision: d, order, waits: Math.max(0, Math.min(500, Math.round(r.waits))), decidedAtRevealed: Math.max(0, Math.round(r.decidedAtRevealed)) };
    }
    default:
      return null;
  }
}

/** A cleaned attempt response, or null if anything about it is off. Stage
 * keys must be stages of the mode. */
export function cleanAttemptResponse(x: unknown, mode: ModeConfig): AttemptResponse | null {
  if (typeof x !== "object" || x === null) return null;
  const r = x as Record<string, unknown>;
  if (typeof r.scenarioId !== "string" || r.modeId !== mode.id) return null;
  if (typeof r.stages !== "object" || r.stages === null) return null;
  const stages: Record<string, StageResponse> = {};
  const allowed = new Set(mode.stages.map((s) => s.id));
  for (const [key, value] of Object.entries(r.stages as Record<string, unknown>)) {
    if (!allowed.has(key)) return null;
    const stage = cleanStage(value);
    if (!stage) return null;
    stages[key] = stage;
  }
  const c = r.confidence;
  const confidence: Confidence5 | null = c === 1 || c === 2 || c === 3 || c === 4 || c === 5 ? c : null;
  return {
    scenarioId: r.scenarioId,
    modeId: mode.id,
    stages,
    confidence,
    responseTimeMs: isNum(r.responseTimeMs) ? Math.min(MAX_MS, Math.max(0, Math.round(r.responseTimeMs))) : 0,
  };
}
