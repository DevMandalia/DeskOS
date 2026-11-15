import { loadAgentStore } from "@/adapters/load";
import { isAgent, requireAgent } from "@/app/api/v1/auth";
import { agentRef } from "@/lib/agent-ref";
import { STATUS } from "@/lib/decide";
import { parseRaise, type RaiseBody } from "@/lib/raise";
import { decisionSource } from "@/lib/rows";

export const dynamic = "force-dynamic";

/** POST raise_decision. GET list of this agent's (and, for a lead, sub-agents') decisions. */
export async function GET(request: Request) {
  const agent = await requireAgent(request);
  if (!isAgent(agent)) return agent;
  const rows = await (await decisionSource()).list();
  const visible = rows.filter((row) => {
    if (!row.raisedBy) return agent.role === "lead";
    if (row.raisedBy.id === agent.id) return true;
    if (agent.role === "lead" && row.raisedBy.parentId === agent.id) return true;
    return false;
  });
  return Response.json({ decisions: visible });
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
        hint: parsed.hint ?? null,
        missing: parsed.missing ?? null,
      },
      { status: parsed.status },
    );
  }
  const agents = await loadAgentStore();
  const parent = agent.parentId ? await agents.get(agent.parentId) : null;
  const row = await (
    await decisionSource()
  ).create({
    item: parsed.item,
    decisionNeeded: parsed.decisionNeeded,
    nextStep: parsed.nextStep,
    project: parsed.project,
    status: STATUS.waiting,
    body: typeof parsed.body === "string" || Array.isArray(parsed.body) ? parsed.body : null,
    raisedBy: agentRef(agent, parent),
    source: agent.name,
    kind: parsed.brief.kind,
    options: parsed.brief.options,
    recommendation: parsed.brief.recommendation,
    door: parsed.brief.door,
    costOfDelay: parsed.brief.costOfDelay,
    defaultIfTimeout: parsed.brief.defaultIfTimeout,
    deadline: parsed.brief.deadline,
    parentDecisionId: parsed.brief.parentId,
  });
  return Response.json({ decision: row }, { status: 201 });
}
