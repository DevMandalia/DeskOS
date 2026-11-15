import { mkdirSync } from "node:fs";
import path from "node:path";

import { sqlitePath } from "@/lib/env";
import {
  DEMO_TASK_AREAS,
  DEMO_TASK_STATUSES,
  demoAgents,
  demoBodies,
  demoDecisions,
  demoTasks,
} from "@/lib/seed";
import { briefJsonOf, hydrateStoredDecision } from "@/lib/brief-fields";
import type { Agent, AgentRef, Decision, DeskBlock, DiscussionMessage } from "@/lib/types";
import { spansFromPlain } from "@/lib/rich";
import type { Task } from "@/lib/tasks/types";
import { parseChoiceFromReply, type VerdictChoice } from "../../../contract";

type DatabaseSync = {
  exec(sql: string): void;
  prepare(sql: string): {
    run(...params: unknown[]): void;
    get(...params: unknown[]): Record<string, unknown> | undefined;
    all(...params: unknown[]): Record<string, unknown>[];
  };
  close(): void;
};

const g = globalThis as unknown as { __deskSqlite?: DatabaseSync; __deskSqlitePath?: string };

function openDatabase(file: string): DatabaseSync {
  // Built-in in Node 22+. Kept behind a require so Next's bundler doesn't rewrite it.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { DatabaseSync } = require("node:sqlite") as {
    DatabaseSync: new (path: string) => DatabaseSync;
  };
  mkdirSync(path.dirname(file), { recursive: true });
  return new DatabaseSync(file);
}

