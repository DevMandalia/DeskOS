import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { isAuthBypass, isHosted } from "../src/lib/env";

const env = process.env as Record<string, string | undefined>;
const KEYS = ["VERCEL", "AUTH_DEV_BYPASS", "NODE_ENV", "DESK_DEMO", "NEXT_PUBLIC_DESK_DEMO"] as const;

describe("production guards", () => {
  const prior: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const key of KEYS) prior[key] = env[key];
    delete env.DESK_DEMO;
    delete env.NEXT_PUBLIC_DESK_DEMO;
  });

  afterEach(() => {
    for (const key of KEYS) {
      const value = prior[key];
      if (value === undefined) delete env[key];
      else env[key] = value;
    }
  });

  it("ignores AUTH_DEV_BYPASS on Vercel", () => {
    process.env.VERCEL = "1";
    process.env.AUTH_DEV_BYPASS = "1";
    expect(isHosted()).toBe(true);
    expect(isAuthBypass()).toBe(false);
  });

  it("ignores AUTH_DEV_BYPASS in production", () => {
    env.NODE_ENV = "production";
    process.env.AUTH_DEV_BYPASS = "1";
    expect(isAuthBypass()).toBe(false);
  });

  it("allows AUTH_DEV_BYPASS locally", () => {
    delete process.env.VERCEL;
    process.env.AUTH_DEV_BYPASS = "1";
    expect(isAuthBypass()).toBe(true);
  });
});
