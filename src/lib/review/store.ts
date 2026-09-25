// File-backed review store for real-data scenarios. Scenarios live in the
// repo as JSON (src/data/real-scenarios/), not in the database — exercise
// content stays version-controlled (supabase/migrations: "nothing about
// exercise content lives in the database"). So approving or rejecting
// edits files on disk, which only works where the repo is checked out: the
// local dev server. The change goes live for everyone once it's committed
// and deployed.
//
//   approve: rewrite the explanation (required — the draft can't ship), set
//            human_reviewed, reviewed_by, reviewed_at, review_notes
//   reject:  delete the JSON file and unregister it from index.ts
//   both:    append a row to the Review Log in docs/SCENARIO-VALIDATION.md

import { promises as fs } from "fs";
import path from "path";
import { parseRealScenario, type RealScenario } from "@/data/real-scenarios";

const ROOT = process.cwd();
const SCENARIO_DIR = path.join(ROOT, "src", "data", "real-scenarios");
const REGISTRY = path.join(SCENARIO_DIR, "index.ts");
const VALIDATION_DOC = path.join(ROOT, "docs", "SCENARIO-VALIDATION.md");
const ID_PATTERN = /^real-[a-z]+-\d{3}$/;
const DRAFT_MARKER = "[DRAFT";
const LOG_PLACEHOLDER = "| — | — | — | — | — | — | No real scenarios reviewed yet |";

export function canWrite(): boolean {
  return process.env.NODE_ENV === "development";
}

function scenarioPath(id: string): string {
  if (!ID_PATTERN.test(id)) throw new Error(`Invalid scenario id: ${id}`);
  return path.join(SCENARIO_DIR, `${id}.json`);
}

/** Read from disk (not the bundled import) so the page reflects edits made
 * a moment ago. */
export async function listScenarios(): Promise<RealScenario[]> {
  const files = (await fs.readdir(SCENARIO_DIR)).filter((f) => f.endsWith(".json")).sort();
  return Promise.all(
    files.map(async (f) => parseRealScenario(JSON.parse(await fs.readFile(path.join(SCENARIO_DIR, f), "utf8")))),
  );
}

async function readScenario(id: string): Promise<Record<string, unknown> & { provenance: Record<string, unknown> }> {
  return JSON.parse(await fs.readFile(scenarioPath(id), "utf8"));
}

function cell(text: string): string {
  return text.replace(/\|/g, "\\|").replace(/\s*\n\s*/g, " ").trim();
}

async function appendReviewLog(row: string[]): Promise<void> {
  const doc = await fs.readFile(VALIDATION_DOC, "utf8");
  const line = `| ${row.map(cell).join(" | ")} |`;
  let next: string;
  if (doc.includes(LOG_PLACEHOLDER)) {
    next = doc.replace(LOG_PLACEHOLDER, line);
  } else {
    const start = doc.indexOf("## Review Log");
    if (start === -1) throw new Error("Review Log section not found in docs/SCENARIO-VALIDATION.md");
    // Insert after the last table row of the Review Log section.
    const lines = doc.slice(start).split("\n");
    let last = lines.findIndex((l) => l.startsWith("|---"));
    while (last + 1 < lines.length && lines[last + 1].startsWith("|")) last++;
    lines.splice(last + 1, 0, line);
    next = doc.slice(0, start) + lines.join("\n");
  }
  await fs.writeFile(VALIDATION_DOC, next);
}

/** The reviewer's local calendar date (the dev server runs on their machine). */
function today(): string {
  return new Date().toLocaleDateString("en-CA");
}

export async function approveScenario(id: string, reviewer: string, explanation: string, notes: string): Promise<void> {
  if (!canWrite()) throw new Error("Reviews can only be saved from the local dev server (they edit repo files).");
  const text = explanation.trim();
  if (!text) throw new Error("Write the explanation users will see before approving.");
  if (text.includes(DRAFT_MARKER)) throw new Error("The explanation still contains the [DRAFT marker — rewrite it first.");
  const s = await readScenario(id);
  if (s.provenance.human_reviewed) throw new Error(`${id} is already approved.`);
  s.explanation = text;
  s.provenance = {
    ...s.provenance,
    human_reviewed: true,
    reviewed_by: reviewer,
    reviewed_at: today(),
    review_notes: notes.trim() || null,
  };
  parseRealScenario(s); // same contract the app enforces at load
  await fs.writeFile(scenarioPath(id), JSON.stringify(s, null, 2) + "\n");
  await appendReviewLog([
    today(), id, String(s.provenance.candidate_id), String(s.provenance.detection_rule), "Approved", reviewer, notes.trim() || "—",
  ]);
}

export async function rejectScenario(id: string, reviewer: string, reason: string): Promise<void> {
  if (!canWrite()) throw new Error("Reviews can only be saved from the local dev server (they edit repo files).");
  if (!reason.trim()) throw new Error("A rejection needs a reason — it goes in the Review Log.");
  const s = await readScenario(id);
  if (s.provenance.human_reviewed) throw new Error(`${id} is already approved — un-approve it by hand if needed.`);

  const registry = await fs.readFile(REGISTRY, "utf8");
  const importLine = new RegExp(`^import (\\w+) from "\\./${id}\\.json";\\n`, "m");
  const match = registry.match(importLine);
  if (!match) throw new Error(`${id} is not registered in src/data/real-scenarios/index.ts`);
  const updated = registry.replace(importLine, "").replace(new RegExp(`^  ${match[1]},\\n`, "m"), "");
  await fs.writeFile(REGISTRY, updated);
  await fs.unlink(scenarioPath(id));
  await appendReviewLog([
    today(), id, String(s.provenance.candidate_id), String(s.provenance.detection_rule), "Rejected", reviewer, reason,
  ]);
}
