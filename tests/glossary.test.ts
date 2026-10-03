// The glossary covers the curriculum: every versioned definition, every
// section, and every bolded term in docs/CURRICULUM.md has an entry, or is
// listed below with the reason it isn't a term. A new term added to the
// curriculum fails here until it's defined (src/data/glossary.ts).

import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { getGlossaryEntry, GLOSSARY } from "@/data/glossary";
import { DEFINITIONS } from "@/lib/curriculum";
import { findTerms, segment, termLabel } from "@/lib/glossary-match";

const curriculum = fs.readFileSync(path.resolve(__dirname, "../docs/CURRICULUM.md"), "utf8");

/** Names, acronyms and aliases of every entry, lower-cased. */
const known = new Set(GLOSSARY.flatMap((e) => [e.name, e.abbr, ...(e.aliases ?? [])].filter(Boolean).map((s) => s!.toLowerCase())));
const norm = (s: string) => s.toLowerCase().replace(/\s*\/\s*/g, "/");
const knownNorm = new Set([...known].map(norm));
const hasTerm = (s: string) => {
  const t = norm(s.replace(/^(a|an|the)\s+/i, "").replace(/[:.]+$/, "").trim());
  if (knownNorm.has(t)) return true;
  if (known.has(t)) return true;
  // "Regular trading hours (RTH)" and "Risk-to-reward (R:R)": the name before the bracket.
  const bare = t.replace(/\s*\([^)]*\)\s*$/, "");
  return known.has(bare) || t.split("/").every((p) => known.has(p.trim()) || [...known].some((k) => k.includes(p.trim()) && p.trim().length > 4));
};

/** Bolded spans in the curriculum that are labels, emphasis or exercise notes, not terms. */
const NOT_TERMS = new Set(
  [
    "Provenance", "What it is", "Confirmation", "Operational details (AI-DRAFTED)", "How it was chosen", "Exercises", "AI-DRAFTED", "HAVEN-VALIDATED",
    "HAVEN-VALIDATED (2026-09-24)", "zone's midpoint", "unclear", "taken the previous confirmed swing on the opposing side", "selling is favoured",
    "buying is favoured", "not", "legibility", "ft-005 — Too Close to Call", "ft-004 — Range Chop", "ft-003 — The Retest That Failed",
    "ft-002 — Equal Highs Raid", "ft-001 — Sweep and Reclaim", "difficulty-3-only relaxed profile", "close", "break a structural level", "body closes through",
    "at least 0.25× the trailing median bar range", "Zone = the candle's full high–low range", "Yes", "Why grade the process, not the outcome (PRD Section 13)",
    "Why adaptive", "Why 0.25× and not a bar-count or a strict-alternation rule", "Which swings", "Where it rests", "What the human-reviewed explanations have in common",
    "Weak or invalid", "Visible at the start", "Versioning (2026-09-25)", "Unblocked (2026-09-24)", "Then why, in market behaviour, not numbers",
    "The requirement", "The gap this closes", "The defaults in `detect.py` do not change", "The chart ends three candles after the entry level forms", "Terminology",
    "Terminology (use exactly these)", "Structure has to start from nothing at 9:30", "Structure before the open is what's missing", "Strength", "Stop zone", "So \"noise\" can't be defined by what happens after the gap",
    "Scope", "Revealed one candle at a time", "Point at the chart, don't describe coordinates", "Per rule", "One idea, stated first", "Note on the NY AM window",
    "Not an MSS", "No-trade verdicts end on the decision and what to wait for", "No lookahead", "No", "Minimum swing magnitude", "Minimum 2:1 is required for a valid setup",
    "Loses", "Length", "Known limit", "Kept as a separate section on purpose", "How rare valid setups are", "How often it appears", "Graded on process, not outcome",
    "Generating a batch means expecting rejections", "First test: do bigger gaps behave differently? They don't", "First difficulty-3 batch", "Existing real scenarios",
    "Equilibrium band", "Entry zone", "Detection", "Current price", "Correction (2026-09-11)", "Consequence for the definition", "Definitions (AI-DRAFTED)", "Direction",
    "Trade decision", "Structure break", "Equal highs/lows tolerance", "Applies to", "As currently implemented",
  ].map((s) => s.toLowerCase()),
);

