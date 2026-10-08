"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { revealCandles } from "@/app/train/actions";
import { NavigationGuard } from "@/components/practice/navigation-guard";
import { ChartFrame } from "@/components/practice/exercise-layout";
import { MarkupToolbar, toolsFor } from "@/components/sim/markup-toolbar";
import { ReviewView } from "@/components/sim/review-view";
import { ScenarioChart } from "@/components/sim/scenario-chart";
import { ConfidenceFive, TradeTicket } from "@/components/sim/trade-ticket";
import { SaveNote, useGrading } from "@/components/sim/use-grading";
import { useMarkup } from "@/components/sim/use-markup";
import type { Plan, Tool } from "@/components/sim/chart-types";
import { useExperience } from "@/contexts/experience-context";
import { fromRow, seriesAt, supportedTimeframes, type SimCandle, type TimeframeData } from "@/lib/engine/candles";
import type { ExplanationTier } from "@/lib/engine/kind-definitions";
import { atr } from "@/lib/engine/structure";
import { TIMEFRAME_LABEL, type Timeframe } from "@/lib/engine/time";
import type { Confidence5, Decision, Direction, ModeConfig, Order, PublicScenario, RefAnnotation, StageConfig, StageResponse } from "@/lib/engine/types";

const snap = (p: number) => Math.round(p / 0.25) * 0.25;
const noop = () => {};

/** Fetches stream candles until `needed` are held, a chunk at a time. */
export function useCandles(scenario: PublicScenario, needed: number): { candles: SimCandle[]; ready: boolean; error: string | null } {
  const [candles, setCandles] = useState<SimCandle[]>(() => scenario.stream.map(fromRow));
  const [error, setError] = useState<string | null>(null);
  const have = candles.length;
  useEffect(() => {
    if (have >= needed || error) return;
    let cancelled = false;
    void revealCandles(scenario.id, have, Math.min(240, needed - have)).then((res) => {
      if (cancelled) return;
      if (!res.ok) return setError(res.error);
      setCandles((c) => [...c, ...res.rows.map(fromRow).filter((r) => r.t > (c[c.length - 1]?.t ?? -1))]);
    });
    return () => {
      cancelled = true;
    };
  }, [have, needed, scenario.id, error]);
  return { candles, ready: have >= needed, error };
}

/** Every mode that isn't a free replay: Build Your Bias, HTF to LTF,
 * Confluence Trainer, Setup or Trap, Find Everything and "Does it matter?".
 * One runner, driven entirely by the mode's stage list. Feedback comes at the
 * end only, so a later stage can't be answered with hindsight. */
