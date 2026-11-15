import { hashSecret } from "@/lib/keys";
import { STATUS } from "@/lib/decide";
import type { Agent, Decision, DiscussionMessage } from "@/lib/types";
import type { Task } from "@/lib/tasks/types";

/** Demo API keys. Obvious fakes; never used outside DESK_DEMO / memory seed. */
export const DEMO_KEYS = {
  chief: "ddk_demo_chief_acme_not_a_secret",
  ops: "ddk_demo_ops_acme_not_a_secret",
} as const;

export const DEMO_AGENT_IDS = {
  chief: "agent-acme-chief",
  ops: "agent-acme-ops",
} as const;

export const DEMO_DECISION_IDS = {
  renew: "a1111111-1111-4111-8111-111111111111",
  hire: "a2222222-2222-4222-8222-222222222222",
  email: "a3333333-3333-4333-8333-333333333333",
  prices: "a4444444-4444-4444-8444-444444444444",
  sunset: "a5555555-5555-4555-8555-555555555555",
} as const;

const now = "2026-11-10T17:00:00.000Z";

export function demoAgents(): Agent[] {
  return [
    {
      id: DEMO_AGENT_IDS.chief,
      name: "Acme Chief of Staff",
      role: "lead",
      parentId: null,
      keyPrefix: DEMO_KEYS.chief.slice(0, 12),
      keyHash: hashSecret(DEMO_KEYS.chief),
      webhookUrl: null,
      webhookSecret: null,
      createdAt: now,
      revokedAt: null,
    },
    {
      id: DEMO_AGENT_IDS.ops,
      name: "Acme Ops",
      role: "sub",
      parentId: DEMO_AGENT_IDS.chief,
      keyPrefix: DEMO_KEYS.ops.slice(0, 12),
      keyHash: hashSecret(DEMO_KEYS.ops),
      webhookUrl: null,
      webhookSecret: null,
      createdAt: now,
      revokedAt: null,
    },
  ];
}

function ref(
  id: string,
  name: string,
  parentId: string | null,
  parentName: string | null,
) {
  return { id, name, parentId, parentName };
}

const chief = ref(DEMO_AGENT_IDS.chief, "Acme Chief of Staff", null, null);
const ops = ref(DEMO_AGENT_IDS.ops, "Acme Ops", DEMO_AGENT_IDS.chief, "Acme Chief of Staff");

export function demoDecisions(): Decision[] {
  return [
    {
      id: DEMO_DECISION_IDS.renew,
      url: `/d/${DEMO_DECISION_IDS.renew}`,
      item: "Example: renew domain?",
      project: "Ops",
      status: STATUS.waiting,
      owner: ops.name,
      ownerColor: "blue",
      decisionNeeded: "Renew acme.example for another year at $14, or let it lapse?",
      nextStep: "Ops will pay the registrar if you approve.",
      source: "Acme Ops",
      reply: null,
      lastUpdated: "2026-11-08T16:00:00.000Z",
      raisedBy: ops,
      lastChoice: null,
    },
    {
      id: DEMO_DECISION_IDS.hire,
      url: `/d/${DEMO_DECISION_IDS.hire}`,
      item: "Example: hire contractor for landing page?",
      project: "Marketing",
      status: STATUS.waiting,
      owner: chief.name,
      ownerColor: "purple",
      decisionNeeded: "Engage a contractor for two weeks to ship the Acme marketing page?",
      nextStep: "Chief of Staff will send the brief if you approve.",
      source: "Acme Chief of Staff",
      reply: null,
      lastUpdated: "2026-11-09T18:00:00.000Z",
      raisedBy: chief,
      lastChoice: null,
    },
    {
      id: DEMO_DECISION_IDS.email,
      url: `/d/${DEMO_DECISION_IDS.email}`,
      item: "Example: switch email provider?",
      project: "Ops",
      status: STATUS.inFlight,
      owner: ops.name,
      ownerColor: "blue",
      decisionNeeded: "Move transactional mail from the old vendor to the new one this month?",
      nextStep: "Ops is running the DNS cutover.",
      source: "Acme Ops",
      reply: "Approve — go ahead this month (via DeskOS, 2026-11-07T09:00:00-08:00)",
      lastUpdated: "2026-11-07T17:00:00.000Z",
      raisedBy: ops,
      lastChoice: "Approve",
    },
    {
      id: DEMO_DECISION_IDS.prices,
      url: `/d/${DEMO_DECISION_IDS.prices}`,
      item: "Example: raise prices 8%?",
      project: "Finance",
      status: STATUS.parked,
      owner: chief.name,
      ownerColor: "purple",
      decisionNeeded: "Raise list prices 8% on 1 January?",
      nextStep: null,
      source: "Acme Chief of Staff",
      reply: "Decline — hold until Q2 (via DeskOS, 2026-11-05T11:00:00-08:00)",
      lastUpdated: "2026-11-05T19:00:00.000Z",
      raisedBy: chief,
      lastChoice: "Decline",
    },
    {
      id: DEMO_DECISION_IDS.sunset,
      url: `/d/${DEMO_DECISION_IDS.sunset}`,
      item: "Example: sunset the old dashboard?",
      project: "Product",
      status: STATUS.done,
      owner: chief.name,
      ownerColor: "green",
      decisionNeeded: "Turn off the legacy dashboard on 1 December?",
      nextStep: null,
      source: "Acme Chief of Staff",
      reply: "Approve — send the notice first (via DeskOS, 2026-10-20T10:00:00-07:00)",
      lastUpdated: "2026-10-28T17:00:00.000Z",
      raisedBy: chief,
      lastChoice: "Approve",
    },
  ];
}

