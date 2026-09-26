// npm run backup — export every row of user data to backups/<timestamp>.json
// (docs/OPERATIONS.md). Reads DATABASE_URL: the Supabase connection string
// with the database password (Dashboard → Connect → Session pooler). It is
// never stored by this script; the output file is written owner-only
// (0600) because it contains every user's email and password hash.

import fs from "node:fs";
import path from "node:path";
import postgres from "postgres";
import { exportAll } from "./lib/backup-core";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("Set DATABASE_URL to the database connection string (see docs/OPERATIONS.md).");
    process.exit(1);
  }
  const sql = postgres(url, { max: 1, prepare: false, onnotice: () => {} });
  try {
    const backup = await exportAll((q, params) => sql.unsafe(q, (params ?? []) as never[]) as unknown as Promise<Record<string, unknown>[]>);
    const dir = path.resolve(process.cwd(), "backups");
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
    const file = path.join(dir, `ict-practice-${backup.created_at.replace(/[:.]/g, "-")}.json`);
    fs.writeFileSync(file, JSON.stringify(backup), { mode: 0o600 });
    console.log(`Wrote ${path.relative(process.cwd(), file)}`);
    for (const [table, n] of Object.entries(backup.row_counts)) console.log(`  ${table}: ${n} rows`);
    console.log(`  migrations applied at source: ${backup.migrations.length ? backup.migrations.at(-1) : "not recorded"}`);
  } finally {
    await sql.end();
  }
}

main().catch((err) => {
  // The message only: a connection error can echo the connection string.
  console.error(`Backup failed: ${err instanceof Error ? err.message.replace(/postgres(ql)?:\/\/\S+/g, "<DATABASE_URL>") : String(err)}`);
  process.exit(1);
});
