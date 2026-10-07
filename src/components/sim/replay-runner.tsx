"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { NavigationGuard } from "@/components/practice/navigation-guard";
import { ChartFrame } from "@/components/practice/exercise-layout";
import { MarkupToolbar, toolsFor } from "@/components/sim/markup-toolbar";
import { PlaybackBar } from "@/components/sim/playback-bar";
import { ReviewView } from "@/components/sim/review-view";
import { ScenarioChart } from "@/components/sim/scenario-chart";
import { TradeTicket } from "@/components/sim/trade-ticket";
import { SaveNote, useGrading } from "@/components/sim/use-grading";
import { useReplay } from "@/components/sim/use-replay";
import type { ChartTrade, Plan } from "@/components/sim/chart-types";
import { useExperience } from "@/contexts/experience-context";
import { atr } from "@/lib/engine/structure";
import type { ExplanationTier } from "@/lib/engine/kind-definitions";
import type { Direction, ModeConfig, PublicScenario } from "@/lib/engine/types";

const snap = (p: number) => Math.round(p / 0.25) * 0.25;
const END_PROMPT = "The scenario has ended and you haven't entered. Finish it as a no-trade, or review what you marked.";

/** The simulator and Blind Chart: one runner, two configurations. The mode
 * decides whether candles advance after the decision (playback) and how much
 * is named for you (guidance); everything else (markup, timeframe switching
 * at one timestamp, the trade ticket, the outcome that stays hidden until
 * the stop or target is hit) is the same code. */
