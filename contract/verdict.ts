import { isFutureOrTodayYmd, isOverdueYmd, parseYmd } from "./dates";
import { assessSplit } from "./split";
import type { DecisionBrief } from "./brief";

export const VERDICT_CHOICES = ["Approve", "Decline", "Park", "Discuss"] as const;
export type VerdictChoice = (typeof VERDICT_CHOICES)[number];

/** Owner actions including revisit follow-ups and send-back. */
export const OWNER_ACTIONS = ["Approve", "Decline", "Park", "Discuss", "Reopen", "Split", "OneDecision"] as const;
export type OwnerAction = (typeof OWNER_ACTIONS)[number];

export type VerdictBucket = "in_flight" | "declined" | "parked" | "waiting";
export type RevisitState = "scheduled" | "expired";

export function isVerdictChoice(value: string): value is VerdictChoice {
  return (VERDICT_CHOICES as readonly string[]).includes(value);
}

export function isOwnerAction(value: string): value is OwnerAction {
  return (OWNER_ACTIONS as readonly string[]).includes(value);
}

export function verdictBucket(choice: VerdictChoice): VerdictBucket {
  if (choice === "Approve") return "in_flight";
  if (choice === "Decline") return "declined";
  if (choice === "Park") return "parked";
  return "waiting";
}

/** get_verdict.closed is true only for Approve or Decline. */
export function isClosedChoice(choice: string | null | undefined): boolean {
  return choice === "Approve" || choice === "Decline";
}

export function parseRevisitFromReply(reply: string | null | undefined): string | null {
  if (!reply) return null;
  const first = reply.split("\n")[0] ?? "";
  const match = first.match(/\brevisit (\d{4}-\d{2}-\d{2})\b/i);
  return match ? match[1] : null;
}

export function parseChoiceFromReply(reply: string | null | undefined): VerdictChoice | null {
  if (!reply) return null;
  const first = (reply.split("\n")[0] ?? "").trim();
  for (const choice of VERDICT_CHOICES) {
    if (first.startsWith(`${choice} —`) || first.startsWith(`${choice} -`)) return choice;
  }
  return null;
}

export function validateParkDate(
  value: unknown,
  today: string,
): { ok: true; value: string } | { ok: false; error: string } {
  const ymd = parseYmd(value);
  if (!ymd) return { ok: false, error: "revisit_at must be YYYY-MM-DD" };
  if (!isFutureOrTodayYmd(ymd, today)) return { ok: false, error: "revisit_at must be today or a future date" };
  return { ok: true, value: ymd };
}

export type HydrationPatch = {
  status?: string;
  revisitState?: RevisitState | null;
  needsSplit?: boolean;
  splitReason?: string | null;
};

export function expireParkIfNeeded(
  row: {
    status?: string | null;
    revisitAt?: string | null;
    revisitState?: RevisitState | null;
  },
  today: string,
  waitingStatus: string,
  parkedStatus: string,
): HydrationPatch | null {
  if (row.status !== parkedStatus) return null;
  if (!row.revisitAt) return null;
  if (row.revisitState && row.revisitState !== "scheduled") return null;
  if (!isOverdueYmd(row.revisitAt, today)) return null;
  return { status: waitingStatus, revisitState: "expired" };
}

export function flagSplitIfNeeded(row: {
  item: string;
  decisionNeeded?: string | null;
  nextStep?: string | null;
  options?: string[] | null;
  needsSplit?: boolean | null;
  splitReason?: string | null;
}): HydrationPatch | null {
  if (row.needsSplit === true || row.needsSplit === false) return null;
  const assessed = assessSplit({
    item: row.item,
    decisionNeeded: row.decisionNeeded,
    nextStep: row.nextStep,
    hasOptions: Boolean(row.options?.length),
  });
  return { needsSplit: assessed.needsSplit, splitReason: assessed.splitReason };
}

export function applyReadHydration<T extends {
  item: string;
  status?: string | null;
  decisionNeeded?: string | null;
  nextStep?: string | null;
  options?: string[] | null;
  needsSplit?: boolean | null;
  splitReason?: string | null;
  revisitAt?: string | null;
  revisitState?: RevisitState | null;
}>(
  row: T,
  today: string,
  statuses: { waiting: string; parked: string },
): { row: T; persist: HydrationPatch | null } {
  const persist: HydrationPatch = {};
  const expired = expireParkIfNeeded(row, today, statuses.waiting, statuses.parked);
  if (expired) Object.assign(persist, expired);
  const flagged = flagSplitIfNeeded({ ...row, ...persist });
  if (flagged) Object.assign(persist, flagged);
  if (Object.keys(persist).length === 0) return { row, persist: null };
  return { row: { ...row, ...persist }, persist };
}

export function briefToRecord(brief: DecisionBrief): {
  options: string[] | null;
  recommendation: string | null;
  doorType: DecisionBrief["doorType"];
  costOfDelay: DecisionBrief["costOfDelay"];
  deadline: string | null;
  defaultIfNoAnswer: DecisionBrief["defaultIfNoAnswer"];
  briefOverrides: DecisionBrief["briefOverrides"];
  parentId: string | null;
  needsSplit: boolean | null;
  splitReason: string | null;
  splitSentBackAt: string | null;
  revisitAt: string | null;
  revisitState: RevisitState | null;
} {
  return {
    options: brief.options,
    recommendation: brief.recommendation,
    doorType: brief.doorType,
    costOfDelay: brief.costOfDelay,
    deadline: brief.deadline,
    defaultIfNoAnswer: brief.defaultIfNoAnswer,
    briefOverrides: brief.briefOverrides,
    parentId: brief.parentId,
    needsSplit: brief.needsSplit,
    splitReason: brief.splitReason,
    splitSentBackAt: brief.splitSentBackAt,
    revisitAt: brief.revisitAt,
    revisitState: brief.revisitState,
  };
}
