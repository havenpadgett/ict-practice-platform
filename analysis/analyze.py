#!/usr/bin/env python3
"""Analysis of practice attempts — not application code.

Input: a CSV of attempts in the shape of the app's export
(/api/export/attempts, columns in docs/ANALYTICS.md), or the all-users query
in analysis/README.md. Output: charts (PNG) and findings.md in --out.

Every claim is gated on sample size. Below the thresholds at the top of this
file the report says there isn't enough data instead of printing a number
that means nothing. Uncertainty is shown as 95% intervals (Wilson for
proportions, bootstrap over users for slopes and differences, so one heavy
user can't carry a result).

  analysis/.venv/bin/python analysis/analyze.py attempts.csv --out analysis/output
"""

from __future__ import annotations

import argparse
import math
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402
import numpy as np  # noqa: E402
import pandas as pd  # noqa: E402

# Minimum evidence before a claim is made.
MIN_ATTEMPTS_GROUP = 30   # attempts in a group (a concept, a source) to report its rate as meaningful
MIN_USERS_TREND = 5       # users with enough history to talk about learning across users
MIN_HISTORY = 20          # attempts a user needs to count toward the learning curve
MIN_EXERCISE_ATTEMPTS = 8 # attempts on one exercise before flagging it
MIN_EXERCISE_USERS = 3    # distinct users on it (one confused user isn't a bad answer key)
MIN_GAP = 0.20            # an anomalous exercise must be at least this far below its peers
BOOTSTRAP = 2000
RNG = np.random.default_rng(42)

INK = "#1f2328"
MUTED = "#6e7781"
ACCENT = "#1a7f5a"
DANGER = "#c4432b"


def wilson(k: int, n: int, z: float = 1.96) -> tuple[float, float]:
    if n == 0:
        return (float("nan"), float("nan"))
    p = k / n
    d = 1 + z * z / n
    c = (p + z * z / (2 * n)) / d
    h = z * math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / d
    return (c - h, c + h)


def pct(x: float) -> str:
    return "—" if x != x else f"{x * 100:.0f}%"


def load(path: str) -> pd.DataFrame:
    df = pd.read_csv(path)
    df["attempted_at_utc"] = pd.to_datetime(df["attempted_at_utc"], utc=True)
    df["is_correct"] = df["is_correct"].astype(int)
    if "data_source" not in df:
        df["data_source"] = np.where(df["exercise_id"].str.startswith("real-"), "real", "constructed")
    if "mode" not in df:
        df["mode"] = df["answer_type"].map({"guided": "guided_entry", "free": "free_trade"}).fillna("recognition")
    df = df.sort_values(["user_id", "attempted_at_utc"]).reset_index(drop=True)
    df["user_attempt_index"] = df.groupby("user_id").cumcount() + 1
    return df


def style(ax, title: str, synthetic: bool) -> None:
    ax.set_title(("SYNTHETIC DATA — pipeline check only\n" if synthetic else "") + title, fontsize=11, color=INK, loc="left")
    for s in ("top", "right"):
        ax.spines[s].set_visible(False)
    ax.tick_params(colors=MUTED, labelsize=9)
    ax.grid(axis="y", color="#e5e7eb", linewidth=0.8)
    ax.set_axisbelow(True)


class Report:
    def __init__(self) -> None:
        self.lines: list[str] = []

    def h(self, text: str) -> None:
        self.lines += ["", f"## {text}", ""]

    def p(self, text: str) -> None:
        self.lines.append(text)

    def img(self, name: str, alt: str) -> None:
        self.lines += ["", f"![{alt}]({name})", ""]


