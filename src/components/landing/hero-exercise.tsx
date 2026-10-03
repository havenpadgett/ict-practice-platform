"use client";

import Link from "next/link";
import { GlossaryText } from "@/components/glossary/glossary-text";
import { CandlestickChart } from "@/components/practice/candlestick-chart";
import { ExerciseControls } from "@/components/practice/exercise-controls";
import { ManualEntry } from "@/components/practice/manual-entry";
import { ShareButton } from "@/components/share-button";
import { CheckRow, Verdict } from "@/components/verdict";
import { useChallengeRecognition } from "@/hooks/use-challenge-recognition";
import { challengePath, practiceMoreHref, signUpHref } from "@/lib/challenge";
import { conceptShortName, DIFFICULTY_LABELS } from "@/lib/concepts";
import type { PublicZoneExercise } from "@/lib/public-exercise";

/** The product, on the landing page: one real exercise, playable with no
 * account. Mark the chart, submit, see your mark against the correct one
 * and why, then the invitation to keep going. The chart comes without its
 * key; grading happens on the server (src/app/c/actions.ts) like any
 * other public challenge, and the result is saved if the visitor is signed
 * in or kept on the device for after sign-up. */
export function HeroExercise({ exercise }: { exercise: PublicZoneExercise }) {
  const c = useChallengeRecognition(exercise, "challenge");
  const answering = c.result === null && !c.grading;
  const practiceHref = practiceMoreHref(exercise.concept);

  return (
    <section aria-labelledby="hero-exercise-title" className="rounded-lg border border-line bg-surface p-3 sm:p-4">
      <div className="flex items-baseline justify-between gap-3 px-1">
        <h2 id="hero-exercise-title" className="eyebrow">
          Try it now · no account
        </h2>
        <p className="eyebrow shrink-0">
          {conceptShortName(exercise.concept)} · {DIFFICULTY_LABELS[exercise.difficulty]}
        </p>
      </div>
      <p className="mt-2 px-1 text-base text-foreground sm:text-lg">
        <GlossaryText text={exercise.prompt} />
      </p>

      <div className="mt-3">
        <CandlestickChart
          answerType="zone"
          candles={exercise.candles}
          interactive={answering}
          userRegion={c.region}
          onUserRegionChange={c.setRegion}
          correctZone={c.reveal?.zone ?? null}
        />
      </div>

      <div className="mt-3 px-1" aria-live="polite">
        {c.gradeError ? (
          <div role="alert">
            <p className="text-sm text-danger">{c.gradeError}</p>
            {c.canRetryGrade && (
              <button type="button" onClick={c.retryGrade} className="btn-primary mt-3">
                Try again
              </button>
            )}
          </div>
        ) : c.grading ? (
          <p className="text-sm text-muted" role="status">
            Grading…
          </p>
        ) : c.result ? (
          <div>
            <Verdict verdict={c.result.verdict} />
            {c.result.failureMessage && (
              <p className="mt-2 text-sm text-foreground">
                <GlossaryText text={c.result.failureMessage} />
              </p>
            )}
            {c.result.checks && c.result.checks.length > 0 && (
              <ul className="mt-3 space-y-2.5">
                {c.result.checks.map((check) => (
                  <CheckRow key={check.id} verdict={check.verdict} label={check.label}>
                    {check.detail}
                  </CheckRow>
                ))}
              </ul>
            )}
            <p className="mt-3 text-sm text-muted">
              <GlossaryText text={c.result.explanation} />
            </p>

            <div className="mt-5 border-t border-line pt-4">
              <p className="text-sm text-foreground">
                {c.recorder.signedIn
                  ? "That's saved to your history."
                  : "That's the loop. With a free account your answers, mistakes and recommendations are kept."}
              </p>
              <div className="mt-3 flex flex-wrap items-start gap-3">
                {c.recorder.signedIn ? (
                  <Link href={practiceHref} className="btn-primary">
                    Practice more {conceptShortName(exercise.concept)}
                  </Link>
                ) : (
                  <Link href={signUpHref("/dashboard")} className="btn-primary">
                    Create a free account
                  </Link>
                )}
                <Link href="/try" className="btn-secondary">
                  Try 3 more charts
                </Link>
                <ShareButton
                  path={challengePath(exercise.exercise_id)}
                  title="A chart challenge"
                  text="Can you read this chart? Mark your answer and see how it compares."
                  label="Challenge a friend"
                  className="btn-link"
                />
              </div>
              {!c.recorder.signedIn && (
                <p className="mt-3 text-xs text-muted">Your result stays on this device until you sign up, then it&apos;s added to your history.</p>
              )}
            </div>
          </div>
        ) : (
          <>
            <ExerciseControls
              hint="Drag on the chart to draw a box around your answer."
              canSubmit={c.region !== null}
              onSubmit={c.submitCurrent}
              onNoAnswer={c.submitNone}
              noAnswerLabel={exercise.noAnswerLabel}
              onClear={c.region ? () => c.setRegion(null) : undefined}
              confidence={c.confidence}
              onConfidenceChange={c.setConfidence}
            />
            <ManualEntry kind="zone" candleCount={exercise.candles.length} onRegion={c.setRegion} />
          </>
        )}
      </div>
    </section>
  );
}
