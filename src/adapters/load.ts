import type { AgentStore, DecisionSource } from "@/lib/types";
import type { TaskStore } from "@/lib/tasks/types";
import { decisionSourceKind, defaultStoreKind, taskStoreKind, type StoreKind } from "@/lib/stores";

function ledgerKind(): Exclude<StoreKind, "notion"> {
  const raw = (process.env.DESK_LEDGER ?? "").trim().toLowerCase();
  if (raw === "memory" || raw === "sqlite" || raw === "postgres") return raw;
  const fallback = defaultStoreKind();
  return fallback === "notion" ? "sqlite" : fallback;
}

export async function loadDecisionSource(): Promise<DecisionSource> {
  const kind = decisionSourceKind();
  switch (kind) {
    case "notion":
      return (await import("@/adapters/notion/decisions")).createNotionDecisionSource();
    case "postgres":
      return new (await import("@/adapters/postgres/stores")).PostgresDecisionSource();
    case "memory":
      return (await import("@/adapters/memory/decisions")).createMemoryDecisionSource();
    case "sqlite":
    default:
      return (await import("@/adapters/sqlite/decisions")).createSqliteDecisionSource();
  }
}

export async function loadTaskStore(): Promise<TaskStore> {
  const kind = taskStoreKind();
  switch (kind) {
    case "notion":
      return (await import("@/adapters/notion/tasks")).createNotionTaskStore();
    case "postgres":
      return new (await import("@/adapters/postgres/stores")).PostgresTaskStore();
    case "memory":
      return (await import("@/adapters/memory/tasks")).createMemoryTaskStore();
    case "sqlite":
    default:
      return (await import("@/adapters/sqlite/tasks")).createSqliteTaskStore();
  }
}

export async function loadAgentStore(): Promise<AgentStore> {
  const kind = ledgerKind();
  switch (kind) {
    case "postgres":
      return new (await import("@/adapters/postgres/stores")).PostgresAgentStore();
    case "memory":
      return (await import("@/adapters/memory/agents")).createMemoryAgentStore();
    case "sqlite":
    default:
      return (await import("@/adapters/sqlite/agents")).createSqliteAgentStore();
  }
}
