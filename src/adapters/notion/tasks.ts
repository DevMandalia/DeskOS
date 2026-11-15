import { configuredColumns, resolveColumns } from "@/lib/board";
import { hyphenateId, stripId } from "@/lib/ids";
import {
  TaskStoreError,
  type Task,
  type TaskBoard,
  type TaskCreate,
  type TaskPatch,
  type TaskStore,
} from "@/lib/tasks/types";
import { MemoryTaskStore } from "@/adapters/memory/tasks";
import { freshState } from "@/adapters/memory/state";
import { liveSurface, notionPropMap, tasksDataSourceId, type NotionSurface } from "@/adapters/notion/client";
import { chunkRichText } from "@/adapters/notion/rich";

export class NotionTaskStore implements TaskStore {
  readonly label = "Notion board";
  private readonly sidecar: MemoryTaskStore;
  private readonly surface: NotionSurface | null;

  constructor(opts: { mock?: boolean; surface?: NotionSurface } = {}) {
    this.sidecar = new MemoryTaskStore(opts.mock ? freshState() : undefined);
    this.surface = opts.mock ? null : (opts.surface ?? liveSurface());
  }

  async list(): Promise<TaskBoard> {
    if (!this.surface) return this.sidecar.list();
    const map = notionPropMap();
    const ds = (await this.surface.dataSources.retrieve({
      data_source_id: tasksDataSourceId(),
    })) as { properties?: Record<string, { select?: { options?: { name: string; color?: string }[] }; status?: { options?: { name: string }[] } }> };
    const statusProp = ds.properties?.[map.status];
    const statusOptions =
      statusProp?.status?.options?.map((o) => o.name) ??
      statusProp?.select?.options?.map((o) => o.name) ??
      [];
    const areaProp = ds.properties?.[map.area];
    const areaOptions = (areaProp?.select?.options ?? []).map((o) => ({
      name: o.name,
      color: o.color ?? null,
    }));
    const tasks: Task[] = [];
    let cursor: string | undefined;
    do {
      const res = await this.surface.dataSources.query({
        data_source_id: tasksDataSourceId(),
        start_cursor: cursor,
        page_size: 100,
      });
      for (const result of res.results) {
        tasks.push(this.toTask(result as Record<string, unknown>));
      }
      cursor = res.has_more ? (res.next_cursor ?? undefined) : undefined;
    } while (cursor);
    return {
      tasks,
      schema: { statusOptions, areaOptions },
      columns: resolveColumns(statusOptions, configuredColumns()),
      fetchedAt: new Date().toISOString(),
    };
  }

  async create(input: TaskCreate): Promise<Task> {
    if (!this.surface) return this.sidecar.create(input);
    const map = notionPropMap();
    const page = (await this.surface.pages.create({
      parent: { type: "data_source_id", data_source_id: tasksDataSourceId() },
      properties: {
        [map.title]: { title: chunkRichText(input.title) },
        [map.status]: { select: { name: input.status } },
      },
    })) as Record<string, unknown>;
    return this.toTask(page);
  }

  async update(id: string, patch: TaskPatch): Promise<Task> {
    if (!this.surface) return this.sidecar.update(id, patch);
    const map = notionPropMap();
    const properties: Record<string, unknown> = {};
    if (patch.title !== undefined) {
      if (!patch.title.trim()) throw new TaskStoreError("A task needs a title.", "invalid");
      properties[map.title] = { title: chunkRichText(patch.title) };
    }
    if (patch.status !== undefined) properties[map.status] = { select: { name: patch.status } };
    if (patch.due !== undefined) properties[map.due] = { date: patch.due ? { start: patch.due } : null };
    const page = (await this.surface.pages.update({
      page_id: hyphenateId(id),
      properties,
    })) as Record<string, unknown>;
    return this.toTask(page);
  }

  private toTask(page: Record<string, unknown>): Task {
    const map = notionPropMap();
    const props = (page.properties as Record<string, unknown>) ?? {};
    const id = hyphenateId(String(page.id ?? ""));
    const titleItems = (props[map.title] as { title?: { plain_text?: string }[] } | undefined)?.title ?? [];
    const title = titleItems.map((t) => t.plain_text ?? "").join("") || "Untitled";
    const status = (props[map.status] as { select?: { name?: string } | null } | undefined)?.select?.name ?? null;
    const area = (props[map.area] as { select?: { name?: string; color?: string } | null } | undefined)?.select;
    return {
      id,
      url: typeof page.url === "string" ? page.url : "/board",
      title,
      status,
      area: area?.name ?? null,
      areaColor: area?.color ?? null,
      due: (props[map.due] as { date?: { start?: string } | null } | undefined)?.date?.start ?? null,
      priority: null,
      owner: null,
      rank: null,
      lastEdited: typeof page.last_edited_time === "string" ? page.last_edited_time : null,
      raisedBy: null,
    };
  }
}

export function createNotionTaskStore(opts: { mock?: boolean; surface?: NotionSurface } = {}): TaskStore {
  return new NotionTaskStore(opts);
}

export { stripId };
