import { loadAgentStore, loadTaskStore } from "@/adapters/load";
import { isAgent, requireAgent } from "@/app/api/v1/auth";
import { agentRef } from "@/lib/agent-ref";
import { configuredColumns, quickAddStatus, resolveColumns } from "@/lib/board";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const agent = await requireAgent(request);
  if (!isAgent(agent)) return agent;
  let body: { title?: string; status?: string; area?: string; due?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return Response.json({ error: "invalid json" }, { status: 400 });
  }
  const title = (body.title ?? "").trim();
  if (!title) return Response.json({ error: "title is required" }, { status: 400 });
  const store = await loadTaskStore();
  const board = await store.list();
  const columns = board.columns.length
    ? board.columns
    : resolveColumns(board.schema.statusOptions, configuredColumns());
  const status = body.status ?? quickAddStatus(columns);
  if (!status) return Response.json({ error: "no writable status column" }, { status: 400 });
  const agents = await loadAgentStore();
  const parent = agent.parentId ? await agents.get(agent.parentId) : null;
  const task = await store.create({
    title,
    status,
    area: body.area ?? null,
    due: body.due ?? null,
    raisedBy: agentRef(agent, parent),
  });
  return Response.json({ task }, { status: 201 });
}