const SCHEMA = `
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
  rank REAL,
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

function raised(row: {
  raised_by_id?: unknown;
  raised_by_name?: unknown;
  parent_id?: unknown;
  parent_name?: unknown;
}): AgentRef | null {
  if (!row.raised_by_id || !row.raised_by_name) return null;
  return {
    id: String(row.raised_by_id),
    name: String(row.raised_by_name),
    parentId: row.parent_id ? String(row.parent_id) : null,
    parentName: row.parent_name ? String(row.parent_name) : null,
  };
}

export function decisionFromRow(row: Record<string, unknown>): Decision {
  const r = raised(row);
  const reply = (row.reply as string | null) ?? null;
  const lastChoice =
    (row.last_choice as VerdictChoice | null) ?? parseChoiceFromReply(reply);
  return hydrateStoredDecision(
    {
      id: String(row.id),
      url: String(row.url),
      item: String(row.item),
      project: (row.project as string | null) ?? null,
      status: (row.status as string | null) ?? null,
      owner: (row.owner as string | null) ?? r?.name ?? null,
      ownerColor: (row.owner_color as string | null) ?? null,
      decisionNeeded: (row.decision_needed as string | null) ?? null,
      nextStep: (row.next_step as string | null) ?? null,
      source: (row.source as string | null) ?? null,
      reply,
      lastUpdated: (row.last_updated as string | null) ?? null,
      createdAt: (row.created_at as string | null) ?? null,
      raisedBy: r,
      lastChoice,
    },
    row.brief_json == null ? null : String(row.brief_json),
  );
}

export function taskFromRow(row: Record<string, unknown>): Task {
  const r = raised(row);
  return {
    id: String(row.id),
    url: String(row.url),
    title: String(row.title),
    status: (row.status as string | null) ?? null,
    area: (row.area as string | null) ?? null,
    areaColor: (row.area_color as string | null) ?? null,
    due: (row.due as string | null) ?? null,
    priority: (row.priority as string | null) ?? null,
    owner: (row.owner as string | null) ?? r?.name ?? null,
    rank: typeof row.rank === "number" ? row.rank : null,
    lastEdited: (row.last_edited as string | null) ?? null,
    raisedBy: r,
  };
}

export function agentFromRow(row: Record<string, unknown>): Agent {
  return {
    id: String(row.id),
    name: String(row.name),
    role: row.role === "sub" ? "sub" : "lead",
    parentId: (row.parent_id as string | null) ?? null,
    keyPrefix: String(row.key_prefix),
    keyHash: String(row.key_hash),
    webhookUrl: (row.webhook_url as string | null) ?? null,
    webhookSecret: (row.webhook_secret as string | null) ?? null,
    createdAt: String(row.created_at),
    revokedAt: (row.revoked_at as string | null) ?? null,
  };
}

export function messageFromRow(row: Record<string, unknown>): DiscussionMessage {
  return {
    id: String(row.id),
    decisionId: String(row.decision_id),
    author: row.author === "agent" ? "agent" : "owner",
    agentId: (row.agent_id as string | null) ?? null,
    agentName: (row.agent_name as string | null) ?? null,
    body: String(row.body),
    at: String(row.at),
  };
}

function ensureBriefColumn(db: DatabaseSync): void {
  const cols = db.prepare("PRAGMA table_info(decisions)").all();
  if (!cols.some((col) => String(col.name) === "brief_json")) {
    db.exec("ALTER TABLE decisions ADD COLUMN brief_json TEXT");
  }
  if (!cols.some((col) => String(col.name) === "created_at")) {
    db.exec("ALTER TABLE decisions ADD COLUMN created_at TEXT");
  }
}

function seedIfEmpty(db: DatabaseSync): void {
  const count = db.prepare("SELECT COUNT(*) AS n FROM decisions").get() as { n: number };
  if (count.n > 0) return;
  db.prepare("INSERT OR IGNORE INTO meta (key, value) VALUES (?, ?)").run(
    "task_statuses",
    JSON.stringify(DEMO_TASK_STATUSES),
  );
  db.prepare("INSERT OR IGNORE INTO meta (key, value) VALUES (?, ?)").run(
    "task_areas",
    JSON.stringify(DEMO_TASK_AREAS),
  );
  for (const a of demoAgents()) {
    db.prepare(
      `INSERT INTO agents (id, name, role, parent_id, key_prefix, key_hash, webhook_url, webhook_secret, created_at, revoked_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      a.id,
      a.name,
      a.role,
      a.parentId,
      a.keyPrefix,
      a.keyHash,
      a.webhookUrl,
      a.webhookSecret,
      a.createdAt,
      a.revokedAt,
    );
  }
  const bodies = demoBodies();
  for (const d of demoDecisions()) {
    const body = bodies[d.id]
      ? JSON.stringify([{ id: `${d.id}-p`, type: "paragraph", rich: spansFromPlain(bodies[d.id]) } satisfies DeskBlock])
      : null;
    db.prepare(
      `INSERT INTO decisions (id, url, item, project, status, owner, owner_color, decision_needed, next_step, source, reply, last_updated, last_choice, raised_by_id, raised_by_name, parent_id, parent_name, body_json, brief_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      d.id,
      d.url,
      d.item,
      d.project,
      d.status,
      d.owner,
      d.ownerColor,
      d.decisionNeeded,
      d.nextStep,
      d.source,
      d.reply,
      d.lastUpdated,
      d.lastChoice,
      d.raisedBy?.id ?? null,
      d.raisedBy?.name ?? null,
      d.raisedBy?.parentId ?? null,
      d.raisedBy?.parentName ?? null,
      body,
      briefJsonOf(d),
      d.createdAt ?? d.lastUpdated,
    );
  }
  for (const t of demoTasks()) {
    db.prepare(
      `INSERT INTO tasks (id, url, title, status, area, area_color, due, priority, owner, rank, last_edited, raised_by_id, raised_by_name, parent_id, parent_name)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      t.id,
      t.url,
      t.title,
      t.status,
      t.area,
      t.areaColor,
      t.due,
      t.priority,
      t.owner,
      t.rank,
      t.lastEdited,
      t.raisedBy?.id ?? null,
      t.raisedBy?.name ?? null,
      t.raisedBy?.parentId ?? null,
      t.raisedBy?.parentName ?? null,
    );
  }
}

export function sqliteDb(file = sqlitePath()): DatabaseSync {
  if (g.__deskSqlite && g.__deskSqlitePath === file) return g.__deskSqlite;
  const db = openDatabase(file);
  db.exec(SCHEMA);
  ensureBriefColumn(db);
  seedIfEmpty(db);
  g.__deskSqlite = db;
  g.__deskSqlitePath = file;
  return db;
}

export function resetSqlite(file: string): DatabaseSync {
  if (g.__deskSqlite && g.__deskSqlitePath === file) {
    try {
      g.__deskSqlite.close();
    } catch {
      /* ignore */
    }
  }
  g.__deskSqlite = undefined;
  g.__deskSqlitePath = undefined;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { unlinkSync } = require("node:fs") as { unlinkSync: (p: string) => void };
  try {
    unlinkSync(file);
  } catch {
    /* ignore */
  }
  return sqliteDb(file);
}

export function metaJson<T>(db: DatabaseSync, key: string, fallback: T): T {
  const row = db.prepare("SELECT value FROM meta WHERE key = ?").get(key);
  if (!row) return fallback;
  try {
    return JSON.parse(String(row.value)) as T;
  } catch {
    return fallback;
  }
}
