import type { Agent, AgentRef } from "@/lib/types";

export function agentRef(agent: Agent, parent: Agent | null = null): AgentRef {
  return {
    id: agent.id,
    name: agent.name,
    parentId: agent.parentId,
    parentName: parent?.name ?? (agent.parentId ? agent.parentId : null),
  };
}

export function raisedByLabel(ref: AgentRef | null | undefined): string | null {
  if (!ref) return null;
  if (ref.parentName) return `${ref.name} · via ${ref.parentName}`;
  return ref.name;
}

export function publicAgent(agent: Agent) {
  return {
    id: agent.id,
    name: agent.name,
    role: agent.role,
    parentId: agent.parentId,
    keyPrefix: agent.keyPrefix,
    webhookUrl: agent.webhookUrl,
    createdAt: agent.createdAt,
    revokedAt: agent.revokedAt,
  };
}
