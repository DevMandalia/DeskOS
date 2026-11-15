import { assessSplit, parseRaiseBrief, type ParsedRaiseBrief, type RaiseBody, type SplitReason } from "../../contract";

export type { RaiseBody };

export type RaisedBrief = Omit<ParsedRaiseBrief, "needsSplit"> & {
  needsSplit: boolean;
  splitReason: SplitReason | null;
};

export type RaiseParseOk = {
  ok: true;
  item: string;
  decisionNeeded: string | null;
  nextStep: string | null;
  project: string | null;
  body: unknown;
  parentId: string | null;
  brief: RaisedBrief;
};

export type RaiseParseErr = {
  ok: false;
  status: number;
  error: string;
  code?: string;
  field?: string;
  hint?: string;
};

export function parseRaise(body: RaiseBody): RaiseParseOk | RaiseParseErr {
  const item = (body.item ?? body.title ?? "").trim();
  if (!item) return { ok: false, status: 400, error: "title is required", field: "title" };

  const parsed = parseRaiseBrief(body);
  if (!parsed.ok) {
    return {
      ok: false,
      status: 400,
      error: parsed.error,
      code: "invalid_field",
      field: parsed.field,
    };
  }

  const decisionNeeded = body.decision_needed?.trim() ? body.decision_needed.trim() : null;
  const nextStep = body.next_step?.trim() ? body.next_step.trim() : null;
  const assessed = assessSplit({
    item,
    decisionNeeded,
    nextStep,
    needsSplit: parsed.brief.needsSplit,
    hasOptions: Boolean(parsed.brief.options?.length),
  });

  return {
    ok: true,
    item,
    decisionNeeded,
    nextStep,
    project: (body.area ?? body.project ?? null)?.trim() || null,
    body: body.body ?? null,
    parentId: parsed.brief.parentId,
    brief: {
      ...parsed.brief,
      needsSplit: assessed.needsSplit,
      splitReason: assessed.splitReason,
    },
  };
}
