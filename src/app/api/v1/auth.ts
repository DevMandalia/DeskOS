import { loadAgentStore } from "@/adapters/load";
import { demoApiBlocked } from "@/lib/demo-mode";
import type { Agent } from "@/lib/types";

export function bearerToken(request: Request): string | null {
  const header = request.headers.get("authorization") ?? "";
  const match = header.match(/^Bearer\s+(\S+)/i);
  return match?.[1] ?? null;
}

export async function requireAgent(request: Request): Promise<Agent | Response> {
  const blocked = demoApiBlocked();
  if (blocked) return blocked;
  const token = bearerToken(request);
  if (!token) {
    return Response.json({ error: "missing bearer token" }, { status: 401 });
  }
  const store = await loadAgentStore();
  const agent = await store.authenticate(token);
  if (!agent) {
    return Response.json({ error: "invalid or revoked key" }, { status: 401 });
  }
  return agent;
}

export function isAgent(value: Agent | Response): value is Agent {
  return typeof value === "object" && value !== null && "keyHash" in value;
}
