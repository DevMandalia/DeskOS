/**
 * Postgres adapters. Same rows as SQLite. Used when DATABASE_URL is postgres://.
 * Contract tests skip this adapter unless DESK_TEST_POSTGRES=1.
 */
import { configuredColumns, resolveColumns, applyPatch } from "@/lib/board";
import { applyPatchToRow, briefJsonOf, briefOf, withBrief } from "@/lib/brief-fields";
import { STATUS } from "@/lib/decide";
import { hashesEqual, mintApiKey, mintWebhookSecret } from "@/lib/keys";
import { spansFromPlain } from "@/lib/rich";
import { DEMO_TASK_AREAS, DEMO_TASK_STATUSES } from "@/lib/seed";
import {
  TaskStoreError,
  type Task,
  type TaskBoard,
  type TaskCreate,
  type TaskPatch,
  type TaskStore,
} from "@/lib/tasks/types";
import type {
  Agent,
  AgentRole,
  AgentStore,
  Decision,
  DecisionCreate,
  DecisionPatch,
  DecisionSource,
  DecisionVerdictInput,
  DeskBlock,
  DiscussionMessage,
} from "@/lib/types";
import { agentFromRow, decisionFromRow, messageFromRow, taskFromRow } from "@/adapters/sqlite/db";
import { pgPool } from "@/adapters/postgres/pool";

export class PostgresDecisionSource implements DecisionSource {
  readonly label = "Postgres";

  async list(): Promise<Decision[]> {
    const { rows } = await (await pgPool()).query("SELECT * FROM decisions");
    return rows.map(decisionFromRow);
  }

  async get(id: string): Promise<Decision | null> {
    const { rows } = await (await pgPool()).query("SELECT * FROM decisions WHERE id = $1", [id]);
    return rows[0] ? decisionFromRow(rows[0]) : null;
  }

  async getBody(decision: Decision): Promise<DeskBlock[]> {
    const { rows } = await (await pgPool()).query("SELECT body_json FROM decisions WHERE id = $1", [decision.id]);
    const raw = rows[0]?.body_json;
    if (!raw) return [];
    try {
      return JSON.parse(String(raw)) as DeskBlock[];
    } catch {
      return [{ id: `${decision.id}-p`, type: "paragraph", rich: spansFromPlain(String(raw)) }];
    }
  }

  async create(input: DecisionCreate): Promise<Decision> {
    const id = crypto.randomUUID();
    const raised = input.raisedBy ?? null;
    const row: Decision = withBrief(
      {
        id,
        url: input.url ?? `/d/${id}`,
        item: input.item.trim() || "Untitled",
        project: input.project ?? null,
        status: input.status ?? STATUS.waiting,
        owner: raised?.name ?? null,
        ownerColor: null,
        decisionNeeded: input.decisionNeeded ?? null,
        nextStep: input.nextStep ?? null,
        source: input.source ?? raised?.name ?? null,
        reply: null,
        lastUpdated: new Date().toISOString(),
        raisedBy: raised,
        lastChoice: null,
      },
      briefOf(input),
    );
    const body = input.body == null ? null : JSON.stringify(input.body);
    await (
      await pgPool()
    ).query(
      `INSERT INTO decisions (id, url, item, project, status, owner, owner_color, decision_needed, next_step, source, reply, last_updated, last_choice, raised_by_id, raised_by_name, parent_id, parent_name, body_json, brief_json)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)`,
      [
        row.id, row.url, row.item, row.project, row.status, row.owner, row.ownerColor,
        row.decisionNeeded, row.nextStep, row.source, row.reply, row.lastUpdated, row.lastChoice,
        raised?.id ?? null, raised?.name ?? null, raised?.parentId ?? null, raised?.parentName ?? null, body,
        briefJsonOf(row),
      ],
    );
    return row;
  }

  async recordVerdict(id: string, verdict: DecisionVerdictInput): Promise<Decision> {
    const current = await this.get(id);
    if (!current) throw new Error("not found");
    await (
      await pgPool()
    ).query(
      "UPDATE decisions SET status=$1, reply=$2, last_updated=$3, last_choice=$4, brief_json=$5 WHERE id=$6",
      [
        verdict.status,
        verdict.reply,
        verdict.lastUpdated,
        verdict.choice,
        briefJsonOf(current, {
          revisitAt: verdict.revisitAt ?? current.revisitAt ?? null,
          revisitState: verdict.revisitState ?? current.revisitState ?? null,
        }),
        id,
      ],
    );
    const next = await this.get(id);
    if (!next) throw new Error("not found");
    return next;
  }

  async patch(id: string, patch: DecisionPatch): Promise<Decision> {
    const current = await this.get(id);
    if (!current) throw new Error("not found");
    const next = applyPatchToRow(current, patch);
    await (
      await pgPool()
    ).query(
      "UPDATE decisions SET status=$1, reply=$2, last_updated=$3, last_choice=$4, brief_json=$5 WHERE id=$6",
      [next.status, next.reply, next.lastUpdated, next.lastChoice, briefJsonOf(next), id],
    );
    const saved = await this.get(id);
    if (!saved) throw new Error("not found");
    return saved;
  }

  async listDiscussion(id: string): Promise<DiscussionMessage[]> {
    const { rows } = await (await pgPool()).query(
      "SELECT * FROM discussion WHERE decision_id=$1 ORDER BY at ASC",
      [id],
    );
    return rows.map(messageFromRow);
  }

