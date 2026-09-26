// Keep src/data/curriculum-versions.json in step with docs/CURRICULUM.md.
//
//   npm run curriculum -- check          list definitions whose text changed
//   npm run curriculum -- bump <id>      bump a changed definition's version
//                                        and record its new hash
//   npm run curriculum -- verify <prefix> <id>
//                                        record that a constructed group was
//                                        re-checked against <id>'s current
//                                        version
//
// A bump makes every exercise built under the old version fail
// tests/curriculum.test.ts and show as "needs re-review" on /review until
// it's re-checked (constructed) or re-approved (real).

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { normalizeSection, splitSections } from "../src/lib/curriculum";

const ROOT = path.resolve(__dirname, "..");
const VERSIONS = path.join(ROOT, "src/data/curriculum-versions.json");
const data = JSON.parse(fs.readFileSync(VERSIONS, "utf8"));
const sections = splitSections(fs.readFileSync(path.join(ROOT, "docs/CURRICULUM.md"), "utf8"));
const hash = (id: string) => {
  const text = sections[data.definitions[id].section];
  if (text === undefined) throw new Error(`Section "${data.definitions[id].section}" not found in CURRICULUM.md`);
  return crypto.createHash("sha256").update(normalizeSection(text)).digest("hex");
};

const [cmd, a, b] = process.argv.slice(2);
if (cmd === "check" || !cmd) {
  const changed = Object.keys(data.definitions).filter((id) => hash(id) !== data.definitions[id].sha256);
  console.log(changed.length ? `Changed without a version bump: ${changed.join(", ")}` : "All definitions match their recorded version.");
  process.exit(changed.length ? 1 : 0);
} else if (cmd === "bump") {
  const d = data.definitions[a];
  if (!d) throw new Error(`Unknown definition ${a}`);
  d.version += 1;
  d.sha256 = hash(a);
  console.log(`${a} is now v${d.version}. Exercises built under v${d.version - 1} now need re-review.`);
} else if (cmd === "verify") {
  const g = data.constructed.find((x: { prefix: string }) => x.prefix === a);
  if (!g) throw new Error(`Unknown constructed group ${a}`);
  g.verified_against[b] = data.definitions[b].version;
  console.log(`${a}* marked as checked against ${b} v${data.definitions[b].version}.`);
} else if (cmd === "init") {
  for (const id of Object.keys(data.definitions)) data.definitions[id].sha256 = hash(id);
  console.log("Recorded hashes for every definition.");
} else {
  throw new Error(`Unknown command ${cmd}`);
}
fs.writeFileSync(VERSIONS, JSON.stringify(data, null, 2) + "\n");
