/** Spec 05: apply a stored default only for tagged two-way, low-stakes items. Off by default. */

import { addDaysYmd, isOverdueYmd, isYmd } from "./dates";
import { DEFAULT_PARK_REVISIT_DAYS, parkRevisitDays } from "./sort";
import type { CostOfDelay, DefaultChoice, DefaultIfNoAnswer, DoorType } from "./brief";

export const TIMEOUT_CLASSES = ["off", "two_way+low"] as const;
export type TimeoutClass = (typeof TIMEOUT_CLASSES)[number];

export type AppliedBy = "owner" | "timeout" | "auto";

export type TimeoutRow = {
  status?: string | null;
  lastChoice?: string | null;
  doorType?: DoorType | null;
  costOfDelay?: CostOfDelay | null;
  deadline?: string | null;
  defaultIfNoAnswer?: DefaultIfNoAnswer | null;
  needsSplit?: boolean | null;
  agentTimeoutTagged?: boolean | null;
  timeoutEligibleOverride?: boolean | null;
  appliedBy?: AppliedBy | null;
  timeoutAppliedAt?: string | null;
};

export function parseTimeoutDefaults(env: Record<string, string | undefined> = process.env): TimeoutClass {
  const raw = (env.TIMEOUT_DEFAULTS ?? "off").trim().toLowerCase();
  if (raw === "two_way+low" || raw === "two_way_low" || raw === "two+way+low") return "two_way+low";
  return "off";
}

export function timeoutClassOn(env: Record<string, string | undefined> = process.env): boolean {
  return parseTimeoutDefaults(env) === "two_way+low";
}

/** Private live data never applies unless TIMEOUT_DEFAULTS_LIVE=1 (owner approval). */
export function timeoutLiveAllowed(env: Record<string, string | undefined> = process.env): boolean {
  return (env.TIMEOUT_DEFAULTS_LIVE ?? "").trim() === "1";
}

/** Class on, and never on live Notion unless TIMEOUT_DEFAULTS_LIVE=1. */
export function mayApplyTimeouts(env: Record<string, string | undefined> = process.env): boolean {
  if (!timeoutClassOn(env)) return false;
  const source = (env.DECISION_SOURCE ?? "").toLowerCase();
  if (source === "notion" && !timeoutLiveAllowed(env)) return false;
  return true;
}

export function agentTaggedTimeoutFields(row: {
  doorType?: DoorType | null;
  costOfDelay?: CostOfDelay | null;
  deadline?: string | null;
  defaultIfNoAnswer?: DefaultIfNoAnswer | null;
}): boolean {
  return (
    row.doorType === "two_way" &&
    row.costOfDelay === "low" &&
    Boolean(row.deadline && isYmd(row.deadline)) &&
    Boolean(row.defaultIfNoAnswer?.choice)
  );
}

function usableDefault(row: TimeoutRow): DefaultChoice | null {
  const choice = row.defaultIfNoAnswer?.choice;
  if (choice === "Approve" || choice === "Decline" || choice === "Park") return choice;
  return null;
}

export function timeoutGateReason(
  row: TimeoutRow,
  today: string,
  waitingStatus: string,
  opts: { classOn: boolean; threadIdle?: boolean },
): string | null {
  if (!opts.classOn) return "class_off";
  if (row.appliedBy === "timeout" || row.timeoutAppliedAt) return "already_applied";
  if (row.status !== waitingStatus) return "not_waiting";
  if (row.needsSplit) return "needs_split";
  if (row.lastChoice === "Discuss" && opts.threadIdle === false) return "discuss_open";
  if (row.doorType !== "two_way") return "door";
  if (row.costOfDelay !== "low") return "cost";
  if (!usableDefault(row)) return "no_default";
  if (!row.deadline || !isYmd(row.deadline)) return "no_deadline";
  if (!row.agentTimeoutTagged && !row.timeoutEligibleOverride) return "not_tagged";
  return null;
}

export function timeoutNoticeTomorrow(
  row: TimeoutRow,
  today: string,
  waitingStatus: string,
  opts: { classOn: boolean; threadIdle?: boolean },
): boolean {
  if (timeoutGateReason(row, today, waitingStatus, opts)) return false;
  return row.deadline === today;
}

export function timeoutReadyToApply(
  row: TimeoutRow,
  today: string,
  waitingStatus: string,
  opts: { classOn: boolean; threadIdle?: boolean },
): boolean {
  if (timeoutGateReason(row, today, waitingStatus, opts)) return false;
  return isOverdueYmd(row.deadline ?? null, today);
}

export function timeoutParkRevisitAt(applyDay: string, days = DEFAULT_PARK_REVISIT_DAYS): string {
  return addDaysYmd(applyDay, days);
}

export type TimeoutApply = {
  choice: DefaultChoice;
  note: string;
  appliedBy: "timeout";
  timeoutAppliedAt: string;
  timeoutAppliedChoice: DefaultChoice;
  revisitAt: string | null;
};

export function timeoutApplyPayload(
  row: TimeoutRow,
  today: string,
  atIso: string,
  env: Record<string, string | undefined> = process.env,
): TimeoutApply | null {
  const choice = usableDefault(row);
  if (!choice) return null;
  const note = row.defaultIfNoAnswer?.note?.trim() || "Default on timeout";
  return {
    choice,
    note,
    appliedBy: "timeout",
    timeoutAppliedAt: atIso,
    timeoutAppliedChoice: choice,
    revisitAt: choice === "Park" ? timeoutParkRevisitAt(today, parkRevisitDays(env)) : null,
  };
}
