import "server-only";

import { loadDecisionSource } from "@/adapters/load";
import { applyReadHydration } from "../../contract";
import { compareStatus, STATUS } from "@/lib/decide";
import { idsEqual } from "@/lib/ids";
import { queueToday } from "@/lib/queue";
import type { BriefRow, Decision, DecisionSource, DeskBlock, DiscussionMessage } from "@/lib/types";

let cached: DecisionSource | null = null;

export async function decisionSource(): Promise<DecisionSource> {
  if (!cached) cached = await loadDecisionSource();
  return cached;
}

async function hydrateRow(source: DecisionSource, row: BriefRow): Promise<BriefRow> {
  const { row: next, persist } = applyReadHydration(row, queueToday(), {
    waiting: STATUS.waiting,
    parked: STATUS.parked,
  });
  if (!persist) return next;
  try {
    return await source.patch(row.id, persist);
  } catch {
    return next;
  }
}

export async function listRows(): Promise<BriefRow[]> {
  const source = await decisionSource();
  const rows = await Promise.all((await source.list()).map((row) => hydrateRow(source, row)));
  return [...rows].sort((a, b) => {
    const status = compareStatus(a.status, b.status);
    if (status !== 0) return status;
    return (b.lastUpdated ?? "").localeCompare(a.lastUpdated ?? "");
  });
}

export async function getRow(id: string): Promise<BriefRow | null> {
  const source = await decisionSource();
  const row = await source.get(id);
  if (!row) return null;
  return hydrateRow(source, row);
}

export async function getRowBody(row: Decision): Promise<DeskBlock[]> {
  return (await decisionSource()).getBody(row);
}

export async function listDiscussion(id: string): Promise<DiscussionMessage[]> {
  return (await decisionSource()).listDiscussion(id);
}

export function neighbors(
  rows: BriefRow[],
  id: string,
): { prev: BriefRow | null; next: BriefRow | null } {
  const index = rows.findIndex((row) => idsEqual(row.id, id));
  if (index < 0) return { prev: null, next: null };
  return {
    prev: rows[index - 1] ?? null,
    next: rows[index + 1] ?? null,
  };
}

export function resetDecisionSourceCache(): void {
  cached = null;
}
