/** Optional decision brief. All raise fields optional so old agents keep working. */

import { isYmd, parseYmd } from "./dates";

export const DOOR_TYPES = ["one_way", "two_way"] as const;
export type DoorType = (typeof DOOR_TYPES)[number];

export const COST_LEVELS = ["high", "medium", "low"] as const;
export type CostOfDelay = (typeof COST_LEVELS)[number];

export const DEFAULT_CHOICES = ["Approve", "Decline", "Park"] as const;
export type DefaultChoice = (typeof DEFAULT_CHOICES)[number];

export type DefaultIfNoAnswer = {
  choice: DefaultChoice;
  note: string | null;
};

export type BriefOverrideField = "door_type" | "cost_of_delay" | "deadline";

export type BriefOverride = {
  field: BriefOverrideField;
  from: string | null;
  to: string | null;
  at: string;
  by: "owner";
};

export type DecisionBrief = {
  options: string[] | null;
  recommendation: string | null;
  doorType: DoorType | null;
  costOfDelay: CostOfDelay | null;
  deadline: string | null;
  defaultIfNoAnswer: DefaultIfNoAnswer | null;
  briefOverrides: BriefOverride[];
  parentId: string | null;
  needsSplit: boolean | null;
  splitReason: string | null;
  splitSentBackAt: string | null;
  revisitAt: string | null;
  revisitState: "scheduled" | "expired" | null;
  agentTimeoutTagged: boolean | null;
  timeoutEligibleOverride: boolean | null;
  timeoutAppliedAt: string | null;
  timeoutAppliedChoice: DefaultChoice | null;
  appliedBy: "owner" | "timeout" | "auto" | null;
  sessionCounted: boolean | null;
  batchKey: string | null;
};

export const EMPTY_BRIEF: DecisionBrief = {
  options: null,
  recommendation: null,
  doorType: null,
  costOfDelay: null,
  deadline: null,
  defaultIfNoAnswer: null,
  briefOverrides: [],
  parentId: null,
  needsSplit: null,
  splitReason: null,
  splitSentBackAt: null,
  revisitAt: null,
  revisitState: null,
  agentTimeoutTagged: null,
  timeoutEligibleOverride: null,
  timeoutAppliedAt: null,
  timeoutAppliedChoice: null,
  appliedBy: null,
  sessionCounted: null,
  batchKey: null,
};

export const INCOMPLETE_BRIEF_FIELDS = [
  "options",
  "recommendation",
  "door_type",
  "cost_of_delay",
  "deadline",
] as const;

export type FieldError = { field: string; error: string };

export function isDoorType(value: string | null | undefined): value is DoorType {
  return value === "one_way" || value === "two_way";
}

export function isCostOfDelay(value: string | null | undefined): value is CostOfDelay {
  return value === "high" || value === "medium" || value === "low";
}

export function isDefaultChoice(value: string | null | undefined): value is DefaultChoice {
  return value === "Approve" || value === "Decline" || value === "Park";
}

function present(value: unknown): boolean {
  return value !== undefined && value !== null && value !== "";
}

function trimString(value: unknown): string {
  return String(value).trim();
}

/** Validate options when the field is present. Empty array → stored null (ok). */
export function validateOptions(value: unknown): { ok: true; value: string[] | null } | { ok: false; error: string } {
  if (!present(value) || (Array.isArray(value) && value.length === 0)) {
    return { ok: true, value: null };
  }
  let items: string[];
  if (Array.isArray(value)) {
    items = value.map((item) => String(item).trim()).filter(Boolean);
  } else if (typeof value === "string") {
    items = value
      .split(/\n|;/)
      .map((item) => item.replace(/^\s*[-*]\s*/, "").trim())
      .filter(Boolean);
  } else {
    return { ok: false, error: "options must be an array of strings or a newline/semicolon list" };
  }
  if (items.length === 0) return { ok: true, value: null };
  if (items.length < 2 || items.length > 7) {
    return { ok: false, error: "options must have 2–7 items" };
  }
  for (const item of items) {
    if (item.length < 1 || item.length > 200) {
      return { ok: false, error: "each option must be 1–200 characters" };
    }
  }
  const seen = new Set<string>();
  for (const item of items) {
    const key = item.toLowerCase();
    if (seen.has(key)) return { ok: false, error: "options must not contain duplicates" };
    seen.add(key);
  }
  return { ok: true, value: items };
}

