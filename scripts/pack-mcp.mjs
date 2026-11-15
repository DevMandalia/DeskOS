#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
mkdirSync(path.join(root, "dist"), { recursive: true });
const out = path.join(root, "dist", "decision-desk.mcpb");
const result = spawnSync("npx", ["--yes", "@anthropic-ai/mcpb", "pack", "mcp", out], {
  cwd: root,
  stdio: "inherit",
  shell: process.platform === "win32",
});
process.exit(result.status ?? 1);
