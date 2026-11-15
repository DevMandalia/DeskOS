import {
  assessRaise,
  briefFromRaise,
  briefRequired,
  missingBriefFields,
  type RaiseBody,
  type RaiseGateFailure,
} from "../../contract";

export type { RaiseBody };

export type RaiseParseOk = {
  ok: true;
  item: string;
  decisionNeeded: string | null;
  nextStep: string | null;
  project: string | null;
  body: unknown;
  brief: ReturnType<typeof briefFromRaise>;
};

export type RaiseParseErr = {
  ok: false;
  status: number;
  error: string;
  code?: string;
  hint?: string;
  missing?: string[];
};

export function parseRaise(
  body: RaiseBody,
  env: Record<string, string | undefined> = process.env,
): RaiseParseOk | RaiseParseErr {
  const item = (body.item ?? body.title ?? "").trim();
  if (!item) return { ok: false, status: 400, error: "title is required" };

  const gate: RaiseGateFailure | null = assessRaise({
    title: item,
    decisionNeeded: body.decision_needed,
    kind: body.kind,
  });
  if (gate) {
    return {
      ok: false,
      status: gate.status,
      error: gate.error,
      code: gate.code,
      hint: gate.hint,
    };
  }

  const brief = briefFromRaise(body);
  if (briefRequired(env)) {
    const missing = missingBriefFields(brief, body.decision_needed);
    if (missing.length) {
      return {
        ok: false,
        status: 400,
        error: "Decision brief is incomplete.",
        code: "brief_incomplete",
        missing,
        hint: `Set ${missing.join(", ")} or unset DESK_BRIEF_REQUIRED.`,
      };
    }
  }

  return {
    ok: true,
    item,
    decisionNeeded: body.decision_needed?.trim() ? body.decision_needed.trim() : null,
    nextStep: body.next_step?.trim() ? body.next_step.trim() : null,
    project: (body.area ?? body.project ?? null)?.trim() || null,
    body: body.body ?? null,
    brief,
  };
}
