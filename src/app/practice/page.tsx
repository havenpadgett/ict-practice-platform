"use client";

import { useEffect, useRef, useState } from "react";
import { DisclaimerFooter } from "@/components/disclaimer-footer";
import { LoadingState } from "@/components/loading-state";
import { ConceptPicker, type ActiveSessionInfo } from "@/components/practice/concept-picker";
import { FreeTradeExercise, type FreeTradeAttempt, type FreeTradeGradeResponse } from "@/components/practice/free-trade-exercise";
import { ReportQuestion } from "@/components/practice/report-question";
import { GuidedExercise, type GuidedGradeResponse } from "@/components/practice/guided-exercise";
import { NavigationGuard } from "@/components/practice/navigation-guard";
import { RecognitionExercise } from "@/components/practice/recognition-exercise";
import { SessionLengthPicker } from "@/components/practice/session-length-picker";
import { SessionSummary } from "@/components/practice/session-summary";
import { SaveStatus } from "@/components/save-status";
import { gradeFreeTradeScenario, gradeGuided, gradeRecognition, loadSessionExercises } from "@/app/practice/actions";
import { getExerciseMeta } from "@/data/catalog";
import type { ZoneAnswer } from "@/data/exercises";
import { useRequireAuth } from "@/hooks/use-require-auth";
import { DASHBOARD_COLUMNS, fetchAttempts, insertAttempt, nextAttemptNumber, type DbAttempt, type NewAttempt } from "@/lib/attempts";
import { describeError, type FriendlyError } from "@/lib/errors";
import { modeFor, track, type SessionSource } from "@/lib/events";
import { CONCEPT_LIST, conceptShortName, DIFFICULTY_LABELS, getConceptMeta, type Concept } from "@/lib/concepts";
import type { GradeResult, UserAnswer, UserRegion } from "@/lib/grading";
import type { GuidedUserAnswer } from "@/lib/guided-grading";
import { recordSessionCompletion } from "@/lib/profiles";
import type { PublicExercise } from "@/lib/public-exercise";
import { mistakeCounts, mistakeSessionIds } from "@/lib/mistakes";
import { buildAdaptiveSession, recommendSession, scoreConcepts } from "@/lib/recommendations";
import { buildMixedSessionIds, buildSessionExerciseIds, type SessionLength } from "@/lib/session-builder";
import {
  ADAPTIVE_SESSION,
  MISTAKES_SESSION,
  MIXED_SESSION,
  clearProgress,
  clearSession,
  createSession,
  loadProgress,
  loadSession,
  saveProgress,
  saveSession,
  type SessionState,
} from "@/lib/storage";

/** Response time for an attempt — called from event handlers only. */
function msSince(start: number): number {
  return Date.now() - start;
}

