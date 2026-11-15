import { describe, expect, it, vi } from "vitest";

import { notifyAgent, splitRequestEvent, verdictEvent } from "@/lib/agent-notify";
import { verifySignature } from "@/lib/keys";
import type { Agent, Decision } from "@/lib/types";

const row: Decision = {
  id: "a1111111-1111-4111-8111-111111111111",
  url: "/d/a1111111-1111-4111-8111-111111111111",
  item: "Example: renew domain?",
  project: "Ops",
  status: "In flight",
  owner: "Acme Ops",
  ownerColor: "blue",
  decisionNeeded: "Renew?",
  nextStep: null,
  source: "Acme Ops",
  reply: "Approve",
  lastUpdated: "2026-11-15T00:00:00.000Z",
  raisedBy: { id: "agent-acme-ops", name: "Acme Ops", parentId: "agent-acme-chief", parentName: "Acme Chief of Staff" },
  lastChoice: "Approve",
};

const agent: Agent = {
  id: "agent-acme-ops",
  name: "Acme Ops",
  role: "sub",
  parentId: "agent-acme-chief",
  keyPrefix: "ddk_demo_ops",
  keyHash: "x",
  webhookUrl: "https://agents.example.test/hook",
  webhookSecret: "whsec_test",
  createdAt: "2026-11-10T00:00:00.000Z",
  revokedAt: null,
};

describe("per-agent HMAC webhook", () => {
  it("POSTs with X-Desk-Signature and no shared webhook URL", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async (_url, init) => {
      const body = String(init?.body);
      const headers = init?.headers as Record<string, string>;
      expect(headers["X-Desk-Signature"]?.startsWith("sha256=")).toBe(true);
      expect(verifySignature("whsec_test", body, headers["X-Desk-Signature"] ?? "")).toBe(true);
      expect(JSON.parse(body).type).toBe("desk_verdict");
      return new Response("ok", { status: 200 });
    });
    const event = verdictEvent(row, "Approve", "yes", "2026-11-15T00:00:00.000Z");
    await notifyAgent(agent, event, fetchImpl);
    expect(fetchImpl).toHaveBeenCalledOnce();
    expect(fetchImpl.mock.calls[0][0]).toBe("https://agents.example.test/hook");
  });

  it("no-ops without a per-agent URL", async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    await notifyAgent({ ...agent, webhookUrl: null, webhookSecret: null }, verdictEvent(row, "Approve", "", ""), fetchImpl);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("keeps desk_verdict fields and allows choice Reopen", () => {
    const event = verdictEvent(row, "Reopen", "back", "2026-11-15T00:00:00.000Z");
    expect(event.type).toBe("desk_verdict");
    expect(event.choice).toBe("Reopen");
    expect(event.decision_id).toBe(row.id);
    expect(event.item).toBe(row.item);
  });

  it("sends desk_split_request on send-back", () => {
    const event = splitRequestEvent(row, "split these", "2026-11-15T00:00:00.000Z");
    expect(event).toEqual({
      type: "desk_split_request",
      decision_id: row.id,
      item: row.item,
      note: "split these",
      at: "2026-11-15T00:00:00.000Z",
      agent_id: "agent-acme-ops",
    });
  });
});
