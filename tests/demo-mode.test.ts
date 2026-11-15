import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { isAuthBypass } from "@/lib/env";
import { isStaticDemo } from "@/lib/demo-mode";
import { defaultStoreKind } from "@/lib/stores";

const env = process.env as Record<string, string | undefined>;
const KEYS = ["DESK_DEMO", "NEXT_PUBLIC_DESK_DEMO", "VERCEL", "AUTH_DEV_BYPASS", "NODE_ENV"] as const;

describe("demo mode", () => {
  const prior: Record<string, string | undefined> = {};
  beforeEach(() => {
    for (const key of KEYS) prior[key] = env[key];
    delete env.DESK_DEMO;
    delete env.NEXT_PUBLIC_DESK_DEMO;
    delete env.VERCEL;
  });
  afterEach(() => {
    for (const key of KEYS) {
      const value = prior[key];
      if (value === undefined) delete env[key];
      else env[key] = value;
    }
  });

  it("treats DESK_DEMO and NEXT_PUBLIC_DESK_DEMO as demo", () => {
    expect(isStaticDemo()).toBe(false);
    process.env.DESK_DEMO = "1";
    expect(isStaticDemo()).toBe(true);
    delete process.env.DESK_DEMO;
    process.env.NEXT_PUBLIC_DESK_DEMO = "1";
    expect(isStaticDemo()).toBe(true);
  });

  it("skips sign-in in demo and uses memory by default", () => {
    process.env.DESK_DEMO = "1";
    expect(isAuthBypass()).toBe(true);
    expect(defaultStoreKind()).toBe("memory");
  });
});
