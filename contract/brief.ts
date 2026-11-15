/** Optional decision brief. All fields optional so old agents keep working. */

export const DOOR_TYPES = ["two_way", "one_way"] as const;
export type DoorType = (typeof DOOR_TYPES)[number];

export const COST_LEVELS = ["low", "medium", "high", "critical"] as const;
export type CostOfDelay = (typeof COST_LEVELS)[number];

export const DECISION_KINDS = ["decision"] as const;
export type DecisionKind = (typeof DECISION_KINDS)[number];

export type DecisionBrief = {
  kind: DecisionKind | null;
  options: string[] | null;
  recommendation: string | null;
  door: DoorType | null;
  costOfDelay: CostOfDelay | null;
  defaultIfTimeout: string | null;
  deadline: string | null;
  parentId: string | null;
  revisitAt: string | null;
};

export const EMPTY_BRIEF: DecisionBrief = {
  kind: null,
  options: null,
  recommendation: null,
  door: null,
  costOfDelay: null,
  defaultIfTimeout: null,
  deadline: null,
  parentId: null,
  revisitAt: null,
};

export function isDoorType(value: string | null | undefined): value is DoorType {
  return value === "two_way" || value === "one_way";
}

export function isCostOfDelay(value: string | null | undefined): value is CostOfDelay {
  return value === "low" || value === "medium" || value === "high" || value === "critical";
}

export function parseOptions(value: unknown): string[] | null {
  if (value == null || value === "") return null;
  if (Array.isArray(value)) {
    const items = value.map((item) => String(item).trim()).filter(Boolean);
    return items.length ? items : null;
  }
  if (typeof value === "string") {
    const items = value
      .split(/\n|;/)
      .map((item) => item.replace(/^\s*[-*]\s*/, "").trim())
      .filter(Boolean);
    return items.length ? items : null;
  }
  return null;
}

export function parseDoor(value: unknown): DoorType | null {
  if (value == null || value === "") return null;
  const raw = String(value).trim().toLowerCase().replace(/-/g, "_");
  if (raw === "two_way" || raw === "reversible" || raw === "two_way_door") return "two_way";
  if (raw === "one_way" || raw === "irreversible" || raw === "one_way_door") return "one_way";
  return null;
}

export function parseCost(value: unknown): CostOfDelay | null {
  if (value == null || value === "") return null;
  const raw = String(value).trim().toLowerCase();
  if (isCostOfDelay(raw)) return raw;
  return null;
}

export function parseKind(value: unknown): DecisionKind | "task" | "bundle" | string | null {
  if (value == null || value === "") return null;
  return String(value).trim().toLowerCase();
}

export function parseDateOnly(value: unknown): string | null {
  if (value == null || value === "") return null;
  const raw = String(value).trim();
  const day = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  if (day) return day[1];
  const parsed = Date.parse(raw);
  if (Number.isNaN(parsed)) return null;
  return new Date(parsed).toISOString().slice(0, 10);
}

export function briefFromUnknown(raw: unknown): DecisionBrief {
  const src =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};
  const kind = parseKind(src.kind);
  return {
    kind: kind === "decision" ? "decision" : null,
    options: parseOptions(src.options),
    recommendation:
      src.recommendation == null || src.recommendation === ""
        ? null
        : String(src.recommendation).trim() || null,
    door: parseDoor(src.door ?? src.door_type),
    costOfDelay: parseCost(src.costOfDelay ?? src.cost_of_delay),
    defaultIfTimeout:
      src.defaultIfTimeout == null && src.default_if_timeout == null
        ? null
        : String(src.defaultIfTimeout ?? src.default_if_timeout).trim() || null,
    deadline: parseDateOnly(src.deadline),
    parentId:
      src.parentId == null && src.parent_id == null
        ? null
        : String(src.parentId ?? src.parent_id).trim() || null,
    revisitAt: parseDateOnly(src.revisitAt ?? src.revisit_at),
  };
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

export function briefHasContent(brief: DecisionBrief | null | undefined): boolean {
  if (!brief) return false;
  return Boolean(
    brief.options?.length ||
      brief.recommendation ||
      brief.door ||
      brief.costOfDelay ||
      brief.defaultIfTimeout ||
      brief.deadline ||
      brief.parentId,
  );
}

export type RaiseBody = {
  title?: string;
  item?: string;
  decision_needed?: string | null;
  next_step?: string | null;
  area?: string | null;
  project?: string | null;
  body?: unknown;
  kind?: string | null;
  options?: unknown;
  recommendation?: string | null;
  door?: string | null;
  door_type?: string | null;
  cost_of_delay?: string | null;
  default_if_timeout?: string | null;
  deadline?: string | null;
  parent_id?: string | null;
};

export function briefFromRaise(body: RaiseBody): DecisionBrief {
  return briefFromUnknown({
    kind: body.kind,
    options: body.options,
    recommendation: body.recommendation,
    door: body.door ?? body.door_type,
    cost_of_delay: body.cost_of_delay,
    default_if_timeout: body.default_if_timeout,
    deadline: body.deadline,
    parent_id: body.parent_id,
  });
}

/** Map a stored decision (camelCase) onto the brief record. */
export function briefFromRecord(input: {
  kind?: DecisionKind | null;
  options?: string[] | null;
  recommendation?: string | null;
  door?: DoorType | null;
  costOfDelay?: CostOfDelay | null;
  defaultIfTimeout?: string | null;
  deadline?: string | null;
  parentDecisionId?: string | null;
  parentId?: string | null;
  revisitAt?: string | null;
}): DecisionBrief {
  return {
    kind: input.kind ?? null,
    options: input.options ?? null,
    recommendation: input.recommendation ?? null,
    door: input.door ?? null,
    costOfDelay: input.costOfDelay ?? null,
    defaultIfTimeout: input.defaultIfTimeout ?? null,
    deadline: input.deadline ?? null,
    parentId: input.parentDecisionId ?? input.parentId ?? null,
    revisitAt: input.revisitAt ?? null,
  };
}

const BRIEF_REQUIRED_KEYS: (keyof DecisionBrief)[] = [
  "options",
  "recommendation",
  "door",
  "costOfDelay",
  "deadline",
];

export function missingBriefFields(
  brief: DecisionBrief,
  decisionNeeded: string | null | undefined,
): string[] {
  const missing: string[] = [];
  if (!decisionNeeded?.trim()) missing.push("decision_needed");
  if (!brief.options?.length) missing.push("options");
  if (!brief.recommendation) missing.push("recommendation");
  if (!brief.door) missing.push("door");
  if (!brief.costOfDelay) missing.push("cost_of_delay");
  if (!brief.deadline) missing.push("deadline");
  return missing;
}

export function briefRequired(env: Record<string, string | undefined> = process.env): boolean {
  return (env.DESK_BRIEF_REQUIRED ?? "").trim() === "1";
}

export { BRIEF_REQUIRED_KEYS };
