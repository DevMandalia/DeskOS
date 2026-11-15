import {
  briefFromRecord,
  parseBriefJson,
  parseChoiceFromReply,
  parseRevisitFromReply,
  serializeBrief,
  type DecisionBrief,
} from "../../contract";
import type { Decision, DecisionCreate } from "@/lib/types";

export function briefOf(input: DecisionCreate | Decision): DecisionBrief {
  return briefFromRecord({
    kind: input.kind,
    options: input.options,
    recommendation: input.recommendation,
    door: input.door,
    costOfDelay: input.costOfDelay,
    defaultIfTimeout: input.defaultIfTimeout,
    deadline: input.deadline,
    parentDecisionId: "parentDecisionId" in input ? input.parentDecisionId : undefined,
    revisitAt: "revisitAt" in input ? input.revisitAt : null,
  });
}

export function withBrief<T extends Decision>(row: T, brief: DecisionBrief): T {
  return {
    ...row,
    kind: brief.kind,
    options: brief.options,
    recommendation: brief.recommendation,
    door: brief.door,
    costOfDelay: brief.costOfDelay,
    defaultIfTimeout: brief.defaultIfTimeout,
    deadline: brief.deadline,
    parentDecisionId: brief.parentId,
    revisitAt: brief.revisitAt,
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
  };
}
