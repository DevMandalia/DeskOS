import { hashesEqual, mintApiKey, mintWebhookSecret } from "@/lib/keys";
import type { Agent, AgentRole, AgentStore } from "@/lib/types";
import { agentFromRow, sqliteDb } from "@/adapters/sqlite/db";

export class SqliteAgentStore implements AgentStore {
  readonly label = "SQLite agents";

  constructor(private readonly file?: string) {}

  private db() {
    return sqliteDb(this.file);
  }

  async list(): Promise<Agent[]> {
    return this.db().prepare("SELECT * FROM agents").all().map(agentFromRow);
  }

  async get(id: string): Promise<Agent | null> {
    const row = this.db().prepare("SELECT * FROM agents WHERE id = ?").get(id);
    return row ? agentFromRow(row) : null;
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
    this.db()
      .prepare(
        `INSERT INTO agents (id, name, role, parent_id, key_prefix, key_hash, webhook_url, webhook_secret, created_at, revoked_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        agent.id,
        agent.name,
        agent.role,
        agent.parentId,
        agent.keyPrefix,
        agent.keyHash,
        agent.webhookUrl,
        agent.webhookSecret,
        agent.createdAt,
        agent.revokedAt,
      );
    return { agent, plaintextKey: key.plaintext, webhookSecret };
  }

  async revoke(id: string): Promise<Agent> {
    const agent = await this.get(id);
    if (!agent) throw new Error("Agent not found");
    const revokedAt = new Date().toISOString();
    this.db().prepare("UPDATE agents SET revoked_at = ? WHERE id = ?").run(revokedAt, id);
    return { ...agent, revokedAt };
  }

  async authenticate(plaintextKey: string): Promise<Agent | null> {
    const agents = await this.list();
    return agents.find((a) => !a.revokedAt && hashesEqual(plaintextKey, a.keyHash)) ?? null;
  }

  async setWebhook(
    id: string,
    webhookUrl: string | null,
    rotateSecret: boolean,
  ): Promise<{ agent: Agent; webhookSecret: string | null }> {
    const agent = await this.get(id);
    if (!agent) throw new Error("Agent not found");
    const url = webhookUrl?.trim() || null;
    let secret: string | null = null;
    let stored = agent.webhookSecret;
    if (url && (rotateSecret || !stored)) {
      secret = mintWebhookSecret();
      stored = secret;
    }
    if (!url) stored = null;
    this.db()
      .prepare("UPDATE agents SET webhook_url = ?, webhook_secret = ? WHERE id = ?")
      .run(url, stored, id);
    return { agent: { ...agent, webhookUrl: url, webhookSecret: stored }, webhookSecret: secret };
  }
}

export function createSqliteAgentStore(file?: string): AgentStore {
  return new SqliteAgentStore(file);
}
