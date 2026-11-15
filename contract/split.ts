/**
 * One decision per card. Never reject a raise — accept and flag needsSplit.
 * Heuristics run on item + decision_needed + next_step (not body).
 */

export type SplitReason = "agent" | "owner_override" | "multiple_questions" | "review_task";

export type SplitAssessment = {
  needsSplit: boolean;
  splitReason: SplitReason | null;
};

function blobOf(item: string, decisionNeeded?: string | null, nextStep?: string | null): string {
  return [item, decisionNeeded ?? "", nextStep ?? ""].join("\n").trim();
}

function questionCount(text: string): number {
  return (text.match(/\?/g) ?? []).length;
}

function looksLikeSeparateSegments(text: string): boolean {
  const lines = [
    ...new Set(
      text
        .split(/\n|;/)
        .map((part) => part.replace(/^\s*(?:\d+[.)]|[-*])\s*/, "").trim().toLowerCase())
        .filter(Boolean),
    ),
  ];
  if (lines.length < 2) return false;
  const questionish = lines.filter(
    (line) => /\?/.test(line) || /\bvs\.?\b/i.test(line) || /\bor\b/i.test(line),
  );
  if (questionish.length >= 2) return true;
  return lines.length >= 3;
}

function multipleQuestions(item: string, decisionNeeded?: string | null, nextStep?: string | null): boolean {
  const needed = decisionNeeded ?? "";
  const next = nextStep ?? "";
  if (questionCount(needed) >= 2 || questionCount(item) >= 2) return true;
  // Check each field on its own. Joining title + needed + next_step with
  // newlines would make every complete raise look like three segments.
  if (looksLikeSeparateSegments(item) || looksLikeSeparateSegments(needed) || looksLikeSeparateSegments(next)) {
    return true;
  }
  return false;
}

function reviewTask(text: string): boolean {
  if (/\bread (the )?.{0,60}(notes|planning|doc|proposal)\b/i.test(text) && /\bshare input\b/i.test(text)) {
    return true;
  }
  if (/\bread .{0,40}and share input\b/i.test(text)) return true;
  if (/\bcomment on\b/i.test(text)) return true;
  if (/\bwalk through the notes\b/i.test(text)) return true;
  if (/\bgo through\b/i.test(text) && /\bone by one\b/i.test(text)) return true;
  return false;
}

export function assessSplit(input: {
  item: string;
  decisionNeeded?: string | null;
  nextStep?: string | null;
  needsSplit?: boolean | null;
  hasOptions?: boolean;
}): SplitAssessment {
  if (input.needsSplit === true) return { needsSplit: true, splitReason: "agent" };
  if (input.needsSplit === false) return { needsSplit: false, splitReason: null };

  const blob = blobOf(input.item, input.decisionNeeded, input.nextStep);
  if (reviewTask(blob)) return { needsSplit: true, splitReason: "review_task" };

  if (input.hasOptions && questionCount(input.decisionNeeded ?? "") <= 1 && questionCount(input.item) <= 1) {
    return { needsSplit: false, splitReason: null };
  }

  if (multipleQuestions(input.item, input.decisionNeeded, input.nextStep)) {
    return { needsSplit: true, splitReason: "multiple_questions" };
  }
  return { needsSplit: false, splitReason: null };
}

/** Existing-row classifier for the proposal list. Does not write. */
export function classifyExisting(input: {
  title: string;
  decisionNeeded?: string | null;
  nextStep?: string | null;
}): "ok" | "bundle" | "task" {
  const result = assessSplit({
    item: input.title,
    decisionNeeded: input.decisionNeeded,
    nextStep: input.nextStep,
  });
  if (!result.needsSplit) return "ok";
  if (result.splitReason === "review_task") return "task";
  return "bundle";
}

export function splitReasonLabel(reason: string | null | undefined): string {
  if (reason === "agent") return "The raising agent marked this as several questions.";
  if (reason === "multiple_questions") return "This looks like several questions.";
  if (reason === "review_task") return "This looks like a review or reading task, not one decision.";
  if (reason === "owner_override") return "Marked as one decision.";
  return "This card needs a split before it can be approved.";
}
