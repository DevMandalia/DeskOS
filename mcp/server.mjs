#!/usr/bin/env node
/**
 * Stdio MCP client for DeskOS. Talks to the desk over REST with a
 * per-agent API key. Configure DESK_URL + DESK_TOKEN (or user_config in the .mcpb).
 */
import { createInterface } from "node:readline";

const DESK_URL = (process.env.DESK_URL ?? "http://127.0.0.1:3000").replace(/\/$/, "");
const DESK_TOKEN = process.env.DESK_TOKEN ?? "";

const TOOLS = [
  {
    name: "raise_decision",
    description: "Create a decision waiting on the owner.",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Short title" },
        decision_needed: { type: "string", description: "The question the owner must answer" },
        next_step: { type: "string" },
        area: { type: "string" },
        body: { type: "string" },
        options: {
          description: "Two to seven options. Array of strings, or newline/semicolon separated.",
          oneOf: [{ type: "array", items: { type: "string" } }, { type: "string" }],
        },
        recommendation: { type: "string" },
        door_type: { type: "string", description: "one_way or two_way" },
        cost_of_delay: { type: "string", description: "high | medium | low" },
        default_if_no_answer: {
          type: "object",
          properties: {
            choice: { type: "string", description: "Approve, Decline, or Park" },
            note: { type: "string" },
          },
        },
        deadline: { type: "string", description: "YYYY-MM-DD" },
        needs_split: { type: "boolean" },
        parent_id: { type: "string", description: "Existing decision id when raising a child" },
        batch_key: { type: "string", description: "Optional grouping slug for similar low-stakes items" },
      },
      required: ["title"],
    },
  },
  {
    name: "add_task",
    description: "Add a task to the board.",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string" },
        status: { type: "string" },
        area: { type: "string" },
        due: { type: "string", description: "YYYY-MM-DD" },
      },
      required: ["title"],
    },
  },
  {
    name: "list_items",
    description: "List this agent's decisions and tasks.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "add_chat",
    description: "Store a chat pointer (url + next step). Never scrapes or stores transcripts.",
    inputSchema: {
      type: "object",
      properties: {
        url: { type: "string" },
        app: { type: "string" },
        title: { type: "string" },
        next_step: { type: "string", description: "Where the owner left off" },
        come_back_by: { type: "string", description: "YYYY-MM-DD" },
        ephemeral: { type: "boolean" },
        note: { type: "string" },
      },
      required: ["next_step"],
    },
  },
  {
    name: "list_chats",
    description: "List chat pointers for this agent.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "update_chat",
    description: "Update a chat pointer. Cannot close or convert.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string" },
        title: { type: "string" },
        next_step: { type: "string" },
        come_back_by: { type: "string" },
        note: { type: "string" },
        app: { type: "string" },
      },
      required: ["id"],
    },
  },
  {
    name: "get_verdict",
    description: "Poll a decision for the owner's verdict and discussion thread.",
    inputSchema: {
      type: "object",
      properties: { id: { type: "string", description: "Decision id" } },
      required: ["id"],
    },
  },
  {
    name: "reply_discussion",
    description: "Reply in a Discuss thread when it is the agent's turn.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Decision id" },
        message: { type: "string" },
      },
      required: ["id", "message"],
    },
  },
];

function textResult(payload) {
  return { content: [{ type: "text", text: JSON.stringify(payload, null, 2) }] };
}

function errorResult(message) {
  return { content: [{ type: "text", text: message }], isError: true };
}

async function desk(path, opts = {}) {
  if (!DESK_TOKEN) throw new Error("DESK_TOKEN is not set");
  const res = await fetch(`${DESK_URL}${path}`, {
    ...opts,
    headers: {
      Authorization: `Bearer ${DESK_TOKEN}`,
      "Content-Type": "application/json",
      ...(opts.headers ?? {}),
    },
  });
  const body = await res.text();
  let json;
  try {
    json = body ? JSON.parse(body) : null;
  } catch {
    json = { raw: body };
  }
  if (!res.ok) {
    const err = new Error(`HTTP ${res.status}`);
    err.status = res.status;
    err.body = json;
    throw err;
  }
  return json;
}

