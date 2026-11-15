#!/usr/bin/env node
/**
 * Capture demo screenshots + a short GIF. Demo data only.
 */
import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, cp } from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = "/Users/DevaangMandalia/.grok-scratch/decision-desk-oss";
const DOCS = path.join(root, "docs");
const PORT = 4173;
const BASE = `http://127.0.0.1:${PORT}`;
const RENEW = "a1111111-1111-4111-8111-111111111111";

function waitForServer(url, ms = 30_000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tick = () => {
      http
        .get(url, (res) => {
          res.resume();
          resolve();
        })
        .on("error", () => {
          if (Date.now() - start > ms) reject(new Error(`timeout waiting for ${url}`));
          else setTimeout(tick, 250);
        });
    };
    tick();
  });
}

async function shot(page, name, width, dests) {
  const height = width === 390 ? 844 : 900;
  await page.setViewportSize({ width, height });
  await page.waitForTimeout(200);
  for (const dir of dests) {
    await mkdir(dir, { recursive: true });
    await page.screenshot({ path: path.join(dir, name), fullPage: true });
  }
}

async function setTheme(page, theme) {
  await page.addInitScript((value) => {
    localStorage.setItem("decision-desk-theme", value);
  }, theme);
  await page.emulateMedia({ colorScheme: theme });
}

if (!existsSync(path.join(root, "out", "index.html"))) {
  const built = spawnSync(process.execPath, [path.join(root, "scripts", "build-demo.mjs")], {
    cwd: root,
    stdio: "inherit",
  });
  if (built.status !== 0) process.exit(built.status ?? 1);
}

const serve = spawn("npx", ["--yes", "serve", "out", "-l", String(PORT)], {
  cwd: root,
  stdio: "pipe",
  shell: process.platform === "win32",
});
serve.stdout.on("data", (d) => process.stdout.write(d));
serve.stderr.on("data", (d) => process.stderr.write(d));

try {
  await waitForServer(BASE);
  await mkdir(OUT, { recursive: true });
  await mkdir(DOCS, { recursive: true });
  await mkdir(path.join(OUT, "gif-frames"), { recursive: true });

  const browser = await chromium.launch();
  const dests = [OUT, DOCS];

  for (const theme of ["light", "dark"]) {
    const context = await browser.newContext();
    const page = await context.newPage();
    await setTheme(page, theme);
    await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
    await shot(page, `home-${theme}-1440.png`, 1440, dests);
    await shot(page, `home-${theme}-390.png`, 390, dests);
    await page.goto(`${BASE}/d/${RENEW}/`, { waitUntil: "networkidle" });
    await shot(page, `decision-${theme}-1440.png`, 1440, dests);
    await shot(page, `decision-${theme}-390.png`, 390, dests);
    await page.goto(`${BASE}/board/`, { waitUntil: "networkidle" });
    await shot(page, `board-${theme}-1440.png`, 1440, dests);
    await shot(page, `board-${theme}-390.png`, 390, dests);
    await page.goto(`${BASE}/waiting/`, { waitUntil: "networkidle" });
    await shot(page, `waiting-${theme}-1440.png`, 1440, dests);
    await context.close();
  }

  await cp(path.join(DOCS, "home-light-1440.png"), path.join(DOCS, "demo-home.png"));
  await cp(path.join(OUT, "home-light-1440.png"), path.join(OUT, "demo-home.png"));

  const rec = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    recordVideo: { dir: path.join(OUT, "video"), size: { width: 1280, height: 800 } },
  });
  const page = await rec.newPage();
  await setTheme(page, "light");
  await page.addInitScript(() => localStorage.removeItem("decision-desk-demo-v1"));
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await page.screenshot({ path: path.join(OUT, "gif-frames", "01-home.png") });
  await page.getByRole("link", { name: /Start with the oldest/ }).click();
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(OUT, "gif-frames", "02-decision.png") });
  await page.getByRole("button", { name: "Approve", exact: true }).click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(OUT, "gif-frames", "03-confirm.png") });
  await page.getByRole("button", { name: /Confirm Approve/ }).click();
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(OUT, "gif-frames", "04-saved.png") });
  await page.getByRole("link", { name: "Board" }).first().click();
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(OUT, "gif-frames", "05-board.png") });
  const video = page.video();
  await rec.close();
  if (video) {
    const webm = await video.path();
    await cp(webm, path.join(OUT, "demo.webm"));
    await cp(webm, path.join(DOCS, "demo.webm"));
  }
  await browser.close();

  const gifOut = path.join(DOCS, "demo.gif");
  const ffmpeg = spawnSync(
    "ffmpeg",
    [
      "-y",
      "-framerate",
      "1",
      "-pattern_type",
      "glob",
      "-i",
      path.join(OUT, "gif-frames", "*.png"),
      "-vf",
      "scale=960:-1:flags=lanczos",
      gifOut,
    ],
    { stdio: "inherit" },
  );
  if (ffmpeg.status !== 0) {
    const alt = spawnSync(
      "ffmpeg",
      ["-y", "-i", path.join(DOCS, "demo.webm"), "-vf", "fps=6,scale=960:-1:flags=lanczos", gifOut],
      { stdio: "inherit" },
    );
    if (alt.status !== 0) {
      await cp(path.join(OUT, "gif-frames", "01-home.png"), gifOut).catch(() => {});
      console.warn("ffmpeg missing; copied a still to docs/demo.gif");
    }
  }
  await cp(gifOut, path.join(OUT, "demo.gif")).catch(() => {});
  console.log(`captured screenshots → ${OUT} and ${DOCS}`);
} finally {
  serve.kill();
}