export default function PracticePage() {
  const { user, loading: authLoading } = useRequireAuth();
  const [session, setSession] = useState<SessionState | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  /** Set once a concept is picked, before session length is chosen — shows
   * the length picker instead of immediately starting a session. */
  const [lengthPickerConcept, setLengthPickerConcept] = useState<Concept | null>(null);
  const [userRegion, setUserRegion] = useState<UserRegion | null>(null);
  const [userLevel, setUserLevel] = useState<number | null>(null);
  const [userChoice, setUserChoice] = useState<string | null>(null);
  const [result, setResult] = useState<GradeResult | null>(null);
  /** The key to draw on the chart, returned by the server with the verdict. */
  const [reveal, setReveal] = useState<{ zone: ZoneAnswer | null; level: number | null } | null>(null);
  const [grading, setGrading] = useState(false);
  /** Answering the same chart again after feedback. Graded, never recorded:
   * an immediate retry isn't independent evidence of anything. */
  const [retrying, setRetrying] = useState(false);
  /** Guided Entry / Free Trade feedback is on screen (they grade internally). */
  const [flowGraded, setFlowGraded] = useState(false);
  /** A recognition answer whose grading request failed, for "Try again". */
  const [pendingAnswer, setPendingAnswer] = useState<{ answer: UserAnswer; responseTimeMs: number } | null>(null);
  /** Exercises of the current session as the server sent them (answer-free,
   * docs/ANSWER-KEYS.md); null = no longer available. */
  const [loaded, setLoaded] = useState<Record<string, PublicExercise | null>>({});
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<FriendlyError | null>(null);
  /** The last attempt row that failed to save, so it can be retried. */
  const pendingRowRef = useRef<NewAttempt | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [gradeError, setGradeError] = useState<string | null>(null);
  const [adaptiveError, setAdaptiveError] = useState<string | null>(null);
  const exerciseStartRef = useRef<number>(0);
  /** The user's history for the picker's accuracy, recommendation and
   * mistakes count; null until loaded. */
  const [pickerAttempts, setPickerAttempts] = useState<DbAttempt[] | null>(null);
  /** A Review Mistakes deep link waiting for auth to resolve. */
  const pendingMistakesRef = useRef<{ retryId?: string } | null>(null);


  // ---- Autosave (src/lib/storage.ts → ExerciseProgress) ------------------
  // The exercise on screen is saved as it's answered: the box, line or
  // choice so far, a Guided/Free Trade flow part-way through, and the grade
  // the moment it arrives. A refresh restores it onto the same exercise.
  const sessionRef = useRef<SessionState | null>(null);
  const progressRef = useRef<{ draft: unknown; graded: unknown; started_at: number | null }>({
    draft: null,
    graded: null,
    started_at: null,
  });
  /** Which exercise the saved progress was restored for, and what it held
   * for the Guided/Free Trade components to start from. */
  const [restored, setRestored] = useState<{ key: string; draft: unknown; graded: unknown } | null>(null);
  const progressKey = session && !session.completed ? `${session.session_id}:${session.current_index}` : null;

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  function persistProgress(patch: { draft?: unknown; graded?: unknown }) {
    const s = sessionRef.current;
    if (!s || s.completed) return;
    progressRef.current = { ...progressRef.current, ...patch };
    saveProgress({
      session_id: s.session_id,
      current_index: s.current_index,
      exercise_id: s.exercise_order[s.current_index],
      started_at: progressRef.current.started_at ?? Date.now(),
      draft: progressRef.current.draft,
      graded: progressRef.current.graded,
    });
  }

  // Restore the saved progress whenever the exercise on screen changes.
  // Reading localStorage is a sync from browser-only state, so the
  // setState-in-effect here is intentional.
  useEffect(() => {
    if (!progressKey || !session) return;
    const p = loadProgress(session);
    progressRef.current = { draft: p?.draft ?? null, graded: p?.graded ?? null, started_at: p?.started_at ?? null };
    const draft = (p?.draft ?? null) as { region?: unknown; level?: unknown; choice?: unknown } | null;
    const graded = (p?.graded ?? null) as { result?: unknown; reveal?: unknown } | null;
    if (draft && typeof draft === "object") {
      const r = draft.region as UserRegion | null | undefined;
      if (r && typeof r === "object" && [r.priceLow, r.priceHigh, r.candleIndexLow, r.candleIndexHigh].every(Number.isFinite)) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setUserRegion(r);
      }
      if (typeof draft.level === "number" && Number.isFinite(draft.level)) setUserLevel(draft.level);
      if (typeof draft.choice === "string") setUserChoice(draft.choice);
    }
    if (graded && typeof graded === "object") {
      if (graded.result && typeof graded.result === "object" && "isCorrect" in graded.result) {
        setResult(graded.result as GradeResult);
        setReveal((graded.reveal ?? null) as typeof reveal);
      } else {
        // Guided Entry / Free Trade: the component restores its own feedback.
        setFlowGraded(true);
      }
    }
    setRestored({ key: progressKey, draft: p?.draft ?? null, graded: p?.graded ?? null });
    // Keyed on the exercise position; `session` is read, not a trigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [progressKey]);

  // Start the response-time clock when the exercise is first shown, or keep
  // the one from before a refresh.
  const currentId = session && !session.completed ? session.exercise_order[session.current_index] : null;
  const currentLoaded = currentId !== null && currentId in loaded;
  useEffect(() => {
    if (!currentLoaded) return;
    const isNew = progressRef.current.started_at === null;
    const started = progressRef.current.started_at ?? Date.now();
    exerciseStartRef.current = started;
    progressRef.current.started_at = started;
    if (isNew) persistProgress({});
  }, [session?.session_id, session?.current_index, currentLoaded]);

  // Autosave a recognition answer as it's drawn or picked.
  useEffect(() => {
    if (!currentLoaded || restored?.key !== progressKey) return;
    if (userRegion === null && userLevel === null && userChoice === null && progressRef.current.draft === null) return;
    persistProgress({ draft: { region: userRegion, level: userLevel, choice: userChoice } });
    // persistProgress reads refs only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userRegion, userLevel, userChoice]);

  // Fetch the session's exercises from the server (without answer keys).
  // Each session frames its charts differently (src/lib/framing.ts), so
  // what's loaded belongs to one session id.
  const activeSessionId = session && !session.completed ? session.session_id : "";
  const sessionIds = session && !session.completed ? session.exercise_order.join(",") : "";
  useEffect(() => {
    if (!sessionIds) return;
    const missing = sessionIds.split(",").filter((id) => !(id in loaded));
    if (missing.length === 0) return;
    let cancelled = false;
    loadSessionExercises(missing, activeSessionId)
      .then((res) => {
        if (cancelled) return;
        if (!res.ok) {
          setLoadError(res.error);
          return;
        }
        setLoadError(null);
        setLoaded((prev) => ({ ...prev, ...res.exercises }));
      })
      .catch((err) => {
        if (!cancelled) setLoadError(describeError(err, "load this exercise").message);
      });
    return () => {
      cancelled = true;
    };
    // `loaded` is read, not a trigger: re-running on every merge would refetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSessionId, sessionIds, loadAttempt]);

  // The picker's history: loaded whenever it's shown, so numbers are fresh
  // after a session. A failure just leaves the numbers out.
  useEffect(() => {
    if (!showPicker || !user) return;
    let cancelled = false;
    fetchAttempts(user.id, DASHBOARD_COLUMNS)
      .then((rows) => {
        if (!cancelled) setPickerAttempts(rows);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [showPicker, user]);

  function handlePickConcept(concept: Concept) {
    setShowPicker(false);
    setLengthPickerConcept(concept);
  }

  function handleStartSession(
    concept: Concept,
    length: SessionLength,
    difficulty?: 1 | 2 | 3,
    source: SessionSource = "picker",
  ) {
    beginSession(concept, buildSessionExerciseIds(concept, length, difficulty), source);
  }

  async function handleStartAdaptive() {
    if (!user) return;
    setAdaptiveError(null);
    try {
      // The engine works from the answer-free catalog; the server re-checks
      // each pick is practice-ready when it serves it.
      const ids = buildAdaptiveSession(await fetchAttempts(user.id, DASHBOARD_COLUMNS)).filter(
        (id) => getExerciseMeta(id)?.practice_ready === true,
      );
      beginSession(ADAPTIVE_SESSION, ids, "adaptive_mix");
    } catch (err) {
      setAdaptiveError(describeError(err, "load your practice history to build the session").message);
    }
  }

  function handleStartMixed() {
    beginSession(MIXED_SESSION, buildMixedSessionIds(), "picker");
  }

  /** Review Mistakes: every open mistake (most recent first, capped), or
   * one exercise to retry. The server re-checks each id when serving it. */
  async function handleStartMistakes(retryId?: string) {
    if (!user) return;
    setAdaptiveError(null);
    const available = (id: string) => getExerciseMeta(id)?.practice_ready === true;
    if (retryId) {
      beginSession(MISTAKES_SESSION, available(retryId) ? [retryId] : [], "mistakes");
      return;
    }
    try {
      const rows = await fetchAttempts(user.id, "exercise_id,is_correct,created_at");
      beginSession(MISTAKES_SESSION, mistakeSessionIds(rows, available), "mistakes");
    } catch (err) {
      setAdaptiveError(describeError(err, "load your mistakes").message);
    }
  }

  /** A session still in progress is recorded as abandoned at the point the
   * user left it (product analytics, src/lib/events.ts). */
  function trackAbandoned(s: SessionState | null) {
    if (s && !s.completed) {
      track({
        event_type: "session_abandoned",
        session_id: s.session_id,
        position: s.correct_count + s.missed_exercise_ids.length,
      });
    }
  }

  function beginSession(kind: string, exerciseIds: string[], source: SessionSource) {
    if (exerciseIds.length === 0) {
      // e.g. a concept whose only exercises are real scenarios still awaiting review.
      setNotice(
        kind === MISTAKES_SESSION
          ? "No mistakes to review right now. Anything you miss shows up here to practice again."
          : `There are no exercises ready for ${kind === ADAPTIVE_SESSION ? "an adaptive session" : kind === MIXED_SESSION ? "a mixed session" : getConceptMeta(kind).pickerLabel} yet. Pick another concept.`,
      );
      setSession(null);
      setLengthPickerConcept(null);
      setShowPicker(true);
      return;
    }
    setNotice(null);
    trackAbandoned(session ?? loadSession());
    const fresh = createSession(kind, exerciseIds);
    track({
      event_type: "session_started",
      session_id: fresh.session_id,
      mode: modeFor(kind),
      concept: kind,
      source,
      planned_length: exerciseIds.length,
    });
    saveSession(fresh);
    clearProgress();
    setLoaded({});
    setSession(fresh);
    setShowPicker(false);
    setLengthPickerConcept(null);
    setUserRegion(null);
    setUserLevel(null);
    setUserChoice(null);
    setResult(null);
    setReveal(null);
    setGradeError(null);
    setPendingAnswer(null);
    setFlowGraded(false);
    setRetrying(false);
  }

  // A deep link (?concept=…[&difficulty=…&length=…], e.g. the dashboard's
  // recommended session) is a "start this now" action: it replaces any
  // session in progress, then the URL is cleaned so a reload resumes
  // instead of restarting. Otherwise resume an in-progress (or
  // just-completed) session from a prior visit, or show the concept picker.
  // Reading localStorage/location is a one-time sync from browser-only
  // state (neither is available during SSR) and can't be done in render, so
  // the setState-in-effect here is intentional.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const retryId = params.get("retry");
    if (params.get("mode") === "mistakes" || retryId) {
      // Needs the user's attempts, so it starts once auth has resolved.
      window.history.replaceState(null, "", "/practice");
      pendingMistakesRef.current = { retryId: retryId ?? undefined };
      return;
    }
    const requestedConcept = params.get("concept");
    if (requestedConcept && CONCEPT_LIST.includes(requestedConcept as Concept)) {
      const d = Number(params.get("difficulty"));
      const lengthParam = params.get("length");
      const length: SessionLength = lengthParam && /^\d+$/.test(lengthParam) ? Number(lengthParam) : "all";
      window.history.replaceState(null, "", "/practice");
      handleStartSession(
        requestedConcept as Concept,
        length,
        d === 1 || d === 2 || d === 3 ? d : undefined,
        params.get("src") === "rec" ? "recommendation" : "deep_link",
      );
      return;
    }
    // An unfinished session resumes where it was. A finished one has
    // already shown its summary, so coming back starts at the picker.
    const existing = loadSession();
    if (existing && !existing.completed) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSession(existing);
      return;
    }
    if (existing) clearSession();
    setShowPicker(true);
    // Mount-only: reads the URL/localStorage once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const pending = pendingMistakesRef.current;
    if (!user || !pending) return;
    pendingMistakesRef.current = null;
    void handleStartMistakes(pending.retryId);
    // Runs once auth resolves; handleStartMistakes only closes over state setters and `user`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  function handleBackToPicker() {
    trackAbandoned(session);
    clearSession();
    setSession(null);
    setLengthPickerConcept(null);
    setShowPicker(true);
  }

  if (authLoading || !user) {
    return (
      <div className="flex flex-1 flex-col">
        <LoadingState />
        <DisclaimerFooter />
      </div>
    );
  }

  if (showPicker) {
    const activeSession: ActiveSessionInfo | null =
      session && !session.completed
        ? { title: sessionTitle(session.concept), position: session.current_index, total: session.exercise_order.length }
        : null;
    return (
      <div className="flex flex-1 flex-col">
        <div className="page max-w-4xl">
          {notice && (
            <p className="mb-6 rounded-md border border-line bg-surface p-3 text-sm text-foreground" role="status">
              {notice}
            </p>
          )}
          <ConceptPicker
            scores={pickerAttempts ? new Map(scoreConcepts(pickerAttempts).concepts.map((c) => [c.concept, c])) : null}
            recommendation={pickerAttempts ? recommendSession(pickerAttempts) : null}
            openMistakes={pickerAttempts ? mistakeCounts(pickerAttempts).open : 0}
            activeSession={activeSession}
            onContinue={() => setShowPicker(false)}
            onPick={handlePickConcept}
            onPickAdaptive={handleStartAdaptive}
            onPickMistakes={() => handleStartMistakes()}
            onPickMixed={handleStartMixed}
            error={adaptiveError}
          />
        </div>
        <DisclaimerFooter />
      </div>
    );
  }

  if (lengthPickerConcept) {
    return (
      <div className="flex flex-1 flex-col">
        <div className="page">
          <SessionLengthPicker
            concept={lengthPickerConcept}
            onPick={(length) => handleStartSession(lengthPickerConcept, length)}
            onBack={() => {
              setLengthPickerConcept(null);
              setShowPicker(true);
            }}
          />
        </div>
        <DisclaimerFooter />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex flex-1 flex-col">
        <div className="page" />
        <DisclaimerFooter />
      </div>
    );
  }

  const isMixedKind = session.concept === ADAPTIVE_SESSION || session.concept === MISTAKES_SESSION || session.concept === MIXED_SESSION;
  const conceptMeta = { title: sessionTitle(session.concept) };

  if (session.completed) {
    return (
      <div className="flex flex-1 flex-col">
        <div className="page">
          <SessionSummary
            session={session}
            title={conceptMeta.title}
            onReviewMissed={() =>
              beginSession(
                MISTAKES_SESSION,
                [...new Set(session.missed_exercise_ids)].filter((id) => getExerciseMeta(id)?.practice_ready === true),
                "mistakes",
              )
            }
            onPracticeAgain={() => {
              if (session.concept === ADAPTIVE_SESSION) void handleStartAdaptive();
              else if (session.concept === MIXED_SESSION) handleStartMixed();
              else if (session.concept === MISTAKES_SESSION) void handleStartMistakes();
              else handleStartSession(session.concept as Concept, session.exercise_order.length);
            }}
            onAdaptive={() => void handleStartAdaptive()}
          />
        </div>
        <DisclaimerFooter />
      </div>
    );
  }

  const exerciseId = session.exercise_order[session.current_index];
  if (!(exerciseId in loaded)) {
    return (
      <div className="flex flex-1 flex-col">
        {loadError ? (
          <div className="page" role="alert">
            <h1 className="page-title">{conceptMeta.title}</h1>
            <p className="mt-4 text-sm text-danger">{loadError}</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <button type="button" onClick={() => setLoadAttempt((n) => n + 1)} className="btn-primary">
                Try again
              </button>
              <button type="button" onClick={handleBackToPicker} className="btn-secondary">
                Start a new session
              </button>
            </div>
          </div>
        ) : (
          <LoadingState />
        )}
        <DisclaimerFooter />
      </div>
    );
  }
  const exercise = loaded[exerciseId];
  if (!exercise) {
    // A saved session can outlive its exercises (e.g. a real scenario
    // rejected at review after the session started). Offer a way on
    // instead of crashing.
    return (
      <div className="flex flex-1 flex-col">
        <div className="page">
          <h1 className="page-title">{conceptMeta.title}</h1>
          <p className="mt-4 text-sm text-foreground">
            The next exercise in this session is no longer available. It may have been withdrawn after review.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => {
                const next = { ...session, current_index: session.current_index + 1 };
                next.completed = next.current_index >= next.exercise_order.length;
                clearProgress();
                progressRef.current = { draft: null, graded: null, started_at: null };
                saveSession(next);
                setSession(next);
              }}
              className="btn-primary"
            >
              Skip it
            </button>
            <button
              type="button"
              onClick={handleBackToPicker}
              className="btn-secondary"
            >
              Start a new session
            </button>
          </div>
        </div>
        <DisclaimerFooter />
      </div>
    );
  }

  const attemptedCount = session.correct_count + session.missed_exercise_ids.length;
  const isLastExercise = session.current_index === session.exercise_order.length - 1;
  // Saving is the only async step after grading. A failure keeps the built
  // row so "Retry save" can resend it; session progress never depends on it.
  async function saveAttempt(userId: string, exerciseId: string, build: (attemptNumber: number) => NewAttempt) {
    setSaving(true);
    setSaveError(null);
    try {
      const row = build(await nextAttemptNumber(userId, exerciseId));
      pendingRowRef.current = row;
      await insertAttempt(userId, row);
      pendingRowRef.current = null;
    } catch (err) {
      setSaveError(describeError(err, "save this attempt"));
    } finally {
      setSaving(false);
    }
  }

  async function retrySave() {
    if (!user) return;
    const row = pendingRowRef.current;
    if (!row) return;
    await saveAttempt(user.id, row.exercise_id, (n) => ({ ...row, attempt_number: n }));
  }

  // Every mode ends here once the server has graded the answer: session
  // progress (local bookkeeping) is updated synchronously, before the async
  // save starts, so there's no window where clicking "Next" mid-save could
  // race with this and overwrite newer state with a stale snapshot. The
  // row comes from the server, built from the same grade the user sees.
  async function recordGraded(isCorrect: boolean, row: NewAttempt) {
    if (!session || !user) return;
    const updatedSession: SessionState = {
      ...session,
      correct_count: session.correct_count + (isCorrect ? 1 : 0),
      missed_exercise_ids: isCorrect ? session.missed_exercise_ids : [...session.missed_exercise_ids, exerciseId],
      outcomes: [...(session.outcomes ?? []), { exercise_id: exerciseId, correct: isCorrect, failure_reason: row.failure_reason }],
    };
    saveSession(updatedSession);
    setSession(updatedSession);
    await saveAttempt(user.id, exerciseId, (attemptNumber) => ({ ...row, attempt_number: attemptNumber }));
  }

  /** Grading is a server round-trip (the key lives there). A failure keeps
   * the answer so "Try again" can resend it. */
  async function submitRecognition(answer: UserAnswer, responseTimeMs: number) {
    if (!session) return;
    setGrading(true);
    setGradeError(null);
    setPendingAnswer({ answer, responseTimeMs });
    try {
      const res = await gradeRecognition(exerciseId, answer, { sessionId: session.session_id, responseTimeMs });
      if (!res.ok) {
        setGradeError(res.error);
        return;
      }
      setPendingAnswer(null);
      setResult(res.grade);
      setReveal(res.reveal);
      if (retrying) return;
      // Before the score and attempt are recorded: a refresh from here on
      // shows this feedback rather than asking (and scoring) again.
      persistProgress({ graded: { result: res.grade, reveal: res.reveal } });
      await recordGraded(res.grade.isCorrect, res.row);
    } catch (err) {
      setGradeError(describeError(err, "grade this answer").message);
    } finally {
      setGrading(false);
    }
  }

  async function handleSubmit() {
    if (!exercise || grading) return;
    if (exercise.answer_type === "zone" && !userRegion) return;
    if (exercise.answer_type === "level" && userLevel === null) return;
    if (exercise.answer_type === "choice" && userChoice === null) return;
    const answer: UserAnswer =
      exercise.answer_type === "zone"
        ? { type: "region", region: userRegion! }
        : exercise.answer_type === "level"
          ? { type: "level", price: userLevel! }
          : { type: "choice", choice: userChoice! };
    await submitRecognition(answer, msSince(exerciseStartRef.current));
  }

  async function handleNoAnswer() {
    if (grading) return;
    setUserRegion(null);
    setUserLevel(null);
    await submitRecognition({ type: "none" }, msSince(exerciseStartRef.current));
  }

  function handleRetryChart() {
    setRetrying(true);
    setResult(null);
    setReveal(null);
    setUserRegion(null);
    setUserLevel(null);
    setUserChoice(null);
  }

  async function retryGrade() {
    if (pendingAnswer) await submitRecognition(pendingAnswer.answer, pendingAnswer.responseTimeMs);
  }

  // Guided Entry's multi-step flow finalizes itself (Submit Setup or No
  // Trade at any step) and calls this once.
  async function gradeGuidedAnswer(answer: GuidedUserAnswer): Promise<GuidedGradeResponse | null> {
    if (!session) return null;
    setGradeError(null);
    try {
      const res = await gradeGuided(exerciseId, answer, {
        sessionId: session.session_id,
        responseTimeMs: msSince(exerciseStartRef.current),
      });
      if (!res.ok) {
        setGradeError(res.error);
        return null;
      }
      setFlowGraded(true);
      persistProgress({ graded: { grade: res.grade, reveal: res.reveal } });
      void recordGraded(res.grade.isCorrect, res.row);
      return { grade: res.grade, reveal: res.reveal };
    } catch (err) {
      setGradeError(describeError(err, "grade this setup").message);
      return null;
    }
  }

  // Free Trade's playback runner calls this once when the scenario ends
  // (trade closed, End Session, or playback ran out). is_correct is the
  // process verdict, never the win/loss outcome.
  async function gradeFreeTradeAttempt(attempt: FreeTradeAttempt): Promise<FreeTradeGradeResponse | null> {
    if (!session) return null;
    setGradeError(null);
    try {
      const res = await gradeFreeTradeScenario(exerciseId, attempt.position, attempt.exit, {
        sessionId: session.session_id,
        responseTimeMs: msSince(exerciseStartRef.current),
      });
      if (!res.ok) {
        setGradeError(res.error);
        return null;
      }
      setFlowGraded(true);
      persistProgress({ graded: { grade: res.grade, key: res.key } });
      void recordGraded(res.grade.passed, res.row);
      return { grade: res.grade, key: res.key };
    } catch (err) {
      setGradeError(describeError(err, "grade this trade").message);
      return null;
    }
  }

  function handleNext() {
    if (!session) return;
    const nextIndex = session.current_index + 1;
    const completed = nextIndex >= session.exercise_order.length;
    const updatedSession: SessionState = { ...session, current_index: nextIndex, completed };
    clearProgress();
    progressRef.current = { draft: null, graded: null, started_at: null };
    if (completed) {
      track({
        event_type: "session_completed",
        session_id: session.session_id,
        position: session.correct_count + session.missed_exercise_ids.length,
      });
    }
    saveSession(updatedSession);
    setSession(updatedSession);
    setUserRegion(null);
    setUserLevel(null);
    setUserChoice(null);
    setResult(null);
    setReveal(null);
    setSaveError(null);
    setGradeError(null);
    setPendingAnswer(null);
    setFlowGraded(false);
    setRetrying(false);
    // Best-effort, off the critical path — a failure here shouldn't block
    // showing the session summary (matching how ensureProfile is called).
    if (completed && user) {
      recordSessionCompletion(user.id).catch(() => {});
    }
  }

  const nextLabel = isLastExercise ? "See Results" : exercise.answer_type === "free" ? "Next Scenario" : "Next Exercise";
  const report = (
    <ReportQuestion
      key={`${session.session_id}:${exercise.exercise_id}`}
      exerciseId={exercise.exercise_id}
      stage={result !== null || flowGraded ? "feedback" : "exercise"}
      sessionId={session.session_id}
    />
  );
  const footer = (
    <>
      {gradeError && exercise.answer_type !== "zone" && exercise.answer_type !== "level" && exercise.answer_type !== "choice" && (
        <p className="mt-3 text-sm text-danger" role="alert">
          {gradeError}
        </p>
      )}
      <SaveStatus saving={saving} error={saveError} onRetry={retrySave} />
      {report}
    </>
  );
  const prompt = (
    <div>
      <p className="text-lg leading-snug text-foreground sm:text-xl">{exercise.prompt}</p>
      <p className="mt-1.5 text-xs text-muted tabular-nums">
        Score {session.correct_count}/{attemptedCount} · {DIFFICULTY_LABELS[exercise.difficulty]} · {conceptShortName(exercise.concept)}
      </p>
    </div>
  );

  return (
    <div className="flex flex-1 flex-col">
      <div className="page max-w-7xl pt-6 sm:pt-8">
        {/* Everything above the chart is quiet: where you are (eyebrow +
            thin progress line). The chart is the focus. */}
        <div className="flex items-baseline justify-between gap-4">
          <h1 className="eyebrow">
            {conceptMeta.title}
            {isMixedKind && <> · {getConceptMeta(exercise.concept).pickerLabel}</>}
          </h1>
          <div className="flex items-baseline gap-4">
            <p className="eyebrow tabular-nums">
              {session.current_index + 1} / {session.exercise_order.length}
            </p>
            {/* Leaves the session saved: the picker offers Continue. */}
            <button type="button" onClick={() => setShowPicker(true)} className="btn-link -my-3 justify-center text-xs no-underline hover:underline">
              Exit
            </button>
          </div>
        </div>
        <div
          className="mt-3 mb-6 h-0.5 overflow-hidden rounded-full bg-line"
          role="progressbar"
          aria-label="Session progress"
          aria-valuemin={0}
          aria-valuemax={session.exercise_order.length}
          aria-valuenow={session.current_index}
        >
          <div
            className="h-full bg-accent transition-[width]"
            style={{ width: `${(session.current_index / session.exercise_order.length) * 100}%` }}
          />
        </div>

        {exercise.answer_type === "free" ? (
          restored?.key === progressKey && (
            <FreeTradeExercise
              key={exercise.exercise_id}
              exercise={exercise}
              prompt={prompt}
              footer={footer}
              initialDraft={restored.draft}
              initialGraded={restored.graded}
              onDraftChange={(draft) => persistProgress({ draft })}
              onGrade={gradeFreeTradeAttempt}
              onNext={handleNext}
              nextLabel={nextLabel}
            />
          )
        ) : exercise.answer_type === "guided" ? (
          restored?.key === progressKey && (
            <GuidedExercise
              key={exercise.exercise_id}
              exercise={exercise}
              prompt={prompt}
              footer={footer}
              initialDraft={restored.draft}
              initialGraded={restored.graded}
              onDraftChange={(draft) => persistProgress({ draft })}
              onGrade={gradeGuidedAnswer}
              onNext={handleNext}
              nextLabel={nextLabel}
            />
          )
        ) : (
          <RecognitionExercise
            exercise={exercise}
            prompt={prompt}
            userRegion={userRegion}
            onUserRegionChange={setUserRegion}
            userLevel={userLevel}
            onUserLevelChange={setUserLevel}
            userChoice={userChoice}
            onUserChoiceChange={setUserChoice}
            result={result}
            reveal={reveal}
            isRetry={retrying}
            grading={grading}
            gradeError={gradeError}
            canRetryGrade={pendingAnswer !== null}
            onRetryGrade={retryGrade}
            onSkip={handleNext}
            onSubmit={handleSubmit}
            onNoAnswer={handleNoAnswer}
            onNext={handleNext}
            nextLabel={nextLabel}
            onRetryChart={handleRetryChart}
            footer={footer}
          />
        )}

        {/* Unanswered = unfinished; once graded there's nothing to lose. A
            retry is never recorded, so it has nothing to lose either. */}
        <NavigationGuard active={result === null && !flowGraded && !retrying} />
      </div>

      <DisclaimerFooter />
    </div>
  );
}

/** Heading for a session of any kind. */
function sessionTitle(kind: string): string {
  if (kind === ADAPTIVE_SESSION) return "Adaptive Practice";
  if (kind === MISTAKES_SESSION) return "Review Mistakes";
  if (kind === MIXED_SESSION) return "Mixed Concepts";
  return getConceptMeta(kind).title;
}
