"use client";

import { useEffect, useRef, useState } from "react";
import { gradeChallengeRecognition } from "@/app/c/actions";
import { useRecordResult } from "@/hooks/use-record-result";
import { describeError } from "@/lib/errors";
import type { GradeResult, UserAnswer, UserRegion } from "@/lib/grading";
import type { PublicChoiceExercise, PublicLevelExercise, PublicZoneExercise } from "@/lib/public-exercise";
import type { RecognitionReveal } from "@/components/practice/recognition-exercise";
import type { Confidence } from "@/lib/confidence";

export type PublicRecognition = PublicZoneExercise | PublicLevelExercise | PublicChoiceExercise;

/** The state of answering one public Recognition exercise: the mark being
 * drawn, the grading round-trip (the key comes back only with the verdict),
 * and where the graded attempt goes (src/hooks/use-record-result.ts). Shared
 * by the challenge page and the landing page's embedded exercise. */
export function useChallengeRecognition(exercise: PublicRecognition, source: string) {
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
  const [confidence, setConfidence] = useState<Confidence | null>(null);
  const [pending, setPending] = useState<UserAnswer | null>(null);
  /** The answer that was graded, for the share card. */
  const [answered, setAnswered] = useState<UserAnswer | null>(null);

  async function submit(answer: UserAnswer) {
    setGrading(true);
    setGradeError(null);
    setPending(answer);
    try {
      const res = await gradeChallengeRecognition(exercise.exercise_id, answer, {
        source,
        responseTimeMs: Date.now() - started.current,
        confidence,
      });
      if (!res.ok) {
        setGradeError(res.error);
        return;
      }
      setPending(null);
      setAnswered(answer);
      setResult(res.grade);
      setReveal(res.reveal);
      void recorder.record(res.row);
    } catch (err) {
      setGradeError(describeError(err, "grade this answer").message);
    } finally {
      setGrading(false);
    }
  }

  /** Commits whatever is currently marked. */
  function submitCurrent() {
    if (exercise.answer_type === "zone" && region) void submit({ type: "region", region });
    else if (exercise.answer_type === "level" && level !== null) void submit({ type: "level", price: level });
    else if (exercise.answer_type === "choice" && choice !== null) void submit({ type: "choice", choice });
  }

  function submitNone() {
    setRegion(null);
    setLevel(null);
    void submit({ type: "none" });
  }

  return {
    recorder,
    region, setRegion, level, setLevel, choice, setChoice, confidence, setConfidence,
    result, reveal, grading, gradeError, answered,
    canRetryGrade: pending !== null,
    retryGrade: () => pending && void submit(pending),
    submitCurrent, submitNone,
  };
}
