import { isAgent, requireAgent } from "@/app/api/v1/auth";
import { nextSpeaker } from "@/lib/execute-decision";
import { decisionSource } from "@/lib/rows";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const agent = await requireAgent(request);
  if (!isAgent(agent)) return agent;
  const { id } = await params;
  let body: { body?: string; message?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return Response.json({ error: "invalid json" }, { status: 400 });
  }
  const text = (body.body ?? body.message ?? "").trim();
  if (!text) return Response.json({ error: "message is required" }, { status: 400 });
  const source = await decisionSource();
  const row = await source.get(id);
  if (!row) return Response.json({ error: "not found" }, { status: 404 });
  if (row.lastChoice === "Approve" || row.lastChoice === "Decline") {
    return Response.json({ error: "this decision is closed" }, { status: 409 });
  }
  const thread = await source.listDiscussion(row.id);
  if (nextSpeaker(thread) !== "agent") {
    return Response.json({ error: "waiting for the owner" }, { status: 409 });
  }
  const message = await source.addDiscussion({
    decisionId: row.id,
    author: "agent",
    agentId: agent.id,
    agentName: agent.name,
    body: text,
    at: new Date().toISOString(),
  });
  return Response.json({ message }, { status: 201 });
}
