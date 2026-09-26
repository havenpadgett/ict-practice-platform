// Curriculum definitions as addressable, versioned units.
//
// docs/CURRICULUM.md is split into its "## " sections; each definition id
// below names one. src/data/curriculum-versions.json records every
// definition's current version and the hash of its text, which rules and
// exercise groups depend on which definitions, and the definition versions
// each constructed group was last checked against. Real scenarios record
// theirs in provenance.curriculum_versions. tests/curriculum.test.ts fails
// when a definition's text changes without a version bump, or when any
// exercise was built under an older version than the current one.

import versions from "@/data/curriculum-versions.json";

export type DefinitionId = keyof typeof versions.definitions;

export type CurriculumVersions = Partial<Record<DefinitionId, number>>;

export const DEFINITIONS = versions.definitions as Record<DefinitionId, { section: string; version: number; sha256: string }>;

/** Definition ids a detection rule's answer keys depend on. The first is the
 * rule's own definition (shown first on /review). */
export function definitionsForRule(rule: string): DefinitionId[] {
  const rules = versions.rules as Record<string, DefinitionId[]>;
  if (rules[rule]) return rules[rule];
  if (/^(previous_day|ny_am|weekly)_/.test(rule)) return rules.time_levels ?? [];
  return [];
}

/** Current version of every definition in `ids`. */
export function currentVersions(ids: DefinitionId[]): CurriculumVersions {
  return Object.fromEntries(ids.map((id) => [id, DEFINITIONS[id].version])) as CurriculumVersions;
}

/** Definitions an exercise was built under that have since changed. */
export function staleDefinitions(builtUnder: CurriculumVersions | undefined, ids: DefinitionId[]): DefinitionId[] {
  return ids.filter((id) => (builtUnder?.[id] ?? 0) < DEFINITIONS[id].version);
}

/** Constructed exercise groups, matched by exercise-id prefix. */
export const CONSTRUCTED_GROUPS = versions.constructed as {
  prefix: string;
  definitions: DefinitionId[];
  verified_against: CurriculumVersions;
}[];

export function constructedGroup(exerciseId: string) {
  // Longest prefix wins ("fvg-resp-" before "fvg-").
  return [...CONSTRUCTED_GROUPS]
    .sort((a, b) => b.prefix.length - a.prefix.length)
    .find((g) => exerciseId.startsWith(g.prefix));
}

/** Split CURRICULUM.md into its "## " sections, keyed by heading text. */
export function splitSections(markdown: string): Record<string, string> {
  const out: Record<string, string> = {};
  const parts = markdown.split(/^## /m).slice(1);
  for (const part of parts) {
    const nl = part.indexOf("\n");
    out[part.slice(0, nl).trim()] = part.slice(nl + 1).trim();
  }
  return out;
}

/** The text a definition's hash covers: its section, trailing spaces and
 * blank-line runs normalized so reflowing whitespace isn't a "change". */
export function normalizeSection(text: string): string {
  return text
    .split("\n")
    .map((l) => l.replace(/\s+$/, ""))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
