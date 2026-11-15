/** Spec 09: batch similar two-way, low-stakes waiting decisions. */

import { addDaysYmd } from "./dates";
import { parkRevisitDays } from "./sort";
import type { CostOfDelay, DoorType } from "./brief";

export type BatchRow = {
  id: string;
  item: string;
  status?: string | null;
  project?: string | null;
  doorType?: DoorType | null;
  costOfDelay?: CostOfDelay | null;
  needsSplit?: boolean | null;
  revisitState?: string | null;
  batchKey?: string | null;
};

export function validateBatchKey(value: unknown): { ok: true; value: string | null } | { ok: false; error: string } {
  if (value === undefined || value === null) return { ok: true, value: null };
  if (typeof value !== "string") return { ok: false, error: "batch_key must be a string" };
  const trimmed = value.trim();
  if (!trimmed) return { ok: true, value: null };
  if (trimmed.length > 64) return { ok: false, error: "batch_key must be at most 64 characters" };
  if (!/^[a-zA-Z0-9_.:-]+$/.test(trimmed)) {
    return { ok: false, error: "batch_key may only use letters, numbers, and _.:-" };
  }
  return { ok: true, value: trimmed };
}

export function batchEligible(row: BatchRow, waitingStatus: string): boolean {
  if (row.status !== waitingStatus) return false;
  if (row.needsSplit) return false;
  if (row.revisitState === "expired") return false;
  if (row.doorType !== "two_way") return false;
  if (row.costOfDelay !== "low") return false;
  return true;
}

export function batchGroupKey(row: BatchRow): string {
  const key = (row.batchKey ?? "").trim();
  if (key) return `key:${key}`;
  return `area:${row.project ?? "Unassigned"}`;
}

export function batchGroups(rows: BatchRow[], waitingStatus: string): { id: string; label: string; rows: BatchRow[] }[] {
  const map = new Map<string, BatchRow[]>();
  for (const row of rows) {
    if (!batchEligible(row, waitingStatus)) continue;
    const id = batchGroupKey(row);
    const list = map.get(id) ?? [];
    list.push(row);
    map.set(id, list);
  }
  return [...map.entries()]
    .filter(([, list]) => list.length >= 2)
    .map(([id, list]) => ({
      id,
      label: id.startsWith("key:") ? id.slice(4) : (list[0]?.project ?? "Unassigned"),
      rows: list,
    }));
}

export function batchParkDate(today: string, env: Record<string, string | undefined> = process.env): string {
  return addDaysYmd(today, parkRevisitDays(env));
}
