// npm run backup:status (also runs before `npm run dev`): how old the
// newest local backup is. The Supabase free plan keeps no backups of its
// own (docs/OPERATIONS.md), so this is the reminder. Never fails the
// command it's attached to.

import fs from "node:fs";
import path from "node:path";

const MAX_AGE_DAYS = 7;
const dir = path.resolve(process.cwd(), "backups");
const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => /^ict-practice-.*\.json$/.test(f)) : [];
const newest = files
  .map((f) => ({ f, mtime: fs.statSync(path.join(dir, f)).mtimeMs }))
  .sort((a, b) => b.mtime - a.mtime)[0];

if (!newest) {
  console.warn(`\n⚠  No database backup found in backups/. The free plan keeps none. Run: DATABASE_URL=... npm run backup (docs/OPERATIONS.md)\n`);
} else {
  const days = (Date.now() - newest.mtime) / 86_400_000;
  const age = days < 1 ? "today" : `${Math.floor(days)} day${Math.floor(days) === 1 ? "" : "s"} ago`;
  if (days > MAX_AGE_DAYS) {
    console.warn(`\n⚠  Last database backup was ${age} (${newest.f}). Run: DATABASE_URL=... npm run backup (docs/OPERATIONS.md)\n`);
  } else {
    console.log(`Last database backup: ${age} (${newest.f}).`);
  }
}
