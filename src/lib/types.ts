import type {
  BriefOverride,
  CostOfDelay,
  DefaultIfNoAnswer,
  DoorType,
  RevisitState,
  VerdictChoice,
} from "../../contract";

export type RichSpan = {
  text: string;
  href?: string | null;
  bold?: boolean;
  italic?: boolean;
  code?: boolean;
  strike?: boolean;
  underline?: boolean;
};

export type DeskBlock =
  | { id: string; type: "heading_1" | "heading_2" | "heading_3"; rich: RichSpan[] }
  | { id: string; type: "paragraph"; rich: RichSpan[] }
  | {
      id: string;
      type: "bulleted_list_item" | "numbered_list_item";
      rich: RichSpan[];
      children?: DeskBlock[];
    }
  | { id: string; type: "quote"; rich: RichSpan[] }
  | { id: string; type: "callout"; rich: RichSpan[]; icon?: string }
  | { id: string; type: "code"; text: string; language?: string }
  | { id: string; type: "image"; url: string; caption?: string }
  | { id: string; type: "video"; url: string; caption?: string }
  | { id: string; type: "toggle"; rich: RichSpan[]; children?: DeskBlock[] }
  | { id: string; type: "divider" }
  | {
      id: string;
      type: "bookmark" | "link_preview" | "embed";
      url: string;
      title?: string;
    }
  | { id: string; type: "to_do"; rich: RichSpan[]; checked: boolean }
  | { id: string; type: "unsupported"; typeName: string };

/** Agent that raised a decision or task. `parent` is the lead, when this is a sub-agent. */
export type AgentRef = {
  id: string;
  name: string;
  parentId: string | null;
  parentName: string | null;
};

export type AgentRole = "lead" | "sub";

export type Agent = {
  id: string;
  name: string;
  role: AgentRole;
  parentId: string | null;
  keyPrefix: string;
  keyHash: string;
  webhookUrl: string | null;
  /** Raw signing secret; never returned after creation. Null if no per-agent webhook. */
  webhookSecret: string | null;
  createdAt: string;
  revokedAt: string | null;
};

export type AgentPublic = Omit<Agent, "keyHash" | "webhookSecret">;

export type DiscussionAuthor = "owner" | "agent";

export type DiscussionMessage = {
  id: string;
  decisionId: string;
  author: DiscussionAuthor;
  agentId: string | null;
  agentName: string | null;
  body: string;
  at: string;
};

/** One decision the owner can Approve / Decline / Park / Discuss. */
export type Decision = {
  id: string;
  url: string;
  item: string;
  project: string | null;
  status: string | null;
  /** @deprecated Prefer raisedBy. Kept as the display name of the raising agent. */
  owner: string | null;
  ownerColor: string | null;
  decisionNeeded: string | null;
  nextStep: string | null;
  source: string | null;
  reply: string | null;
  lastUpdated: string | null;
  raisedBy: AgentRef | null;
  /** Last recorded verdict choice, if any. */
  lastChoice: VerdictChoice | null;
  options?: string[] | null;
  recommendation?: string | null;
  doorType?: DoorType | null;
  costOfDelay?: CostOfDelay | null;
  defaultIfNoAnswer?: DefaultIfNoAnswer | null;
  deadline?: string | null;
  parentId?: string | null;
  briefOverrides?: BriefOverride[];
  needsSplit?: boolean | null;
  splitReason?: string | null;
  splitSentBackAt?: string | null;
  revisitAt?: string | null;
  revisitState?: RevisitState | null;
  agentTimeoutTagged?: boolean | null;
  timeoutEligibleOverride?: boolean | null;
  timeoutAppliedAt?: string | null;
  timeoutAppliedChoice?: "Approve" | "Decline" | "Park" | null;
  appliedBy?: "owner" | "timeout" | "auto" | null;
  sessionCounted?: boolean | null;
  batchKey?: string | null;
};

/** @deprecated Use Decision. */
export type BriefRow = Decision;

export type DecisionCreate = {
  item: string;
  decisionNeeded?: string | null;
  nextStep?: string | null;
  project?: string | null;
  source?: string | null;
  status?: string | null;
  body?: DeskBlock[] | string | null;
  url?: string | null;
  raisedBy?: AgentRef | null;
  options?: string[] | null;
  recommendation?: string | null;
  doorType?: DoorType | null;
  costOfDelay?: CostOfDelay | null;
  defaultIfNoAnswer?: DefaultIfNoAnswer | null;
  deadline?: string | null;
  parentId?: string | null;
  needsSplit?: boolean | null;
  splitReason?: string | null;
  agentTimeoutTagged?: boolean | null;
  batchKey?: string | null;
};

export type DecisionVerdictInput = {
  choice: VerdictChoice | null;
  note: string;
  reply: string;
  status: string;
  lastUpdated: string;
  revisitAt?: string | null;
  revisitState?: RevisitState | null;
};

export type DecisionPatch = Partial<
  Pick<
    Decision,
    | "status"
    | "reply"
    | "lastChoice"
    | "lastUpdated"
    | "revisitAt"
    | "revisitState"
    | "doorType"
    | "costOfDelay"
    | "deadline"
    | "briefOverrides"
    | "needsSplit"
    | "splitReason"
    | "splitSentBackAt"
    | "agentTimeoutTagged"
    | "timeoutEligibleOverride"
    | "timeoutAppliedAt"
    | "timeoutAppliedChoice"
    | "appliedBy"
    | "sessionCounted"
    | "batchKey"
  >
>;

/**
 * Pluggable decision source. Core never talks to Notion, SQLite, or memory
 * directly — only through this interface. See README "Connect your decision source".
 */
export interface DecisionSource {
  readonly label: string;
  list(): Promise<Decision[]>;
  get(id: string): Promise<Decision | null>;
  getBody(decision: Decision): Promise<DeskBlock[]>;
  create(input: DecisionCreate): Promise<Decision>;
  recordVerdict(id: string, verdict: DecisionVerdictInput): Promise<Decision>;
  patch(id: string, patch: DecisionPatch): Promise<Decision>;
  listDiscussion(id: string): Promise<DiscussionMessage[]>;
  addDiscussion(message: Omit<DiscussionMessage, "id">): Promise<DiscussionMessage>;
  hasIdempotencyKey?(key: string): Promise<boolean>;
  rememberIdempotencyKey?(key: string): Promise<void>;
}

export class DecisionSourceError extends Error {
  constructor(
    message: string,
    readonly code: "no_access" | "not_found" | "invalid" | "unavailable",
  ) {
    super(message);
    this.name = "DecisionSourceError";
  }
}

export interface AgentStore {
  readonly label: string;
  list(): Promise<Agent[]>;
  get(id: string): Promise<Agent | null>;
  create(input: {
    name: string;
    role: AgentRole;
    parentId: string | null;
    webhookUrl?: string | null;
  }): Promise<{ agent: Agent; plaintextKey: string; webhookSecret: string | null }>;
  revoke(id: string): Promise<Agent>;
  authenticate(plaintextKey: string): Promise<Agent | null>;
  setWebhook(
    id: string,
    webhookUrl: string | null,
    rotateSecret: boolean,
  ): Promise<{ agent: Agent; webhookSecret: string | null }>;
}
