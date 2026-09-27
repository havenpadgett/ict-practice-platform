# Manual Test Plan (production)

*For walking through https://ict-practice-platform.vercel.app after a deploy (AI-DRAFTED, 2026-09-26). Tick each line. Anything that doesn't match the expected result goes in the PRD Bug Log.*

**Before you start:**
- The pre-deploy checklist in [OPERATIONS.md](OPERATIONS.md#pre-deploy-checklist) is done.
- Supabase's SQL editor is open in another tab.
- You have two email addresses: **your admin account**, and **a fresh one for signup**.

## Signup and access

- [ ] 1. Open `/`. **Expect:** the landing page loads, with no "Can't connect right now" message anywhere.
- [ ] 2. Open `/dashboard` while signed out. **Expect:** redirected to `/login?next=%2Fdashboard`.
- [ ] 3. On `/login`, switch to **Sign up** and enter the fresh email and a password. **Expect:** "Check your email to confirm your account" if confirmation is on. Otherwise you land on `/dashboard`.
- [ ] 4. If you were asked to confirm, click the link in the email. **Expect:** you land on `/dashboard`, signed in, with no error in the URL.
- [ ] 5. SQL editor: `select id, role from profiles order by created_at desc limit 1;` **Expect:** one row for the new user, with `role = user`.
- [ ] 6. As the new user, open `/review` and `/admin`. **Expect:** both say "Not authorized."
- [ ] 7. Open `/login?next=https://example.com`, then log in. **Expect:** you land on `/dashboard`, not example.com.

## Recognition mode

- [ ] 8. `/practice` → **Fair Value Gap** → **5**. **Expect:** exercise 1 of 5, with the chart, prompt and "Difficulty n of 3". A brief "Loading…" first is fine.
- [ ] 9. Drag a box over the gap you see and press **Submit**. **Expect:** "Grading…" briefly. Then **Correct** or **Incorrect**, feedback stating the correct answer explicitly, and the true zone drawn on the chart.
- [ ] 10. Next exercise: press the **"No FVG present"** button. **Expect:** a verdict and explanation. If the chart had a gap, it says so.
- [ ] 11. Draw a deliberately huge box on the next one. **Expect:** Incorrect, with a precision message ("too broad"), not "wrong area".
- [ ] 12. Finish the session. **Expect:** a session summary with the score, missed exercises listed, and **Practice again**.
- [ ] 13. **Liquidity** → any length. Click to place a line near a high, drag it, then **Submit**. **Expect:** a verdict. If wrong, "You were N points too high/low".
- [ ] 14. **FVG respected/disrespected** (a choice question under FVG or IFVG). Pick an option and submit. **Expect:** the gap is shaded from the start, and you get a verdict and explanation.
- [ ] 15. **Premium & Discount**: pick an option. **Expect:** the dealing range is shown from the start, and the equilibrium line appears after grading.

## Guided Entry

- [ ] 16. **Guided Entry** → 5. Pick **Bullish** or **Bearish** → **Continue**. **Expect:** the entry step, with a line to place.
- [ ] 17. Place the entry → **Continue** → stop → **Continue** → target. **Expect:** a live R:R shown against the 2:1 minimum.
- [ ] 18. Press **Submit Setup**. **Expect:** "Grading…", then an overall verdict. Each step (bias, entry, stop, target) is marked correct or incorrect, and the ideal levels are drawn on the chart.
- [ ] 19. On the next scenario, pick **Unclear** → **Continue**. **Expect:** it's graded straight away as No Trade: correct if the scenario had no valid setup, incorrect otherwise.

## Free Trade

- [ ] 20. **Free Trade** → any length. Press **Next Candle** a few times, then **Play** / **Pause**. **Expect:** candles appear one at a time, and there's no date on real scenarios.
- [ ] 21. Press **Long** (or **Short**), place the stop and target, then **Confirm Trade**. **Expect:** Confirm is disabled until the stop and target are on the correct sides. After confirming, it shows "Long from … · Stop … · Target … · R:R".
- [ ] 22. Let playback run until the stop or target is hit, or press **End Session**. **Expect:** "Grading…", then process checks (direction, entry, stop, R:R, decision), the outcome (win / loss / open) and R. The full chart is shown with the ideal zones.
- [ ] 23. On another scenario, press **End Session** without trading. **Expect:** graded as No Trade, with outcome "no trade".

## Attempt storage

- [ ] 24. After any answer, watch under the chart. **Expect:** no "Couldn't save" message. If one appears, **Retry save** clears it.
- [ ] 25. SQL editor: `select exercise_id, answer_type, is_correct, session_id, response_time_ms from attempts where user_id = '<new user id>' order by created_at desc limit 5;` **Expect:** one row per answer you gave, with `session_id` filled in and sensible response times in milliseconds.
- [ ] 26. SQL editor: `select event_type, mode, source, position from practice_events where user_id = '<new user id>' order by created_at;` **Expect:** `session_started` / `session_completed` for each finished session. Leaving one mid-way with **Back** gives `session_abandoned`.

## Analytics and adaptive recommendation

- [ ] 27. `/dashboard`. **Expect:** overall accuracy, per-concept accuracy, and a **Recommended next session** card whose reason quotes your accuracy.
- [ ] 28. Click **Start this session**. **Expect:** `/practice` starts that concept at that length straight away. `practice_events` gets a `session_started` with `source = recommendation`.
- [ ] 29. `/practice` → **Adaptive mix**. **Expect:** a 10-exercise session mixing concepts, weighted toward your weaker ones.
- [ ] 30. `/analytics`. **Expect:** the trend line, per-concept and per-difficulty bars, Guided Entry per-step accuracy and Free Trade checks, all matching what you just did.
- [ ] 31. Click **Export CSV** and **Sessions CSV**. **Expect:** two downloads. The attempts file has one row per answer and only your rows. The sessions file has one row per session.

## Review queue and admin (your account)

- [ ] 32. SQL editor: `update profiles set role = 'admin' where id = (select id from auth.users where email = '<your email>');`, then sign in as yourself.
- [ ] 33. `/review`. **Expect:** real scenarios grouped by rule, with the definition beside each chart. **j/k** moves between them. Production shows a read-only notice; reviews are saved only from the local dev server.
- [ ] 34. `/admin`. **Expect:** total users (at least 2), sessions, attempts, completion rate, most-failed exercises (only those with 5+ attempts), concept difficulty ranking, and a review progress table with 50 awaiting. (That nobody can grant themselves a role through the API is covered by `tests/sql/rls.test.ts`.)

## Chart framing, mistakes, reports and recovery (added 2026-09-27)

- [ ] 35. Start two FVG sessions one after the other. **Expect:** the same exercise shows a different slice of the chart, with a different candle count and the gap in a different place. Refreshing mid-exercise shows the identical chart.
- [ ] 36. Draw a box on an exercise, then refresh. **Expect:** the same exercise, with your box still drawn. Submit it. **Expect:** it grades normally.
- [ ] 37. Answer an exercise, then refresh before pressing Next. **Expect:** the feedback is still shown, and the score doesn't go up a second time. SQL editor: only one new `attempts` row for it.
- [ ] 38. Place a Guided Entry bias and entry, or play a few Free Trade candles, then refresh. **Expect:** the flow resumes where you left it, with playback paused.
- [ ] 39. With an unanswered exercise on screen, click **Dashboard** in the nav. **Expect:** a "Leave this exercise?" prompt. Cancel stays put. Closing or reloading the tab shows the browser's own prompt. Once answered, there's no prompt.
- [ ] 40. Get at least one exercise wrong, then open `/dashboard`. **Expect:** a **Review mistakes** card with "N to review · M mastered".
- [ ] 41. **See all** → `/mistakes`. **Expect:** each missed exercise with your answer, the correct answer and the explanation.
- [ ] 42. **Retry** one and answer it correctly. **Expect:** back on `/mistakes` it's under **Mastered**, and the dashboard's mastered count is up by one.
- [ ] 43. `/practice` → **Review mistakes** (or **Practice mistakes** on the dashboard). **Expect:** a "Review Mistakes" session of only the exercises you last got wrong. `practice_events`: `mode = mistakes`, `source = mistakes`. This needs migration `20260927140000`.
- [ ] 44. On any exercise, click **Report a problem**, pick **Something else** and try to send without a note. **Expect:** Send stays disabled until you type a note. Send it. **Expect:** "Thanks, your report was sent." SQL editor: a `question_reports` row with the exercise id, `stage = exercise` and your session id. This needs migration `20260927150000`.
- [ ] 45. Report the same exercise from its feedback, signed in as the second account. **Expect:** a row with `stage = feedback`. As admin on `/admin`, **Question reports** shows 2 open reports for it, and **Flagged for re-review** lists it under "Reports". **Mark re-reviewed** removes it from the flagged list.
- [ ] 46. Open `/no-such-page`. **Expect:** the branded "There's no candle here" page with links back. The tab title is "Page not found · ICT Practice".
- [ ] 47. Check the tab titles on `/dashboard`, `/practice`, `/mistakes` and `/analytics`. **Expect:** "Dashboard · ICT Practice" and so on, and the candlestick favicon. Paste the site URL into a link-preview tool (or Slack). **Expect:** the title, description and preview image.
- [ ] 48. Open the browser console and walk through a whole session. **Expect:** no errors, warnings or debug logs.

## Wrap-up

- [ ] 49. Log out. **Expect:** `/dashboard` redirects to `/login` again.
- [ ] 50. Delete the test user's data if you don't want it in the stats: `delete from auth.users where email = '<fresh email>';`. It cascades to their profile, attempts, events and reports.
