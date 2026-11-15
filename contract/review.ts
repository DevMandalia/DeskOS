/** Spec 08: backlog bankruptcy / weekly review. Never auto-delete. */

import { localDay } from "./session";
import { addDaysYmd, isOverdueYmd, isYmd } from "./dates";

export const DEFAULT_REVIEW_WAITING_DAYS = 14;
export const DEFAULT_REVIEW_TASK_DAYS = 30;
export const REVIEW_PAGE_SIZE = 5;

export function parseReviewWaitingDays(env: Record<string, string | undefined> = process.env): number {
  const raw = Number.parseInt((env.REVIEW_WAITING_DAYS ?? "").trim(), 10);
  if (Number.isInteger(raw) && raw >= 1) return raw;
  return DEFAULT_REVIEW_WAITING_DAYS;
}

export function parseReviewTaskDays(env: Record<string, string | undefined> = process.env): number {
  const raw = Number.parseInt((env.REVIEW_TASK_DAYS ?? "").trim(), 10);
  if (Number.isInteger(raw) && raw >= 1) return raw;
  return DEFAULT_REVIEW_TASK_DAYS;
}

export type ReviewKind = "split" | "incomplete_high" | "stale_waiting" | "stale_task" | "stale_chat" | "wip_overflow" | "expired_park";

export type ReviewItem = {
  id: string;
  kind: ReviewKind;
  title: string;
  reason: string;
  type: "decision" | "task" | "chat";
};

function daysAgo(ymd: string | null | undefined, today: string): number | null {
  if (!ymd || !isYmd(ymd.slice(0, 10))) return null;
  const start = ymd.slice(0, 10);
  let n = 0;
  let cursor = start;
  while (cursor < today && n < 10_000) {
    cursor = addDaysYmd(cursor, 1);
    n += 1;
  }
  return n;
}

export function reviewDecisionBucket(
  row: {
    id: string;
    item: string;
    status?: string | null;
    needsSplit?: boolean | null;
    doorType?: string | null;
    costOfDelay?: string | null;
    lastUpdated?: string | null;
    revisitState?: string | null;
  },
  today: string,
  waitingStatus: string,
  waitingDays: number,
): ReviewItem | null {
  if (row.needsSplit) {
    return { id: row.id, kind: "split", title: row.item, reason: "Needs split", type: "decision" };
  }
  if (row.revisitState === "expired") {
    return { id: row.id, kind: "expired_park", title: row.item, reason: "Expired park — already on Home", type: "decision" };
  }
  if (row.status !== waitingStatus) return null;
  const incompleteHigh =
    row.doorType === "one_way" || row.costOfDelay === "high" || row.costOfDelay === "medium";
  const age = daysAgo(localDay(row.lastUpdated) ?? row.lastUpdated?.slice(0, 10), today);
  const stale = age != null && age >= waitingDays;
  if (incompleteHigh && stale) {
    return { id: row.id, kind: "incomplete_high", title: row.item, reason: `Incomplete high-stakes · ${age} days`, type: "decision" };
  }
  if (stale) {
    return { id: row.id, kind: "stale_waiting", title: row.item, reason: `Stale waiting · ${age} days`, type: "decision" };
  }
  return null;
}

export function reviewChatBucket(
  chat: { id: string; title: string; status?: string; comeBackBy?: string; createdAt?: string; missedCount?: number },
  today: string,
  staleDays: number,
): ReviewItem | null {
  if (chat.status !== "open" && chat.status !== "resumed") return null;
  const missed = chat.missedCount ?? 0;
  const created = (chat.createdAt ?? "").slice(0, 10);
  const stale = missed >= 2 || (isYmd(created) && addDaysYmd(created, staleDays) <= today);
  if (!stale) return null;
  return { id: chat.id, kind: "stale_chat", title: chat.title, reason: "Suggest close — I won’t return", type: "chat" };
}

export function reviewTaskBucket(
  task: { id: string; title: string; due?: string | null; lastEdited?: string | null; createdAt?: string | null; status?: string | null },
  today: string,
  taskDays: number,
): ReviewItem | null {
  if (isOverdueYmd(task.due ?? null, today)) {
    return { id: task.id, kind: "stale_task", title: task.title, reason: `Overdue ${task.due}`, type: "task" };
  }
  if (task.due) return null;
  const stamp = (task.lastEdited ?? task.createdAt ?? "").slice(0, 10);
  const age = daysAgo(stamp, today);
  if (age != null && age > taskDays) {
    return { id: task.id, kind: "stale_task", title: task.title, reason: `No due date · ${age} days`, type: "task" };
  }
  return null;
}

const KIND_ORDER: ReviewKind[] = ["split", "incomplete_high", "stale_waiting", "stale_task", "stale_chat", "wip_overflow", "expired_park"];

export function sortReviewItems(items: ReviewItem[]): ReviewItem[] {
  return [...items].sort((a, b) => KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind));
}

export function reviewPage(items: ReviewItem[], offset = 0, size = REVIEW_PAGE_SIZE): ReviewItem[] {
  return sortReviewItems(items).slice(offset, offset + size);
}
