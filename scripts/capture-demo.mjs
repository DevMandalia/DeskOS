#!/usr/bin/env node
/**
 * Capture demo screenshots + a short GIF/WebM. Demo data only.
 */
import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, cp, stat, writeFile } from "node:fs/promises";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = process.env.DESKOS_CAPTURE_OUT || path.join(os.tmpdir(), "deskos-capture");
const DOCS = path.join(root, "docs");
const SCRATCH = path.join(os.homedir(), ".grok-scratch/decision-desk-oss/readme-media");
const PORT = 4173;
const BASE = `http://127.0.0.1:${PORT}`;
const RENEW = "a1111111-1111-4111-8111-111111111111";
const BANNED =
  /dragonstone|herofolk|devaang|mandalia|dsky-vault|\bdsky\b|direction sky|direction-sky|polaris|night lab|nightlab|nimbus|dbm\.fyi|solaris|decision desk/i;

const CURSOR = `
(() => {
  const draw = () => {
    if (document.getElementById("desk-demo-cursor")) return;
    const el = document.createElement("div");
    el.id = "desk-demo-cursor";
    el.setAttribute("aria-hidden", "true");
    el.style.cssText = "position:fixed;z-index:2147483647;width:18px;height:18px;margin:-9px 0 0 -9px;border:2px solid #141414;box-shadow:0 0 0 2px #fff;border-radius:50%;pointer-events:none;background:rgba(255,255,255,.4);";
    document.documentElement.appendChild(el);
    window.addEventListener("mousemove", (e) => {
      el.style.left = e.clientX + "px";
      el.style.top = e.clientY + "px";
    }, { passive: true });
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", draw);
  else draw();
})();
`;

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

function pause(page, ms) {
  return page.waitForTimeout(ms);
}

async function assertClean(page, where) {
  const text = await page.evaluate(() => document.body?.innerText ?? "");
  const hit = text.replace(/https?:\/\/\S+/g, "").match(BANNED);
  if (hit) throw new Error(`personal/old copy "${hit[0]}" on ${where}`);
  const scanDir = path.join(OUT, "scans");
  await mkdir(scanDir, { recursive: true });
  await writeFile(path.join(scanDir, `${where}.txt`), text);
}

async function moveTo(page, locator) {
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  if (!box) throw new Error("target not visible");
  await page.mouse.move(box.x + box.width / 2, box.y + Math.min(16, box.height / 2), { steps: 12 });
}

async function pointerClick(page, locator) {
  await moveTo(page, locator);
  await pause(page, 220);
  await locator.click();
}

async function bootTheme(page, theme, { once = false } = {}) {
  await page.addInitScript(
    ({ value, onceOnly }) => {
      if (onceOnly) {
        try {
          if (sessionStorage.getItem("desk-capture-boot")) return;
          sessionStorage.setItem("desk-capture-boot", "1");
        } catch {
          /* private mode */
        }
      }
      localStorage.setItem("desk-theme", value);
      localStorage.setItem("deskos-theme", value);
      localStorage.setItem("decision-desk-theme", value);
      localStorage.setItem("desk-nav-collapsed", "0");
      localStorage.setItem("desk-chat-collapsed", "0");
      localStorage.setItem("desk-focus-mode", "0");
      localStorage.removeItem("deskos-demo-v1");
    },
    { value: theme, onceOnly: once },
  );
  await page.emulateMedia({ colorScheme: theme === "dark" ? "dark" : "light" });
}

async function shot(page, name, width, dests) {
  const height = width === 390 ? 844 : 1100;
  await page.setViewportSize({ width, height });
  await pause(page, 250);
  await assertClean(page, name);
  for (const dir of dests) {
    await mkdir(dir, { recursive: true });
    await page.screenshot({ path: path.join(dir, name), fullPage: false });
  }
}

function encode(args) {
  return spawnSync("ffmpeg", args, { stdio: "inherit" });
}

