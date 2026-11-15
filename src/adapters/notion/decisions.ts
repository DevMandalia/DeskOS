import { hyphenateId, idsEqual, stripId } from "@/lib/ids";
import { STATUS } from "@/lib/decide";
import type {
  Decision,
  DecisionCreate,
  DecisionSource,
  DecisionVerdictInput,
  DeskBlock,
  DiscussionMessage,
} from "@/lib/types";
import { MemoryDecisionSource } from "@/adapters/memory/decisions";
import { freshState } from "@/adapters/memory/state";
import {
  decisionsDataSourceId,
  liveSurface,
  notionPropMap,
  type NotionSurface,
} from "@/adapters/notion/client";
import { chunkRichText, spansFromNotion } from "@/adapters/notion/rich";

function plain(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  const item = value as {
    type?: string;
    title?: { plain_text?: string }[];
    rich_text?: { plain_text?: string }[];
    select?: { name?: string } | null;
    date?: { start?: string } | null;
  };
  if (item.type === "title" && Array.isArray(item.title)) {
    return item.title.map((t) => t.plain_text ?? "").join("") || null;
  }
  if (item.type === "rich_text" && Array.isArray(item.rich_text)) {
    return item.rich_text.map((t) => t.plain_text ?? "").join("") || null;
  }
  if (item.type === "select") return item.select?.name ?? null;
  if (item.type === "date") return item.date?.start ?? null;
  return null;
}

function propsOf(page: Record<string, unknown>): Record<string, unknown> {
  return (page.properties as Record<string, unknown>) ?? {};
}

/**
 * Example Notion adapter. Property names are env-driven. Discussion lives in a
 * desk-side memory sidecar so a Notion database doesn't have to model threads.
 * Pass `{ mock: true }` in tests to skip the live client.
 */
export class NotionDecisionSource implements DecisionSource {
  readonly label = "Notion";
  private readonly sidecar: MemoryDecisionSource;
  private readonly surface: NotionSurface | null;

  constructor(opts: { mock?: boolean; surface?: NotionSurface } = {}) {
    this.sidecar = new MemoryDecisionSource(opts.mock ? freshState() : undefined);
    this.surface = opts.mock ? null : (opts.surface ?? liveSurface());
  }

  async list(): Promise<Decision[]> {
    if (!this.surface) return this.sidecar.list();
    const rows: Decision[] = [];
    let cursor: string | undefined;
    do {
      const res = await this.surface.dataSources.query({
        data_source_id: decisionsDataSourceId(),
        start_cursor: cursor,
        page_size: 100,
      });
      for (const result of res.results) {
        const page = result as Record<string, unknown>;
        if (page.object && page.object !== "page") continue;
        rows.push(this.toDecision(page));
      }
      cursor = res.has_more ? (res.next_cursor ?? undefined) : undefined;
    } while (cursor);
    return rows;
  }

  async get(id: string): Promise<Decision | null> {
    if (!this.surface) return this.sidecar.get(id);
    try {
      const page = await this.surface.pages.retrieve({ page_id: hyphenateId(id) });
      return this.toDecision(page as Record<string, unknown>);
    } catch {
      return null;
    }
  }

  async getBody(decision: Decision): Promise<DeskBlock[]> {
    if (!this.surface) return this.sidecar.getBody(decision);
    const children = await this.surface.blocks.children.list({
      block_id: hyphenateId(decision.id),
      page_size: 100,
    });
    const blocks: DeskBlock[] = [];
    for (const raw of children.results) {
      const block = raw as Record<string, unknown>;
      const type = String(block.type);
      if (type === "paragraph" || type === "heading_1" || type === "heading_2" || type === "heading_3") {
        const payload = block[type] as { rich_text?: unknown };
        blocks.push({
          id: String(block.id),
          type,
          rich: spansFromNotion(payload?.rich_text),
        });
      }
    }
    return blocks;
  }

  async create(input: DecisionCreate): Promise<Decision> {
    if (!this.surface) return this.sidecar.create(input);
    const map = notionPropMap();
    const page = (await this.surface.pages.create({
      parent: { type: "data_source_id", data_source_id: decisionsDataSourceId() },
      properties: {
        [map.title]: { title: chunkRichText(input.item) },
        [map.decision]: input.decisionNeeded ? { rich_text: chunkRichText(input.decisionNeeded) } : undefined,
        [map.status]: { select: { name: input.status ?? STATUS.waiting } },
        [map.raisedBy]: input.raisedBy ? { rich_text: chunkRichText(input.raisedBy.name) } : undefined,
      },
    })) as Record<string, unknown>;
    return this.toDecision(page);
  }

  async recordVerdict(id: string, verdict: DecisionVerdictInput): Promise<Decision> {
    if (!this.surface) return this.sidecar.recordVerdict(id, verdict);
    const map = notionPropMap();
    await this.surface.pages.update({
      page_id: hyphenateId(id),
      properties: {
        [map.reply]: { rich_text: chunkRichText(verdict.reply) },
        [map.status]: { select: { name: verdict.status } },
        [map.updated]: { date: { start: verdict.lastUpdated } },
      },
    });
    const next = await this.get(id);
    if (!next) throw new Error("not found");
    return next;
  }

  async listDiscussion(id: string): Promise<DiscussionMessage[]> {
    return this.sidecar.listDiscussion(id);
  }

  async addDiscussion(message: Omit<DiscussionMessage, "id">): Promise<DiscussionMessage> {
    return this.sidecar.addDiscussion(message);
  }

  async hasIdempotencyKey(key: string) {
    return this.sidecar.hasIdempotencyKey(key);
  }

  async rememberIdempotencyKey(key: string) {
    return this.sidecar.rememberIdempotencyKey(key);
  }

  private toDecision(page: Record<string, unknown>): Decision {
    const map = notionPropMap();
    const props = propsOf(page);
    const id = hyphenateId(String(page.id ?? ""));
    const name = plain(props[map.raisedBy]);
    return {
      id,
      url: typeof page.url === "string" ? page.url : `/d/${id}`,
      item: plain(props[map.title]) ?? "Untitled",
      project: plain(props[map.area]),
      status: plain(props[map.status]),
      owner: name,
      ownerColor: null,
      decisionNeeded: plain(props[map.decision]),
      nextStep: plain(props[map.next]),
      source: plain(props[map.source]),
      reply: plain(props[map.reply]),
      lastUpdated: plain(props[map.updated]),
      raisedBy: name
        ? { id: stripId(name), name, parentId: plain(props[map.parent]), parentName: plain(props[map.parent]) }
        : null,
      lastChoice: null,
    };
  }
}

export function createNotionDecisionSource(opts: { mock?: boolean; surface?: NotionSurface } = {}): DecisionSource {
  return new NotionDecisionSource(opts);
}

export { idsEqual };
