import { isAgent, requireAgent } from "@/app/api/v1/auth";
import { nextSpeaker } from "@/lib/execute-decision";
import { decisionSource } from "@/lib/rows";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const agent = await requireAgent(request);
  if (!isAgent(agent)) return agent;
  const { id } = await params;
  const source = await decisionSource();
  const row = await source.get(id);
  if (!row) return Response.json({ error: "not found" }, { status: 404 });
  if (row.raisedBy && row.raisedBy.id !== agent.id && row.raisedBy.parentId !== agent.id) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }
  const discussion = await source.listDiscussion(row.id);
  const closed =
    row.lastChoice === "Approve" || row.lastChoice === "Decline" || row.lastChoice === "Park";
  return Response.json({
    decision_id: row.id,
    item: row.item,
    status: row.status,
    closed,
    choice: closed ? row.lastChoice : null,
    reply: row.reply,
    discussion,
    next_speaker: closed ? null : nextSpeaker(discussion),
  });
}