  async addDiscussion(message: Omit<DiscussionMessage, "id">): Promise<DiscussionMessage> {
    const full: DiscussionMessage = { ...message, id: crypto.randomUUID() };
    await (
      await pgPool()
    ).query(
      "INSERT INTO discussion (id, decision_id, author, agent_id, agent_name, body, at) VALUES ($1,$2,$3,$4,$5,$6,$7)",
      [full.id, full.decisionId, full.author, full.agentId, full.agentName, full.body, full.at],
    );
    return full;
  }
}

export class PostgresTaskStore implements TaskStore {
  readonly label = "Postgres board";

  async list(): Promise<TaskBoard> {
    const pool = await pgPool();
    const { rows } = await pool.query("SELECT * FROM tasks");
    const statuses = DEMO_TASK_STATUSES;
    return {
      tasks: rows.map(taskFromRow),
      schema: { statusOptions: statuses, areaOptions: DEMO_TASK_AREAS },
      columns: resolveColumns(statuses, configuredColumns()),
      fetchedAt: new Date().toISOString(),
    };
  }

  async create(input: TaskCreate): Promise<Task> {
    const title = input.title.replace(/\s+/g, " ").trim();
    if (!title) throw new TaskStoreError("A task needs a title.", "invalid");
    const raised = input.raisedBy ?? null;
    const task: Task = {
      id: crypto.randomUUID(),
      url: "/board",
      title,
      status: input.status,
      area: input.area ?? null,
      areaColor: null,
      due: input.due ?? null,
      priority: null,
      owner: raised?.name ?? null,
      rank: null,
      lastEdited: new Date().toISOString(),
      raisedBy: raised,
    };
    await (
      await pgPool()
    ).query(
      `INSERT INTO tasks (id, url, title, status, area, area_color, due, priority, owner, rank, last_edited, raised_by_id, raised_by_name, parent_id, parent_name)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
      [
        task.id, task.url, task.title, task.status, task.area, task.areaColor, task.due,
        task.priority, task.owner, task.rank, task.lastEdited,
        raised?.id ?? null, raised?.name ?? null, raised?.parentId ?? null, raised?.parentName ?? null,
      ],
    );
    return task;
  }

  async update(id: string, patch: TaskPatch): Promise<Task> {
    const { rows } = await (await pgPool()).query("SELECT * FROM tasks WHERE id=$1", [id]);
    if (!rows[0]) throw new TaskStoreError("That card isn't on the board.", "not_found");
    const task = applyPatch(taskFromRow(rows[0]), patch);
    task.lastEdited = new Date().toISOString();
    await (
      await pgPool()
    ).query("UPDATE tasks SET title=$1, status=$2, area=$3, due=$4, last_edited=$5 WHERE id=$6", [
      task.title, task.status, task.area, task.due, task.lastEdited, id,
    ]);
    return task;
  }
}

export class PostgresAgentStore implements AgentStore {
  readonly label = "Postgres agents";

  async list(): Promise<Agent[]> {
    const { rows } = await (await pgPool()).query("SELECT * FROM agents");
    return rows.map(agentFromRow);
  }

  async get(id: string): Promise<Agent | null> {
    const { rows } = await (await pgPool()).query("SELECT * FROM agents WHERE id=$1", [id]);
    return rows[0] ? agentFromRow(rows[0]) : null;
  }

  async create(input: {
    name: string;
    role: AgentRole;
    parentId: string | null;
    webhookUrl?: string | null;
  }): Promise<{ agent: Agent; plaintextKey: string; webhookSecret: string | null }> {
    const key = mintApiKey();
    const webhookUrl = input.webhookUrl?.trim() || null;
    const webhookSecret = webhookUrl ? mintWebhookSecret() : null;
    const agent: Agent = {
      id: crypto.randomUUID(),
      name: input.name.trim(),
      role: input.role,
      parentId: input.role === "lead" ? null : input.parentId,
      keyPrefix: key.prefix,
      keyHash: key.hash,
      webhookUrl,
      webhookSecret,
      createdAt: new Date().toISOString(),
      revokedAt: null,
    };
    await (
      await pgPool()
    ).query(
      `INSERT INTO agents (id, name, role, parent_id, key_prefix, key_hash, webhook_url, webhook_secret, created_at, revoked_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [
        agent.id, agent.name, agent.role, agent.parentId, agent.keyPrefix, agent.keyHash,
        agent.webhookUrl, agent.webhookSecret, agent.createdAt, agent.revokedAt,
      ],
    );
    return { agent, plaintextKey: key.plaintext, webhookSecret };
  }

  async revoke(id: string): Promise<Agent> {
    const agent = await this.get(id);
    if (!agent) throw new Error("Agent not found");
    const revokedAt = new Date().toISOString();
    await (await pgPool()).query("UPDATE agents SET revoked_at=$1 WHERE id=$2", [revokedAt, id]);
    return { ...agent, revokedAt };
  }

  async authenticate(plaintextKey: string): Promise<Agent | null> {
    const agents = await this.list();
    return agents.find((a) => !a.revokedAt && hashesEqual(plaintextKey, a.keyHash)) ?? null;
  }

  async setWebhook(id: string, webhookUrl: string | null, rotateSecret: boolean) {
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
    await (await pgPool()).query("UPDATE agents SET webhook_url=$1, webhook_secret=$2 WHERE id=$3", [
      url,
      stored,
      id,
    ]);
    return { agent: { ...agent, webhookUrl: url, webhookSecret: stored }, webhookSecret: secret };
  }
}
