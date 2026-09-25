// Writes src/data/exercise-catalog.json: every exercise's metadata without
// its candles, so pages that only need labels, concepts and difficulties
// (dashboard, analytics, recommendations, CSV export) don't download ~470 KB
// of chart data. Run after adding, removing or approving exercises:
//   npm run catalog
// tests/catalog.test.ts fails if the file is out of date.

import fs from "node:fs";
import path from "node:path";
import { buildCatalog } from "../src/data/catalog-builder";

const out = path.resolve(__dirname, "../src/data/exercise-catalog.json");
const catalog = buildCatalog();
fs.writeFileSync(out, JSON.stringify(catalog, null, 1) + "\n");
console.log(`Wrote ${catalog.length} entries to ${path.relative(process.cwd(), out)}`);
