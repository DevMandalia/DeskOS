type PoolClient = {
  query: (sql: string, params?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }>;
};

type Pool = {
  query: PoolClient["query"];
  connect: () => Promise<PoolClient & { release: () => void }>;
};

const g = globalThis as unknown as { __deskPg?: Pool };

export async function pgPool(): Promise<Pool> {
  if (g.__deskPg) return g.__deskPg;
  const url = (process.env.DATABASE_URL ?? "").trim();
  if (!url.startsWith("postgres")) {
    throw new Error("DATABASE_URL must be a postgres:// URL for TASK_STORE/DECISION_SOURCE=postgres");
  }
  const { Pool } = await import("pg");
  g.__deskPg = new Pool({ connectionString: url, max: 4 }) as unknown as Pool;
  await migrate(g.__deskPg);
  return g.__deskPg;
}

const DDL = `
CREATE TABLE IF NOT EXISTS decisions (
  id TEXT PRIMARY KEY,
  url TEXT NOT NULL,
  item TEXT NOT NULL,
  project TEXT,
  status TEXT,
  owner TEXT,
  owner_color TEXT,
  decision_needed TEXT,
  next_step TEXT,
  source TEXT,
  reply TEXT,
  last_updated TEXT,
  last_choice TEXT,
  raised_by_id TEXT,
  raised_by_name TEXT,
  parent_id TEXT,
  parent_name TEXT,
  body_json TEXT,
  brief_json TEXT,
  created_at TEXT
);
CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  url TEXT NOT NULL,
  title TEXT NOT NULL,
  status TEXT,
  area TEXT,
  area_color TEXT,
  due TEXT,
  priority TEXT,
  owner TEXT,
  rank DOUBLE PRECISION,
  last_edited TEXT,
  raised_by_id TEXT,
  raised_by_name TEXT,
  parent_id TEXT,
  parent_name TEXT
);
CREATE TABLE IF NOT EXISTS agents (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  parent_id TEXT,
  key_prefix TEXT NOT NULL,
  key_hash TEXT NOT NULL,
  webhook_url TEXT,
  webhook_secret TEXT,
  created_at TEXT NOT NULL,
  revoked_at TEXT
);
CREATE TABLE IF NOT EXISTS discussion (
  id TEXT PRIMARY KEY,
  decision_id TEXT NOT NULL,
  author TEXT NOT NULL,
  agent_id TEXT,
  agent_name TEXT,
  body TEXT NOT NULL,
  at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS idempotency (
  key TEXT PRIMARY KEY,
  at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`;

async function migrate(pool: Pool): Promise<void> {
  await pool.query(DDL);
  await pool.query("ALTER TABLE decisions ADD COLUMN IF NOT EXISTS brief_json TEXT");
  await pool.query("ALTER TABLE decisions ADD COLUMN IF NOT EXISTS created_at TEXT");
}
