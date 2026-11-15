import {
  briefFromRecord,
  parseBriefJson,
  parseChoiceFromReply,
  parseRevisitFromReply,
  serializeBrief,
  type DecisionBrief,
} from "../../contract";
import type { Decision, DecisionCreate, DecisionPatch } from "@/lib/types";

export function briefOf(input: DecisionCreate | Decision): DecisionBrief {
  return briefFromRecord({
    options: input.options,
    recommendation: input.recommendation,
    doorType: input.doorType,
    costOfDelay: input.costOfDelay,
    deadline: input.deadline,
    defaultIfNoAnswer: "defaultIfNoAnswer" in input ? input.defaultIfNoAnswer : undefined,
    briefOverrides: "briefOverrides" in input ? input.briefOverrides : undefined,
    parentId: input.parentId,
    needsSplit: "needsSplit" in input ? input.needsSplit : undefined,
    splitReason: "splitReason" in input ? input.splitReason : undefined,
    splitSentBackAt: "splitSentBackAt" in input ? input.splitSentBackAt : undefined,
    revisitAt: "revisitAt" in input ? input.revisitAt : null,
    revisitState: "revisitState" in input ? input.revisitState : null,
  });
}

export function withBrief<T extends Decision>(row: T, brief: DecisionBrief): T {
  return {
    ...row,
    options: brief.options,
    recommendation: brief.recommendation,
    doorType: brief.doorType,
    costOfDelay: brief.costOfDelay,
    defaultIfNoAnswer: brief.defaultIfNoAnswer,
    deadline: brief.deadline,
    parentId: brief.parentId,
    briefOverrides: brief.briefOverrides,
    needsSplit: brief.needsSplit,
    splitReason: brief.splitReason,
    splitSentBackAt: brief.splitSentBackAt,
    revisitAt: brief.revisitAt,
    revisitState: brief.revisitState,
  };
}

export function briefJsonOf(input: DecisionCreate | Decision, extra?: Partial<DecisionBrief>): string {
  return serializeBrief({ ...briefOf(input), ...extra });
}

export function hydrateStoredDecision(row: Decision, briefJson?: string | null): Decision {
  const brief = parseBriefJson(briefJson);
  const hydrated = withBrief(row, brief);
  return {
    ...hydrated,
    lastChoice: hydrated.lastChoice ?? parseChoiceFromReply(hydrated.reply),
    revisitAt: hydrated.revisitAt ?? parseRevisitFromReply(hydrated.reply),
    parentId: hydrated.parentId ?? null,
  };
}

export function applyPatchToRow(row: Decision, patch: DecisionPatch): Decision {
  const next = { ...row, ...patch };
  return withBrief(next, briefOf(next));
}
