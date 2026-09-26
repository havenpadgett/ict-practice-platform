// Regression safety for curriculum changes (docs/CURRICULUM-REVIEW.md, end).
//
// 1. A definition's text can't change without a version bump
//    (`npm run curriculum -- bump <id>`).
// 2. No exercise's answer key may have been built under an older version of
//    a definition it depends on than the current one:
//    - constructed exercises: re-check by hand, then
//      `npm run curriculum -- verify <prefix> <id>`
//    - real scenarios: re-approve at /review (or rebuild).

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { exercises } from "@/data/exercises";
import {
  constructedGroup,
  CONSTRUCTED_GROUPS,
  DEFINITIONS,
  definitionsForRule,
  normalizeSection,
  splitSections,
  staleDefinitions,
  type DefinitionId,
} from "@/lib/curriculum";

const sections = splitSections(fs.readFileSync(path.resolve(__dirname, "../docs/CURRICULUM.md"), "utf8"));

describe("curriculum versions", () => {
  it.each(Object.entries(DEFINITIONS))("%s: text matches its recorded version", (id, def) => {
    const text = sections[def.section];
    expect(text, `section "${def.section}" is missing from CURRICULUM.md`).toBeDefined();
    const hash = crypto.createHash("sha256").update(normalizeSection(text)).digest("hex");
    expect(hash, `${id} changed without a version bump — run: npm run curriculum -- bump ${id}`).toBe(def.sha256);
  });

  it("every constructed exercise belongs to a definition group", () => {
    const orphans = exercises.filter((e) => !e.provenance && !constructedGroup(e.exercise_id)).map((e) => e.exercise_id);
    expect(orphans).toEqual([]);
  });

  it("no constructed exercise was built under an older definition version", () => {
    const stale: string[] = [];
    for (const e of exercises.filter((x) => !x.provenance)) {
      const g = constructedGroup(e.exercise_id)!;
      for (const id of staleDefinitions(g.verified_against, g.definitions)) {
        stale.push(`${e.exercise_id}: ${id} checked at v${g.verified_against[id] ?? 0}, now v${DEFINITIONS[id].version}`);
      }
    }
    expect(stale, "re-check these, then: npm run curriculum -- verify <prefix> <definition>").toEqual([]);
  });

  it("no real scenario was built under an older definition version", () => {
    const stale: string[] = [];
    for (const e of exercises.filter((x) => x.provenance)) {
      const p = e.provenance!;
      const ids = definitionsForRule(p.detection_rule);
      expect(ids.length, `no definitions mapped for rule ${p.detection_rule}`).toBeGreaterThan(0);
      for (const id of staleDefinitions(p.curriculum_versions, ids)) {
        stale.push(`${e.exercise_id}: ${id} v${p.curriculum_versions?.[id] ?? "none"}, now v${DEFINITIONS[id].version}`);
      }
    }
    expect(stale, "re-review these at /review").toEqual([]);
  });

  it("every definition a group or rule names exists", () => {
    const named = new Set<DefinitionId>(CONSTRUCTED_GROUPS.flatMap((g) => g.definitions));
    for (const id of named) expect(DEFINITIONS[id], id).toBeDefined();
  });

  it("a bumped definition flags exactly the exercises built on it", () => {
    // Simulate MSS moving to v2 without touching the files.
    const bumped = { ...DEFINITIONS.mss, version: DEFINITIONS.mss.version + 1 };
    const flagged = exercises
      .filter((e) => {
        const ids = e.provenance ? definitionsForRule(e.provenance.detection_rule) : constructedGroup(e.exercise_id)!.definitions;
        const built = e.provenance ? e.provenance.curriculum_versions : constructedGroup(e.exercise_id)!.verified_against;
        return ids.includes("mss") && (built?.mss ?? 0) < bumped.version;
      })
      .map((e) => e.exercise_id);
    expect(flagged).toContain("mss-001");
    expect(flagged).toContain("guided-001");
    expect(flagged).toContain("real-mss-001");
    expect(flagged).not.toContain("fvg-001");
    expect(flagged).not.toContain("liq-001");
  });
});
