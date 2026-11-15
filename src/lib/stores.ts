/**
 * Which adapter to load. Defaults to local SQLite. Memory/JSON is the fallback
 * for demo mode and serverless hosts that have no disk. Notion is opt-in.
 */

export const STORE_KINDS = ["sqlite", "memory", "postgres", "notion"] as const;
export type StoreKind = (typeof STORE_KINDS)[number];

function parseKind(value: string | undefined): StoreKind | null {
  const v = (value ?? "").trim().toLowerCase();
  return (STORE_KINDS as readonly string[]).includes(v) ? (v as StoreKind) : null;
}

export function isServerless(): boolean {
  return Boolean(process.env.VERCEL) || process.env.DESK_SERVERLESS === "1";
}

export function isDemoMode(): boolean {
  return process.env.DESK_DEMO === "1";
}

/** Prefer SQLite on a disk; memory on Vercel/demo; Postgres if DATABASE_URL is set and nothing else is. */
export function defaultStoreKind(): StoreKind {
  if (isDemoMode()) return "memory";
  if (isServerless()) {
    const db = (process.env.DATABASE_URL ?? "").trim();
    if (db.startsWith("postgres")) return "postgres";
    return "memory";
  }
  return "sqlite";
}

export function decisionSourceKind(): StoreKind {
  return parseKind(process.env.DECISION_SOURCE) ?? defaultStoreKind();
}

export function taskStoreKind(): StoreKind {
  return parseKind(process.env.TASK_STORE) ?? defaultStoreKind();
}