def descriptive(df: pd.DataFrame, out: Path, r: Report, synthetic: bool) -> None:
    r.h("1. Practice behaviour")
    users = df["user_id"].nunique()
    sessions = df["session_id"].nunique() if "session_id" in df else 0
    per_user = df.groupby("user_id").size()
    k, n = int(df["is_correct"].sum()), len(df)
    lo, hi = wilson(k, n)
    r.p(
        f"- **{n}** attempts by **{users}** user{'s' if users != 1 else ''}"
        + (f" over **{sessions}** sessions" if sessions else "")
        + f", {df['attempted_at_utc'].min():%Y-%m-%d} to {df['attempted_at_utc'].max():%Y-%m-%d}."
    )
    r.p(f"- Attempts per user: median {per_user.median():.0f}, range {per_user.min()}–{per_user.max()}.")
    r.p(f"- Overall accuracy **{pct(k / n)}** (95% interval {pct(lo)}–{pct(hi)}).")
    by_mode = df.groupby("mode").size().sort_values(ascending=False)
    r.p("- By mode: " + ", ".join(f"{m} {c}" for m, c in by_mode.items()) + ".")
    if users < 2:
        r.p("- **Only one user so far:** everything below describes one person's practice, not users in general.")

    fig, ax = plt.subplots(figsize=(7, 3.4))
    counts = df.groupby("concept").size().sort_values()
    ax.barh(counts.index, counts.values, color=MUTED)
    for y, v in enumerate(counts.values):
        ax.text(v, y, f" {v}", va="center", fontsize=9, color=INK)
    style(ax, "Attempts per concept", synthetic)
    ax.grid(axis="x", color="#e5e7eb")
    fig.tight_layout()
    fig.savefig(out / "01_attempts_per_concept.png", dpi=150)
    plt.close(fig)
    r.img("01_attempts_per_concept.png", "Attempts per concept")


def learning(df: pd.DataFrame, out: Path, r: Report, synthetic: bool) -> None:
    r.h("2. Does accuracy improve with practice?")
    hist = df.groupby("user_id").size()
    eligible = hist[hist >= MIN_HISTORY].index
    d = df[df["user_id"].isin(eligible)].copy()
    d["block"] = (d["user_attempt_index"] - 1) // 10 + 1
    blocks = d.groupby("block")["is_correct"].agg(["sum", "count"])
    blocks = blocks[blocks["count"] >= 10]

    if len(blocks) >= 2:
        fig, ax = plt.subplots(figsize=(7, 3.4))
        x = blocks.index.values
        rate = (blocks["sum"] / blocks["count"]).values
        ci = np.array([wilson(int(s), int(c)) for s, c in zip(blocks["sum"], blocks["count"])])
        ax.fill_between(x, ci[:, 0], ci[:, 1], color=ACCENT, alpha=0.15, linewidth=0)
        ax.plot(x, rate, color=ACCENT, linewidth=2, marker="o", markersize=4)
        ax.set_ylim(0, 1)
        ax.set_xlabel("Block of 10 attempts (per user, pooled)", fontsize=9, color=MUTED)
        ax.set_ylabel("Accuracy", fontsize=9, color=MUTED)
        style(ax, "Accuracy by practice block, with 95% interval", synthetic)
        fig.tight_layout()
        fig.savefig(out / "02_learning_curve.png", dpi=150)
        plt.close(fig)
        r.img("02_learning_curve.png", "Accuracy by block of 10 attempts")

    if len(eligible) < MIN_USERS_TREND:
        r.p(
            f"**Not enough data to say.** A learning trend across users needs at least {MIN_USERS_TREND} users with "
            f"{MIN_HISTORY}+ attempts each; there {'is' if len(eligible) == 1 else 'are'} {len(eligible)}. "
            "The chart (if shown) is descriptive only. With so few people it can't separate learning from "
            "which exercises they happened to meet, or from moving on to harder concepts."
        )
        return

    # Change in accuracy per 10 attempts: per-user least-squares slope of
    # correctness on attempt index, averaged, with a bootstrap over users.
    slopes = []
    for _, g in d.groupby("user_id"):
        x = g["user_attempt_index"].values.astype(float)
        y = g["is_correct"].values.astype(float)
        if x.std() > 0:
            slopes.append(np.polyfit(x, y, 1)[0] * 10)
    slopes = np.array(slopes)
    boot = np.array([RNG.choice(slopes, len(slopes)).mean() for _ in range(BOOTSTRAP)])
    lo, hi = np.percentile(boot, [2.5, 97.5])
    mean = slopes.mean()
    if lo > 0:
        verdict = (f"**Yes.** Accuracy rises by about **{mean * 100:.1f} points per 10 attempts** "
                   f"(95% interval {lo * 100:.1f}–{hi * 100:.1f}).")
    elif hi < 0:
        verdict = (f"**No, it falls.** About {mean * 100:.1f} points per 10 attempts (95% interval "
                   f"{lo * 100:.1f}–{hi * 100:.1f}). Most likely users moving on to harder concepts; see §3.")
    else:
        verdict = (f"**No clear trend.** The estimate is {mean * 100:+.1f} points per 10 attempts, but the "
                   f"95% interval ({lo * 100:+.1f} to {hi * 100:+.1f}) includes zero.")
    r.p(verdict + f" Based on {len(slopes)} users with {MIN_HISTORY}+ attempts. The slope is per user, then averaged, "
        "so heavy users don't dominate. A caveat: users usually get harder material as they go, which pulls "
        "this estimate *down*.")


