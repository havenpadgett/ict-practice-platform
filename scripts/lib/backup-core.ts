// Export and restore of every row of user data (docs/OPERATIONS.md). Kept
// free of any database driver so it runs against real Postgres
// (scripts/backup.ts, scripts/restore.ts, via the `postgres` package) and
// against PGlite in tests/backup.test.ts.

export type Query = (sql: string, params?: unknown[]) => Promise<Record<string, unknown>[]>;

/** Restore order matters: each table's foreign keys point at tables above
 * it. auth.identities holds each user's sign-in method; a table that
 * doesn't exist (e.g. in the test database) is skipped. */
export const BACKUP_TABLES = ["auth.users", "auth.identities", "public.profiles", "public.attempts", "public.practice_events"] as const;

export type Backup = {
  format: "ict-practice-backup";
  version: 1;
  created_at: string;
  /** Migrations the source database had applied, when that's recorded. */
  migrations: string[];
  row_counts: Record<string, number>;
  tables: Record<string, Record<string, unknown>[]>;
};

async function tableExists(q: Query, table: string): Promise<boolean> {
  const [row] = await q(`select to_regclass($1) is not null as ok`, [table]);
  return row.ok === true;
}

export async function exportAll(q: Query): Promise<Backup> {
  const tables: Record<string, Record<string, unknown>[]> = {};
  const row_counts: Record<string, number> = {};
  for (const table of BACKUP_TABLES) {
    if (!(await tableExists(q, table))) continue;
    // json_agg keeps every column's type faithfully (numbers, booleans,
    // jsonb, timestamps as ISO strings) and is what restore reads back.
    const [row] = await q(`select coalesce(json_agg(t), '[]'::json) as rows from ${table} t`);
    const rows = (typeof row.rows === "string" ? JSON.parse(row.rows) : row.rows) as Record<string, unknown>[];
    tables[table] = rows;
    row_counts[table] = rows.length;
  }
  let migrations: string[] = [];
  if (await tableExists(q, "supabase_migrations.schema_migrations")) {
    migrations = (await q(`select version from supabase_migrations.schema_migrations order by version`)).map((r) => String(r.version));
  }
  return { format: "ict-practice-backup", version: 1, created_at: new Date().toISOString(), migrations, row_counts, tables };
}

/** Columns a restore can write: not generated, not GENERATED ALWAYS identity. */
async function writableColumns(q: Query, table: string): Promise<string[]> {
  const [schema, name] = table.split(".");
  const rows = await q(
    `select column_name from information_schema.columns
     where table_schema = $1 and table_name = $2 and is_generated = 'NEVER' and coalesce(identity_generation, '') <> 'ALWAYS'
     order by ordinal_position`,
    [schema, name],
  );
  return rows.map((r) => String(r.column_name));
}

const CHUNK = 500;

/**
 * Loads a backup into a database whose schema is already migrated. Existing
 * rows (same primary key) are left alone, so a restore can be re-run.
 * Returns rows inserted per table. Triggers (including foreign-key checks
 * and the profile-role guard) are skipped for the load when `replica` is
 * true, the way Supabase's own restore does; tables go in dependency order
 * either way.
 */
export async function restoreAll(q: Query, backup: Backup, opts: { replica: boolean }): Promise<Record<string, number>> {
  if (backup.format !== "ict-practice-backup" || backup.version !== 1) throw new Error("Not an ict-practice backup file.");
  const inserted: Record<string, number> = {};
  if (opts.replica) await q(`set session_replication_role = replica`);
  try {
    for (const table of BACKUP_TABLES) {
      const rows = backup.tables[table];
      if (!rows || rows.length === 0) continue;
      if (!(await tableExists(q, table))) throw new Error(`${table} doesn't exist in the target. Apply the migrations first.`);
      const cols = (await writableColumns(q, table)).filter((c) => c in rows[0]);
      const list = cols.map((c) => `"${c}"`).join(", ");
      let n = 0;
      for (let i = 0; i < rows.length; i += CHUNK) {
        const chunk = rows.slice(i, i + CHUNK);
        const res = await q(
          `with ins as (
             insert into ${table} (${list})
             select ${list} from json_populate_recordset(null::${table}, $1::json)
             on conflict do nothing
             returning 1)
           select count(*)::int as n from ins`,
          [JSON.stringify(chunk)],
        );
        n += Number(res[0].n);
      }
      inserted[table] = n;
    }
  } finally {
    if (opts.replica) await q(`set session_replication_role = origin`);
  }
  return inserted;
}
