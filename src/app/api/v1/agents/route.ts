import { loadAgentStore } from "@/adapters/load";
import { isAgent, requireAgent } from "@/app/api/v1/auth";
import { publicAgent } from "@/lib/agent-ref";

export const dynamic = "force-dynamic";

/** A lead agent may register a sub-agent. The new key is shown once. */
export async function POST(request: Request) {
  const agent = await requireAgent(request);
  if (!isAgent(agent)) return agent;
  if (agent.role !== "lead") {
    return Response.json({ error: "only a lead agent can register sub-agents" }, { status: 403 });
  }
  let body: { name?: string; webhook_url?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return Response.json({ error: "invalid json" }, { status: 400 });
  }
  const name = (body.name ?? "").trim();
  if (!name) return Response.json({ error: "name is required" }, { status: 400 });
  const store = await loadAgentStore();
  const created = await store.create({
    name,
    role: "sub",
    parentId: agent.id,
    webhookUrl: body.webhook_url ?? null,
  });
  return Response.json(
    {
      agent: publicAgent(created.agent),
      api_key: created.plaintextKey,
      webhook_secret: created.webhookSecret,
    },
    { status: 201 },
  );
}
