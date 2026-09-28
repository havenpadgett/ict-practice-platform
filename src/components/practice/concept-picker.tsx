import type { ReactNode } from "react";
import { getPracticeCatalog } from "@/data/catalog";
import { RecommendedSession } from "@/components/recommended-session";
import { CONCEPTS, conceptDisplayName, conceptShortName, type Concept } from "@/lib/concepts";
import {
  accuracyLabel,
  difficultyRange,
  estimateConceptMinutes,
  LIQUIDITY_VARIANT,
  RECOGNITION_CONCEPTS,
  TRADE_CONCEPTS,
} from "@/lib/practice-modes";
import type { ConceptScore, Recommendation } from "@/lib/recommendations";

export type ActiveSessionInfo = { title: string; position: number; total: number };

/** "What" (a concept) is chosen here; "how many" on the next screen. The
 * page is grouped so the next step is obvious: what's recommended first,
 * then recognition, then trade practice, then mixed and review sessions. */
export function ConceptPicker({
  scores,
  recommendation,
  openMistakes,
  activeSession,
  onContinue,
  onPick,
  onPickAdaptive,
  onPickMistakes,
  onPickMixed,
  error,
}: {
  /** Per-concept history; null while loading (or if it couldn't load). */
  scores: Map<Concept, ConceptScore> | null;
  recommendation: Recommendation | null;
  openMistakes: number;
  activeSession: ActiveSessionInfo | null;
  onContinue: () => void;
  onPick: (concept: Concept) => void;
  onPickAdaptive: () => void;
  onPickMistakes: () => void;
  onPickMixed: () => void;
  error?: string | null;
}) {
  const recommended = recommendation?.concept ?? null;
  const showRecommended = activeSession !== null || recommendation !== null || openMistakes > 0;

  return (
    <div>
      <h1 className="page-title">Practice</h1>
      <p className="page-lede">Recognize one concept at a time, then put them together in a full trade.</p>

      {error && (
        <p className="text-error mt-4" role="alert">
          {error}
        </p>
      )}

      {showRecommended && (
        <section className="mt-8 space-y-4" aria-labelledby="picker-recommended">
          <h2 id="picker-recommended" className="eyebrow">
            Recommended
          </h2>
          {activeSession && (
            <div className="card flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="eyebrow">In progress</p>
                <p className="mt-1 text-base font-semibold text-foreground">{activeSession.title}</p>
                <p className="mt-0.5 text-sm text-muted tabular-nums">
                  Exercise {Math.min(activeSession.position + 1, activeSession.total)} of {activeSession.total}
                </p>
              </div>
              <button type="button" onClick={onContinue} className="btn-primary shrink-0">
                Continue session
              </button>
            </div>
          )}
          {recommendation && <RecommendedSession recommendation={recommendation} headingLevel={3} primary={activeSession === null} />}
          {openMistakes > 0 && (
            <div className="flex flex-col gap-3 rounded-lg border border-line px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-foreground">
                <span className="font-semibold tabular-nums">{openMistakes}</span> mistake{openMistakes === 1 ? "" : "s"} waiting
                for review
              </p>
              <button type="button" onClick={onPickMistakes} className="btn-secondary shrink-0">
                Review {openMistakes} mistake{openMistakes === 1 ? "" : "s"}
              </button>
            </div>
          )}
        </section>
      )}

      <section className="mt-section" aria-labelledby="picker-recognition">
        <h2 id="picker-recognition" className="text-lg">
          Recognition practice
        </h2>
        <p className="mt-1 text-sm text-muted">
          One chart, one concept. Draw a box, place a line or pick an answer, and &ldquo;there isn&apos;t one&rdquo; is
          always an option.
        </p>
        <ul className="mt-4 divide-y divide-line overflow-hidden rounded-lg border border-line">
          {RECOGNITION_CONCEPTS.map((concept) => (
            <li key={concept}>
              <ConceptRow concept={concept} score={scores?.get(concept)} loading={scores === null} recommended={recommended === concept} onPick={onPick} />
              {concept === "Liquidity" && (
                <ConceptRow
                  concept={LIQUIDITY_VARIANT}
                  variantOf="Liquidity"
                  score={scores?.get(LIQUIDITY_VARIANT)}
                  loading={scores === null}
                  recommended={recommended === LIQUIDITY_VARIANT}
                  onPick={onPick}
                />
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-section" aria-labelledby="picker-trade">
        <h2 id="picker-trade" className="text-lg">
          Trade practice
        </h2>
        <p className="mt-1 text-sm text-muted">
          Put the concepts together into a decision. Graded on process, and No Trade is often the right call.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {TRADE_CONCEPTS.map((concept) => (
            <TradeCard key={concept} concept={concept} score={scores?.get(concept)} loading={scores === null} recommended={recommended === concept} onPick={onPick} />
          ))}
        </div>
      </section>

      <section className="mt-section" aria-labelledby="picker-mixed">
        <h2 id="picker-mixed" className="text-lg">
          Mixed and review
        </h2>
        <ul className="mt-4 divide-y divide-line overflow-hidden rounded-lg border border-line">
          <li>
            <PlainRow
              title="Adaptive mix"
              detail="10 exercises across concepts, weighted toward the ones you miss most."
              meta="About 8 min"
              onClick={onPickAdaptive}
            />
          </li>
          <li>
            <PlainRow
              title="Mixed concepts"
              detail="10 recognition exercises drawn evenly from every concept, so each chart asks something different."
              meta="About 7 min"
              onClick={onPickMixed}
            />
          </li>
          <li>
            <PlainRow
              title="Review mistakes"
              detail={
                openMistakes > 0
                  ? "Only the exercises you last got wrong, most recent first."
                  : "Nothing to review. Anything you miss shows up here."
              }
              meta={openMistakes > 0 ? `${openMistakes} to review` : undefined}
              onClick={onPickMistakes}
              disabled={openMistakes === 0}
            />
          </li>
        </ul>
      </section>
    </div>
  );
}

function Chevron() {
  return (
    <svg viewBox="0 0 16 16" width={16} height={16} aria-hidden className="shrink-0 text-muted transition-colors group-hover:text-foreground">
      <path d="m6 3.5 4.5 4.5L6 12.5" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function RecommendedTag() {
  return <span className="ml-2 align-middle text-[11px] font-semibold tracking-wide text-accent uppercase">Recommended</span>;
}

function metaFor(concept: Concept): string {
  const count = getPracticeCatalog(concept).length;
  const each = estimateConceptMinutes(concept, 1);
  return `${difficultyRange(concept)} · ${count} exercise${count === 1 ? "" : "s"} · about ${each} min each`;
}

function ConceptRow({
  concept,
  variantOf,
  score,
  loading,
  recommended,
  onPick,
}: {
  concept: Concept;
  /** Shown indented under its parent concept. */
  variantOf?: Concept;
  score: ConceptScore | undefined;
  loading: boolean;
  recommended: boolean;
  onPick: (concept: Concept) => void;
}) {
  const ready = getPracticeCatalog(concept).length > 0;
  const title = conceptDisplayName(concept);
  return (
    <button
      type="button"
      onClick={() => onPick(concept)}
      disabled={!ready}
      className={`group flex w-full items-center gap-4 py-4 pr-4 text-left transition-colors hover:bg-surface disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent ${
        variantOf ? "border-t border-line pl-9 sm:pl-10" : "pl-4 sm:pl-5"
      }`}
    >
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-foreground sm:text-base">
          {variantOf && <span className="sr-only">{CONCEPTS[variantOf].pickerLabel}: </span>}
          {title}
          {recommended && <RecommendedTag />}
        </span>
        <span className="mt-0.5 block text-sm text-muted">{ready ? CONCEPTS[concept].pickerDescription : "No exercises ready yet."}</span>
        {ready && (
          <span className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted tabular-nums">
            <span>{metaFor(concept)}</span>
            <span className="text-foreground">{loading ? " " : accuracyLabel(score)}</span>
          </span>
        )}
      </span>
      <Chevron />
    </button>
  );
}

function TradeCard({
  concept,
  score,
  loading,
  recommended,
  onPick,
}: {
  concept: Concept;
  score: ConceptScore | undefined;
  loading: boolean;
  recommended: boolean;
  onPick: (concept: Concept) => void;
}) {
  const ready = getPracticeCatalog(concept).length > 0;
  const steps: Record<string, string> = {
    GuidedEntry: "Bias → entry → stop → target, each graded on its own.",
    FreeTrade: "Candle by candle, no future candles. Decide if, when and how to trade.",
  };
  return (
    <div className="card flex flex-col">
      <h3 className="text-base">
        {conceptDisplayName(concept)}
        {recommended && <RecommendedTag />}
      </h3>
      <p className="mt-1 text-sm text-muted">{steps[concept]}</p>
      <p className="mt-3 text-xs text-muted tabular-nums">{ready ? metaFor(concept) : "No scenarios ready yet."}</p>
      <p className="mt-0.5 text-xs text-foreground tabular-nums">{loading ? " " : accuracyLabel(score)}</p>
      <div className="mt-auto pt-5">
        <button type="button" onClick={() => onPick(concept)} disabled={!ready} className="btn-secondary w-full sm:w-auto">
          Start {conceptShortName(concept)}
        </button>
      </div>
    </div>
  );
}

function PlainRow({
  title,
  detail,
  meta,
  onClick,
  disabled,
}: {
  title: string;
  detail: ReactNode;
  meta?: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="group flex w-full items-center gap-4 py-4 pr-4 pl-4 text-left transition-colors hover:bg-surface disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent sm:pl-5"
    >
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-foreground sm:text-base">{title}</span>
        <span className="mt-0.5 block text-sm text-muted">{detail}</span>
        {meta && <span className="mt-1.5 block text-xs text-muted tabular-nums">{meta}</span>}
      </span>
      <Chevron />
    </button>
  );
}