export function demoTasks(): Task[] {
  return [
    {
      id: "task-acme-001",
      url: "/board",
      title: "Pay the acme.example renewal invoice",
      status: "Blocked",
      area: "Ops",
      areaColor: "blue",
      due: "2026-11-18",
      priority: "P1",
      owner: ops.name,
      rank: 1,
      lastEdited: "2026-11-10T16:00:00.000Z",
      raisedBy: ops,
    },
    {
      id: "task-acme-002",
      url: "/board",
      title: "Draft contractor brief for the landing page",
      status: "In progress",
      area: "Marketing",
      areaColor: "purple",
      due: "2026-11-16",
      priority: "P0",
      owner: chief.name,
      rank: 2,
      lastEdited: "2026-11-11T15:00:00.000Z",
      raisedBy: chief,
    },
    {
      id: "task-acme-003",
      url: "/board",
      title: "Write the Q4 recap outline",
      status: "To do",
      area: "Product",
      areaColor: "green",
      due: "2026-11-20",
      priority: "P2",
      owner: chief.name,
      rank: 3,
      lastEdited: "2026-11-09T14:00:00.000Z",
      raisedBy: chief,
    },
    {
      id: "task-acme-004",
      url: "/board",
      title: "Rotate staging credentials",
      status: "Backlog",
      area: "Ops",
      areaColor: "blue",
      due: null,
      priority: "P2",
      owner: ops.name,
      rank: null,
      lastEdited: "2026-11-04T14:00:00.000Z",
      raisedBy: ops,
    },
    {
      id: "task-acme-005",
      url: "/board",
      title: "Ship the November changelog",
      status: "Done",
      area: "Product",
      areaColor: "green",
      due: null,
      priority: "P1",
      owner: chief.name,
      rank: null,
      lastEdited: "2026-11-01T18:00:00.000Z",
      raisedBy: chief,
    },
  ];
}

export function demoDiscussion(): DiscussionMessage[] {
  return [];
}

export const DEMO_TASK_STATUSES = ["Backlog", "To do", "In progress", "Blocked", "Done"];
export const DEMO_TASK_AREAS = [
  { name: "Ops", color: "blue" },
  { name: "Marketing", color: "purple" },
  { name: "Product", color: "green" },
  { name: "Finance", color: "orange" },
];

export function demoBodies(): Record<string, string> {
  return {
    [DEMO_DECISION_IDS.renew]:
      "The domain acme.example is due in three weeks. Auto-renew is off. Registrar quote is $14 for one year.",
    [DEMO_DECISION_IDS.hire]:
      "A contractor (Jane Example) quoted two weeks to ship a static landing page. Budget is already in Marketing.",
    [DEMO_DECISION_IDS.email]:
      "The new vendor's sandbox is green. DNS records are staged. Cutover is a Friday afternoon.",
    [DEMO_DECISION_IDS.prices]:
      "Finance modelled +8% on list. Support worries about the annual cohort.",
    [DEMO_DECISION_IDS.sunset]:
      "Legacy dashboard traffic is 4%. Notice went out. Redirects are ready.",
  };
}
