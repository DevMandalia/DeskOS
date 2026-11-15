import { isAgent, requireAgent } from "@/app/api/v1/auth";
import { decisionSource } from "@/lib/rows";
import { idsEqual } from "@/lib/ids";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const agent = await requireAgent(request);
  if (!isAgent(agent)) return agent;
  const { id } = await params;
  const row = await (await decisionSource()).get(id);
  if (!row) return Response.json({ error: "not found" }, { status: 404 });
  if (row.raisedBy && row.raisedBy.id !== agent.id && row.raisedBy.parentId !== agent.id) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }
  const discussion = await (await decisionSource()).listDiscussion(row.id);
  return Response.json({ decision: row, discussion });
}

export { idsEqual };
