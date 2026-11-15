import { VERDICT_CHOICES, isVerdictChoice, verdictBucket, type VerdictChoice } from "../../contract";
import { deskTimezone } from "@/lib/env";

export const CHOICES = VERDICT_CHOICES;
export type Choice = VerdictChoice;

export const STATUS = {
  waiting: "Waiting on you",
  inFlight: "In flight",
  parked: "Parked",
  declined: "Declined",
  done: "Done",
} as const;

export type StatusName = (typeof STATUS)[keyof typeof STATUS];

export const SAVED_TOAST = "Saved. The lead agent will pick it up.";

const STATUS_BY_BUCKET = {
  in_flight: STATUS.inFlight,
  declined: STATUS.declined,
  parked: STATUS.parked,
  waiting: STATUS.waiting,
} as const;

export function isChoice(value: string): value is Choice {
  return isVerdictChoice(value);
}

export function statusForChoice(choice: Choice): StatusName {
  return STATUS_BY_BUCKET[verdictBucket(choice)];
}

export function normalizeOffset(timeZoneName: string): string {
  const m = timeZoneName
    .replace("UTC", "GMT")
    .match(/GMT([+-])(\d{1,2})(?::?(\d{2}))?/);
  if (!m) return "-08:00";
  const sign = m[1];
  const hh = m[2].padStart(2, "0");
  const mm = (m[3] ?? "00").padStart(2, "0");
  return `${sign}${hh}:${mm}`;
}

export function formatIsoInZone(date: Date, timeZone = deskTimezone()): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
      timeZoneName: "shortOffset",
    })
      .formatToParts(date)
      .map((part) => [part.type, part.value]),
  ) as Record<string, string>;

  const offset = normalizeOffset(parts.timeZoneName ?? "GMT-08:00");
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}${offset}`;
}

/** @deprecated Use formatIsoInZone. */
export function formatIsoPT(date: Date): string {
  return formatIsoInZone(date, "America/Los_Angeles");
}

export function formatReply(
  choice: Choice,
  note: string,
  at: Date,
  extra?: { revisitAt?: string | null },
): string {
  const iso = formatIsoInZone(at);
  const trimmed = note.trim();
  const revisit =
    choice === "Park" && extra?.revisitAt ? ` (revisit ${extra.revisitAt})` : "";
  if (trimmed) {
    return `${choice} — ${trimmed}${revisit} (via DeskOS, ${iso})`;
  }
  return `${choice} —${revisit} (via DeskOS, ${iso})`;
}

export function prependReply(
  existing: string | null | undefined,
  incoming: string,
): string {
  const prev = (existing ?? "").trim();
  if (!prev) return incoming;
  return `${incoming}\n${prev}`;
}

export function isDuplicateReply(
  existing: string | null | undefined,
  choice: Choice,
  note: string,
  now = Date.now(),
): boolean {
  if (!existing) return false;
  const first = existing.split("\n")[0]?.trim() ?? "";
  const trimmed = note.trim();
  const prefix = trimmed ? `${choice} — ${trimmed} (` : `${choice} — (`;
  if (!first.startsWith(prefix) || !first.includes("via DeskOS")) {
    return false;
  }
  const stamp = first.match(/(\d{4}-\d{2}-\d{2}T[0-9:+-]+)\)$/);
  if (!stamp) return true;
  const then = Date.parse(stamp[1]);
  if (Number.isNaN(then)) return true;
  return now - then < 120_000;
}

export type NotifyPayload = {
  row_id: string;
  url: string;
  item: string;
  project: string | null;
  owner: string | null;
  choice: Choice;
  note: string;
  at: string;
  agent_id?: string | null;
  revisit_at?: string | null;
};

export type NotifyBody = NotifyPayload & { type: "desk_decision" };

export function buildNotifyPayload(input: NotifyPayload): NotifyBody {
  return {
    type: "desk_decision",
    row_id: input.row_id,
    url: input.url,
    item: input.item,
    project: input.project,
    owner: input.owner,
    choice: input.choice,
    note: input.note,
    at: input.at,
    agent_id: input.agent_id ?? null,
    revisit_at: input.revisit_at ?? null,
  };
}

export const STATUS_RANK: Record<string, number> = {
  [STATUS.waiting]: 0,
  [STATUS.inFlight]: 1,
  [STATUS.parked]: 2,
  [STATUS.done]: 3,
  [STATUS.declined]: 4,
};

export function isClosedStatus(status: string | null | undefined): boolean {
  return status === STATUS.done || status === STATUS.declined;
}

export function compareStatus(a: string | null, b: string | null): number {
  return (STATUS_RANK[a ?? ""] ?? 9) - (STATUS_RANK[b ?? ""] ?? 9);
}
