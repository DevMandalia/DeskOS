import { applyPatchToRow, briefOf, withBrief } from "@/lib/brief-fields";
import { parseChoiceFromReply, parseRevisitFromReply } from "../../../contract";
import { hyphenateId, idsEqual, stripId } from "@/lib/ids";
import { STATUS } from "@/lib/decide";
import type {
  Decision,
  DecisionCreate,
  DecisionPatch,
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

function extraWriteProps(page: Record<string, unknown>, brief: Partial<Decision>): Record<string, unknown> {
  const map = notionPropMap();
  const existing = propsOf(page);
  const out: Record<string, unknown> = {};
  const put = (name: string, value: unknown) => {
    if (name in existing) out[name] = value;
  };
  if (brief.options !== undefined) put(map.options, { rich_text: chunkRichText((brief.options ?? []).join("\n")) });
  if (brief.recommendation !== undefined) put(map.recommendation, { rich_text: chunkRichText(brief.recommendation ?? "") });
  if (brief.doorType !== undefined) put(map.doorType, { select: brief.doorType ? { name: brief.doorType } : null });
  if (brief.costOfDelay !== undefined) put(map.costOfDelay, { select: brief.costOfDelay ? { name: brief.costOfDelay } : null });
  if (brief.deadline !== undefined) put(map.deadline, { date: brief.deadline ? { start: brief.deadline } : null });
  if (brief.defaultIfNoAnswer !== undefined) {
    put(map.defaultChoice, { select: brief.defaultIfNoAnswer ? { name: brief.defaultIfNoAnswer.choice } : null });
    put(map.defaultNote, { rich_text: chunkRichText(brief.defaultIfNoAnswer?.note ?? "") });
  }
  if (brief.needsSplit !== undefined) put(map.needsSplit, { checkbox: Boolean(brief.needsSplit) });
  if (brief.splitReason !== undefined) put(map.splitReason, { rich_text: chunkRichText(brief.splitReason ?? "") });
  if (brief.parentId !== undefined) put(map.parentDecision, { rich_text: chunkRichText(brief.parentId ?? "") });
  if (brief.splitSentBackAt !== undefined) {
    put(map.splitSentBack, { date: brief.splitSentBackAt ? { start: brief.splitSentBackAt } : null });
  }
  if (brief.revisitAt !== undefined) put(map.revisitAt, { date: brief.revisitAt ? { start: brief.revisitAt } : null });
  if (brief.revisitState !== undefined) {
    put(map.revisitState, { select: brief.revisitState ? { name: brief.revisitState } : null });
  }
  if (brief.briefOverrides !== undefined) {
    put(map.briefOverrides, { rich_text: chunkRichText(JSON.stringify(brief.briefOverrides ?? [])) });
  }
  return out;
}

async function tryWriteExtra(
  surface: NotionSurface,
  page: Record<string, unknown>,
  brief: Partial<Decision>,
): Promise<void> {
  const extra = extraWriteProps(page, brief);
  if (Object.keys(extra).length === 0) return;
  try {
    await surface.pages.update({ page_id: String(page.id), properties: extra });
  } catch {
    // Extra properties are optional. Missing schema must not fail the save.
  }
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
    const brief = briefOf(input);
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
    await tryWriteExtra(this.surface, page, brief);
    return withBrief(this.toDecision(page), brief);
  }

  async patch(id: string, patch: DecisionPatch): Promise<Decision> {
    if (!this.surface) return this.sidecar.patch(id, patch);
    const current = await this.get(id);
    if (!current) throw new Error("not found");
    try {
      const page = (await this.surface.pages.retrieve({ page_id: hyphenateId(id) })) as Record<string, unknown>;
      await tryWriteExtra(this.surface, page, patch);
    } catch {
      // Extra properties are optional.
    }
    try {
      return await this.sidecar.patch(id, patch);
    } catch {
      return applyPatchToRow(current, patch);
    }
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
    try {
      const page = (await this.surface.pages.retrieve({ page_id: hyphenateId(id) })) as Record<string, unknown>;
      await tryWriteExtra(this.surface, page, {
        revisitAt: verdict.revisitAt,
        revisitState: verdict.revisitState,
      });
    } catch {
      // Extra properties are optional.
    }
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
      createdAt: typeof page.created_time === "string" ? page.created_time : null,
      raisedBy: name
        ? { id: stripId(name), name, parentId: plain(props[map.parent]), parentName: plain(props[map.parent]) }
        : null,
      lastChoice: parseChoiceFromReply(plain(props[map.reply])),
      revisitAt: parseYmdSafe(plain(props[map.revisitAt])) ?? parseRevisitFromReply(plain(props[map.reply])),
      doorType: asDoor(plain(props[map.doorType])),
      costOfDelay: asCost(plain(props[map.costOfDelay])),
      deadline: parseYmdSafe(plain(props[map.deadline])),
      recommendation: plain(props[map.recommendation]),
      options: parseOptions(plain(props[map.options])),
      defaultIfNoAnswer: parseDefault(plain(props[map.defaultChoice]), plain(props[map.defaultNote])),
      needsSplit: asBool(props[map.needsSplit]),
      splitReason: plain(props[map.splitReason]),
      parentId: plain(props[map.parentDecision]),
      splitSentBackAt: parseYmdSafe(plain(props[map.splitSentBack])),
      revisitState: asRevisit(plain(props[map.revisitState])),
      briefOverrides: parseOverrides(plain(props[map.briefOverrides])),
    };
  }
}

function parseYmdSafe(value: string | null): string | null {
  return value && /^\d{4}-\d{2}-\d{2}/.test(value) ? value.slice(0, 10) : null;
}

function asDoor(value: string | null): Decision["doorType"] {
  return value === "one_way" || value === "two_way" ? value : null;
}

function asCost(value: string | null): Decision["costOfDelay"] {
  return value === "high" || value === "medium" || value === "low" ? value : null;
}

function asRevisit(value: string | null): Decision["revisitState"] {
  return value === "scheduled" || value === "expired" ? value : null;
}

function asBool(value: unknown): boolean | null {
  if (!value || typeof value !== "object") return null;
  const item = value as { type?: string; checkbox?: boolean };
  if (item.type === "checkbox") return Boolean(item.checkbox);
  return null;
}

function parseOptions(value: string | null): string[] | null {
  if (!value) return null;
  const items = value.split(/\n|;/).map((part) => part.trim()).filter(Boolean);
  return items.length ? items : null;
}

function parseDefault(choice: string | null, note: string | null): Decision["defaultIfNoAnswer"] {
  if (choice !== "Approve" && choice !== "Decline" && choice !== "Park") return null;
  return { choice, note };
}

function parseOverrides(value: string | null): Decision["briefOverrides"] {
  if (!value) return undefined;
  try {
    const parsed = JSON.parse(value) as Decision["briefOverrides"];
    return Array.isArray(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

export function createNotionDecisionSource(opts: { mock?: boolean; surface?: NotionSurface } = {}): DecisionSource {
  return new NotionDecisionSource(opts);
}

export { idsEqual };
