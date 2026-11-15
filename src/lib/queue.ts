import {
  compareParked,
  compareWaiting,
  queueOrderHint,
  resolveQueueSort,
  todayYmd,
  type QueueSort,
} from "../../contract";
import { deskTimezone } from "@/lib/env";
import { STATUS, compareStatus } from "@/lib/decide";
import type { BriefRow } from "@/lib/types";

export function queueSort(): QueueSort {
  return resolveQueueSort(
    {
      QUEUE_SORT: process.env.QUEUE_SORT,
      NEXT_PUBLIC_QUEUE_SORT: process.env.NEXT_PUBLIC_QUEUE_SORT,
    },
    "stakes",
  );
}

export function queueToday(now = new Date()): string {
  return todayYmd(now, deskTimezone());
}

export { queueOrderHint };

export function displayTitle(item: string): string {
  return item;
}

type Ymd = { y: number; m: number; d: number };

function zoneDate(date: Date): Ymd {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: deskTimezone(),
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
      .formatToParts(date)
      .map((part) => [part.type, part.value]),
  ) as Record<string, string>;
  return { y: Number(parts.year), m: Number(parts.month), d: Number(parts.day) };
}

export function toPtDate(value: string | null | undefined): Ymd | null {
  if (!value) return null;
  const bare = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (bare) return { y: Number(bare[1]), m: Number(bare[2]), d: Number(bare[3]) };
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return zoneDate(parsed);
}

export function ageDays(
  lastUpdated: string | null | undefined,
  now: Date = new Date(),
): number | null {
  const then = toPtDate(lastUpdated);
  if (!then) return null;
  const today = zoneDate(now);
  const diff =
    (Date.UTC(today.y, today.m - 1, today.d) - Date.UTC(then.y, then.m - 1, then.d)) /
    86_400_000;
  return Math.max(0, Math.round(diff));
}

export function cardAge(row: BriefRow, now: Date): string {
  const days = ageDays(row.lastUpdated, now);
  if (days === null) return "";
  const waiting = isWaiting(row);
  if (days === 0) return waiting ? "Waiting since today" : "Updated today";
  const span = `${days} ${days === 1 ? "day" : "days"}`;
  return waiting ? `Waiting ${span}` : `Updated ${span} ago`;
}

export function formatAge(days: number | null): string {
  if (days === null) return "";
  if (days === 0) return "today";
  return `${days}d`;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function shortDate(value: string | null | undefined, now: Date = new Date()): string {
  const date = toPtDate(value);
  if (!date) return "";
  const label = `${MONTHS[date.m - 1]} ${date.d}`;
  return date.y === zoneDate(now).y ? label : `${label}, ${date.y}`;
}

export function isWaiting(row: BriefRow): boolean {
  return row.status === STATUS.waiting;
}

export function waitingQueue(rows: BriefRow[], sort: QueueSort = queueSort(), today = queueToday()): BriefRow[] {
  return rows.filter(isWaiting).sort((a, b) => compareWaiting(a, b, sort, today));
}

export function parkedQueue(rows: BriefRow[]): BriefRow[] {
  return rows
    .filter((row) => row.status === STATUS.parked)
    .sort((a, b) => compareParked(a, b));
}

export function othersByArea(rows: BriefRow[]): { area: string; rows: BriefRow[] }[] {
  const map = new Map<string, BriefRow[]>();
  for (const row of rows) {
    if (isWaiting(row)) continue;
    const area = row.project ?? "Unassigned";
    const list = map.get(area) ?? [];
    list.push(row);
    map.set(area, list);
  }
  return [...map.entries()]
    .map(([area, grouped]) => ({
      area,
      rows: [...grouped].sort(
        (a, b) =>
          compareStatus(a.status, b.status) ||
          (b.lastUpdated ?? "").localeCompare(a.lastUpdated ?? ""),
      ),
    }))
    .sort((a, b) => a.area.localeCompare(b.area));
}

export function deskOrder(rows: BriefRow[]): BriefRow[] {
  return [...waitingQueue(rows), ...othersByArea(rows).flatMap((group) => group.rows)];
}

export function waitingAreaCounts(rows: BriefRow[]): { area: string; count: number }[] {
  const map = new Map<string, number>();
  for (const row of rows) {
    const area = row.project ?? "Unassigned";
    map.set(area, (map.get(area) ?? 0) + (isWaiting(row) ? 1 : 0));
  }
  return [...map.entries()]
    .map(([area, count]) => ({ area, count }))
    .sort((a, b) => b.count - a.count || a.area.localeCompare(b.area));
}
