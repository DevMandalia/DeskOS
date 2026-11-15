import { describe, expect, it, vi } from "vitest";

import { postWebhook, webhookHeaders, webhookUrl } from "@/lib/webhook";

const URL_ = "https://hooks.example.test/routine/abc";

function fakeFetch(status = 200) {
  return vi.fn<typeof fetch>(async () => new Response("ok", { status }));
}

describe("webhook headers", () => {
  it("sends NOTIFY_WEBHOOK_AUTH verbatim as Authorization", () => {
    expect(webhookHeaders({ NOTIFY_WEBHOOK_AUTH: "Bearer routine-secret" })).toEqual({
      "Content-Type": "application/json",
      Authorization: "Bearer routine-secret",
    });
  });
  it("falls back to the legacy NOTIFY_WEBHOOK_TOKEN as Bearer, AUTH wins over it", () => {
    expect(webhookHeaders({ NOTIFY_WEBHOOK_TOKEN: "t" }).Authorization).toBe("Bearer t");
    expect(
      webhookHeaders({ NOTIFY_WEBHOOK_TOKEN: "t", NOTIFY_WEBHOOK_AUTH: "Token x" }).Authorization,
    ).toBe("Token x");
  });
  it("has no Authorization when neither is set", () => {
    expect(webhookHeaders({})).toEqual({ "Content-Type": "application/json" });
  });
  it("needs an http(s) URL", () => {
    expect(webhookUrl({})).toBeNull();
    expect(webhookUrl({ NOTIFY_WEBHOOK_URL: "not a url" })).toBeNull();
    expect(webhookUrl({ NOTIFY_WEBHOOK_URL: URL_ })).toBe(URL_);
  });
});

describe("postWebhook", () => {
  it("no-ops while the URL is unset", async () => {
    const f = fakeFetch();
    expect(await postWebhook("t", {}, { env: {}, fetchImpl: f })).toEqual({
      sent: false,
      reason: "unset",
    });
    expect(f).not.toHaveBeenCalled();
  });
  it("POSTs JSON with the auth header when set", async () => {
    const f = fakeFetch();
    const r = await postWebhook(
      "t",
      { a: 1 },
      { env: { NOTIFY_WEBHOOK_URL: URL_, NOTIFY_WEBHOOK_AUTH: "Bearer s" }, fetchImpl: f },
    );
    expect(r).toEqual({ sent: true, ok: true, status: 200 });
    const [url, init] = f.mock.calls[0];
    expect(url).toBe(URL_);
    expect(init?.method).toBe("POST");
    expect(init?.headers).toEqual({
      "Content-Type": "application/json",
      Authorization: "Bearer s",
    });
    expect(JSON.parse(String(init?.body))).toEqual({ a: 1 });
    expect(init?.signal).toBeInstanceOf(AbortSignal);
  });
  it("never throws and never logs the header or URL", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const boom = vi.fn(async () => {
      throw new DOMException("timed out", "TimeoutError");
    });
    const r = await postWebhook(
      "t",
      {},
      {
        env: { NOTIFY_WEBHOOK_URL: URL_, NOTIFY_WEBHOOK_AUTH: "Bearer s3cret" },
        fetchImpl: boom as unknown as typeof fetch,
      },
    );
    expect(r).toEqual({ sent: true, ok: false, error: "TimeoutError" });
    await postWebhook(
      "t",
      {},
      {
        env: { NOTIFY_WEBHOOK_URL: URL_, NOTIFY_WEBHOOK_AUTH: "Bearer s3cret" },
        fetchImpl: fakeFetch(500),
      },
    );
    const logged = warn.mock.calls.flat().join(" ");
    expect(logged).toContain("HTTP 500");
    expect(logged).not.toContain("s3cret");
    expect(logged).not.toContain("hooks.example.test");
    warn.mockRestore();
  });
});
