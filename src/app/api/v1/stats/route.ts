import { isAgent, requireAgent } from "@/app/api/v1/auth";
import { agentStatsFromRows } from "@/lib/desk-contract";
import { STATUS } from "@/lib/decide";
import { currentUser } from "@/lib/session";
import { listRows } from "@/lib/rows";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await currentUser();
  const rows = await listRows();
  if (user) {
    return Response.json({ agents: agentStatsFromRows(rows, STATUS.waiting) });
  }
  const agent = await requireAgent(request);
  if (!isAgent(agent)) return agent;
  const scoped = rows.filter((row) => {
    if (!row.raisedBy) return agent.role === "lead";
    if (row.raisedBy.id === agent.id) return true;
    if (agent.role === "lead" && row.raisedBy.parentId === agent.id) return true;
    return false;
  });
  return Response.json({ agents: agentStatsFromRows(scoped, STATUS.waiting) });
}
