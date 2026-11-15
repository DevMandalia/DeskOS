import { configuredColumns, resolveColumns } from "@/lib/board";
import { applyPatchToRow, briefOf, withBrief } from "@/lib/brief-fields";
import { STATUS } from "@/lib/decide";
import { idsEqual } from "@/lib/ids";
import { spansFromPlain } from "@/lib/rich";
import type {
  Decision,
  DecisionCreate,
  DecisionPatch,
  DecisionSource,
  DecisionVerdictInput,
  DeskBlock,
  DiscussionMessage,
} from "@/lib/types";
import { clone, memoryState, persistMemory, type MemoryState } from "@/adapters/memory/state";

function asBlocks(id: string, body: DeskBlock[] | string | null | undefined): DeskBlock[] {
  if (!body) return [];
  if (typeof body === "string") {
    return [{ id: `${id}-p`, type: "paragraph", rich: spansFromPlain(body) }];
  }
  return body;
}

export class MemoryDecisionSource implements DecisionSource {
  readonly label = "Memory";

  constructor(private readonly state: MemoryState = memoryState()) {}

  private snap() {
    return this.state;
  }

  async list(): Promise<Decision[]> {
    return clone(this.snap().decisions);
  }

  async get(id: string): Promise<Decision | null> {
    return clone(this.snap().decisions.find((d) => idsEqual(d.id, id)) ?? null);
  }

  async getBody(decision: Decision): Promise<DeskBlock[]> {
    const body = this.snap().bodies[decision.id];
    return clone(asBlocks(decision.id, body));
  }

  async create(input: DecisionCreate): Promise<Decision> {
    const id = crypto.randomUUID();
    const raised = input.raisedBy ?? null;
    const row: Decision = withBrief(
      {
        id,
        url: input.url ?? `/d/${id}`,
        item: input.item.trim() || "Untitled",
        project: input.project ?? null,
        status: input.status ?? STATUS.waiting,
        owner: raised?.name ?? null,
        ownerColor: null,
        decisionNeeded: input.decisionNeeded ?? null,
        nextStep: input.nextStep ?? null,
        source: input.source ?? raised?.name ?? null,
        reply: null,
        lastUpdated: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        raisedBy: raised,
        lastChoice: null,
      },
      briefOf(input),
    );
    const state = this.snap();
    state.decisions.unshift(row);
    if (input.body) state.bodies[id] = input.body;
    await persistMemory();
    return clone(row);
  }

  async recordVerdict(id: string, verdict: DecisionVerdictInput): Promise<Decision> {
    const state = this.snap();
    const row = state.decisions.find((d) => idsEqual(d.id, id));
    if (!row) throw new Error("not found");
    row.status = verdict.status;
    row.reply = verdict.reply;
    row.lastUpdated = verdict.lastUpdated;
    row.lastChoice = verdict.choice;
    row.revisitAt = verdict.revisitAt ?? row.revisitAt ?? null;
    if (verdict.revisitState !== undefined) row.revisitState = verdict.revisitState;
    await persistMemory();
    return clone(row);
  }

  async patch(id: string, patch: DecisionPatch): Promise<Decision> {
    const state = this.snap();
    const row = state.decisions.find((d) => idsEqual(d.id, id));
    if (!row) throw new Error("not found");
    Object.assign(row, applyPatchToRow(row, patch));
    await persistMemory();
    return clone(row);
  }

  async listDiscussion(id: string): Promise<DiscussionMessage[]> {
    return clone(this.snap().discussion.filter((m) => idsEqual(m.decisionId, id)));
  }

  async addDiscussion(message: Omit<DiscussionMessage, "id">): Promise<DiscussionMessage> {
    const full: DiscussionMessage = { ...message, id: crypto.randomUUID() };
    this.snap().discussion.push(full);
    await persistMemory();
    return clone(full);
  }

  async hasIdempotencyKey(key: string): Promise<boolean> {
    return this.snap().idempotency.includes(key);
  }

  async rememberIdempotencyKey(key: string): Promise<void> {
    if (!key) return;
    this.snap().idempotency.push(key);
    await persistMemory();
  }
}

export function createMemoryDecisionSource(): DecisionSource {
  return new MemoryDecisionSource();
}

export function memoryColumns() {
  const state = memoryState();
  return resolveColumns(state.taskStatuses, configuredColumns());
}
