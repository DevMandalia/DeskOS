import { idsEqual } from "@/lib/ids";
import { spansFromPlain } from "@/lib/rich";
import { STATUS } from "@/lib/decide";
import type {
  Decision,
  DecisionCreate,
  DecisionSource,
  DecisionVerdictInput,
  DeskBlock,
  DiscussionMessage,
} from "@/lib/types";
import { decisionFromRow, messageFromRow, sqliteDb } from "@/adapters/sqlite/db";

function asBlocks(id: string, raw: string | null): DeskBlock[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as DeskBlock[] | string;
    if (typeof parsed === "string") {
      return [{ id: `${id}-p`, type: "paragraph", rich: spansFromPlain(parsed) }];
    }
    return parsed;
  } catch {
    return [{ id: `${id}-p`, type: "paragraph", rich: spansFromPlain(raw) }];
  }
}

export class SqliteDecisionSource implements DecisionSource {
  readonly label = "SQLite";

  constructor(private readonly file?: string) {}

  private db() {
    return sqliteDb(this.file);
  }

  async list(): Promise<Decision[]> {
    return this.db()
      .prepare("SELECT * FROM decisions")
      .all()
      .map(decisionFromRow);
  }

  async get(id: string): Promise<Decision | null> {
    const rows = this.db().prepare("SELECT * FROM decisions").all().map(decisionFromRow);
    return rows.find((d) => idsEqual(d.id, id)) ?? null;
  }

  async getBody(decision: Decision): Promise<DeskBlock[]> {
    const row = this.db().prepare("SELECT body_json FROM decisions WHERE id = ?").get(decision.id);
    return asBlocks(decision.id, row ? String(row.body_json ?? "") || null : null);
  }

  async create(input: DecisionCreate): Promise<Decision> {
    const id = crypto.randomUUID();
    const raised = input.raisedBy ?? null;
    const row: Decision = {
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
    };
    const body =
      input.body == null
        ? null
        : typeof input.body === "string"
          ? JSON.stringify([{ id: `${id}-p`, type: "paragraph", rich: spansFromPlain(input.body) }])
          : JSON.stringify(input.body);
    this.db()
      .prepare(
        `INSERT INTO decisions (id, url, item, project, status, owner, owner_color, decision_needed, next_step, source, reply, last_updated, last_choice, raised_by_id, raised_by_name, parent_id, parent_name, body_json)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        row.id,
        row.url,
        row.item,
        row.project,
        row.status,
        row.owner,
        row.ownerColor,
        row.decisionNeeded,
        row.nextStep,
        row.source,
        row.reply,
        row.lastUpdated,
        row.lastChoice,
        raised?.id ?? null,
        raised?.name ?? null,
        raised?.parentId ?? null,
        raised?.parentName ?? null,
        body,
      );
    return row;
  }

  async recordVerdict(id: string, verdict: DecisionVerdictInput): Promise<Decision> {
    const current = await this.get(id);
    if (!current) throw new Error("not found");
    this.db()
      .prepare(
        "UPDATE decisions SET status = ?, reply = ?, last_updated = ?, last_choice = ? WHERE id = ?",
      )
      .run(verdict.status, verdict.reply, verdict.lastUpdated, verdict.choice, current.id);
    return (await this.get(id))!;
  }

  async listDiscussion(id: string): Promise<DiscussionMessage[]> {
    return this.db()
      .prepare("SELECT * FROM discussion WHERE decision_id = ? ORDER BY at ASC")
      .all(id)
      .map(messageFromRow);
  }

  async addDiscussion(message: Omit<DiscussionMessage, "id">): Promise<DiscussionMessage> {
    const full: DiscussionMessage = { ...message, id: crypto.randomUUID() };
    this.db()
      .prepare(
        "INSERT INTO discussion (id, decision_id, author, agent_id, agent_name, body, at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      )
      .run(full.id, full.decisionId, full.author, full.agentId, full.agentName, full.body, full.at);
    return full;
  }

  async hasIdempotencyKey(key: string): Promise<boolean> {
    const row = this.db().prepare("SELECT key FROM idempotency WHERE key = ?").get(key);
    return Boolean(row);
  }

  async rememberIdempotencyKey(key: string): Promise<void> {
    if (!key) return;
    this.db().prepare("INSERT OR IGNORE INTO idempotency (key, at) VALUES (?, ?)").run(key, new Date().toISOString());
  }
}

export function createSqliteDecisionSource(file?: string): DecisionSource {
  return new SqliteDecisionSource(file);
}