if (!existsSync(path.join(root, "out", "index.html"))) {
  const built = spawnSync(process.execPath, [path.join(root, "scripts", "build-demo.mjs")], {
    cwd: root,
    stdio: "inherit",
  });
  if (built.status !== 0) process.exit(built.status ?? 1);
}

let serve = null;
try {
  await waitForServer(BASE, 800);
} catch {
  serve = spawn("npx", ["--yes", "serve", "out", "-l", String(PORT)], {
    cwd: root,
    stdio: "pipe",
    shell: process.platform === "win32",
  });
  serve.stdout.on("data", (d) => process.stdout.write(d));
  serve.stderr.on("data", (d) => process.stderr.write(d));
  await waitForServer(BASE);
}

try {
  await mkdir(OUT, { recursive: true });
  await mkdir(DOCS, { recursive: true });
  await mkdir(SCRATCH, { recursive: true });
  await mkdir(path.join(OUT, "gif-frames"), { recursive: true });

  const browser = await chromium.launch();
  const dests = [OUT, SCRATCH];

  for (const theme of ["light", "dark"]) {
    const context = await browser.newContext();
    const page = await context.newPage();
    await bootTheme(page, theme);
    await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
    await shot(page, `home-${theme}-1440.png`, 1440, dests);
    await shot(page, `home-${theme}-390.png`, 390, dests);
    await page.goto(`${BASE}/waiting/`, { waitUntil: "networkidle" });
    await shot(page, `waiting-${theme}-1440.png`, 1440, dests);
    await page.goto(`${BASE}/d/${RENEW}/`, { waitUntil: "networkidle" });
    await shot(page, `decision-${theme}-1440.png`, 1440, dests);
    await shot(page, `decision-${theme}-390.png`, 390, dests);
    await page.goto(`${BASE}/board/`, { waitUntil: "networkidle" });
    await shot(page, `board-${theme}-1440.png`, 1440, dests);
    await shot(page, `board-${theme}-390.png`, 390, dests);
    await context.close();
  }

  await cp(path.join(OUT, "home-light-1440.png"), path.join(DOCS, "demo-home.png"));
  await cp(path.join(OUT, "home-dark-1440.png"), path.join(DOCS, "demo-home-dark.png"));
  await cp(path.join(DOCS, "demo-home.png"), path.join(SCRATCH, "demo-home.png"));
  await cp(path.join(DOCS, "demo-home-dark.png"), path.join(SCRATCH, "demo-home-dark.png"));

  const rec = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    recordVideo: { dir: path.join(OUT, "video"), size: { width: 1280, height: 800 } },
  });
  const page = await rec.newPage();
  await bootTheme(page, "light", { once: true });
  await page.addInitScript(CURSOR);
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await assertClean(page, "video-home");
  await pause(page, 2400);
  await moveTo(page, page.locator("#desk-chat .chat-empty"));
  await pause(page, 2000);
  await page.screenshot({ path: path.join(OUT, "gif-frames", "01-home.png") });

  await pointerClick(page, page.locator(".side-nav-inner").getByRole("link", { name: "Waiting on you" }));
  await page.waitForURL(/\/waiting\/?$/);
  await assertClean(page, "video-queue");
  await pause(page, 2200);
  await page.screenshot({ path: path.join(OUT, "gif-frames", "02-queue.png") });

  await pointerClick(page, page.getByRole("link", { name: /Example: renew domain/ }));
  await page.waitForURL(new RegExp(`/d/${RENEW}`));
  await assertClean(page, "video-decision");
  await pause(page, 2800);
  await page.screenshot({ path: path.join(OUT, "gif-frames", "03-decision.png") });

  await pointerClick(page, page.locator(".side-nav-inner").getByRole("link", { name: "Board" }));
  await page.waitForURL(/\/board\/?$/);
  await assertClean(page, "video-board");
  await pause(page, 1800);
  await page.screenshot({ path: path.join(OUT, "gif-frames", "04-board.png") });

  await page.mouse.move(640, 360, { steps: 8 });
  await page.keyboard.press("\\");
  await page.locator(".focus-exit").waitFor({ state: "visible" });
  await pause(page, 2400);
  await page.screenshot({ path: path.join(OUT, "gif-frames", "05-focus.png") });
  await pointerClick(page, page.locator(".focus-exit"));
  await pause(page, 1600);

  const card = (await page.locator(".lane-doing .task").count())
    ? page.locator(".lane-doing .task").first()
    : page.locator(".task").first();
  await moveTo(page, card);
  await pause(page, 400);
  await pointerClick(page, card.getByRole("button", { name: /More for/ }));
  await page.locator(".task-pop").waitFor({ state: "visible" });
  await pause(page, 2400);
  await page.screenshot({ path: path.join(OUT, "gif-frames", "06-menu.png") });
  await page.keyboard.press("Escape");
  await pause(page, 500);

  await moveTo(page, page.locator("#desk-chat .chat-empty"));
  await pause(page, 1800);
  await page.screenshot({ path: path.join(OUT, "gif-frames", "07-chat.png") });

  await pointerClick(page, page.locator(".theme-toggle-slot .theme-icon"));
  await page.waitForFunction(() => document.documentElement.getAttribute("data-theme") === "dark");
  await pause(page, 2200);
  await page.screenshot({ path: path.join(OUT, "gif-frames", "08-dark-board.png") });

  await pointerClick(page, page.locator(".side-nav-inner").getByRole("link", { name: "Home" }));
  await page.waitForURL(/\/$/);
  await assertClean(page, "video-home-dark");
  await pause(page, 2800);
  await page.screenshot({ path: path.join(OUT, "gif-frames", "09-home-dark.png") });

  await pointerClick(page, page.locator(".side-nav-inner").getByRole("link", { name: "Board" }));
  await page.waitForURL(/\/board\/?$/);
  await assertClean(page, "video-board-dark");
  await pause(page, 2600);
  await page.screenshot({ path: path.join(OUT, "gif-frames", "10-board-dark.png") });

  const video = page.video();
  await rec.close();
  const rawWebm = video ? await video.path() : null;
  await browser.close();

  const gifOut = path.join(DOCS, "demo.gif");
  const webmOut = path.join(DOCS, "demo.webm");
  if (rawWebm) {
    const packed = encode([
      "-y",
      "-i",
      rawWebm,
      "-an",
      "-c:v",
      "libvpx-vp9",
      "-b:v",
      "700k",
      "-crf",
      "34",
      "-vf",
      "scale=1280:800:flags=lanczos",
      webmOut,
    ]);
    if (packed.status !== 0) await cp(rawWebm, webmOut);
  }

  let gif = encode([
    "-y",
    "-i",
    webmOut,
    "-vf",
    "fps=8,scale=880:-1:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=96[p];[s1][p]paletteuse=dither=bayer:bayer_scale=5",
    "-loop",
    "0",
    gifOut,
  ]);
  const gifSize = existsSync(gifOut) ? (await stat(gifOut)).size : 0;
  if (gif.status !== 0 || gifSize > 8_000_000) {
    gif = encode([
      "-y",
      "-i",
      webmOut,
      "-vf",
      "fps=6,scale=720:-1:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=64[p];[s1][p]paletteuse=dither=bayer:bayer_scale=5",
      "-loop",
      "0",
      gifOut,
    ]);
  }
  if (gif.status !== 0 || !existsSync(gifOut)) {
    await cp(path.join(OUT, "gif-frames", "01-home.png"), gifOut);
    console.warn("ffmpeg missing; copied a still to docs/demo.gif");
  }

  await cp(gifOut, path.join(SCRATCH, "demo.gif"));
  await cp(webmOut, path.join(SCRATCH, "demo.webm"));

  const probe = spawnSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", webmOut], {
    encoding: "utf8",
  });
  console.log(`captured screenshots → ${OUT}, ${DOCS}, ${SCRATCH}`);
  console.log(`demo.webm duration ${probe.stdout.trim()}s`);
} finally {
  serve?.kill();
}
