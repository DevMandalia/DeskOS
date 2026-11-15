import { applyPatch, configuredColumns, resolveColumns } from "@/lib/board";
import {
  TaskStoreError,
  type Task,
  type TaskBoard,
  type TaskCreate,
  type TaskPatch,
  type TaskStore,
} from "@/lib/tasks/types";
import { DEMO_TASK_AREAS, DEMO_TASK_STATUSES } from "@/lib/seed";
import { metaJson, sqliteDb, taskFromRow } from "@/adapters/sqlite/db";

export class SqliteTaskStore implements TaskStore {
  readonly label = "SQLite board";

  constructor(private readonly file?: string) {}

  private db() {
    return sqliteDb(this.file);
  }

  async list(): Promise<TaskBoard> {
    const db = this.db();
    const statuses = metaJson<string[]>(db, "task_statuses", DEMO_TASK_STATUSES);
    const areas = metaJson<{ name: string; color: string | null }[]>(db, "task_areas", DEMO_TASK_AREAS);
    return {
      tasks: db.prepare("SELECT * FROM tasks").all().map(taskFromRow),
      schema: { statusOptions: statuses, areaOptions: areas },
      columns: resolveColumns(statuses, configuredColumns()),
      fetchedAt: new Date().toISOString(),
    };
  }

  async create(input: TaskCreate): Promise<Task> {
    const db = this.db();
    const statuses = metaJson<string[]>(db, "task_statuses", DEMO_TASK_STATUSES);
    const areas = metaJson<{ name: string; color: string | null }[]>(db, "task_areas", DEMO_TASK_AREAS);
    const title = input.title.replace(/\s+/g, " ").trim();
    if (!title) throw new TaskStoreError("A task needs a title.", "invalid");
    if (!statuses.includes(input.status)) throw new TaskStoreError(`Unknown status "${input.status}".`, "invalid");
    const raised = input.raisedBy ?? null;
    const task: Task = {
      id: crypto.randomUUID(),
      url: "/board",
      title,
      status: input.status,
      area: input.area ?? null,
      areaColor: areas.find((a) => a.name === input.area)?.color ?? null,
      due: input.due ?? null,
      priority: null,
      owner: raised?.name ?? null,
      rank: null,
      lastEdited: new Date().toISOString(),
      raisedBy: raised,
    };
    db.prepare(
      `INSERT INTO tasks (id, url, title, status, area, area_color, due, priority, owner, rank, last_edited, raised_by_id, raised_by_name, parent_id, parent_name)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      task.id,
      task.url,
      task.title,
      task.status,
      task.area,
      task.areaColor,
      task.due,
      task.priority,
      task.owner,
      task.rank,
      task.lastEdited,
      raised?.id ?? null,
      raised?.name ?? null,
      raised?.parentId ?? null,
      raised?.parentName ?? null,
    );
    return task;
  }

  async update(id: string, patch: TaskPatch): Promise<Task> {
    const db = this.db();
    const statuses = metaJson<string[]>(db, "task_statuses", DEMO_TASK_STATUSES);
    const row = db.prepare("SELECT * FROM tasks WHERE id = ?").get(id);
    if (!row) throw new TaskStoreError("That card isn't on the board.", "not_found");
    if (patch.status !== undefined && !statuses.includes(patch.status)) {
      throw new TaskStoreError(`Unknown status "${patch.status}".`, "invalid");
    }
    if (patch.title !== undefined && !patch.title.trim()) {
      throw new TaskStoreError("A task needs a title.", "invalid");
    }
    const task = applyPatch(taskFromRow(row), patch);
    task.lastEdited = new Date().toISOString();
    db.prepare(
      `UPDATE tasks SET title = ?, status = ?, area = ?, area_color = ?, due = ?, last_edited = ? WHERE id = ?`,
    ).run(task.title, task.status, task.area, task.areaColor, task.due, task.lastEdited, id);
    return task;
  }
}

export function createSqliteTaskStore(file?: string): TaskStore {
  return new SqliteTaskStore(file);
}