export function StagedRunner({ scenario, mode, tier, nextHref, againHref, sessionId: runSession, nextLabel }: { scenario: PublicScenario; mode: ModeConfig; tier?: ExplanationTier; nextHref: string; againHref: string; /** Set when this scenario is a step of a guided run. */ sessionId?: string; nextLabel?: string }) {
  const { level } = useExperience();
  const resolvedTier: ExplanationTier = tier ?? (level === "beginner" ? "define" : "relate");
  const [sessionId] = useState(() => runSession ?? `stg_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`);
  const [startedAt] = useState(() => Date.now());
  const grading = useGrading(sessionId);

  const [index, setIndex] = useState(0);
  const [responses, setResponses] = useState<Record<string, StageResponse>>({});
  const [confidence, setConfidence] = useState<Confidence5 | null>(null);
  const [finalStep, setFinalStep] = useState(false);

  const stage = mode.stages[index];
  const revealed = stage.checkpoint ? (scenario.checkpoints[stage.checkpoint] ?? scenario.cursorStart) : scenario.cursorStart;
  const feed = useCandles(scenario, revealed);

  if (grading.graded) {
    return (
      <div className="space-y-4">
        <ReviewView
          scenario={grading.graded.scenario}
          result={grading.graded.result}
          response={grading.graded.response}
          tier={resolvedTier}
          actions={
            <>
              <Link href={nextHref} className="btn-primary">
                {nextLabel ?? "Next scenario"}
              </Link>
              {!runSession && (
                <Link href={againHref} className="btn-secondary">
                  Try this one again
                </Link>
              )}
              <Link href="/train" className="btn-link">
                Back to Train
              </Link>
            </>
          }
        />
        <SaveNote save={grading.save} error={grading.saveError} onRetry={grading.retrySave} />
      </div>
    );
  }

  function finish(finalResponses: Record<string, StageResponse>, c: Confidence5 | null) {
    void grading.submit({ scenarioId: scenario.id, modeId: mode.id, stages: finalResponses, confidence: c, responseTimeMs: Date.now() - startedAt });
  }

  function commit(stageId: string, response: StageResponse) {
    const next = { ...responses, [stageId]: response };
    setResponses(next);
    if (index + 1 < mode.stages.length) setIndex(index + 1);
    else if (mode.asksConfidence) setFinalStep(true);
    else finish(next, null);
  }

  const intro = level === "beginner" ? scenario.intro.beginner : scenario.intro.advanced;

  return (
    <div className="space-y-4">
      <NavigationGuard active={!grading.grading} message="Leave this scenario? Your answers so far aren't saved, and you'd start it again from the beginning." />
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="eyebrow">{mode.name}</p>
          <h1 className="text-lg font-semibold text-foreground">
            {stage.guidance === "none" ? "Unlabelled chart" : scenario.title}{" "}
            <span className="text-xs font-normal text-muted">{scenario.seeded ? "· seeded scenario, not market history" : ""}</span>
          </h1>
        </div>
        <p className="text-sm tabular-nums" aria-live="polite">
          {finalStep ? "Last step" : `Step ${index + 1} of ${mode.stages.length}`}: {finalStep ? "How sure are you?" : stage.title}
        </p>
      </div>
      {stage.guidance === "full" && index === 0 && <p className="text-sm">{intro}</p>}

      {finalStep ? (
        <div className="card max-w-xl space-y-5">
          <ConfidenceFive value={confidence} onChange={setConfidence} />
          <button type="button" className="btn-primary" disabled={grading.grading} onClick={() => finish(responses, confidence)}>
            {grading.grading ? "Grading…" : "See how you did"}
          </button>
          {grading.error && (
            <p role="alert" className="text-sm text-danger">
              {grading.error}
            </p>
          )}
        </div>
      ) : feed.error ? (
        <p role="alert" className="text-sm text-danger">
          {feed.error}
        </p>
      ) : !feed.ready ? (
        <p className="text-sm text-muted">Loading the chart…</p>
      ) : (
        <StageView key={stage.id} scenario={scenario} stage={stage} candles={feed.candles} revealed={revealed} onCommit={(r) => commit(stage.id, r)} asksConfidence={false} />
      )}
      {grading.error && !finalStep && (
        <p role="alert" className="text-sm text-danger">
          {grading.error}
        </p>
      )}
    </div>
  );
}

