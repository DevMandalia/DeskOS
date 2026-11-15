import { describe, expect, it } from "vitest";

import { BASE_PATH, safeCallbackPath, stripBasePath, withBasePath } from "@/lib/base-path";

describe("base path", () => {
  it("is empty by default (site root)", () => {
    expect(BASE_PATH).toBe("");
  });

  it("leaves paths unchanged when empty", () => {
    expect(withBasePath("/")).toBe("/");
    expect(withBasePath("/api/auth")).toBe("/api/auth");
    expect(withBasePath("signin")).toBe("/signin");
  });

  it("strips nothing when empty", () => {
    expect(stripBasePath("/")).toBe("/");
    expect(stripBasePath("/d/abc")).toBe("/d/abc");
    expect(stripBasePath("/signin")).toBe("/signin");
  });

  it("only allows same-site callback paths", () => {
    expect(safeCallbackPath(undefined)).toBe("/");
    expect(safeCallbackPath("https://evil.example/")).toBe("/");
    expect(safeCallbackPath("//evil.example/")).toBe("/");
    expect(safeCallbackPath("/d/abc?area=x")).toBe("/d/abc?area=x");
  });
});