export function ReplayRunner({ scenario, mode, tier, nextHref, againHref }: { scenario: PublicScenario; mode: ModeConfig; tier?: ExplanationTier; nextHref: string; againHref: string }) {
  const stage = mode.stages[0];
  const input = stage.input.kind === "replay" ? stage.input : { kind: "replay" as const, playback: true };
  const playback = input.playback;
  const { level } = useExperience();
  const resolvedTier: ExplanationTier = tier ?? (level === "beginner" ? "define" : "relate");

  const firstTf = stage.initialTimeframe;
  const replay = useReplay(scenario, firstTf);
  const { state, dispatch, series } = replay;
  const [sessionId] = useState(() => `sim_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`);
  const [startedAt] = useState(() => Date.now());
  const grading = useGrading(sessionId);
  const [noteDraft, setNoteDraft] = useState<{ price: number; t: number } | null>(null);
  const [noteText, setNoteText] = useState("");
  const submitted = useRef(false);

  // The timeframe in use must be one the data supports at this moment.
  const tf = replay.timeframes.includes(state.tf) ? state.tf : (replay.timeframes[0] ?? state.tf);

  const nowCandle = state.candles[state.revealed - 1];
  const lastClose = nowCandle?.c ?? 0;
  const ended = state.done && state.revealed >= state.candles.length;

  // Grade when the trade resolves (or immediately, in a mode without playback).
  useEffect(() => {
    const finishNow = !playback && state.phase === "committed";
    if (submitted.current || (state.phase !== "resolved" && !finishNow)) return;
    submitted.current = true;
    dispatch({ type: "play", value: false });
    void grading.submit({
      scenarioId: scenario.id,
      modeId: mode.id,
      stages: { [stage.id]: replay.response() },
      confidence: state.confidence,
      responseTimeMs: Date.now() - startedAt,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once per attempt, when it ends
  }, [state.phase, playback]);

  // Keyboard: space plays and pauses, arrows step.
  useEffect(() => {
    if (!playback) return;
    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target instanceof Element ? e.target : null;
      if (t?.closest("input, textarea, select, button, [contenteditable=true]")) return;
      if (e.key === " ") {
        e.preventDefault();
        dispatch({ type: "play", value: !state.playing });
      } else if (e.key === "ArrowRight") dispatch({ type: "advance", n: e.shiftKey ? 5 : 1 });
      else if (e.key === "ArrowLeft") dispatch({ type: "back" });
      else if (e.key === "Delete" || e.key === "Backspace") dispatch({ type: "deleteSelected" });
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [playback, state.playing, dispatch]);

  const tools = useMemo(() => toolsFor(["liquidity", "zone", "fvg", "ob", "swing_high", "swing_low", "note"], true), []);

  function newPlan(direction: Direction): Plan {
    const unit = Math.max(atr(series, 20) * 1.5, Math.abs(lastClose) * 0.0008);
    const long = direction === "long";
    return { direction, entry: null, stop: snap(long ? lastClose - unit : lastClose + unit), target: snap(long ? lastClose + unit * 2.5 : lastClose - unit * 2.5) };
  }

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
                Next scenario
              </Link>
              <Link href={againHref} className="btn-secondary">
                Try this one again
              </Link>
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

  const order = state.order;
  const fill = replay.fill;
  const planForChart: Plan | null = state.phase === "reading" ? state.plan : order ? { direction: order.direction, entry: order.entry, stop: order.stop, target: order.target } : null;
  const planT = state.phase === "reading" ? state.planT : state.candles[(order?.placedAt ?? 1) - 1]?.t ?? null;
  const chartTrade: ChartTrade | null =
    order && fill ? { direction: order.direction, fillT: state.candles[fill.index].t, fillPrice: fill.price, exitT: null, exitPrice: null, stop: order.stop, target: order.target } : null;

  const busy = grading.grading || state.phase === "resolved";
  const intro = level === "beginner" ? scenario.intro.beginner : scenario.intro.advanced;

  return (
    <div className="space-y-4">
      <NavigationGuard active={!busy} message="Leave this scenario? A replay in progress isn't saved, and you'd start it again from the beginning." />
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="eyebrow">{mode.name}</p>
          <h1 className="text-lg font-semibold text-foreground">
            {stage.guidance === "none" ? "Blind chart" : scenario.title}{" "}
            <span className="text-xs font-normal text-muted">{scenario.seeded ? "· seeded scenario, not market history" : ""}</span>
          </h1>
        </div>
        <p className="max-w-md text-sm">{scenario.prompt}</p>
      </div>
      {stage.guidance !== "none" && <p className="text-sm">{intro}</p>}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0 space-y-3">
          <div className="grid gap-2 sm:grid-cols-[auto_1fr]">
            <MarkupToolbar
              tools={tools}
              tool={state.tool}
              onTool={(t) => dispatch({ type: "tool", tool: t })}
              onUndo={() => dispatch({ type: "undo" })}
              onDelete={() => dispatch({ type: "deleteSelected" })}
              onClear={() => dispatch({ type: "clear" })}
              canUndo={state.undo.length > 0}
              canDelete={state.selectedId !== null}
              canClear={state.annotations.length > 0}
              disabled={busy}
            />
            <ChartFrame>
              <ScenarioChart
                series={series}
                tf={tf}
                tool={state.tool}
                interactive={!busy}
                annotations={state.annotations}
                selectedId={state.selectedId}
                onSelect={(id) => dispatch({ type: "select", id })}
                onCreate={(a) => dispatch({ type: "add", a })}
                onNote={(at) => {
                  setNoteDraft(at);
                  setNoteText("");
                }}
                plan={planForChart}
                planEditable={state.phase === "reading" && !busy}
                planT={planT}
                onPlanChange={(p) => dispatch({ type: "plan", plan: p })}
                trade={chartTrade}
                futureSlots={playback ? 12 : 4}
                label={`${scenario.instrument} ${tf} chart, replay. Use the toolbar to mark liquidity, zones and swings; the trade ticket takes entry, stop and target as numbers.`}
              />
            </ChartFrame>
          </div>

          {noteDraft && (
            <form
              className="flex flex-wrap items-end gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (noteText.trim()) dispatch({ type: "add", a: { kind: "note", price: noteDraft.price, t: noteDraft.t, text: noteText.trim().slice(0, 120), tf } });
                setNoteDraft(null);
              }}
            >
              <label className="min-w-0 flex-1 text-xs text-muted">
                Note
                <input autoFocus value={noteText} onChange={(e) => setNoteText(e.target.value)} maxLength={120} className="field mt-1 w-full" />
              </label>
              <button type="submit" className="btn-secondary">
                Add note
              </button>
              <button type="button" className="btn-link" onClick={() => setNoteDraft(null)}>
                Cancel
              </button>
            </form>
          )}

          <PlaybackBar
            nowT={nowCandle?.t ?? 0}
            tf={tf}
            timeframes={replay.timeframes}
            onTf={(x) => dispatch({ type: "tf", tf: x })}
            playing={state.playing}
            speed={state.speed}
            onPlay={() => dispatch({ type: "play", value: !state.playing })}
            onSpeed={(i) => dispatch({ type: "speed", value: i })}
            onStep={(n) => dispatch({ type: "advance", n })}
            onBack={() => dispatch({ type: "back" })}
            onReset={() => dispatch({ type: "reset" })}
            canBack={state.phase === "reading" && state.revealed > state.startRevealed}
            canReset={state.phase === "reading" && state.revealed > state.startRevealed}
            stepping={playback && state.phase !== "resolved" && !busy && !ended}
            atLiveEdge={replay.atLiveEdge}
            onLive={() => dispatch({ type: "live" })}
            fetching={state.fetching}
            locked={state.phase !== "reading" || !playback}
          />
          {state.fetchError && (
            <p role="alert" className="text-sm text-danger">
              {state.fetchError}{" "}
              <button type="button" className="font-medium text-accent underline" onClick={() => dispatch({ type: "retryFetch" })}>
                Retry
              </button>
            </p>
          )}
          {playback && state.phase === "reading" && ended && (
            <div className="card space-y-3">
              <p className="text-sm">{END_PROMPT}</p>
              <button type="button" className="btn-secondary" onClick={() => dispatch({ type: "commit", decision: "no_trade" })} disabled={state.bias === null}>
                Finish as no trade
              </button>
              {state.bias === null && <p className="text-xs">Declare your bias first.</p>}
            </div>
          )}
        </div>

        <div className="min-w-0 space-y-4">
          {grading.error && (
            <div role="alert" className="card space-y-2">
              <p className="text-sm text-danger">{grading.error}</p>
              <button type="button" className="btn-secondary" onClick={() => { submitted.current = false; grading.retry(); dispatch({ type: "play", value: false }); window.location.reload(); }}>
                Start this scenario again
              </button>
            </div>
          )}
          {grading.grading && <p className="text-sm text-muted">Grading…</p>}
          <TradeTicket
            bias={state.bias}
            onBias={(b) => dispatch({ type: "bias", bias: b })}
            plan={state.plan}
            onPlan={(p) => dispatch({ type: "plan", plan: p })}
            onNewPlan={(d) => dispatch({ type: "plan", plan: newPlan(d) })}
            lastClose={lastClose}
            phase={state.phase}
            outcome={replay.outcome}
            inTrade={state.orderState?.status === "open"}
            order={order}
            fillPrice={fill?.price ?? null}
            barsInTrade={fill ? state.revealed - fill.index : 0}
            atLiveEdge={replay.atLiveEdge}
            confidence={state.confidence}
            onConfidence={(c) => dispatch({ type: "confidence", value: c })}
            onCommit={(d) => dispatch({ type: "commit", decision: d })}
            onWait={() => dispatch({ type: "wait" })}
            canWait={playback && !ended}
            allowWait={playback}
            asksConfidence={mode.asksConfidence}
          />
          {playback && state.phase === "committed" && (
            <button type="button" className="btn-secondary w-full" onClick={() => { dispatch({ type: "speed", value: 4 }); dispatch({ type: "play", value: true }); }}>
              Run to the result
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
