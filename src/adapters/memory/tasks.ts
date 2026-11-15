import { applyPatch, configuredColumns, resolveColumns } from "@/lib/board";
import { TaskStoreError, type Task, type TaskBoard, type TaskCreate, type TaskPatch, type TaskStore } from "@/lib/tasks/types";
import { clone, memoryState, persistMemory, type MemoryState } from "@/adapters/memory/state";

export class MemoryTaskStore implements TaskStore {
  readonly label = "Memory board";

  constructor(private readonly state: MemoryState = memoryState()) {}

  private snap() {
    return this.state;
  }

  async list(): Promise<TaskBoard> {
    const state = this.snap();
    return {
      tasks: clone(state.tasks),
      schema: { statusOptions: [...state.taskStatuses], areaOptions: clone(state.taskAreas) },
      columns: resolveColumns(state.taskStatuses, configuredColumns()),
      fetchedAt: new Date().toISOString(),
    };
  }

  async create(input: TaskCreate): Promise<Task> {
    const state = this.snap();
    const title = input.title.replace(/\s+/g, " ").trim();
    if (!title) throw new TaskStoreError("A task needs a title.", "invalid");
    if (!state.taskStatuses.includes(input.status)) {
      throw new TaskStoreError(`Unknown status "${input.status}".`, "invalid");
    }
    const raised = input.raisedBy ?? null;
    const task: Task = {
      id: crypto.randomUUID(),
      url: "/board",
      title,
      status: input.status,
      area: input.area ?? null,
      areaColor: state.taskAreas.find((a) => a.name === input.area)?.color ?? null,
      due: input.due ?? null,
      priority: null,
      owner: raised?.name ?? null,
      rank: null,
      lastEdited: new Date().toISOString(),
      raisedBy: raised,
    };
    state.tasks.unshift(task);
    await persistMemory();
    return clone(task);
  }

  async update(id: string, patch: TaskPatch): Promise<Task> {
    const state = this.snap();
    const task = state.tasks.find((t) => t.id === id);
    if (!task) throw new TaskStoreError("That card isn't on the board.", "not_found");
    if (patch.status !== undefined && !state.taskStatuses.includes(patch.status)) {
      throw new TaskStoreError(`Unknown status "${patch.status}".`, "invalid");
    }
    if (patch.title !== undefined && !patch.title.trim()) {
      throw new TaskStoreError("A task needs a title.", "invalid");
    }
    const next = applyPatch(task, patch);
    next.lastEdited = new Date().toISOString();
    next.areaColor = state.taskAreas.find((a) => a.name === next.area)?.color ?? null;
    Object.assign(task, next);
    await persistMemory();
    return clone(task);
  }
}

export function createMemoryTaskStore(): TaskStore {
  return new MemoryTaskStore();
}
