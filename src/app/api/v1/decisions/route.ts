import { loadAgentStore } from "@/adapters/load";
import { isAgent, requireAgent } from "@/app/api/v1/auth";
import { agentRef } from "@/lib/agent-ref";
import { STATUS } from "@/lib/decide";
import { parseRaise, type RaiseBody } from "@/lib/raise";
import { agentTaggedTimeoutFields, compareWaiting, parseQueueSort, todayYmd } from "@/lib/desk-contract";
import { deskTimezone } from "@/lib/env";
import { decisionSource } from "@/lib/rows";
import type { Decision } from "@/lib/types";

export const dynamic = "force-dynamic";

function visibleTo(rows: Decision[], agent: { id: string; role: string; parentId: string | null }) {
  return rows.filter((row) => {
    if (!row.raisedBy) return agent.role === "lead";
    if (row.raisedBy.id === agent.id) return true;
    if (agent.role === "lead" && row.raisedBy.parentId === agent.id) return true;
    return false;
  });
}

/** POST raise_decision. GET list of this agent's (and, for a lead, sub-agents') decisions. */
export async function GET(request: Request) {
  const agent = await requireAgent(request);
  if (!isAgent(agent)) return agent;
  const rows = visibleTo(await (await decisionSource()).list(), agent);
  const sort = parseQueueSort(new URL(request.url).searchParams.get("sort"));
  if (!sort) return Response.json({ decisions: rows });
  const today = todayYmd(new Date(), deskTimezone());
  const waiting = rows
    .filter((row) => row.status === STATUS.waiting)
    .sort((a, b) => compareWaiting(a, b, sort, today));
  const rest = rows.filter((row) => row.status !== STATUS.waiting);
  return Response.json({ decisions: [...waiting, ...rest] });
}

export async function POST(request: Request) {
  const agent = await requireAgent(request);
  if (!isAgent(agent)) return agent;
  let body: RaiseBody;
  try {
    body = (await request.json()) as RaiseBody;
  } catch {
    return Response.json({ error: "invalid json" }, { status: 400 });
  }
  const parsed = parseRaise(body);
  if (!parsed.ok) {
    return Response.json(
      {
        error: parsed.error,
        code: parsed.code ?? null,
        field: parsed.field ?? null,
        hint: parsed.hint ?? null,
      },
      { status: parsed.status },
    );
  }

  const source = await decisionSource();
  if (parsed.parentId) {
    const parent = await source.get(parsed.parentId);
    if (!parent) {
      return Response.json(
        { error: "parent_id must match an existing decision", code: "invalid_field", field: "parent_id" },
        { status: 400 },
      );
    }
    const visible = visibleTo([parent], agent);
    if (visible.length === 0) {
      return Response.json(
        { error: "parent_id must be a decision this agent can see", code: "invalid_field", field: "parent_id" },
        { status: 400 },
      );
    }
  }

  const agents = await loadAgentStore();
  const parent = agent.parentId ? await agents.get(agent.parentId) : null;
  const row = await source.create({
    item: parsed.item,
    decisionNeeded: parsed.decisionNeeded,
    nextStep: parsed.nextStep,
    project: parsed.project,
    status: STATUS.waiting,
    body: typeof parsed.body === "string" || Array.isArray(parsed.body) ? parsed.body : null,
    raisedBy: agentRef(agent, parent),
    source: agent.name,
    options: parsed.brief.options,
    recommendation: parsed.brief.recommendation,
    doorType: parsed.brief.doorType,
    costOfDelay: parsed.brief.costOfDelay,
    defaultIfNoAnswer: parsed.brief.defaultIfNoAnswer,
    deadline: parsed.brief.deadline,
    parentId: parsed.parentId,
    needsSplit: parsed.brief.needsSplit,
    splitReason: parsed.brief.splitReason,
    agentTimeoutTagged: agentTaggedTimeoutFields(parsed.brief),
    batchKey: parsed.brief.batchKey,
  });
  return Response.json({ decision: row }, { status: 201 });
}
