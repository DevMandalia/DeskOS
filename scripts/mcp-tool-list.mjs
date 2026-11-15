#!/usr/bin/env node
/**
 * Local verification: spawn the MCP stdio server and assert tools/list.
 */
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const serverPath = path.join(root, "mcp", "server.mjs");
const expected = ["raise_decision", "add_task", "list_items", "get_verdict", "reply_discussion", "add_chat", "list_chats", "update_chat"];

const child = spawn(process.execPath, [serverPath], {
  stdio: ["pipe", "pipe", "pipe"],
  env: { ...process.env, DESK_URL: "http://127.0.0.1:3000", DESK_TOKEN: "ddk_test" },
});

let buf = "";
const replies = [];

child.stdout.setEncoding("utf8");
child.stdout.on("data", (chunk) => {
  buf += chunk;
  let idx;
  while ((idx = buf.indexOf("\n")) >= 0) {
    const line = buf.slice(0, idx).trim();
    buf = buf.slice(idx + 1);
    if (line) replies.push(JSON.parse(line));
  }
});

function send(msg) {
  child.stdin.write(`${JSON.stringify(msg)}\n`);
}

send({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "mcp-tool-list", version: "0.1.0" } } });
send({ jsonrpc: "2.0", method: "notifications/initialized" });
send({ jsonrpc: "2.0", id: 2, method: "tools/list" });

const timeout = setTimeout(() => {
  child.kill();
  console.error("timed out waiting for tools/list");
  process.exit(1);
}, 5000);

function done() {
  clearTimeout(timeout);
  child.kill();
  const list = replies.find((r) => r.id === 2);
  const names = (list?.result?.tools ?? []).map((t) => t.name).sort();
  const want = [...expected].sort();
  if (JSON.stringify(names) !== JSON.stringify(want)) {
    console.error("tools/list mismatch", names, "expected", want, replies);
    process.exit(1);
  }
  console.log(`mcp tools/list ok: ${names.join(", ")}`);
  process.exit(0);
}

const check = setInterval(() => {
  if (replies.some((r) => r.id === 2)) {
    clearInterval(check);
    done();
  }
}, 50);
