// Finding glossary terms in running text, and deciding how each one is
// written: the full name on first use per page with its acronym in
// brackets, the acronym after ("Market Structure Shift (MSS)", then "MSS").
// Pure, so the matching and the rule are testable without a page.

import { GLOSSARY, type GlossaryEntry } from "@/data/glossary";

export type Match = {
  start: number;
  end: number;
  entry: GlossaryEntry;
  /** What the text said. */
  matched: string;
  /** "name" and "abbr" take part in the first-use rule; an alias (a plural,
   * a variant wording) is shown as typed. */
  kind: "name" | "abbr" | "alias";
  /** The text already carried its own "(ABBR)" after the name. */
  hadBracket: boolean;
};

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/** Acronyms are matched exactly (so "MSS" isn't "mss" mid-word); words are case-insensitive. */
const isAcronym = (s: string) => /^[A-Z][A-Z0-9:./]+$/.test(s);

type Pattern = { entry: GlossaryEntry; text: string; kind: Match["kind"]; ci: boolean };

function patterns(): Pattern[] {
  const out: Pattern[] = [];
  for (const entry of GLOSSARY) {
    if (entry.manual) continue;
    out.push({ entry, text: entry.name, kind: "name", ci: !isAcronym(entry.name) });
    if (entry.abbr) out.push({ entry, text: entry.abbr, kind: "abbr", ci: false });
    for (const alias of entry.aliases ?? []) {
      const kind: Match["kind"] = alias === entry.abbr ? "abbr" : alias === entry.name ? "name" : "alias";
      out.push({ entry, text: alias, kind, ci: !isAcronym(alias) });
    }
  }
  // Longest first, so "Buy-Side Liquidity" wins over "Liquidity".
  return out.sort((a, b) => b.text.length - a.text.length);
}

let cached: { pattern: Pattern; re: RegExp }[] | null = null;
function compiled() {
  cached ??= patterns().map((pattern) => {
    const bracket = pattern.kind === "name" && pattern.entry.abbr ? `(?:\\s*\\(${escape(pattern.entry.abbr)}\\))?` : "";
    return {
      pattern,
      re: new RegExp(`(?<![A-Za-z0-9])${escape(pattern.text)}${bracket}(?![A-Za-z0-9])`, pattern.ci ? "gi" : "g"),
    };
  });
  return cached;
}

/** Every glossary term in `text`, left to right, longest match winning where
 * two overlap. */
export function findTerms(text: string): Match[] {
  const found: Match[] = [];
  for (const { pattern, re } of compiled()) {
    re.lastIndex = 0;
    for (let m = re.exec(text); m !== null; m = re.exec(text)) {
      const start = m.index;
      const end = start + m[0].length;
      if (found.some((f) => start < f.end && end > f.start)) continue;
      const hadBracket = pattern.kind === "name" && !!pattern.entry.abbr && m[0].length > pattern.text.length;
      found.push({ start, end, entry: pattern.entry, matched: hadBracket ? m[0].slice(0, pattern.text.length) : m[0], kind: pattern.kind, hadBracket });
      if (m[0].length === 0) re.lastIndex++;
    }
  }
  return found.sort((a, b) => a.start - b.start);
}

/** How one use of a term reads. `first` is whether it's the first use on
 * the page. Only terms with an acronym change. */
export function termLabel(entry: GlossaryEntry, matched: string, kind: Match["kind"], first: boolean): string {
  if (kind === "alias" || !entry.abbr) return matched;
  if (first) return kind === "abbr" ? `${entry.name} (${entry.abbr})` : `${matched} (${entry.abbr})`;
  return entry.abbr;
}

/** Text with each term split out, for rendering. */
export type Segment = { text: string } | { match: Match };

export function segment(text: string): Segment[] {
  const out: Segment[] = [];
  let at = 0;
  for (const match of findTerms(text)) {
    if (match.start > at) out.push({ text: text.slice(at, match.start) });
    out.push({ match });
    at = match.end;
  }
  if (at < text.length) out.push({ text: text.slice(at) });
  return out;
}
