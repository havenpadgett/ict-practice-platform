"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { startPlacementTask, gradePlacementTask } from "@/app/train/placement-actions";
import { LoadingState } from "@/components/loading-state";
import { NavigationGuard } from "@/components/practice/navigation-guard";
import { SkillBars } from "@/components/sim/skill-bars";
import { StageView, useCandles } from "@/components/sim/staged-runner";
import { useRequireAuth } from "@/hooks/use-require-auth";
import { PLACEMENT_TASKS, tasksForSkill, type PlacementTask } from "@/lib/engine/placement-tasks";
import type { StoredScenarioAttempt } from "@/lib/engine/attempt-row";
import { CLASSIFICATION_MEANING } from "@/lib/engine/skill-config";
import { classify, computeSkillVector, evidenceFromAttempts, weakestSkills } from "@/lib/engine/skills";
import { SKILLS, SKILL_LABEL, type PublicScenario, type SkillId, type StageConfig, type StageResponse } from "@/lib/engine/types";
import { describeError } from "@/lib/errors";
import { saveScenarioAttempt } from "@/lib/scenario-attempts";

function stageOf(task: PlacementTask): StageConfig {
  return { id: task.id, title: task.title, prompt: task.prompt, timeframes: task.timeframes, initialTimeframe: task.initialTimeframe, checkpoint: task.checkpoint, input: task.input, scorer: "answer_set", guidance: "none" };
}

function TaskView({ task, onDone }: { task: PlacementTask; onDone: (stages: Record<string, StageResponse>) => void }) {
  const [scenario, setScenario] = useState<PublicScenario | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    void startPlacementTask(task.id).then((r) => {
      if (cancelled) return;
      if (r.ok) setScenario(r.scenario);
      else setError(r.error);
    });
    return () => {
      cancelled = true;
    };
  }, [task.id]);
  if (error) return <p role="alert" className="text-sm text-danger">{error}</p>;
  if (!scenario) return <p className="text-sm text-muted">Loading the chart…</p>;
  return <TaskChart key={task.id} task={task} scenario={scenario} onDone={onDone} />;
}

function TaskChart({ task, scenario, onDone }: { task: PlacementTask; scenario: PublicScenario; onDone: (stages: Record<string, StageResponse>) => void }) {
  const revealed = task.checkpoint ? (scenario.checkpoints[task.checkpoint] ?? scenario.cursorStart) : scenario.cursorStart;
  const feed = useCandles(scenario, revealed);
  if (feed.error) return <p role="alert" className="text-sm text-danger">{feed.error}</p>;
  if (!feed.ready) return <p className="text-sm text-muted">Loading the chart…</p>;
  return <StageView scenario={scenario} stage={stageOf(task)} candles={feed.candles} revealed={revealed} onCommit={(r) => onDone({ [task.id]: r })} asksConfidence={false} />;
}

type Result = { task: PlacementTask; score: number };