def concepts(df: pd.DataFrame, out: Path, r: Report, synthetic: bool) -> None:
    r.h("3. Are some concepts genuinely harder?")
    g = df.groupby("concept")["is_correct"].agg(["sum", "count"]).reset_index()
    g["rate"] = g["sum"] / g["count"]
    g[["lo", "hi"]] = [wilson(int(s), int(c)) for s, c in zip(g["sum"], g["count"])]
    g = g.sort_values("rate")
    enough = g[g["count"] >= MIN_ATTEMPTS_GROUP]

    fig, ax = plt.subplots(figsize=(7, 3.6))
    y = np.arange(len(g))
    ax.errorbar(g["rate"], y, xerr=[g["rate"] - g["lo"], g["hi"] - g["rate"]], fmt="o",
                color=INK, ecolor=MUTED, capsize=3, markersize=5)
    ax.set_yticks(y, [f"{c} (n={n})" for c, n in zip(g["concept"], g["count"])])
    ax.set_xlim(0, 1)
    ax.set_xlabel("Accuracy (dot) with 95% interval", fontsize=9, color=MUTED)
    style(ax, "Accuracy by concept", synthetic)
    ax.grid(axis="x", color="#e5e7eb")
    fig.tight_layout()
    fig.savefig(out / "03_concept_accuracy.png", dpi=150)
    plt.close(fig)
    r.img("03_concept_accuracy.png", "Accuracy by concept with intervals")

    if len(enough) < 2:
        r.p(f"**Not enough data to rank concepts.** A concept needs {MIN_ATTEMPTS_GROUP}+ attempts to be compared; "
            f"{len(enough)} {'has' if len(enough) == 1 else 'have'} that many. The chart's intervals show how wide the uncertainty still is.")
        return
    hardest, easiest = enough.iloc[0], enough.iloc[-1]
    separated = hardest["hi"] < easiest["lo"]
    r.p(f"Among concepts with {MIN_ATTEMPTS_GROUP}+ attempts, the lowest accuracy is **{hardest['concept']}** "
        f"({pct(hardest['rate'])}, n={int(hardest['count'])}) and the highest is **{easiest['concept']}** "
        f"({pct(easiest['rate'])}, n={int(easiest['count'])}).")
    if separated:
        r.p("Their 95% intervals don't overlap, so that gap is real in this data. **But harder isn't the same as "
            "poorly taught:** each concept's exercises differ in difficulty rating, and whether the rating mix is "
            "comparable should be checked before concluding the concept itself is harder.")
    else:
        r.p("Their 95% intervals overlap, so **this data doesn't show that any concept is harder than another.** "
            "The ordering could be noise.")
    by_diff = df.dropna(subset=["difficulty"]).groupby(["concept", "difficulty"])["is_correct"].agg(["mean", "count"])
    thin = (by_diff["count"] < 10).sum()
    r.p(f"Within concepts, {len(by_diff)} concept × difficulty cells exist, and {thin} have fewer than 10 attempts. "
        "Difficulty-adjusted comparisons need those cells filled first.")


