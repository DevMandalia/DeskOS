"use client";

import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
  type KeyboardCoordinateGetter,
} from "@dnd-kit/core";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from "react";

import {
  applyPatch,
  buildLanes,
  columnOf,
  dueLabel,
  LANE_LIMIT,
  mergeBoard,
  parseQuickAdd,
  quickAddStatus,
  resolveColumns,
  type BoardLane,
} from "@/lib/board";
import {
  doingCount,
  findDoingColumn,
  isDoingStatus,
  overflowIndex,
  wipMoveCheck,
  type WipEnforce,
} from "../../contract";
import { withBasePath } from "@/lib/base-path";
import { isStaticDemo } from "@/lib/demo-mode";
import { demoBoard, upsertDemoTask } from "@/lib/demo-store";
import { raisedByLabel } from "@/lib/agent-ref";
import type { BoardColumn, ColumnKey, Task, TaskBoard, TaskPatch } from "@/lib/tasks/types";

const API = withBasePath("/api/tasks");

type Props = {
  initial: TaskBoard | null;
  initialError: string | null;
  today: string;
  storeLabel: string;
  wipLimit?: number;
  wipEnforce?: WipEnforce;
};

/** Arrow keys jump a lifted card one column left or right (dnd-kit keyboard drag). */
const columnJump: KeyboardCoordinateGetter = (event, { context }) => {
  const { collisionRect, droppableRects, droppableContainers } = context;
  if (!collisionRect) return undefined;
  if (event.code !== "ArrowRight" && event.code !== "ArrowLeft") return undefined;
  event.preventDefault();
  const centers = droppableContainers
    .getEnabled()
    .map((c) => droppableRects.get(c.id))
    .filter((r): r is NonNullable<typeof r> => Boolean(r))
    .map((r) => r.left + r.width / 2)
    .sort((a, b) => a - b);
  const here = collisionRect.left + collisionRect.width / 2;
  const target =
    event.code === "ArrowRight" ? centers.find((x) => x > here + 4) : [...centers].reverse().find((x) => x < here - 4);
  if (target === undefined) return undefined;
  return { x: target - collisionRect.width / 2, y: collisionRect.top };
};

function isTyping(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  if (el.isContentEditable) return true;
  return Boolean(el.closest("input, textarea, select, [contenteditable='true']"));
}