export function StageView({
  scenario,
  stage,
  candles,
  revealed,
  onCommit,
}: {
  scenario: PublicScenario;
  stage: StageConfig;
  candles: SimCandle[];
  revealed: number;
  onCommit: (r: StageResponse) => void;
  asksConfidence: boolean;
}) {
  const data: TimeframeData = useMemo(
    () => ({ history: Object.fromEntries(Object.entries(scenario.history).map(([k, v]) => [k, (v ?? []).map(fromRow)])), stream: candles, streamTimeframe: scenario.streamTimeframe }),
    [scenario.history, scenario.streamTimeframe, candles],
  );
  const frames = useMemo(() => supportedTimeframes(data, revealed).filter((t) => stage.timeframes.includes(t)), [data, revealed, stage.timeframes]);
  const [tf, setTf] = useState<Timeframe>(frames.includes(stage.initialTimeframe) ? stage.initialTimeframe : frames[0]);
  const series = useMemo(() => seriesAt(data, tf, revealed), [data, tf, revealed]);
  const lastClose = series[series.length - 1]?.c ?? 0;
  const input = stage.input;

  const markup = useMarkup();
  const [tool, setTool] = useState<Tool>("cursor");
  const [choice, setChoice] = useState<string | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [price, setPrice] = useState<number | null>(null);
  const [priceText, setPriceText] = useState("");
  const [plan, setPlan] = useState<Plan | null>(null);
  const [planT, setPlanT] = useState<number | null>(null);
  const [note, setNote] = useState<{ price: number; t: number } | null>(null);
  const [noteText, setNoteText] = useState("");

  const candidates: RefAnnotation[] = useMemo(
    () =>
      input.kind === "multi" && input.options === "candidates"
        ? scenario.candidates.map((c, i) => ({
            id: c.id,
            kind: c.kind,
            // Neutral until chosen: the style must not hint which ones matter.
            role: picked.includes(c.id) ? ("key" as const) : ("irrelevant" as const),
            label: `#${i + 1}`,
            price: c.price,
            priceLow: c.priceLow,
            priceHigh: c.priceHigh,
            t: c.t,
            tStart: c.tStart,
            tEnd: c.tEnd,
            why: "",
          }))
        : [],
    [input, scenario.candidates, picked],
  );

  const marksOnChart = input.kind === "price" && price !== null ? [{ id: "pick", kind: "liquidity" as const, price, t: series[0]?.t, tf }] : markup.annotations;

  function newPlan(direction: Direction): Plan {
    const unit = Math.max(atr(series, 20) * 1.5, Math.abs(lastClose) * 0.0008);
    const long = direction === "long";
    return { direction, entry: null, stop: snap(long ? lastClose - unit : lastClose + unit), target: snap(long ? lastClose + unit * 2.5 : lastClose - unit * 2.5) };
  }

  function setPlanned(p: Plan | null) {
    if (p && !plan) setPlanT(series[series.length - 1]?.t ?? null);
    setPlan(p);
  }

  const markable = input.kind === "mark";
  const drawTools = markable ? toolsFor(input.tools, false) : input.kind === "trade" ? toolsFor(["liquidity", "zone", "fvg", "ob"], true) : input.kind === "price" ? (["cursor", "liquidity"] as Tool[]) : [];
  const interactive = markable || input.kind === "price" || input.kind === "trade";
  const activeTool: Tool = input.kind === "price" ? "liquidity" : tool;

  function commitTrade(d: "long" | "short" | "no_trade") {
    if (d === "no_trade") return onCommit({ kind: "trade", decision: "no_trade", order: null });
    if (!plan) return;
    const order: Order = { direction: plan.direction, entry: plan.entry, stop: plan.stop, target: plan.target, placedAt: revealed };
    onCommit({ kind: "trade", decision: d as Decision, order });
  }

  const canContinue =
    input.kind === "choice"
      ? choice !== null
      : input.kind === "price"
        ? price !== null
        : input.kind === "multi"
          ? picked.length >= (input.min ?? 0)
          : input.kind === "mark"
            ? markup.annotations.length > 0 || input.allowNone === true
            : false;

  function continueStage() {
    if (input.kind === "choice" && choice !== null) onCommit({ kind: "choice", value: choice });
    else if (input.kind === "price" && price !== null) onCommit({ kind: "price", price });
    else if (input.kind === "multi") onCommit({ kind: "multi", values: picked });
    else if (input.kind === "mark") onCommit({ kind: "mark", annotations: markup.annotations });
  }

  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="min-w-0 space-y-3">
        <div role="group" aria-label="Timeframe" className="flex flex-wrap gap-1">
          {frames.map((t) => (
            <button key={t} type="button" aria-pressed={tf === t} onClick={() => setTf(t)} className="btn-option min-h-11 px-3 text-xs">
              {TIMEFRAME_LABEL[t]}
            </button>
          ))}
        </div>
        <div className={interactive && drawTools.length > 1 ? "grid gap-2 sm:grid-cols-[auto_1fr]" : ""}>
          {interactive && drawTools.length > 1 && input.kind !== "price" && (
            <MarkupToolbar
              tools={drawTools}
              tool={tool}
              onTool={setTool}
              onUndo={markup.undo}
              onDelete={markup.remove}
              onClear={markup.clear}
              canUndo={markup.canUndo}
              canDelete={markup.selectedId !== null}
              canClear={markup.annotations.length > 0}
            />
          )}
          <ChartFrame>
            <ScenarioChart
              series={series}
              tf={tf}
              tool={activeTool}
              interactive={interactive}
              annotations={marksOnChart}
              selectedId={markup.selectedId}
              onSelect={markup.select}
              onCreate={(a) => {
                if (input.kind === "price") setPrice(a.price ?? null);
                else markup.add(a);
              }}
              onNote={(at) => {
                setNote(at);
                setNoteText("");
              }}
              plan={plan}
              planEditable={input.kind === "trade"}
              planT={planT}
              onPlanChange={setPlanned}
              refs={candidates}
              futureSlots={4}
              label={`${scenario.instrument} ${tf} chart. ${stage.prompt}`}
            />
          </ChartFrame>
        </div>
        {note && (
          <form
            className="flex flex-wrap items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (noteText.trim()) markup.add({ kind: "note", price: note.price, t: note.t, text: noteText.trim().slice(0, 120), tf });
              setNote(null);
            }}
          >
            <label className="min-w-0 flex-1 text-xs text-muted">
              Note
              <input autoFocus value={noteText} onChange={(e) => setNoteText(e.target.value)} maxLength={120} className="field mt-1 w-full" />
            </label>
            <button type="submit" className="btn-secondary">
              Add note
            </button>
            <button type="button" className="btn-link" onClick={() => setNote(null)}>
              Cancel
            </button>
          </form>
        )}
      </div>

      <div className="min-w-0 space-y-4">
        <section className="card space-y-4">
          <p className="text-sm font-medium text-foreground">{stage.prompt}</p>

          {input.kind === "choice" && (
            <div className="flex flex-wrap gap-2" role="group" aria-label={stage.title}>
              {input.options.map((o) => (
                <button key={o.value} type="button" aria-pressed={choice === o.value} onClick={() => setChoice(o.value)} className="btn-option px-3.5 text-sm">
                  {o.label}
                </button>
              ))}
            </div>
          )}

          {input.kind === "multi" && input.options === "confluences" && (
            <ul className="space-y-2">
              {scenario.confluenceOptions.map((c) => (
                <li key={c.id}>
                  <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-md border border-control px-3 py-2 text-sm has-[:checked]:border-accent has-[:checked]:bg-accent/5">
                    <input type="checkbox" checked={picked.includes(c.id)} onChange={() => toggle(c.id)} className="mt-1 accent-[var(--accent)]" />
                    <span className="text-foreground">{c.label}</span>
                  </label>
                </li>
              ))}
            </ul>
          )}

          {input.kind === "multi" && input.options === "candidates" && (
            <ul className="space-y-2">
              {scenario.candidates.map((c, i) => (
                <li key={c.id}>
                  <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-md border border-control px-3 py-2 text-sm has-[:checked]:border-accent has-[:checked]:bg-accent/5">
                    <input type="checkbox" checked={picked.includes(c.id)} onChange={() => toggle(c.id)} className="mt-1 accent-[var(--accent)]" />
                    <span className="text-foreground">
                      #{i + 1} · {c.label}
                    </span>
                  </label>
                </li>
              ))}
              <li className="text-xs">Tick the ones that actually matter. Leave the rest.</li>
            </ul>
          )}

          {input.kind === "mark" && (
            <p className="text-xs">
              {markup.annotations.length} mark{markup.annotations.length === 1 ? "" : "s"} placed. {input.allowNone ? "If nothing here matters, you can continue without marking." : ""}
            </p>
          )}

          {input.kind === "price" && (
            <div>
              <label htmlFor="stage-price" className="text-xs text-muted">
                Click the chart, or type the price
              </label>
              <input
                id="stage-price"
                type="number"
                inputMode="decimal"
                step={0.25}
                value={price !== null && priceText === "" ? String(price) : priceText}
                onChange={(e) => {
                  setPriceText(e.target.value);
                  const n = Number(e.target.value);
                  setPrice(e.target.value !== "" && Number.isFinite(n) ? n : null);
                }}
                className="field mt-1 w-full tabular-nums"
              />
            </div>
          )}

          {input.kind !== "trade" && (
            <button type="button" className="btn-primary" disabled={!canContinue} onClick={continueStage}>
              Continue
            </button>
          )}
        </section>

        {input.kind === "trade" && (
          <TradeTicket
            bias={null}
            onBias={noop}
            plan={plan}
            onPlan={setPlanned}
            onNewPlan={(d) => setPlanned(newPlan(d))}
            lastClose={lastClose}
            phase="reading"
            outcome={null}
            inTrade={false}
            order={null}
            fillPrice={null}
            barsInTrade={0}
            atLiveEdge
            confidence={null}
            onConfidence={noop}
            onCommit={commitTrade}
            onWait={() => onCommit({ kind: "trade", decision: "wait", order: null })}
            canWait
            allowWait
            asksConfidence={false}
            showBias={false}
          />
        )}
      </div>
    </div>
  );
}