async function callTool(name, args = {}) {
  switch (name) {
    case "raise_decision":
      return textResult(
        await desk("/api/v1/decisions", {
          method: "POST",
          body: JSON.stringify({
            title: args.title,
            item: args.title,
            decision_needed: args.decision_needed,
            next_step: args.next_step,
            area: args.area,
            body: args.body,
            options: args.options,
            recommendation: args.recommendation,
            door_type: args.door_type ?? args.door,
            cost_of_delay: args.cost_of_delay,
            default_if_no_answer: args.default_if_no_answer,
            deadline: args.deadline,
            needs_split: args.needs_split,
            parent_id: args.parent_id,
            batch_key: args.batch_key,
          }),
        }),
      );
    case "add_task":
      return textResult(
        await desk("/api/v1/tasks", {
          method: "POST",
          body: JSON.stringify({
            title: args.title,
            status: args.status,
            area: args.area,
            due: args.due,
          }),
        }),
      );
    case "list_items":
      return textResult(await desk("/api/v1/items"));
    case "add_chat":
      return textResult(
        await desk("/api/v1/chats", {
          method: "POST",
          body: JSON.stringify({
            url: args.url,
            app: args.app,
            title: args.title,
            next_step: args.next_step ?? args.left_off_at,
            come_back_by: args.come_back_by,
            ephemeral: args.ephemeral,
            note: args.note,
          }),
        }),
      );
    case "list_chats":
      return textResult(await desk("/api/v1/chats"));
    case "update_chat":
      return textResult(
        await desk(`/api/v1/chats/${encodeURIComponent(args.id)}`, {
          method: "PATCH",
          body: JSON.stringify({
            title: args.title,
            next_step: args.next_step,
            come_back_by: args.come_back_by,
            note: args.note,
            app: args.app,
          }),
        }),
      );
    case "get_verdict":
      return textResult(await desk(`/api/v1/decisions/${encodeURIComponent(args.id)}/verdict`));
    case "reply_discussion":
      return textResult(
        await desk(`/api/v1/decisions/${encodeURIComponent(args.id)}/replies`, {
          method: "POST",
          body: JSON.stringify({ message: args.message }),
        }),
      );
    default:
      return errorResult(`Unknown tool: ${name}`);
  }
}

async function handle(msg) {
  if (msg.method === "initialize") {
    return {
      protocolVersion: "2024-11-05",
      capabilities: { tools: {} },
      serverInfo: { name: "deskos", version: "0.1.1" },
    };
  }
  if (msg.method === "notifications/initialized") return null;
  if (msg.method === "ping") return {};
  if (msg.method === "tools/list") return { tools: TOOLS };
  if (msg.method === "tools/call") {
    try {
      return await callTool(msg.params?.name, msg.params?.arguments ?? {});
    } catch (err) {
      return errorResult(err instanceof Error ? err.message : String(err));
    }
  }
  return { error: { code: -32601, message: `Method not found: ${msg.method}` } };
}

function send(id, result) {
  const payload = { jsonrpc: "2.0", id, result };
  process.stdout.write(`${JSON.stringify(payload)}\n`);
}

function sendError(id, error) {
  process.stdout.write(`${JSON.stringify({ jsonrpc: "2.0", id, error })}\n`);
}

const rl = createInterface({ input: process.stdin });
rl.on("line", async (line) => {
  const trimmed = line.trim();
  if (!trimmed) return;
  let msg;
  try {
    msg = JSON.parse(trimmed);
  } catch {
    return;
  }
  if (msg.method && String(msg.method).startsWith("notifications/")) {
    await handle(msg);
    return;
  }
  try {
    const result = await handle(msg);
    if (result && result.error && !("jsonrpc" in result)) {
      sendError(msg.id ?? null, result.error);
      return;
    }
    if (result !== null) send(msg.id ?? null, result);
  } catch (err) {
    sendError(msg.id ?? null, { code: -32603, message: err instanceof Error ? err.message : String(err) });
  }
});
