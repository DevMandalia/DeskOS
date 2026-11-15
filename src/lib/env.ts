import { isStaticDemo } from "@/lib/demo-mode";
import { isServerless } from "@/lib/stores";

export function isHosted(): boolean {
  return Boolean(process.env.VERCEL) || process.env.NODE_ENV === "production";
}

/** Local only. Never true on Vercel or in production. Demo mode skips sign-in. */
export function isAuthBypass(): boolean {
  if (isStaticDemo()) return true;
  if (process.env.AUTH_DEV_BYPASS !== "1") return false;
  if (process.env.VERCEL) return false;
  if (process.env.NODE_ENV === "production") return false;
  return true;
}

/** Owner allowlist. OWNER_EMAIL is canonical; ALLOWED_EMAIL is an alias. */
export function ownerEmail(): string {
  return (process.env.OWNER_EMAIL ?? process.env.ALLOWED_EMAIL ?? "").trim().toLowerCase();
}

/** @deprecated Use ownerEmail. */
export function allowedEmail(): string {
  return ownerEmail();
}

export function isAllowedEmail(email: string | null | undefined): boolean {
  const allowed = ownerEmail();
  if (!allowed || !email) return false;
  return email.trim().toLowerCase() === allowed;
}

export function authProvider(): "google" | "github" {
  const value = (process.env.AUTH_PROVIDER ?? "google").trim().toLowerCase();
  return value === "github" ? "github" : "google";
}

export function deskTimezone(): string {
  return (process.env.DESK_TIMEZONE ?? "America/Los_Angeles").trim() || "America/Los_Angeles";
}

export function dataDir(): string {
  return (process.env.DESK_DATA_DIR ?? "").trim() || `${process.cwd()}/data`;
}

export function sqlitePath(): string {
  return (process.env.DESK_SQLITE_PATH ?? "").trim() || `${dataDir()}/desk.sqlite`;
}

export function isChatConfigured(): boolean {
  return Boolean((process.env.CHAT_COMPLETIONS_URL ?? "").trim());
}

/** True when the desk is serving in-memory demo rows (not a durable store). */
export function isDemoStore(): boolean {
  return process.env.DESK_DEMO === "1" || (isServerless() && !process.env.DATABASE_URL && !process.env.DECISION_SOURCE);
}

/** When "1", new raises must include the full decision brief. Off by default. */
export function briefRequired(): boolean {
  return (process.env.DESK_BRIEF_REQUIRED ?? "").trim() === "1";
}
