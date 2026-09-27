// DEMO MODE (see ./gate.ts). A stand-in for the Supabase client covering
// exactly the calls the app makes: auth reads, from(table) with select /
// insert / upsert / update, eq / order / maybeSingle, and rpc. Each query is
// turned into a plain description and handed to `execute`: in the browser
// that POSTs to /api/demo, on the server it runs against the in-memory
// store (./store.ts). Nothing here can reach a real Supabase project.

import { DEMO_USER } from "@/lib/demo/gate";

export type DemoQuery = {
  table: string;
  action: "select" | "insert" | "upsert" | "update" | "delete";
  columns: string;
  count: boolean;
  head: boolean;
  values: Record<string, unknown>[] | Record<string, unknown> | null;
  filters: [string, unknown][];
  order: { column: string; ascending: boolean } | null;
  limit: number | null;
  single: "maybe" | "one" | null;
  onConflict: string | null;
  ignoreDuplicates: boolean;
};

export type DemoRpc = { rpc: string; args: Record<string, unknown> };

export type DemoResult = {
  data: unknown;
  error: { code: string; message: string } | null;
  count: number | null;
};

export type DemoExecutor = (request: DemoQuery | DemoRpc) => Promise<DemoResult>;

class DemoQueryBuilder implements PromiseLike<DemoResult> {
  private q: DemoQuery;

  constructor(
    table: string,
    private execute: DemoExecutor,
  ) {
    this.q = {
      table,
      action: "select",
      columns: "*",
      count: false,
      head: false,
      values: null,
      filters: [],
      order: null,
      limit: null,
      single: null,
      onConflict: null,
      ignoreDuplicates: false,
    };
  }

  select(columns = "*", opts?: { count?: string; head?: boolean }) {
    if (this.q.action === "select") this.q.columns = columns;
    this.q.count = opts?.count !== undefined;
    this.q.head = opts?.head === true;
    return this;
  }
  insert(values: Record<string, unknown> | Record<string, unknown>[]) {
    this.q.action = "insert";
    this.q.values = values;
    return this;
  }
  upsert(values: Record<string, unknown> | Record<string, unknown>[], opts?: { onConflict?: string; ignoreDuplicates?: boolean }) {
    this.q.action = "upsert";
    this.q.values = values;
    this.q.onConflict = opts?.onConflict ?? "id";
    this.q.ignoreDuplicates = opts?.ignoreDuplicates === true;
    return this;
  }
  update(values: Record<string, unknown>) {
    this.q.action = "update";
    this.q.values = values;
    return this;
  }
  delete() {
    this.q.action = "delete";
    return this;
  }
  eq(column: string, value: unknown) {
    this.q.filters.push([column, value]);
    return this;
  }
  order(column: string, opts?: { ascending?: boolean }) {
    this.q.order = { column, ascending: opts?.ascending !== false };
    return this;
  }
  limit(n: number) {
    this.q.limit = n;
    return this;
  }
  maybeSingle() {
    this.q.single = "maybe";
    return this;
  }
  single() {
    this.q.single = "one";
    return this;
  }
  then<T1 = DemoResult, T2 = never>(
    onfulfilled?: ((value: DemoResult) => T1 | PromiseLike<T1>) | null,
    onrejected?: ((reason: unknown) => T2 | PromiseLike<T2>) | null,
  ): PromiseLike<T1 | T2> {
    return this.execute(this.q).then(onfulfilled, onrejected);
  }
}

const DEMO_AUTH_USER = {
  id: DEMO_USER.id,
  email: DEMO_USER.email,
  aud: "authenticated",
  role: "authenticated",
  app_metadata: {},
  user_metadata: {},
  created_at: "2026-09-01T00:00:00Z",
};

const DEMO_SESSION = {
  access_token: "demo",
  refresh_token: "demo",
  token_type: "bearer",
  expires_in: 3600,
  user: DEMO_AUTH_USER,
};

const DISABLED = { code: "demo_mode", message: "Not available in demo mode." };

/** Always signed in as the demo reviewer; sign-in and sign-out are no-ops. */
export function createFakeSupabase(execute: DemoExecutor) {
  const signedIn = async () => ({ data: { user: DEMO_AUTH_USER, session: DEMO_SESSION }, error: null });
  return {
    auth: {
      getUser: async () => ({ data: { user: DEMO_AUTH_USER }, error: null }),
      getSession: async () => ({ data: { session: DEMO_SESSION }, error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
      signInWithPassword: signedIn,
      signUp: signedIn,
      signInWithOAuth: async () => ({ data: null, error: DISABLED }),
      exchangeCodeForSession: async () => ({ data: null, error: DISABLED }),
      signOut: async () => ({ error: null }),
    },
    from: (table: string) => new DemoQueryBuilder(table, execute),
    rpc: (rpc: string, args: Record<string, unknown> = {}) => execute({ rpc, args }),
  };
}

/** Browser half: every query goes to the demo route, which answers from
 * the server's in-memory store. */
export function createDemoBrowserClient() {
  return createFakeSupabase(async (request) => {
    const res = await fetch("/api/demo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    });
    if (!res.ok) return { data: null, error: { code: String(res.status), message: "Demo store unavailable." }, count: null };
    return (await res.json()) as DemoResult;
  });
}