export function BoardView({ initial, initialError, today, storeLabel, wipLimit = 3, wipEnforce = "confirm" }: Props) {
  const [tasks, setTasks] = useState<Task[]>(initial?.tasks ?? []);
  const [schema, setSchema] = useState(initial?.schema ?? { statusOptions: [], areaOptions: [] });
  const [error, setError] = useState<string | null>(initialError);
  const [notice, setNotice] = useState<string | null>(null);
  const [wipConfirm, setWipConfirm] = useState<{ task: Task; status: string } | null>(null);
  const [focusId, setFocusId] = useState<string | null>(() => {
    try {
      return localStorage.getItem("desk-focused-task-id");
    } catch {
      return null;
    }
  });
  const [area, setArea] = useState<string>("");
  const [dragging, setDragging] = useState<Task | null>(null);
  const [synced, setSynced] = useState<string | null>(initial?.fetchedAt ?? null);
  const pending = useRef(new Set<string>());
  const tasksRef = useRef(tasks);
  useEffect(() => {
    tasksRef.current = tasks;
  }, [tasks]);
  const quickRef = useRef<HTMLInputElement | null>(null);
  const [adding, setAdding] = useState(false);

  const [columns, setColumns] = useState<BoardColumn[]>(
    initial?.columns?.length ? initial.columns : resolveColumns(schema.statusOptions),
  );
  const areas = useMemo(() => schema.areaOptions.map((o) => o.name), [schema.areaOptions]);
  const [added, setAdded] = useState<ReadonlySet<string>>(() => new Set());
  const doing = findDoingColumn(columns);
  const inProgress = doingCount(tasks, doing);
  const activeFocus =
    focusId && doing && isDoingStatus(tasks.find((t) => t.id === focusId)?.status, doing) ? focusId : null;
  const focused = useMemo(() => {
    const set = new Set(added);
    if (activeFocus) set.add(activeFocus);
    return set;
  }, [added, activeFocus]);
  const lanes = useMemo(() => buildLanes(tasks, columns, area || null, focused), [tasks, columns, area, focused]);

  const pin = useCallback((id: string | null) => {
    setFocusId(id);
    try {
      if (id) localStorage.setItem("desk-focused-task-id", id);
      else localStorage.removeItem("desk-focused-task-id");
    } catch {
      /* ignore */
    }
  }, []);

  const refresh = useCallback(async () => {
    try {
      if (isStaticDemo()) {
        const body = demoBoard();
        setSchema(body.schema);
        setColumns(body.columns);
        setTasks(body.tasks);
        setSynced(body.fetchedAt);
        setError(null);
        return;
      }
      const res = await fetch(API, { cache: "no-store" });
      const body = (await res.json()) as TaskBoard & { error?: string };
      if (!res.ok) throw new Error(body.error ?? "Couldn't load the board.");
      setSchema(body.schema);
      if (body.columns?.length) setColumns(body.columns);
      setTasks(mergeBoard(body, tasksRef.current, pending.current));
      setSynced(body.fetchedAt);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load the board.");
    }
  }, []);

  // N focuses quick-add (not while typing elsewhere).
  useEffect(() => {
    function onKey(event: globalThis.KeyboardEvent) {
      if (event.key !== "n" && event.key !== "N") return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (isTyping(event.target)) return;
      event.preventDefault();
      setAdding(true);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (adding) quickRef.current?.focus();
  }, [adding]);

  const update = useCallback(async (task: Task, patch: TaskPatch, what: string) => {
    const before = tasksRef.current.find((t) => t.id === task.id);
    if (!before) return;
    pending.current.add(task.id);
    setTasks((all) => all.map((t) => (t.id === task.id ? applyPatch(t, patch) : t)));
    setNotice(null);
    try {
      if (isStaticDemo()) {
        const next = applyPatch(before, patch);
        next.lastEdited = new Date().toISOString();
        upsertDemoTask(next);
        setTasks((all) => all.map((t) => (t.id === task.id ? next : t)));
        setError(null);
        return;
      }
      const res = await fetch(`${API}/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const body = (await res.json()) as { task?: Task; error?: string };
      if (!res.ok || !body.task) throw new Error(body.error ?? "That change didn't save.");
      setTasks((all) => all.map((t) => (t.id === task.id ? body.task! : t)));
      setError(null);
    } catch (err) {
      setTasks((all) => all.map((t) => (t.id === task.id ? before : t)));
      setNotice(`${what} didn't save, so it's back where it was. ${err instanceof Error ? err.message : ""}`.trim());
    } finally {
      pending.current.delete(task.id);
    }
  }, []);

  const move = useCallback(
    (task: Task, key: ColumnKey, confirmed = false) => {
      const column = columns.find((c) => c.key === key);
      if (!column?.status) {
        setNotice(`Board has no "${column?.label ?? key}" status yet, so nothing moved.`);
        return;
      }
      if (columnOf(task, columns) === key) return;
      const check = wipMoveCheck(tasksRef.current, task.id, column.status, doing, {
        BOARD_WIP_LIMIT: String(wipLimit),
        BOARD_WIP_ENFORCE: wipEnforce,
      });
      if (check.over && wipEnforce === "block") {
        setNotice(`${check.nextCount - 1} are already in progress. Move one out first.`);
        return;
      }
      if (check.over && wipEnforce === "confirm" && !confirmed) {
        setWipConfirm({ task, status: column.status });
        return;
      }
      void update(task, { status: column.status }, `Moving "${task.title}"`);
    },
    [columns, doing, update, wipEnforce, wipLimit],
  );

  const add = useCallback(
    async (text: string, pickedArea: string, due: string, statusOverride?: string | null): Promise<boolean> => {
      const status = statusOverride || quickAddStatus(columns);
      const parsed = parseQuickAdd(text, areas);
      if (!parsed.title || !status) return false;
      const tempId = `tmp-${Date.now().toString(36)}`;
      const temp: Task = {
        id: tempId,
        url: "",
        title: parsed.title,
        status,
        area: parsed.area ?? (pickedArea || null),
        areaColor: null,
        due: due || null,
        priority: null,
        owner: null,
        rank: null,
        lastEdited: new Date().toISOString(),
        raisedBy: null,
      };
      pending.current.add(tempId);
      setAdded((s) => new Set(s).add(tempId));
      setTasks((all) => [temp, ...all]);
      setNotice(null);
      try {
        if (isStaticDemo()) {
          const saved = { ...temp, id: crypto.randomUUID(), url: "/board" };
          upsertDemoTask(saved);
          setAdded((s) => new Set(s).add(saved.id));
          setTasks((all) => all.map((t) => (t.id === tempId ? saved : t)));
          return true;
        }
        const res = await fetch(API, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: temp.title, status, area: temp.area, due: temp.due }),
        });
        const body = (await res.json()) as { task?: Task; error?: string };
        if (!res.ok || !body.task) throw new Error(body.error ?? "That task wasn't added.");
        setAdded((s) => new Set(s).add(body.task!.id));
        setTasks((all) => all.map((t) => (t.id === tempId ? body.task! : t)));
        return true;
      } catch (err) {
        setTasks((all) => all.filter((t) => t.id !== tempId));
        setNotice(`"${temp.title}" wasn't added. ${err instanceof Error ? err.message : ""}`.trim());
        return false;
      } finally {
        pending.current.delete(tempId);
      }
    },
    [columns, areas],
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: columnJump, scrollBehavior: "auto" }),
  );

  function onDragStart(event: DragStartEvent) {
    setDragging(tasksRef.current.find((t) => t.id === event.active.id) ?? null);
  }

  function onDragEnd(event: DragEndEvent) {
    const task = tasksRef.current.find((t) => t.id === event.active.id);
    setDragging(null);
    if (!task || !event.over) return;
    move(task, event.over.id as ColumnKey);
  }

  const addTo = columns.find((c) => c.status === quickAddStatus(columns));
  const shown = lanes.reduce((n, l) => n + l.tasks.length, 0);

  return (
    <div className="board">
      <header className="desk-head board-head">
        <div>
          <h1 className="home-hello" title={storeLabel}>
            Board
          </h1>
          <p className="desk-sub">
            {shown} {shown === 1 ? "task" : "tasks"}
            {area ? ` in ${area}` : ""}
            {doing ? ` · ${doing.label} ${inProgress}/${wipLimit}` : ""}
          </p>
        </div>
        <button
          type="button"
          className="board-new"
          onClick={() => setAdding(true)}
          disabled={!columns.some((c) => c.status)}
        >
          New to-do <kbd>N</kbd>
        </button>
      </header>

      {wipConfirm ? (
        <div className="modal-back" role="presentation" onClick={() => setWipConfirm(null)}>
          <div className="modal" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
            <h2>{inProgress} in progress. Move one out, or confirm overflow.</h2>
            <div className="modal-actions">
              <button
                type="button"
                className="btn btn-approve"
                onClick={() => {
                  const pendingMove = wipConfirm;
                  setWipConfirm(null);
                  void update(pendingMove.task, { status: pendingMove.status }, `Moving "${pendingMove.task.title}"`);
                }}
              >
                Confirm overflow
              </button>
              <button type="button" className="btn btn-discuss" onClick={() => setWipConfirm(null)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}
      <QuickAdd
        inputRef={quickRef}
        areas={areas}
        target={addTo?.label ?? null}
        onAdd={add}
        disabled={!columns.some((c) => c.status)}
        hidden={!adding}
        onClose={() => setAdding(false)}
      />

      <div className="board-tools">
        <label className="board-filter">
          <span>Area</span>
          <select value={area} onChange={(e) => setArea(e.target.value)}>
            <option value="">All areas</option>
            {areas.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className="text-btn board-refresh" onClick={() => void refresh()}>
          Refresh
        </button>
      </div>

      {error ? (
        <div className="board-alert" role="alert">
          {error}
        </div>
      ) : null}
      {notice ? (
        <div className="board-notice" role="status">
          {notice}
          <button type="button" className="text-btn" onClick={() => setNotice(null)}>
            Dismiss
          </button>
        </div>
      ) : null}

      <DndContext id="hq-board" sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setDragging(null)}>
        <div className="board-lanes" role="list" aria-label="Task columns">
          {lanes.map((lane) => (
            <Lane
              key={lane.key}
              lane={lane}
              columns={columns}
              areas={areas}
              today={today}
              onMove={move}
              onEdit={update}
              doing={doing}
              focusId={activeFocus}
              onPin={pin}
              wipLimit={wipLimit}
            />
          ))}
        </div>
        <DragOverlay dropAnimation={null}>
          {dragging ? <CardFace task={dragging} today={today} overlay /> : null}
        </DragOverlay>
      </DndContext>
      <p className="board-foot">
        Drag to move. <kbd>N</kbd> adds a task. <kbd>\</kbd> hides the side panels.
      </p>
    </div>
  );
}

function QuickAdd({
  inputRef,
  areas,
  target,
  onAdd,
  disabled,
  hidden = false,
  onClose,
}: {
  inputRef: React.RefObject<HTMLInputElement | null>;
  areas: string[];
  target: string | null;
  onAdd: (text: string, area: string, due: string, status?: string | null) => Promise<boolean>;
  disabled: boolean;
  hidden?: boolean;
  onClose?: () => void;
}) {
  const [text, setText] = useState("");
  const [area, setArea] = useState("");
  const [due, setDue] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    const value = text.trim();
    if (!value) return;
    setText("");
    const ok = await onAdd(value, area, due);
    if (ok) setDue("");
    else setText((now) => now || value);
    inputRef.current?.focus();
  }

  return (
    <form className="quick-add" onSubmit={submit} aria-label="Quick add a task" hidden={hidden}>
      <label className="sr-only" htmlFor="quick-add-input">
        New task
      </label>
      <input
        id="quick-add-input"
        ref={inputRef}
        className="quick-add-input"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
          if (e.key === "Escape") {
            (e.target as HTMLInputElement).blur();
            onClose?.();
          }
        }}
        placeholder="Title, then Enter"
        autoComplete="off"
        disabled={disabled}
        aria-keyshortcuts="N"
      />
      <div className="quick-add-opts">
        <label>
          <span className="sr-only">Area (optional)</span>
          <select value={area} onChange={(e) => setArea(e.target.value)} aria-label="Area (optional)">
            <option value="">No area</option>
            {areas.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="sr-only">Due date (optional)</span>
          <input type="date" value={due} onChange={(e) => setDue(e.target.value)} aria-label="Due date (optional)" />
        </label>
        <button type="submit" className="quick-add-btn" disabled={disabled || !text.trim()}>
          Add
        </button>
      </div>
      <p className="quick-add-hint">
        {target ?? "Board"}. <kbd>N</kbd> to add. <code>#Ops</code> for area. <kbd>Esc</kbd> closes.
      </p>
    </form>
  );
}

