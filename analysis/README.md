# Practice data analysis

*Analysis, not application code (AI-DRAFTED, 2026-09-26).* `analyze.py` reads exported attempt data and answers six questions with charts and a plain-English `findings.md`:
1. What does practice look like?
2. Does accuracy improve with practice, and how fast?
3. Are some concepts genuinely harder?
4. Are real-data scenarios harder than constructed ones?
5. Does response time relate to correctness?
6. Which exercises have failure rates anomalous enough to suspect the answer key?

## Findings on real data: none yet

**No real attempt data was available when this was written.** The attempts live in Supabase behind Row Level Security, and there was no export or service-role access to work from. **Nothing here describes actual users.**

To produce real findings, run it on an export (below). The report is written so it can't overstate a small dataset:
- **One user:** it says so.
- **A concept below 30 attempts:** it won't be ranked.
- **Fewer than 5 users with 20+ attempts:** it won't claim a learning trend.
- **An exercise with fewer than 8 attempts from 3 users:** it won't be flagged.

Every rate comes with a 95% interval.

## What the synthetic checks show

The pipeline was checked on generated data with **known, planted effects** (`make_fixture.py`), to see whether it finds what's there and stays quiet when there's too little data. These results validate the method, not the product.

| Planted effect (12 users, 1,268 attempts) | What `analyze.py` reported |
|---|---|
| Accuracy rises with practice | ✅ +2.2 points per 10 attempts (95% interval 0.9–3.5) |
| MSS harder than the easy concepts | ✅ MSS lowest at 56%, intervals separated from the top concepts |
| Real scenarios ~15 points harder (before per-user skill) | ✅ 8 points harder within concept (interval −17 to −1) |
| A small speed–correctness effect | ⚪ Not established (r = −0.03, interval includes 0). The effect was small, and the report correctly declined to claim it |
| `liq-004` has a broken answer key (8% success) | ✅ Flagged (0% vs peers 71%, q < 0.001), plus 2 chance flags (`ifvg-005`, `real-liq-007`) at the 10% false-discovery rate it allows |

Example output: [`example-synthetic-large/findings.md`](example-synthetic-large/findings.md).

The **small** fixture (1 user, 40 attempts), [`example-synthetic-small/findings.md`](example-synthetic-small/findings.md), is about what one early tester's data looks like. It correctly reports "not enough data" for the learning trend, concept ranking, real vs constructed, and anomalies. Every chart and report from synthetic data is stamped **SYNTHETIC**.

## Running it

```bash
python3 -m venv analysis/.venv
analysis/.venv/bin/pip install -r analysis/requirements.txt
analysis/.venv/bin/python analysis/analyze.py attempts.csv --out analysis/output
```

Output (charts and `findings.md`) goes to `analysis/output/`, which is git-ignored because it contains user data.

### Getting the data

- **Your own attempts:** log in, then open `/analytics` and click **Export CSV** (`/api/export/attempts`). Columns are documented in `docs/ANALYTICS.md`.
- **All users:** as the service role (Supabase SQL editor → download as CSV), in the same shape:

```sql
select id as attempt_id, user_id, session_id, created_at as attempted_at_utc, exercise_id, concept,
       case answer_type when 'guided' then 'guided_entry' when 'free' then 'free_trade' else 'recognition' end as mode,
       answer_type, difficulty,
       case when exercise_id like 'real-%' then 'real' else 'constructed' end as data_source,
       is_correct::int as is_correct, response_time_ms, attempt_number
from public.attempts order by user_id, created_at;
```

## Method notes

- **Uncertainty:** Wilson intervals for proportions. For slopes and differences, a bootstrap that resamples **users**, not attempts, because attempts from one person aren't independent. A heavy user can't carry a result alone.
- **Learning:** a per-user least-squares slope of correctness on attempt number, averaged across users. Users usually meet harder material as they go, which biases this *down*.
- **Real vs constructed:** compared **within concept** and weighted by real attempts, so a different concept mix can't create the gap.
- **Anomalies:** an exercise is compared with peers of the same concept, difficulty and source. It's flagged only if it is at least 20 points below them and a one-sided binomial test survives a Benjamini–Hochberg correction (false discovery rate 10%). The peer rate is Laplace-smoothed. Expect roughly one chance flag in ten: the list is for checking answer keys, not a verdict.
