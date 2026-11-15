import { isAgent, requireAgent } from "@/app/api/v1/auth";
import { nextSpeaker } from "@/lib/execute-decision";
import { briefFromRecord, isClosedChoice, snakeBrief } from "@/lib/desk-contract";
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
  const closed = isClosedChoice(row.lastChoice);
  const brief = snakeBrief(briefFromRecord(row));
  return Response.json({
    decision_id: row.id,
    item: row.item,
    status: row.status,
    closed,
    choice: closed ? row.lastChoice : row.lastChoice,
    reply: row.reply,
    discussion,
    next_speaker: closed ? null : nextSpeaker(discussion),
    options: brief.options,
    recommendation: brief.recommendation,
    door_type: brief.door_type,
    cost_of_delay: brief.cost_of_delay,
    deadline: brief.deadline,
    default_if_no_answer: brief.default_if_no_answer,
    brief_overrides: brief.brief_overrides,
    needs_split: brief.needs_split,
    split_reason: brief.split_reason,
    parent_id: brief.parent_id,
    split_sent_back_at: brief.split_sent_back_at,
    revisit_at: brief.revisit_at,
    revisit_state: brief.revisit_state,
  });
}