function Lane({
  lane,
  columns,
  areas,
  today,
  onMove,
  onEdit,
  doing,
  focusId,
  onPin,
  wipLimit,
}: {
  lane: BoardLane;
  columns: BoardColumn[];
  areas: string[];
  today: string;
  onMove: (task: Task, key: ColumnKey) => void;
  onEdit: (task: Task, patch: TaskPatch, what: string) => Promise<void>;
  doing: BoardColumn | null;
  focusId: string | null;
  onPin: (id: string | null) => void;
  wipLimit: number;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: lane.key, disabled: !lane.status });
  const [all, setAll] = useState(false);
  const isDoingLane = Boolean(doing && (lane.key === doing.key || lane.status === doing.status));
  const visible = all || isDoingLane ? lane.tasks : lane.tasks.slice(0, LANE_LIMIT);
  return (
    <section
      ref={setNodeRef}
      role="listitem"
      className={`lane lane-${lane.key} ${isOver ? "lane-over" : ""} ${lane.status ? "" : "lane-off"} ${isDoingLane ? "lane-doing" : ""}`}
      aria-labelledby={`lane-${lane.key}`}
      data-lane={lane.key}
    >
      <h2 className="lane-head" id={`lane-${lane.key}`}>
        <span>{lane.label}</span>
        <span className="lane-count">{lane.tasks.length}</span>
      </h2>
      {!lane.status ? (
        <p className="lane-empty">No {lane.label} status. Set BOARD_COLUMNS.</p>
      ) : null}
      <ul className="lane-cards">
        {visible.map((task, index) => (
          <TaskCard
            key={task.id}
            task={task}
            columns={columns}
            areas={areas}
            today={today}
            onMove={onMove}
            onEdit={onEdit}
            focused={task.id === focusId}
            overflow={isDoingLane && overflowIndex(index, task.id === focusId, wipLimit)}
            canPin={isDoingLane}
            onPin={onPin}
          />
        ))}
      </ul>
      {lane.tasks.length > visible.length ? (
        <button type="button" className="lane-more" onClick={() => setAll(true)}>
          Show {lane.tasks.length - visible.length} more
        </button>
      ) : null}
    </section>
  );
}

