/** Spec 07: daily decision session cap and unscored Done-today ledger. */

import { isYmd, todayYmd } from "./dates";

export const DEFAULT_SESSION_CAP = 5;
export const COUNTED_SESSION_CHOICES = ["Approve", "Decline", "Park"] as const;
export type CountedSessionChoice = (typeof COUNTED_SESSION_CHOICES)[number];

export type SessionLine = {
  id: string;
  item: string;
  choice: string;
  appliedBy: "owner" | "timeout" | "auto" | null;
  at: string;
  sentence: string;
  counts: boolean;
};

export function parseSessionCap(env: Record<string, string | undefined> = process.env): number {
  const raw = Number.parseInt((env.SESSION_CAP ?? "").trim(), 10);
  if (Number.isInteger(raw) && raw >= 1 && raw < 10_000) return raw;
  return DEFAULT_SESSION_CAP;
}

export function localDay(iso: string | null | undefined, timeZone?: string): string | null {
  if (!iso) return null;
  if (isYmd(iso.slice(0, 10)) && iso.length === 10) return iso.slice(0, 10);
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return todayYmd(date, timeZone);
}

export function mondayOfWeek(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  const weekday = date.getUTCDay(); // 0 Sun
  const offset = weekday === 0 ? 6 : weekday - 1;
  date.setUTCDate(date.getUTCDate() - offset);
  return date.toISOString().slice(0, 10);
}

export function countsTowardSession(input: {
  choice: string;
  keepParked?: boolean;
  reopen?: boolean;
  split?: boolean;
  discuss?: boolean;
  overrideOnly?: boolean;
}): boolean {
  if (input.keepParked || input.reopen || input.split || input.discuss || input.overrideOnly) return false;
  return input.choice === "Approve" || input.choice === "Decline" || input.choice === "Park";
}

export function sessionSentence(input: {
  choice: string;
  item: string;
  appliedBy?: "owner" | "timeout" | "auto" | null;
  revisitAt?: string | null;
  reversed?: boolean;
}): string {
  const title = input.item.replace(/^Example:\s*/i, "");
  if (input.reversed) return `Reversed default on ‘${title}’.`;
  if (input.choice === "Park" && input.revisitAt) {
    return `Parked ‘${title}’ until ${prettyDay(input.revisitAt)}.`;
  }
  const verb =
    input.choice === "Approve" ? "Approved" : input.choice === "Decline" ? "Declined" : input.choice === "Park" ? "Parked" : input.choice;
  const via =
    input.appliedBy === "timeout"
      ? " (default on timeout)"
      : input.appliedBy === "auto"
        ? " (auto)"
        : "";
  return `${verb} ‘${title}’${via}.`;
}

function prettyDay(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
}

export function sessionForDay(
  lines: SessionLine[],
  today: string,
  cap: number,
  timeZone?: string,
): { date: string; cap: number; used: number; remaining: number; doneToday: SessionLine[]; complete: boolean } {
  const doneToday = lines.filter((line) => localDay(line.at, timeZone) === today);
  const used = doneToday.filter((line) => line.counts).length;
  const remaining = Math.max(0, cap - used);
  return { date: today, cap, used, remaining, doneToday, complete: remaining === 0 };
}

export function doneThisWeekCount(
  rows: { status?: string | null; lastUpdated?: string | null }[],
  today: string,
  doneStatus: string,
  timeZone?: string,
): number {
  const start = mondayOfWeek(today);
  return rows.filter((row) => {
    if (row.status !== doneStatus) return false;
    const day = localDay(row.lastUpdated, timeZone);
    return Boolean(day && day >= start && day <= today);
  }).length;
}
