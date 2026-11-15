import { loadAgentStore } from "@/adapters/load";
import { isAgent, requireAgent } from "@/app/api/v1/auth";
import { agentRef } from "@/lib/agent-ref";
import { STATUS } from "@/lib/decide";
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
  let body: {
    title?: string;
    item?: string;
    decision_needed?: string;
    next_step?: string;
    area?: string;
    project?: string;
    body?: string;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return Response.json({ error: "invalid json" }, { status: 400 });
  }
  const item = (body.item ?? body.title ?? "").trim();
  if (!item) return Response.json({ error: "title is required" }, { status: 400 });
  const agents = await loadAgentStore();
  const parent = agent.parentId ? await agents.get(agent.parentId) : null;
  const row = await (
    await decisionSource()
  ).create({
    item,
    decisionNeeded: body.decision_needed ?? null,
    nextStep: body.next_step ?? null,
    project: body.area ?? body.project ?? null,
    status: STATUS.waiting,
    body: body.body ?? null,
    raisedBy: agentRef(agent, parent),
    source: agent.name,
  });
  return Response.json({ decision: row }, { status: 201 });
}
