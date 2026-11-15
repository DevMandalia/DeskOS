import { loadTaskStore } from "@/adapters/load";
import { isAgent, requireAgent } from "@/app/api/v1/auth";
import { decisionSource } from "@/lib/rows";

export const dynamic = "force-dynamic";

/** list_items: decisions and tasks this agent can see. */
export async function GET(request: Request) {
  const agent = await requireAgent(request);
  if (!isAgent(agent)) return agent;
  const rows = await (await decisionSource()).list();
  const decisions = rows.filter((row) => {
    if (!row.raisedBy) return agent.role === "lead";
    return row.raisedBy.id === agent.id || (agent.role === "lead" && row.raisedBy.parentId === agent.id);
  });
  const board = await (await loadTaskStore()).list();
  const tasks = board.tasks.filter((task) => {
    if (!task.raisedBy) return agent.role === "lead";
    return task.raisedBy.id === agent.id || (agent.role === "lead" && task.raisedBy.parentId === agent.id);
  });
  return Response.json({ decisions, tasks });
}
