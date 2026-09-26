# Answer Key Protection

*2026-09-27 (AI-DRAFTED, pending Haven's review). Security audit finding S4.*

## The exposure before this change

`/practice` was a client component that imported `src/data/exercises.ts` whole. Every exercise's answer key was in the JavaScript the browser downloaded, for all **105 exercises**, including the **50 real scenarios still awaiting review**:
- zone coordinates;
- level prices;
- the correct choice;
- the Guided Entry levels;
- the Free Trade setup verdict;
- every explanation.

Finding an answer took no skill:
- **React DevTools** showed the current exercise's `answer` as a prop of the chart component, with no searching needed.
- The **Sources panel** held a data chunk of about 468 KB (Decision Log, 2026-09-25 performance pass) with every answer in plain JSON.
- **Unreleased material shipped to every user:** unreviewed scenarios, including their `[DRAFT]` explanations.

Who it hurt:
- **Other users: nobody.** There are no leaderboards, grades or certificates.
- **The learner who looks:** the exercise stops being practice.
- **The product:** a learner who peeks before answering records a "correct" attempt that measures nothing.

Grading is also local, so nothing stops a user from inserting a made-up attempt row directly. That is covered separately (S3 and the Task 3 constraints).

## Options considered

| Option | What it protects | Cost |
|---|---|---|
| **A. Keys server-side, grade on the server** (chosen) | The key is never in the browser before an answer is submitted. DevTools, the bundle and the network show only candles and the prompt. | A server round-trip before each verdict. Practice needs the server to grade. The practice page, Guided Entry and Free Trade components had to be restructured. |
| **B. Send only what the chart needs, fetch the key after answering, grade in the browser** | The key isn't in the bundle | The same round-trip as A, but anyone can call the key endpoint *before* answering. Weaker than A at the same cost. |
| **C. Accept it as a known limitation** | Nothing | None now. But the product's premise, graded recall, has a hole any curious learner falls into, and unreviewed content ships to everyone. |

## Decision: A

**How it works:**
- **Loading:** `src/app/practice/actions.ts` runs on the server. `loadSessionExercises(ids)` returns each exercise as a `PublicExercise` (`src/lib/public-exercise.ts`):
  - candles, prompt, difficulty and the "no answer" label;
  - the choice options, plus the FVG zone or dealing range those exercises show from the start;
  - the 2:1 minimum for Guided Entry and Free Trade.

  It returns `null` for anything missing or not practice-ready, re-checked against the full data rather than trusting the catalog.
- **Grading:** `gradeRecognition`, `gradeGuided` and `gradeFreeTradeScenario` check the session and validate the input. They grade with the same pure functions as before and return:
  - the verdict and explanation;
  - the key to draw on the chart;
  - the attempt row.

  The browser saves the row, keeping the existing save / "Retry save" flow.
- **Building sessions:** session building, concept availability and the adaptive mix read the answer-free catalog (`src/lib/session-builder.ts`, `src/data/catalog.ts`).

**Guarded by tests** (`tests/answer-keys.test.ts`):
- all 105 public projections contain no key field or explanation;
- the grading functions refuse signed-out callers, unreviewed scenarios and malformed answers, and grade exactly as the grading library does;
- an import-graph check fails if any `"use client"` module can reach `src/data/exercises.ts`, the real-scenario files or the other exercise data files.

`/review` is exempt: reviewers are there to check keys.

**Verified in the production build:**
- no explanation text in `.next/static`;
- no answer price (for example fvg-001's `21107.25`) in `.next/static`;
- the only key-field name in the client JS is the feedback component reading `is_valid_setup` from the server's response.

## What was traded away

- **Latency:** each verdict waits for one server round-trip, where it used to be instant. That's expected to be a few hundred milliseconds on a warm server and a second or more on a cold serverless start. It hasn't been measured, since there was no signed-in session to test with. The UI shows "Grading…" and disables the controls meanwhile.
- **Offline or server-down practice:** before, a lost connection only failed the *save*, and the verdict still showed. Now grading needs the server too. A failed grading request keeps the answer and offers **Try again** or **Skip**.
- **Simplicity:** grading moved from an in-component function call to an async request, with loading and retry states in three places.
- **Guided Entry detail:** there is one request per Guided Entry attempt, at the end, as before. Steps are still not graded one by one.

## What this does not protect

- **Free Trade's future candles.** Playback reveals candles on a timer, so the whole scenario's candles are still sent up front. A determined user can read what happens next in DevTools, which half-answers "should I trade here?". The explicit key (valid setup or not, the entry and stop zones, the target) *is* now server-side. Streaming candles one at a time from the server would close this. It's already in the PRD Backlog (LATER), deferred because every tick would need a request.
- **Deliberate probing.** A grading function has to reveal the key when it grades, so someone calling it directly with a dummy answer learns the answer. That takes intent and tooling, and it's the user's own practice they're cheating. Recording the attempt server-side at grading time would make each probe show up as a wrong attempt. The app still writes attempts from the browser, so this wasn't done (next item).
- **Forged attempt rows.** Users can still insert their own attempts directly with their session token (RLS allows own-row inserts). Grading on the server doesn't change that without a privileged writer. A server-only credential was rejected (SECURITY-AUDIT.md: no service-role key in this app). The Task 3 constraints now stop *self-contradictory* rows. A user can still record a false "correct", but only in their own data.
