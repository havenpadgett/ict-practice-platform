// npm run restore -- backups/<file>.json — load a backup made by
// `npm run backup` into the database at DATABASE_URL (docs/OPERATIONS.md →
// Restore). Apply every migration in supabase/migrations/ to the target
// first. Rows that already exist are skipped, so it's safe to re-run.

import fs from "node:fs";
import postgres from "postgres";
import { restoreAll, type Backup } from "./lib/backup-core";

async function main() {
  const file = process.argv[2];
  const url = process.env.DATABASE_URL;
  if (!file || !url) {
    console.error("Usage: DATABASE_URL=... npm run restore -- backups/<file>.json");
    process.exit(1);
  }
  const backup = JSON.parse(fs.readFileSync(file, "utf8")) as Backup;
  const sql = postgres(url, { max: 1, prepare: false, onnotice: () => {} });
  try {
    const inserted = await restoreAll(
      (q, params) => sql.unsafe(q, (params ?? []) as never[]) as unknown as Promise<Record<string, unknown>[]>,
      backup,
      { replica: true },
    );
    for (const [table, n] of Object.entries(inserted)) {
      console.log(`  ${table}: ${n} of ${backup.row_counts[table]} rows inserted`);
    }
  } finally {
    await sql.end();
  }
}

main().catch((err) => {
  console.error(`Restore failed: ${err instanceof Error ? err.message.replace(/postgres(ql)?:\/\/\S+/g, "<DATABASE_URL>") : String(err)}`);
  process.exit(1);
});
