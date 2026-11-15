/**
 * Raise-time gate: one actionable decision per card.
 * Enforced on NEW raises only. Existing rows are never rewritten.
 */

export type RaiseGateFailure = {
  status: 422;
  code: "not_one_decision" | "not_a_decision" | "kind_not_decision";
  error: string;
  hint: string;
};

const BUNDLE_HINT =
  "Split this into one raise per question (optional parent_id to keep them together), or use add_task for work that is not a verdict.";

const TASK_HINT = "Use add_task for reading, reviews, and other work that is not a yes/no (or A/B) decision.";

function textOf(title: string, decisionNeeded: string | null | undefined): string {
  return `${title}\n${decisionNeeded ?? ""}`.trim();
}

function questionCount(text: string): number {
  return (text.match(/\?/g) ?? []).length;
}

function looksBundled(title: string, decisionNeeded: string | null | undefined): boolean {
  const needed = decisionNeeded ?? "";
  const blob = textOf(title, needed);
  // Title often restates the same question — count each field on its own.
  if (questionCount(needed) >= 2 || questionCount(title) >= 2) return true;
  if (/\bone by one\b/i.test(blob)) return true;
  if (/\bopen decisions\b/i.test(blob)) return true;
  if (/(?:^|\n)\s*(?:\d+[.)]|[-*])\s+\S+/m.test(blob) && questionCount(blob) >= 1) {
    return true;
  }
  const clauses = blob.split(/;|\band then\b/i).map((part) => part.trim()).filter(Boolean);
  if (clauses.length >= 3 && (questionCount(needed) >= 1 || questionCount(title) >= 1)) return true;
  return false;
}

function looksLikeTask(text: string): boolean {
  if (/\bread (the )?.{0,40}(notes|planning|doc|proposal)\b/i.test(text)) return true;
  if (/\bshare input\b/i.test(text)) return true;
  if (/\bnone now\b/i.test(text)) return true;
  if (/^\s*review\b/i.test(text) && !/\?/.test(text)) return true;
  if (/\bread and (comment|share|reply)\b/i.test(text)) return true;
  return false;
}

export function assessRaise(input: {
  title: string;
  decisionNeeded?: string | null;
  kind?: string | null;
}): RaiseGateFailure | null {
  const kind = (input.kind ?? "").trim().toLowerCase();
  if (kind && kind !== "decision") {
    if (kind === "task" || kind === "review") {
      return {
        status: 422,
        code: "kind_not_decision",
        error: "This is not a decision. Raise a task instead.",
        hint: TASK_HINT,
      };
    }
    if (kind === "bundle") {
      return {
        status: 422,
        code: "not_one_decision",
        error: "One card must be one decision.",
        hint: BUNDLE_HINT,
      };
    }
    return {
      status: 422,
      code: "kind_not_decision",
      error: `kind must be "decision" (got "${kind}").`,
      hint: TASK_HINT,
    };
  }

  const blob = textOf(input.title, input.decisionNeeded);
  if (!blob) return null;

  if (looksLikeTask(blob) && !kind) {
    return {
      status: 422,
      code: "not_a_decision",
      error: "This looks like a review or reading task, not a single decision.",
      hint: TASK_HINT,
    };
  }

  if (looksBundled(input.title, input.decisionNeeded)) {
    return {
      status: 422,
      code: "not_one_decision",
      error: "One card must be one decision.",
      hint: BUNDLE_HINT,
    };
  }

  return null;
}

export function classifyExisting(input: {
  title: string;
  decisionNeeded?: string | null;
}): "ok" | "bundle" | "task" {
  const blob = textOf(input.title, input.decisionNeeded);
  if (looksLikeTask(blob)) return "task";
  if (looksBundled(input.title, input.decisionNeeded)) return "bundle";
  return "ok";
}
