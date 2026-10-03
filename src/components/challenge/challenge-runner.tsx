"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { gradeChallengeGuided, gradeChallengeRecognition } from "@/app/c/actions";
import { ChallengeAfter } from "@/components/challenge/challenge-after";
import { GuidedExercise, type GuidedGradeResponse } from "@/components/practice/guided-exercise";
import { RecognitionExercise, type RecognitionReveal } from "@/components/practice/recognition-exercise";
import { useRecordResult } from "@/hooks/use-record-result";
import { conceptShortName, DIFFICULTY_LABELS } from "@/lib/concepts";
import { practiceMoreHref, signUpHref } from "@/lib/challenge";
import { describeError } from "@/lib/errors";
import type { GradeResult, UserAnswer, UserRegion } from "@/lib/grading";
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
  const router = useRouter();
  const recorder = useRecordResult();
  const started = useRef(0);
  useEffect(() => {
    started.current = Date.now();
  }, [exercise.exercise_id]);

  const [region, setRegion] = useState<UserRegion | null>(null);
  const [level, setLevel] = useState<number | null>(null);
  const [choice, setChoice] = useState<string | null>(null);
  const [result, setResult] = useState<GradeResult | null>(null);
  const [reveal, setReveal] = useState<RecognitionReveal | null>(null);
  const [grading, setGrading] = useState(false);
  const [gradeError, setGradeError] = useState<string | null>(null);
  const [pending, setPending] = useState<UserAnswer | null>(null);
  const [guidedGraded, setGuidedGraded] = useState(false);

  const meta = `${DIFFICULTY_LABELS[exercise.difficulty]} · ${conceptShortName(exercise.concept)}`;
  const prompt = (
    <div>
      <p className="text-lg leading-snug text-foreground sm:text-xl">{exercise.prompt}</p>
      <p className="mt-1.5 text-xs text-muted">{meta}</p>
    </div>
  );
  const graded = result !== null || guidedGraded;
  const practiceHref = practiceMoreHref(exercise.concept);

  async function submit(answer: UserAnswer) {
    if (exercise.answer_type === "guided") return;
    setGrading(true);
    setGradeError(null);
    setPending(answer);
    try {
      const res = await gradeChallengeRecognition(exercise.exercise_id, answer, {
        source,
        responseTimeMs: Date.now() - started.current,
      });
      if (!res.ok) {
        setGradeError(res.error);
        return;
      }
      setPending(null);
      setResult(res.grade);
      setReveal(res.reveal);
      void recorder.record(res.row);
    } catch (err) {
      setGradeError(describeError(err, "grade this answer").message);
    } finally {
      setGrading(false);
    }
  }

  async function gradeGuided(answer: GuidedUserAnswer): Promise<GuidedGradeResponse | null> {
    if (exercise.answer_type !== "guided") return null;
    setGradeError(null);
    try {
      const res = await gradeChallengeGuided(exercise.exercise_id, answer, { source, responseTimeMs: Date.now() - started.current });
      if (!res.ok) {
        setGradeError(res.error);
        return null;
      }
      setGuidedGraded(true);
      void recorder.record(res.row);
      return { grade: res.grade, reveal: res.reveal };
    } catch (err) {
      setGradeError(describeError(err, "grade this setup").message);
      return null;
    }
  }

  const after = graded && (
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

  if (exercise.answer_type === "guided") {
    return (
      <GuidedExercise
        exercise={exercise}
        prompt={prompt}
        footer={
          <>
            {gradeError && (
              <p className="mt-3 text-sm text-danger" role="alert">
                {gradeError}
              </p>
            )}
            {after}
          </>
        }
        onGrade={gradeGuided}
        onNext={() => router.push(recorder.signedIn ? practiceHref : signUpHref(practiceHref))}
        nextLabel={`Practice more ${conceptShortName(exercise.concept)}`}
      />
    );
  }

  return (
    <RecognitionExercise
      exercise={exercise}
      prompt={prompt}
      userRegion={region}
      onUserRegionChange={setRegion}
      userLevel={level}
      onUserLevelChange={setLevel}
      userChoice={choice}
      onUserChoiceChange={setChoice}
      result={result}
      reveal={reveal}
      isRetry={false}
      grading={grading}
      gradeError={gradeError}
      canRetryGrade={pending !== null}
      onRetryGrade={() => pending && void submit(pending)}
      onSkip={() => router.push("/")}
      onSubmit={() => {
        if (exercise.answer_type === "zone" && region) void submit({ type: "region", region });
        else if (exercise.answer_type === "level" && level !== null) void submit({ type: "level", price: level });
        else if (exercise.answer_type === "choice" && choice !== null) void submit({ type: "choice", choice });
      }}
      onNoAnswer={() => {
        setRegion(null);
        setLevel(null);
        void submit({ type: "none" });
      }}
      onNext={() => {}}
      nextLabel=""
      onRetryChart={() => {}}
      feedbackActions={cta}
      footer={after}
    />
  );
}