function Placement() {
  const { user, loading } = useRequireAuth();
  const skillParam = useSearchParams().get("skill");
  const skill = SKILLS.includes(skillParam as SkillId) ? (skillParam as SkillId) : null;
  const tasks = useMemo(() => (skill ? tasksForSkill(skill).slice(0, 4) : PLACEMENT_TASKS), [skill]);
  const [started, setStarted] = useState(false);
  const [index, setIndex] = useState(0);
  const [results, setResults] = useState<Result[]>([]);
  const [rows, setRows] = useState<StoredScenarioAttempt[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sessionId] = useState(() => `${skill ? `placement-skill:${skill}` : "placement"}:${Date.now().toString(36)}`);
  const t0 = useRef(0);

  if (loading || !user) return <LoadingState />;

  const done = started && index >= tasks.length;
  const task = tasks[index];

  async function commit(stages: Record<string, StageResponse>) {
    if (busy || !task) return;
    setBusy(true);
    setError(null);
    try {
      const res = await gradePlacementTask(task.id, stages, { sessionId, responseTimeMs: Date.now() - t0.current });
      if (!res.ok) return setError(res.error);
      t0.current = Date.now();
      const saved = await saveScenarioAttempt(user?.id ?? null, res.row).catch(() => null);
      setRows((r) => [...r, { ...res.row, id: saved?.id || `${sessionId}-${index}`, created_at: new Date(Date.now() + index).toISOString(), source: saved?.source ?? "device" }]);
      setResults((r) => [...r, { task, score: res.score }]);
      setIndex((i) => i + 1);
    } catch (err) {
      setError(describeError(err, "grade this task").message);
    } finally {
      setBusy(false);
    }
  }

  if (!started) {
    return (
      <main className="mx-auto w-full max-w-3xl px-4 pt-10 pb-16 sm:px-6">
        <p className="eyebrow">{skill ? "Test out of a skill" : "Placement test"}</p>
        <h1 className="page-title mt-2">{skill ? `Test out of ${SKILL_LABEL[skill]}` : "Where do you stand?"}</h1>
        <p className="page-lede mt-3 max-w-xl">
          {skill
            ? `${tasks.length} chart tasks on ${SKILL_LABEL[skill]}, hardest first. A good result replaces your earlier estimate; practice keeps adjusting it afterwards.`
            : `${tasks.length} short tasks on real-looking charts, easy to hard. You mark charts, place levels and make trade decisions: mostly interaction, few choices. You'll get no feedback until the end, so one answer can't help the next.`}
        </p>
        <ul className="mt-6 space-y-2 text-sm">
          <li>The result is seven separate skills, not one score. Knowing the terms isn&apos;t the same as reading context or executing, and it&apos;s measured separately.</li>
          <li>It isn&apos;t permanent. You can retake it, test out of a single skill, and every scenario you practise moves it.</li>
          <li>Scenarios are seeded: constructed price paths, labelled as such.</li>
        </ul>
        <div className="mt-8 flex gap-3">
          <button type="button" className="btn-primary" onClick={() => { setStarted(true); t0.current = Date.now(); }}>
            Start
          </button>
          <Link href="/train" className="btn-link">
            Not now
          </Link>
        </div>
      </main>
    );
  }

  if (done) {
    const vector = computeSkillVector(evidenceFromAttempts(rows));
    const placed = classify(vector);
    const weak = weakestSkills(vector, 1)[0];
    return (
      <main className="mx-auto w-full max-w-4xl px-4 pt-10 pb-16 sm:px-6">
        <NavigationGuard active={false} />
        <p className="eyebrow">{skill ? "Test-out result" : "Placement result"}</p>
        <h1 className="page-title mt-2">{skill ? `${SKILL_LABEL[skill]}: ${vector[skill].score === null ? "not enough to say" : `${Math.round((vector[skill].score as number) * 100)}%`}` : placed.level ? `${placed.label}: ${CLASSIFICATION_MEANING[placed.level].toLowerCase()}` : "Not enough to place you yet"}</h1>
        {!skill && placed.nextStep && <p className="page-lede mt-2">{placed.nextStep}</p>}
        {!skill && weak && <p className="mt-2 text-sm">Weakest area: {weak.label} ({Math.round(weak.score * 100)}%).</p>}
        <div className="mt-6">
          <SkillBars vector={vector} />
        </div>
        <section className="mt-8">
          <h2 className="eyebrow">Task by task</h2>
          <ul className="mt-2 divide-y divide-line rounded-lg border border-line bg-surface">
            {results.map((r) => (
              <li key={r.task.id} className="flex items-center justify-between gap-3 px-4 py-2 text-sm">
                <span className="text-foreground">{r.task.title}</span>
                <span className="tabular-nums">{r.score}</span>
              </li>
            ))}
          </ul>
        </section>
        <p className="mt-4 text-xs">This is a snapshot, not a label. Your dashboard recomputes it from everything you do, and you can retake the test whenever you like.</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/dashboard" className="btn-primary">
            Go to your dashboard
          </Link>
          <Link href="/train" className="btn-secondary">
            Start training
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-7xl px-4 pt-6 pb-16 sm:px-6 sm:pt-8">
      <NavigationGuard active message="Leave the test? Answers you've given are saved, and you can retake it." />
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="eyebrow">{skill ? `Test out: ${SKILL_LABEL[skill]}` : "Placement test"}</p>
          <h1 className="text-lg font-semibold text-foreground">{task.title}</h1>
        </div>
        <p className="text-sm tabular-nums">
          Task {index + 1} of {tasks.length}
        </p>
      </div>
      {error && <p role="alert" className="mb-3 text-sm text-danger">{error}</p>}
      <TaskView key={task.id} task={task} onDone={commit} />
    </main>
  );
}

export default function PlacementPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <Placement />
    </Suspense>
  );
}
