#!/usr/bin/env node
/**
 * Static export for GitHub Pages. Stashes API routes, proxy, and server
 * actions so `output: 'export'` can succeed, then restores them.
 */
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const stash = path.join(root, ".demo-stash");

const moves = [
  ["src/app/api", "api"],
  ["src/app/actions", "actions"],
  ["src/proxy.ts", "proxy.ts"],
];

const STUB_AUTH = `export const handlers = {
  GET: async () => new Response(null, { status: 404 }),
  POST: async () => new Response(null, { status: 404 }),
};
export async function signIn(..._args: unknown[]) {}
export async function signOut(..._args: unknown[]) {}
export async function auth() {
  return { user: { email: "owner@acme.test", name: "Owner" } };
}
`;

const STUB_SIGNOUT = `export function SignOutButton() {
  return null;
}
`;

const overlays = [
  ["src/app/page.tsx", "home.tsx"],
  ["src/app/[view]/page.tsx", "view.tsx"],
  ["src/app/d/[id]/page.tsx", "decision.tsx"],
  ["src/app/board/page.tsx", "board.tsx"],
  ["src/app/settings/page.tsx", "settings.tsx"],
  ["src/app/signin/page.tsx", "signin.tsx"],
];

function moveAside() {
  rmSync(stash, { recursive: true, force: true });
  mkdirSync(stash, { recursive: true });
  for (const [from, name] of moves) {
    const src = path.join(root, from);
    if (!existsSync(src)) continue;
    cpSync(src, path.join(stash, name), { recursive: true });
    rmSync(src, { recursive: true, force: true });
  }
  if (existsSync(path.join(root, "src/auth.ts"))) {
    cpSync(path.join(root, "src/auth.ts"), path.join(stash, "auth.ts"));
    writeFileSync(path.join(root, "src/auth.ts"), STUB_AUTH);
  }
  if (existsSync(path.join(root, "src/components/sign-out-button.tsx"))) {
    cpSync(
      path.join(root, "src/components/sign-out-button.tsx"),
      path.join(stash, "sign-out-button.tsx"),
    );
    writeFileSync(path.join(root, "src/components/sign-out-button.tsx"), STUB_SIGNOUT);
  }
  const overlayDir = path.join(root, "scripts", "demo-pages");
  mkdirSync(path.join(stash, "pages"), { recursive: true });
  for (const [dest, name] of overlays) {
    const live = path.join(root, dest);
    const demo = path.join(overlayDir, name);
    if (!existsSync(live) || !existsSync(demo)) continue;
    cpSync(live, path.join(stash, "pages", name));
    cpSync(demo, live);
  }
}

function restore() {
  for (const [from, name] of moves) {
    const src = path.join(stash, name);
    if (!existsSync(src)) continue;
    rmSync(path.join(root, from), { recursive: true, force: true });
    cpSync(src, path.join(root, from), { recursive: true });
  }
  if (existsSync(path.join(stash, "auth.ts"))) {
    cpSync(path.join(stash, "auth.ts"), path.join(root, "src/auth.ts"));
  }
  if (existsSync(path.join(stash, "sign-out-button.tsx"))) {
    cpSync(
      path.join(stash, "sign-out-button.tsx"),
      path.join(root, "src/components/sign-out-button.tsx"),
    );
  }
  for (const [dest, name] of overlays) {
    const saved = path.join(stash, "pages", name);
    if (!existsSync(saved)) continue;
    cpSync(saved, path.join(root, dest));
  }
  rmSync(stash, { recursive: true, force: true });
}

moveAside();
let status = 1;
try {
  const env = {
    ...process.env,
    DESK_DEMO: "1",
    NEXT_PUBLIC_DESK_DEMO: "1",
    NEXT_PUBLIC_BASE_PATH: process.env.NEXT_PUBLIC_BASE_PATH ?? "",
  };
  const result = spawnSync("npx", ["next", "build"], {
    cwd: root,
    env,
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  status = result.status ?? 1;
} finally {
  restore();
}
process.exit(status);