describe("glossary coverage of the curriculum", () => {
  it("has an entry for every versioned curriculum definition", () => {
    for (const id of Object.keys(DEFINITIONS)) {
      expect(GLOSSARY.some((e) => e.curriculum === id), `no glossary entry cites the curriculum definition "${id}"`).toBe(true);
    }
  });

  it("every entry's curriculum reference is a real definition", () => {
    for (const e of GLOSSARY) if (e.curriculum) expect(DEFINITIONS, `${e.id} cites "${e.curriculum}"`).toHaveProperty(e.curriculum);
  });

  it("covers every bolded term in docs/CURRICULUM.md or lists it as not a term", () => {
    const missing = new Set<string>();
    for (const m of curriculum.matchAll(/\*\*([^*\n]{2,80})\*\*/g)) {
      const span = m[1].replace(/[:.]+$/, "").trim();
      // A candidate term is a short noun phrase. Sentences, numbers, dates and
      // formulas that happen to be bold are emphasis, not terms.
      if (span.split(/\s+/).length > 4 || /[\d=`]|isn't|—/.test(span)) continue;
      if (NOT_TERMS.has(span.toLowerCase()) || hasTerm(span)) continue;
      missing.add(span);
    }
    expect([...missing], "define these in src/data/glossary.ts, or add them to NOT_TERMS if they are not terms").toEqual([]);
  });

  it("defines the trade-building terms the curriculum uses as steps", () => {
    for (const id of ["bias", "entry", "stop-loss", "target", "risk-to-reward", "no-trade", "long", "short", "guided-entry", "free-trade"]) {
      expect(getGlossaryEntry(id), id).toBeDefined();
    }
  });
});

describe("glossary entries", () => {
  it("have unique ids, tooltips short enough to be tooltips, and resolvable links", () => {
    const ids = GLOSSARY.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const e of GLOSSARY) {
      expect(e.short.length, `${e.id} tooltip`).toBeLessThanOrEqual(190);
      expect(e.short.length, `${e.id} tooltip`).toBeGreaterThan(15);
      expect(e.long.length).toBeGreaterThan(e.short.length - 40);
      for (const r of e.related ?? []) expect(getGlossaryEntry(r), `${e.id} → ${r}`).toBeDefined();
    }
  });

  it("don't use the terms the curriculum says not to introduce", () => {
    const body = GLOSSARY.map((e) => [e.name, e.abbr, ...(e.aliases ?? [])].join(" ")).join(" ");
    expect(body).not.toMatch(/\b(BOS|CHoCH)\b/);
    // The curriculum says "this project uses MSS. Do not introduce BOS or CHoCH terminology": mentioned only to rule them out.
    const mss = getGlossaryEntry("market-structure-shift")!;
    expect(mss.long).toContain("does not use BOS or CHoCH");
  });
});

describe("finding terms in text", () => {
  it("links names, acronyms and variants, the longest first", () => {
    const text = "An Inverse Fair Value Gap is a failed FVG; buy-side liquidity sits above equal highs.";
    expect(findTerms(text).map((m) => [m.matched, m.entry.id])).toEqual([
      ["Inverse Fair Value Gap", "inverse-fair-value-gap"],
      ["FVG", "fair-value-gap"],
      ["buy-side liquidity", "buy-side-liquidity"],
      ["equal highs", "equal-highs-lows"],
    ]);
  });

  it("matches acronyms exactly and whole words only", () => {
    expect(findTerms("a gapless mss in IFVGX").map((m) => m.entry.id)).toEqual([]);
    expect(findTerms("The MSS held").map((m) => m.entry.id)).toEqual(["market-structure-shift"]);
    expect(findTerms("IFVG").map((m) => m.entry.id)).toEqual(["inverse-fair-value-gap"]);
  });

  it("takes a bracketed acronym after the name as one term", () => {
    const [m] = findTerms("Identify the Fair Value Gap (FVG), if there is one.");
    expect(m).toMatchObject({ matched: "Fair Value Gap", hadBracket: true });
    expect(segment("a Fair Value Gap (FVG) here").map((s) => ("text" in s ? s.text : "<term>"))).toEqual(["a ", "<term>", " here"]);
  });

  it("writes the full name with its acronym on first use, and the acronym after", () => {
    const mss = getGlossaryEntry("market-structure-shift")!;
    expect(termLabel(mss, "MSS", "abbr", true)).toBe("Market Structure Shift (MSS)");
    expect(termLabel(mss, "MSS", "abbr", false)).toBe("MSS");
    expect(termLabel(mss, "Market Structure Shift", "name", true)).toBe("Market Structure Shift (MSS)");
    expect(termLabel(mss, "Market Structure Shift", "name", false)).toBe("MSS");
    // A term without an acronym is shown as typed; so is a variant wording.
    const sweep = getGlossaryEntry("liquidity-sweep")!;
    expect(termLabel(sweep, "swept", "alias", false)).toBe("swept");
    const liq = getGlossaryEntry("liquidity")!;
    expect(termLabel(liq, "Liquidity", "name", false)).toBe("Liquidity");
  });
});