def real_vs_constructed(df: pd.DataFrame, out: Path, r: Report, synthetic: bool) -> None:
    r.h("4. Are real-data scenarios harder than constructed ones?")
    real = df[df["data_source"] == "real"]
    if len(real) < MIN_ATTEMPTS_GROUP:
        r.p(f"**Not enough data to say.** There {'is' if len(real) == 1 else 'are'} {len(real)} attempt(s) on real scenarios "
            f"(needs {MIN_ATTEMPTS_GROUP}+). Real scenarios reach practice only after human review at /review, so "
            "this will stay empty until some are approved.")
        return
    # Compare within concept (stratified), so a different concept mix can't
    # create the gap: difference per concept, weighted by real attempts.
    rows, weights = [], []
    for concept, g in df.groupby("concept"):
        a, b = g[g["data_source"] == "real"], g[g["data_source"] == "constructed"]
        if len(a) >= 5 and len(b) >= 5:
            rows.append((concept, a["is_correct"].mean(), b["is_correct"].mean(), len(a), len(b)))
            weights.append(len(a))
    if not rows:
        r.p("Real and constructed attempts don't overlap in any concept with 5+ attempts of each, so they can't be compared fairly yet.")
        return
    diff = sum(w * (rr - cc) for (_, rr, cc, _, _), w in zip(rows, weights)) / sum(weights)
    users = df["user_id"].unique()
    boot = []
    for _ in range(BOOTSTRAP):
        sample = pd.concat([df[df["user_id"] == u] for u in RNG.choice(users, len(users))])
        num = den = 0.0
        for concept, _, _, _, _ in rows:
            g = sample[sample["concept"] == concept]
            a, b = g[g["data_source"] == "real"], g[g["data_source"] == "constructed"]
            if len(a) and len(b):
                num += len(a) * (a["is_correct"].mean() - b["is_correct"].mean())
                den += len(a)
        if den:
            boot.append(num / den)
    lo, hi = np.percentile(boot, [2.5, 97.5])
    r.p("| Concept | Real | Constructed | n (real / constructed) |\n|---|---|---|---|")
    for concept, rr, cc, na, nb in rows:
        r.p(f"| {concept} | {pct(rr)} | {pct(cc)} | {na} / {nb} |")
    word = "harder" if diff < 0 else "easier"
    if hi < 0 or lo > 0:
        r.p(f"\nWithin the same concept, real scenarios are **{abs(diff) * 100:.0f} points {word}** "
            f"(95% interval {lo * 100:+.0f} to {hi * 100:+.0f}). That's a real difference in this data.")
    else:
        r.p(f"\nWithin the same concept the difference is {diff * 100:+.0f} points, but the 95% interval "
            f"({lo * 100:+.0f} to {hi * 100:+.0f}) includes zero, so **no difference is established yet.**")


def response_time(df: pd.DataFrame, out: Path, r: Report, synthetic: bool) -> None:
    r.h("5. Response time and correctness")
    d = df[(df["mode"] == "recognition") & (df["response_time_ms"] > 0)].copy()
    if len(d) < MIN_ATTEMPTS_GROUP or d["is_correct"].nunique() < 2:
        r.p(f"**Not enough data to say.** It needs {MIN_ATTEMPTS_GROUP}+ recognition attempts with both right and wrong answers.")
        return
    d["log_s"] = np.log(d["response_time_ms"] / 1000)
    corr = np.corrcoef(d["log_s"], d["is_correct"])[0, 1]
    users = d["user_id"].unique()
    boot = []
    for _ in range(BOOTSTRAP):
        s = pd.concat([d[d["user_id"] == u] for u in RNG.choice(users, len(users))])
        if s["is_correct"].nunique() == 2:
            boot.append(np.corrcoef(s["log_s"], s["is_correct"])[0, 1])
    lo, hi = np.percentile(boot, [2.5, 97.5])
    med = d.groupby("is_correct")["response_time_ms"].median() / 1000

    fig, ax = plt.subplots(figsize=(7, 3.2))
    parts = [d[d["is_correct"] == 1]["response_time_ms"] / 1000, d[d["is_correct"] == 0]["response_time_ms"] / 1000]
    ax.boxplot(parts, vert=False, widths=0.5, showfliers=False, medianprops={"color": INK})
    ax.set_yticks([1, 2], [f"Correct (n={len(parts[0])})", f"Incorrect (n={len(parts[1])})"])
    ax.set_xlabel("Seconds to answer (recognition mode; outliers hidden)", fontsize=9, color=MUTED)
    style(ax, "Response time, correct vs incorrect", synthetic)
    ax.grid(axis="x", color="#e5e7eb")
    fig.tight_layout()
    fig.savefig(out / "05_response_time.png", dpi=150)
    plt.close(fig)
    r.img("05_response_time.png", "Response time by correctness")

    r.p(f"- Median time: {med.get(1, float('nan')):.1f}s when correct, {med.get(0, float('nan')):.1f}s when incorrect.")
    r.p(f"- Correlation between log response time and being correct: **{corr:+.2f}** (95% interval {lo:+.2f} to {hi:+.2f}).")
    if lo > 0 or hi < 0:
        r.p(f"  The direction is established: {'slower' if corr > 0 else 'faster'} answers are more often right. It's still a weak "
            "signal (|r| under 0.3 explains under 10% of the variation) unless the number above says otherwise.")
    else:
        r.p("  The interval includes zero, so **there's no established link** between speed and correctness here.")
    r.p("- Guided Entry and Free Trade are excluded: their time includes building a setup or watching playback.")