export function validateRecommendation(value: unknown): { ok: true; value: string | null } | { ok: false; error: string } {
  if (!present(value)) return { ok: true, value: null };
  const text = trimString(value);
  if (!text) return { ok: true, value: null };
  if (text.length > 2000) return { ok: false, error: "recommendation must be at most 2000 characters" };
  return { ok: true, value: text };
}

export function validateDoorType(value: unknown): { ok: true; value: DoorType | null } | { ok: false; error: string } {
  if (!present(value)) return { ok: true, value: null };
  const raw = trimString(value);
  if (isDoorType(raw)) return { ok: true, value: raw };
  return { ok: false, error: 'door_type must be exactly "one_way" or "two_way"' };
}

export function validateCostOfDelay(value: unknown): { ok: true; value: CostOfDelay | null } | { ok: false; error: string } {
  if (!present(value)) return { ok: true, value: null };
  const raw = trimString(value);
  if (isCostOfDelay(raw)) return { ok: true, value: raw };
  return { ok: false, error: 'cost_of_delay must be exactly "high", "medium", or "low"' };
}

export function validateDeadline(value: unknown): { ok: true; value: string | null } | { ok: false; error: string } {
  if (!present(value)) return { ok: true, value: null };
  const ymd = parseYmd(value);
  if (!ymd) return { ok: false, error: "deadline must be YYYY-MM-DD" };
  return { ok: true, value: ymd };
}

export function validateDefaultIfNoAnswer(
  value: unknown,
): { ok: true; value: DefaultIfNoAnswer | null } | { ok: false; error: string } {
  if (value == null || value === "") return { ok: true, value: null };
  if (typeof value === "string") {
    const raw = value.trim();
    if (!raw) return { ok: true, value: null };
    if (isDefaultChoice(raw)) return { ok: true, value: { choice: raw, note: null } };
    return { ok: false, error: 'default_if_no_answer must be { choice: "Approve"|"Decline"|"Park", note? }' };
  }
  if (typeof value !== "object" || Array.isArray(value)) {
    return { ok: false, error: "default_if_no_answer must be an object" };
  }
  const src = value as Record<string, unknown>;
  if (!present(src.choice)) {
    return { ok: false, error: "default_if_no_answer.choice is required" };
  }
  const choice = trimString(src.choice);
  if (!isDefaultChoice(choice)) {
    return { ok: false, error: 'default_if_no_answer.choice must be "Approve", "Decline", or "Park"' };
  }
  let note: string | null = null;
  if (present(src.note)) {
    note = trimString(src.note);
    if (note.length > 500) return { ok: false, error: "default_if_no_answer.note must be at most 500 characters" };
    if (!note) note = null;
  }
  return { ok: true, value: { choice, note } };
}

export function validateNeedsSplit(value: unknown): { ok: true; value: boolean | undefined } | { ok: false; error: string } {
  if (value === undefined || value === null) return { ok: true, value: undefined };
  if (typeof value === "boolean") return { ok: true, value };
  return { ok: false, error: "needs_split must be a boolean" };
}

export type RaiseBody = {
  title?: string;
  item?: string;
  decision_needed?: string | null;
  next_step?: string | null;
  area?: string | null;
  project?: string | null;
  body?: unknown;
  options?: unknown;
  recommendation?: unknown;
  door?: unknown;
  door_type?: unknown;
  cost_of_delay?: unknown;
  default_if_no_answer?: unknown;
  default_if_timeout?: unknown;
  deadline?: unknown;
  parent_id?: unknown;
  needs_split?: unknown;
  batch_key?: unknown;
};

export type ParsedRaiseBrief = {
  options: string[] | null;
  recommendation: string | null;
  doorType: DoorType | null;
  costOfDelay: CostOfDelay | null;
  deadline: string | null;
  defaultIfNoAnswer: DefaultIfNoAnswer | null;
  parentId: string | null;
  needsSplit: boolean | undefined;
  batchKey: string | null;
};

