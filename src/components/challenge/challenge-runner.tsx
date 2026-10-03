"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { gradeChallengeGuided } from "@/app/c/actions";
import { ChallengeAfter } from "@/components/challenge/challenge-after";
import { GuidedExercise, type GuidedGradeResponse } from "@/components/practice/guided-exercise";
import { RecognitionExercise } from "@/components/practice/recognition-exercise";
import { useChallengeRecognition } from "@/hooks/use-challenge-recognition";
import { useRecordResult } from "@/hooks/use-record-result";
import { conceptShortName, DIFFICULTY_LABELS } from "@/lib/concepts";
import { practiceMoreHref, signUpHref } from "@/lib/challenge";
import { describeError } from "@/lib/errors";
import type { GuidedUserAnswer } from "@/lib/guided-grading";
import type { PublicChoiceExercise, PublicGuidedExercise, PublicLevelExercise, PublicZoneExercise } from "@/lib/public-exercise";

export type ChallengeExerciseData = PublicZoneExercise | PublicLevelExercise | PublicChoiceExercise | PublicGuidedExercise;

/** A single public exercise, answered with no account (/c/<id>, the
 * landing page, the daily challenge). The server grades it and returns the
 * attempt row, which is saved to the visitor's history if they're signed
 * in and kept on the device otherwise. */
export function ChallengeRunner({
  exercise,
  source,
  sharePath,
  signedInCta,
  extra,
}: {
  exercise: ChallengeExerciseData;
  /** Which public surface this is, sent with every grade ("challenge"). */
  source: string;
  /** The link someone would share to send this exact chart. */
  sharePath: string;
  /** Overrides the "practice more" action once graded. */
  signedInCta?: ReactNode;
  /** Shown under the feedback once graded (daily streaks, etc.). */
  extra?: ReactNode;
}) {
  if (exercise.answer_type === "guided") {
    return <GuidedChallenge exercise={exercise} source={source} sharePath={sharePath} extra={extra} />;
  }
  return <RecognitionChallenge exercise={exercise} source={source} sharePath={sharePath} signedInCta={signedInCta} extra={extra} />;
}

function promptFor(exercise: ChallengeExerciseData) {
  return (
    <div>
      <p className="text-lg leading-snug text-foreground sm:text-xl">{exercise.prompt}</p>
      <p className="mt-1.5 text-xs text-muted">
        {DIFFICULTY_LABELS[exercise.difficulty]} · {conceptShortName(exercise.concept)}
      </p>
    </div>
  );
}

function RecognitionChallenge({
  exercise,
  source,
  sharePath,
  signedInCta,
  extra,
}: {
  exercise: PublicZoneExercise | PublicLevelExercise | PublicChoiceExercise;
  source: string;
  sharePath: string;
  signedInCta?: ReactNode;
  extra?: ReactNode;
}) {
  const c = useChallengeRecognition(exercise, source);
  const { recorder } = c;
  const practiceHref = practiceMoreHref(exercise.concept);
  const after = c.result !== null && (
    <>
      <ChallengeAfter
        concept={exercise.concept}
        sharePath={sharePath}
        state={recorder.state}
        error={recorder.error}
        signedIn={recorder.signedIn}
        onRetrySave={() => void recorder.retry()}
      />
      {extra}
    </>
  );
  const cta = signedInCta ?? (
    <Link href={recorder.signedIn ? practiceHref : signUpHref(practiceHref)} className="btn-primary">
      Practice more {conceptShortName(exercise.concept)}
    </Link>
  );
  const router = useRouter();

  return (
    <RecognitionExercise
      exercise={exercise}
      prompt={promptFor(exercise)}
      userRegion={c.region}
      onUserRegionChange={c.setRegion}
      userLevel={c.level}
      onUserLevelChange={c.setLevel}
      userChoice={c.choice}
      onUserChoiceChange={c.setChoice}
      result={c.result}
      reveal={c.reveal}
      isRetry={false}
      grading={c.grading}
      gradeError={c.gradeError}
      canRetryGrade={c.canRetryGrade}
      onRetryGrade={c.retryGrade}
      onSkip={() => router.push("/")}
      onSubmit={c.submitCurrent}
      onNoAnswer={c.submitNone}
      onNext={() => {}}
      nextLabel=""
      onRetryChart={() => {}}
      feedbackActions={cta}
      footer={after}
    />
  );
}

function GuidedChallenge({
  exercise,
  source,
  sharePath,
  extra,
}: {
  exercise: PublicGuidedExercise;
  source: string;
  sharePath: string;
  extra?: ReactNode;
}) {
  const router = useRouter();
  const recorder = useRecordResult();
  const started = useRef(0);
  useEffect(() => {
    started.current = Date.now();
  }, []);
  const [gradeError, setGradeError] = useState<string | null>(null);
  const [graded, setGraded] = useState(false);
  const practiceHref = practiceMoreHref(exercise.concept);

  async function gradeGuided(answer: GuidedUserAnswer): Promise<GuidedGradeResponse | null> {
    setGradeError(null);
    try {
      const res = await gradeChallengeGuided(exercise.exercise_id, answer, { source, responseTimeMs: Date.now() - started.current });
      if (!res.ok) {
        setGradeError(res.error);
        return null;
      }
      setGraded(true);
      void recorder.record(res.row);
      return { grade: res.grade, reveal: res.reveal };
    } catch (err) {
      setGradeError(describeError(err, "grade this setup").message);
      return null;
    }
  }

  return (
    <GuidedExercise
      exercise={exercise}
      prompt={promptFor(exercise)}
      footer={
        <>
          {gradeError && (
            <p className="mt-3 text-sm text-danger" role="alert">
              {gradeError}
            </p>
          )}
          {graded && (
            <>
              <ChallengeAfter
                concept={exercise.concept}
                sharePath={sharePath}
                state={recorder.state}
                error={recorder.error}
                signedIn={recorder.signedIn}
                onRetrySave={() => void recorder.retry()}
              />
              {extra}
            </>
          )}
        </>
      }
      onGrade={gradeGuided}
      onNext={() => router.push(recorder.signedIn ? practiceHref : signUpHref(practiceHref))}
      nextLabel={`Practice more ${conceptShortName(exercise.concept)}`}
    />
  );
}