function CardFace({
  task,
  today,
  overlay = false,
  metaOnly = false,
}: {
  task: Task;
  today: string;
  overlay?: boolean;
  metaOnly?: boolean;
}) {
  const due = dueLabel(task.due, today);
  const meta = [task.area, raisedByLabel(task.raisedBy), task.priority].filter(Boolean);
  const metaLine =
    meta.length || due ? (
      <p className="task-meta">
        {meta.join(" · ")}
        {due ? (
          <>
            {meta.length ? " · " : ""}
            <span className={due.overdue ? "task-overdue" : ""}>{due.text}</span>
          </>
        ) : null}
      </p>
    ) : null;
  if (metaOnly) return metaLine;
  return (
    <div className={`task-face ${overlay ? "task-overlay" : ""}`}>
      <p className="task-title">{task.title}</p>
      {metaLine}
    </div>
  );
}

function TaskCard({
  task,
  columns,
  areas,
  today,
  onMove,
  onEdit,
  focused = false,
  overflow = false,
  canPin = false,
  onPin,
}: {
  task: Task;
  columns: BoardColumn[];
  areas: string[];
  today: string;
  onMove: (task: Task, key: ColumnKey) => void;
  onEdit: (task: Task, patch: TaskPatch, what: string) => Promise<void>;
  focused?: boolean;
  overflow?: boolean;
  canPin?: boolean;
  onPin?: (id: string | null) => void;
}) {
  const temp = task.id.startsWith("tmp-");
  const [editing, setEditing] = useState(false);
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: task.id, disabled: editing || temp });
  const current = columnOf(task, columns);
  const source = task.url && task.url.startsWith("http") ? task.url : null;

  return (
    <li
      className={`task ${isDragging ? "task-dragging" : ""} ${temp ? "task-saving task-added" : ""} ${focused ? "task-focus" : ""} ${overflow ? "task-overflow" : ""}`}
      data-task={task.id}
    >
      {editing ? (
        <TaskEditor
          task={task}
          areas={areas}
          source={source}
          onCancel={() => setEditing(false)}
          onSave={(patch) => {
            setEditing(false);
            if (Object.keys(patch).length) void onEdit(task, patch, `Editing "${task.title}"`);
          }}
        />
      ) : (
        <>
          <div className="task-grab">
            <span
              ref={setNodeRef}
              className="task-grip"
              {...listeners}
              {...attributes}
              aria-roledescription="draggable task"
              aria-label={`Move ${task.title}`}
            >
              ⋮⋮
            </span>
            <div className="task-face" onClick={() => !temp && setEditing(true)}>
              <button type="button" className="task-title-btn" disabled={temp}>
                {task.title}
              </button>
              <CardFace task={task} today={today} metaOnly />
            </div>
          </div>
          <div className="task-actions">
            {overflow ? <span className="task-overflow-badge">Overflow</span> : null}
            <details className="task-menu">
              <summary aria-label={`More for ${task.title}`}>⋯</summary>
              <div className="task-menu-panel">
                <button type="button" className="text-btn" disabled={temp} onClick={() => setEditing(true)}>
                  Edit
                </button>
                <label className="task-move">
                  <span className="sr-only">Move {task.title} to</span>
                  <select
                    value={current}
                    disabled={temp}
                    onChange={(e) => onMove(task, e.target.value as ColumnKey)}
                    aria-label={`Move "${task.title}" to`}
                  >
                    {columns.map((c) => (
                      <option key={c.key} value={c.key} disabled={!c.status}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </label>
                {canPin && onPin ? (
                  <button type="button" className="text-btn" disabled={temp} onClick={() => onPin(focused ? null : task.id)}>
                    {focused ? "Unpin" : "Pin"}
                  </button>
                ) : null}
                {source ? (
                  <a className="text-btn" href={source} target="_blank" rel="noreferrer">
                    Source
                  </a>
                ) : null}
              </div>
            </details>
          </div>
        </>
      )}
    </li>
  );
}

function TaskEditor({
  task,
  areas,
  source,
  onCancel,
  onSave,
}: {
  task: Task;
  areas: string[];
  source?: string | null;
  onCancel: () => void;
  onSave: (patch: TaskPatch) => void;
}) {
  const [title, setTitle] = useState(task.title);
  const [area, setArea] = useState(task.area ?? "");
  const [due, setDue] = useState(task.due?.slice(0, 10) ?? "");

  function submit(event: FormEvent) {
    event.preventDefault();
    const patch: TaskPatch = {};
    const t = title.replace(/\s+/g, " ").trim();
    if (t && t !== task.title) patch.title = t;
    if ((area || null) !== task.area) patch.area = area || null;
    if ((due || null) !== (task.due?.slice(0, 10) ?? null)) patch.due = due || null;
    onSave(patch);
  }

  return (
    <form className="task-edit" onSubmit={submit} onKeyDown={(e) => e.key === "Escape" && onCancel()}>
      <label>
        <span className="task-edit-label">Title</span>
        <input value={title} onChange={(e) => setTitle(e.target.value)} autoFocus required />
      </label>
      <label>
        <span className="task-edit-label">Area</span>
        <select value={area} onChange={(e) => setArea(e.target.value)}>
          <option value="">No area</option>
          {areas.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span className="task-edit-label">Due</span>
        <input type="date" value={due} onChange={(e) => setDue(e.target.value)} />
      </label>
      <div className="task-edit-actions">
        <button type="submit" className="quick-add-btn">
          Save
        </button>
        <button type="button" className="text-btn" onClick={onCancel}>
          Cancel
        </button>
        {source ? (
          <a className="text-btn" href={source} target="_blank" rel="noreferrer">
            Source
          </a>
        ) : null}
      </div>
    </form>
  );
}