export function parseRaiseBrief(body: RaiseBody): { ok: true; brief: ParsedRaiseBrief } | { ok: false; field: string; error: string } {
  const options = validateOptions(body.options);
  if (!options.ok) return { ok: false, field: "options", error: options.error };
  const recommendation = validateRecommendation(body.recommendation);
  if (!recommendation.ok) return { ok: false, field: "recommendation", error: recommendation.error };
  const door = validateDoorType(body.door_type ?? body.door);
  if (!door.ok) return { ok: false, field: "door_type", error: door.error };
  const cost = validateCostOfDelay(body.cost_of_delay);
  if (!cost.ok) return { ok: false, field: "cost_of_delay", error: cost.error };
  const deadline = validateDeadline(body.deadline);
  if (!deadline.ok) return { ok: false, field: "deadline", error: deadline.error };
  const def = validateDefaultIfNoAnswer(body.default_if_no_answer ?? body.default_if_timeout);
  if (!def.ok) return { ok: false, field: "default_if_no_answer", error: def.error };
  const split = validateNeedsSplit(body.needs_split);
  if (!split.ok) return { ok: false, field: "needs_split", error: split.error };
  let parentId: string | null = null;
  if (present(body.parent_id)) {
    parentId = trimString(body.parent_id);
    if (!parentId) parentId = null;
  }
  let batchKey: string | null = null;
  if (body.batch_key !== undefined && body.batch_key !== null) {
    if (typeof body.batch_key !== "string") {
      return { ok: false, field: "batch_key", error: "batch_key must be a string" };
    }
    const trimmed = body.batch_key.trim();
    if (trimmed) {
      if (trimmed.length > 64) return { ok: false, field: "batch_key", error: "batch_key must be at most 64 characters" };
      if (!/^[a-zA-Z0-9_.:-]+$/.test(trimmed)) {
        return { ok: false, field: "batch_key", error: "batch_key may only use letters, numbers, and _.:-" };
      }
      batchKey = trimmed;
    }
  }
  return {
    ok: true,
    brief: {
      options: options.value,
      recommendation: recommendation.value,
      doorType: door.value,
      costOfDelay: cost.value,
      deadline: deadline.value,
      defaultIfNoAnswer: def.value,
      parentId,
      needsSplit: split.value,
      batchKey,
    },
  };
}

function parseOverrides(raw: unknown): BriefOverride[] {
  if (!Array.isArray(raw)) return [];
  const out: BriefOverride[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const src = item as Record<string, unknown>;
    const field = src.field;
    if (field !== "door_type" && field !== "cost_of_delay" && field !== "deadline") continue;
    out.push({
      field,
      from: src.from == null ? null : String(src.from),
      to: src.to == null ? null : String(src.to),
      at: src.at == null ? "" : String(src.at),
      by: "owner",
    });
  }
  return out;
}

function parseStoredDoor(value: unknown): DoorType | null {
  if (!present(value)) return null;
  const raw = trimString(value);
  if (isDoorType(raw)) return raw;
  return null;
}

function parseStoredCost(value: unknown): CostOfDelay | null {
  if (!present(value)) return null;
  const raw = trimString(value);
  if (raw === "critical") return "high";
  if (isCostOfDelay(raw)) return raw;
  return null;
}

function parseStoredDefault(value: unknown): DefaultIfNoAnswer | null {
  const parsed = validateDefaultIfNoAnswer(value);
  return parsed.ok ? parsed.value : null;
}