def anomalies(df: pd.DataFrame, out: Path, r: Report, synthetic: bool) -> None:
    r.h("6. Exercises with anomalous failure rates")
    r.p("An exercise is flagged when its success rate is far below that of the *other* exercises of the same concept, "
        "difficulty and source (real or constructed), which is what a wrong answer key would look like. It must be at "
        f"least {int(MIN_GAP * 100)} points below its peers *and* statistically unlikely by chance: a one-sided binomial "
        "test against the peers' rate (smoothed so a perfect peer group doesn't make any single miss significant), "
        "with a Benjamini–Hochberg correction because many exercises are tested at once.")
    rows = []
    for (concept, diff, _src), g in df.groupby(["concept", "difficulty", "data_source"], dropna=False):
        for ex, e in g.groupby("exercise_id"):
            n, k, u = len(e), int(e["is_correct"].sum()), e["user_id"].nunique()
            others = g[g["exercise_id"] != ex]
            if n < MIN_EXERCISE_ATTEMPTS or u < MIN_EXERCISE_USERS or len(others) < MIN_EXERCISE_ATTEMPTS:
                continue
            # Laplace-smoothed peer rate: 30/30 peers is "about 97%", not a certainty.
            p0 = (others["is_correct"].sum() + 1) / (len(others) + 2)
            pval = sum(math.comb(n, i) * p0**i * (1 - p0) ** (n - i) for i in range(0, k + 1))
            rows.append({"exercise_id": ex, "concept": concept, "difficulty": diff, "n": n, "users": u,
                         "rate": k / n, "peer_rate": p0, "p": min(1.0, pval)})
    tested = pd.DataFrame(rows)
    eligible = df.groupby("exercise_id").agg(n=("is_correct", "size"), users=("user_id", "nunique"))
    r.p(f"\n{len(tested)} of {df['exercise_id'].nunique()} exercises have enough attempts to test "
        f"({MIN_EXERCISE_ATTEMPTS}+ attempts from {MIN_EXERCISE_USERS}+ users). "
        f"{int((eligible['n'] >= MIN_EXERCISE_ATTEMPTS).sum())} have {MIN_EXERCISE_ATTEMPTS}+ attempts at all.")
    if tested.empty:
        r.p("**None can be tested yet, so no exercise can be called anomalous.** That needs several users per exercise; "
            "with one user, a low rate means that user struggles, not that the key is wrong.")
        return
    tested = tested.sort_values("p").reset_index(drop=True)
    m = len(tested)
    tested["q"] = (tested["p"] * m / (tested.index + 1)).iloc[::-1].cummin().iloc[::-1].clip(upper=1)
    flagged = tested[(tested["q"] < 0.1) & (tested["rate"] <= tested["peer_rate"] - MIN_GAP)]
    if flagged.empty:
        r.p("No exercise's failure rate is far enough below its peers to flag (false discovery rate 10%).")
    else:
        r.p("\n| Exercise | Concept | Diff. | Success | Peers | n (users) | q |\n|---|---|---|---|---|---|---|")
        for _, x in flagged.iterrows():
            r.p(f"| `{x['exercise_id']}` | {x['concept']} | {x['difficulty']} | {pct(x['rate'])} | {pct(x['peer_rate'])} | "
                f"{x['n']} ({x['users']}) | {x['q']:.3f} |")
        r.p("\nCheck each flagged exercise's answer key and explanation against CURRICULUM.md before blaming the users.")


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("csv")
    ap.add_argument("--out", default="analysis/output")
    ap.add_argument("--synthetic", action="store_true", help="label every chart and the report as synthetic")
    args = ap.parse_args()
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    df = load(args.csv)
    r = Report()
    r.p("# Practice analysis — findings")
    if args.synthetic:
        r.p("\n> **SYNTHETIC DATA.** Generated by `analysis/make_fixture.py` to check that this pipeline runs. "
            "Nothing below describes real users.")
    r.p(f"\nSource: `{Path(args.csv).name}`. Thresholds: a group needs {MIN_ATTEMPTS_GROUP}+ attempts to be compared; "
        f"a learning trend needs {MIN_USERS_TREND}+ users with {MIN_HISTORY}+ attempts; an exercise needs "
        f"{MIN_EXERCISE_ATTEMPTS}+ attempts from {MIN_EXERCISE_USERS}+ users to be flagged. Intervals are 95%.")
    for step in (descriptive, learning, concepts, real_vs_constructed, response_time, anomalies):
        step(df, out, r, args.synthetic)
    (out / "findings.md").write_text("\n".join(r.lines) + "\n")
    print(f"Wrote {out / 'findings.md'} and charts to {out}/")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
