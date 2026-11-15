import { deskTimezone } from "@/lib/env";

export const CHOICES = ["Approve", "Decline", "Discuss"] as const;
export type Choice = (typeof CHOICES)[number];

export const STATUS = {
  waiting: "Waiting on you",
  inFlight: "In flight",
  parked: "Parked",
  done: "Done",
} as const;

export type StatusName = (typeof STATUS)[keyof typeof STATUS];

export const SAVED_TOAST = "Saved. The lead agent will pick it up.";

const STATUS_BY_CHOICE: Record<Choice, StatusName> = {
  Approve: STATUS.inFlight,
  Decline: STATUS.parked,
  Discuss: STATUS.waiting,
};

export function isChoice(value: string): value is Choice {
  return (CHOICES as readonly string[]).includes(value);
}

export function statusForChoice(choice: Choice): StatusName {
  return STATUS_BY_CHOICE[choice];
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

export function formatReply(choice: Choice, note: string, at: Date): string {
  const iso = formatIsoInZone(at);
  const trimmed = note.trim();
  if (trimmed) {
    return `${choice} — ${trimmed} (via Decision Desk, ${iso})`;
  }
  return `${choice} — (via Decision Desk, ${iso})`;
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
  if (!first.startsWith(prefix) || !first.includes("via Decision Desk")) {
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
  };
}

export const STATUS_RANK: Record<string, number> = {
  [STATUS.waiting]: 0,
  [STATUS.inFlight]: 1,
  [STATUS.parked]: 2,
  [STATUS.done]: 3,
};

export function compareStatus(a: string | null, b: string | null): number {
  return (STATUS_RANK[a ?? ""] ?? 9) - (STATUS_RANK[b ?? ""] ?? 9);
}