export function briefFromUnknown(raw: unknown): DecisionBrief {
  const src =
    raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const options = validateOptions(src.options);
  const recommendation = validateRecommendation(src.recommendation);
  const door = parseStoredDoor(src.doorType ?? src.door_type ?? src.door);
  const cost = parseStoredCost(src.costOfDelay ?? src.cost_of_delay);
  const deadline = parseYmd(src.deadline);
  const def = parseStoredDefault(src.defaultIfNoAnswer ?? src.default_if_no_answer ?? src.defaultIfTimeout ?? src.default_if_timeout);
  let needsSplit: boolean | null = null;
  if (typeof src.needsSplit === "boolean") needsSplit = src.needsSplit;
  else if (typeof src.needs_split === "boolean") needsSplit = src.needs_split;
  const revisitState =
    src.revisitState === "scheduled" || src.revisitState === "expired"
      ? src.revisitState
      : src.revisit_state === "scheduled" || src.revisit_state === "expired"
        ? src.revisit_state
        : null;
  return {
    options: options.ok ? options.value : null,
    recommendation: recommendation.ok ? recommendation.value : null,
    doorType: door,
    costOfDelay: cost,
    deadline,
    defaultIfNoAnswer: def,
    briefOverrides: parseOverrides(src.briefOverrides ?? src.brief_overrides),
    parentId:
      present(src.parentId) || present(src.parent_id) || present(src.parentDecisionId)
        ? trimString(src.parentId ?? src.parent_id ?? src.parentDecisionId)
        : null,
    needsSplit,
    splitReason: present(src.splitReason ?? src.split_reason) ? trimString(src.splitReason ?? src.split_reason) : null,
    splitSentBackAt: present(src.splitSentBackAt ?? src.split_sent_back_at)
      ? trimString(src.splitSentBackAt ?? src.split_sent_back_at)
      : null,
    revisitAt: parseYmd(src.revisitAt ?? src.revisit_at),
    revisitState,
    agentTimeoutTagged: boolOrNull(src.agentTimeoutTagged ?? src.agent_timeout_tagged),
    timeoutEligibleOverride: boolOrNull(src.timeoutEligibleOverride ?? src.timeout_eligible_override),
    timeoutAppliedAt: present(src.timeoutAppliedAt ?? src.timeout_applied_at)
      ? trimString(src.timeoutAppliedAt ?? src.timeout_applied_at)
      : null,
    timeoutAppliedChoice: isDefaultChoice(String(src.timeoutAppliedChoice ?? src.timeout_applied_choice ?? ""))
      ? (src.timeoutAppliedChoice ?? src.timeout_applied_choice) as DefaultChoice
      : null,
    appliedBy:
      src.appliedBy === "owner" || src.appliedBy === "timeout" || src.appliedBy === "auto"
        ? src.appliedBy
        : src.applied_by === "owner" || src.applied_by === "timeout" || src.applied_by === "auto"
          ? src.applied_by
          : null,
    sessionCounted: boolOrNull(src.sessionCounted ?? src.session_counted),
    batchKey: present(src.batchKey ?? src.batch_key) ? trimString(src.batchKey ?? src.batch_key) : null,
  };
}

function boolOrNull(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  return null;
}

export function parseBriefJson(raw: string | null | undefined): DecisionBrief {
  if (!raw) return { ...EMPTY_BRIEF };
  try {
    return briefFromUnknown(JSON.parse(raw));
  } catch {
    return { ...EMPTY_BRIEF };
  }
}

export function serializeBrief(brief: DecisionBrief): string {
  return JSON.stringify(brief);
}

export function mergeBrief(
  base: DecisionBrief | null | undefined,
  extra: Partial<DecisionBrief>,
): DecisionBrief {
  return { ...EMPTY_BRIEF, ...base, ...extra };
}

export function missingBriefFields(brief: Pick<DecisionBrief, "options" | "recommendation" | "doorType" | "costOfDelay" | "deadline">): string[] {
  const missing: string[] = [];
  if (!brief.options?.length) missing.push("options");
  if (!brief.recommendation) missing.push("recommendation");
  if (!brief.doorType) missing.push("door_type");
  if (!brief.costOfDelay) missing.push("cost_of_delay");
  if (!brief.deadline) missing.push("deadline");
  return missing;
}

export function isIncompleteBrief(brief: Pick<DecisionBrief, "options" | "recommendation" | "doorType" | "costOfDelay" | "deadline">): boolean {
  return missingBriefFields(brief).length > 0;
}

export function briefHasContent(brief: DecisionBrief | null | undefined): boolean {
  if (!brief) return false;
  return Boolean(
    brief.options?.length ||
      brief.recommendation ||
      brief.doorType ||
      brief.costOfDelay ||
      brief.deadline ||
      brief.defaultIfNoAnswer ||
      brief.parentId,
  );
}

