import { hashesEqual, mintApiKey, mintWebhookSecret } from "@/lib/keys";
import type { Agent, AgentRole, AgentStore } from "@/lib/types";
import { clone, memoryState, persistMemory, type MemoryState } from "@/adapters/memory/state";

export class MemoryAgentStore implements AgentStore {
  readonly label = "Memory agents";

  constructor(private readonly state: MemoryState = memoryState()) {}

  private snap() {
    return this.state;
  }

  async list(): Promise<Agent[]> {
    return clone(this.snap().agents);
  }

  async get(id: string): Promise<Agent | null> {
    return clone(this.snap().agents.find((a) => a.id === id) ?? null);
  }

  async create(input: {
    name: string;
    role: AgentRole;
    parentId: string | null;
    webhookUrl?: string | null;
  }): Promise<{ agent: Agent; plaintextKey: string; webhookSecret: string | null }> {
    const name = input.name.replace(/\s+/g, " ").trim();
    if (!name) throw new Error("An agent needs a name.");
    if (input.role === "sub" && !input.parentId) throw new Error("A sub-agent needs a parent.");
    const key = mintApiKey();
    const webhookUrl = input.webhookUrl?.trim() || null;
    const webhookSecret = webhookUrl ? mintWebhookSecret() : null;
    const agent: Agent = {
      id: crypto.randomUUID(),
      name,
      role: input.role,
      parentId: input.role === "lead" ? null : input.parentId,
      keyPrefix: key.prefix,
      keyHash: key.hash,
      webhookUrl,
      webhookSecret,
      createdAt: new Date().toISOString(),
      revokedAt: null,
    };
    this.snap().agents.unshift(agent);
    await persistMemory();
    return { agent: clone(agent), plaintextKey: key.plaintext, webhookSecret };
  }

  async revoke(id: string): Promise<Agent> {
    const agent = this.snap().agents.find((a) => a.id === id);
    if (!agent) throw new Error("Agent not found");
    agent.revokedAt = new Date().toISOString();
    await persistMemory();
    return clone(agent);
  }

  async authenticate(plaintextKey: string): Promise<Agent | null> {
    const agent = this.snap().agents.find(
      (a) => !a.revokedAt && hashesEqual(plaintextKey, a.keyHash),
    );
    return agent ? clone(agent) : null;
  }

  async setWebhook(
    id: string,
    webhookUrl: string | null,
    rotateSecret: boolean,
  ): Promise<{ agent: Agent; webhookSecret: string | null }> {
    const agent = this.snap().agents.find((a) => a.id === id);
    if (!agent) throw new Error("Agent not found");
    agent.webhookUrl = webhookUrl?.trim() || null;
    let secret: string | null = null;
    if (agent.webhookUrl && (rotateSecret || !agent.webhookSecret)) {
      secret = mintWebhookSecret();
      agent.webhookSecret = secret;
    }
    if (!agent.webhookUrl) agent.webhookSecret = null;
    await persistMemory();
    return { agent: clone(agent), webhookSecret: secret };
  }
}

export function createMemoryAgentStore(): AgentStore {
  return new MemoryAgentStore();
}