export function appendOverride(
  list: BriefOverride[] | null | undefined,
  field: BriefOverrideField,
  from: string | null,
  to: string | null,
  at: string,
): BriefOverride[] {
  return [...(list ?? []), { field, from, to, at, by: "owner" }];
}

export function briefFromRecord(input: {
  options?: string[] | null;
  recommendation?: string | null;
  doorType?: DoorType | null;
  door?: DoorType | null;
  costOfDelay?: CostOfDelay | null;
  deadline?: string | null;
  defaultIfNoAnswer?: DefaultIfNoAnswer | null;
  defaultIfTimeout?: string | null;
  briefOverrides?: BriefOverride[] | null;
  parentId?: string | null;
  parentDecisionId?: string | null;
  needsSplit?: boolean | null;
  splitReason?: string | null;
  splitSentBackAt?: string | null;
  revisitAt?: string | null;
  revisitState?: "scheduled" | "expired" | null;
  agentTimeoutTagged?: boolean | null;
  timeoutEligibleOverride?: boolean | null;
  timeoutAppliedAt?: string | null;
  timeoutAppliedChoice?: DefaultChoice | null;
  appliedBy?: "owner" | "timeout" | "auto" | null;
  sessionCounted?: boolean | null;
  batchKey?: string | null;
}): DecisionBrief {
  const storedDefault =
    input.defaultIfNoAnswer ??
    (input.defaultIfTimeout && isDefaultChoice(input.defaultIfTimeout)
      ? { choice: input.defaultIfTimeout, note: null }
      : null);
  return {
    options: input.options ?? null,
    recommendation: input.recommendation ?? null,
    doorType: input.doorType ?? input.door ?? null,
    costOfDelay: input.costOfDelay ?? null,
    deadline: input.deadline ?? null,
    defaultIfNoAnswer: storedDefault,
    briefOverrides: input.briefOverrides ?? [],
    parentId: input.parentId ?? input.parentDecisionId ?? null,
    needsSplit: input.needsSplit ?? null,
    splitReason: input.splitReason ?? null,
    splitSentBackAt: input.splitSentBackAt ?? null,
    revisitAt: input.revisitAt ?? null,
    revisitState: input.revisitState ?? null,
    agentTimeoutTagged: input.agentTimeoutTagged ?? null,
    timeoutEligibleOverride: input.timeoutEligibleOverride ?? null,
    timeoutAppliedAt: input.timeoutAppliedAt ?? null,
    timeoutAppliedChoice: input.timeoutAppliedChoice ?? null,
    appliedBy: input.appliedBy ?? null,
    sessionCounted: input.sessionCounted ?? null,
    batchKey: input.batchKey ?? null,
  };
}

export function snakeBrief(brief: DecisionBrief): {
  options: string[] | null;
  recommendation: string | null;
  door_type: DoorType | null;
  cost_of_delay: CostOfDelay | null;
  deadline: string | null;
  default_if_no_answer: DefaultIfNoAnswer | null;
  brief_overrides: BriefOverride[];
  parent_id: string | null;
  needs_split: boolean | null;
  split_reason: string | null;
  split_sent_back_at: string | null;
  revisit_at: string | null;
  revisit_state: "scheduled" | "expired" | null;
  applied_by: "owner" | "timeout" | "auto" | null;
  timeout_applied_at: string | null;
  timeout_applied_choice: DefaultChoice | null;
  timeout_eligible_override: boolean | null;
  batch_key: string | null;
} {
  return {
    options: brief.options,
    recommendation: brief.recommendation,
    door_type: brief.doorType,
    cost_of_delay: brief.costOfDelay,
    deadline: brief.deadline,
    default_if_no_answer: brief.defaultIfNoAnswer,
    brief_overrides: brief.briefOverrides,
    parent_id: brief.parentId,
    needs_split: brief.needsSplit,
    split_reason: brief.splitReason,
    split_sent_back_at: brief.splitSentBackAt,
    revisit_at: brief.revisitAt,
    revisit_state: brief.revisitState,
    applied_by: brief.appliedBy,
    timeout_applied_at: brief.timeoutAppliedAt,
    timeout_applied_choice: brief.timeoutAppliedChoice,
    timeout_eligible_override: brief.timeoutEligibleOverride,
    batch_key: brief.batchKey,
  };
}

export { isYmd };
