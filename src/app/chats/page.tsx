import type { Metadata } from "next";

import { ChatCapture, ChatLane } from "@/components/chat-lane";
import { DemoDesk } from "@/components/demo-desk";
import { DeskFrame } from "@/components/desk-frame";
import { isStaticDemo } from "@/lib/demo-mode";
import { publicOrigin, withBasePath } from "@/lib/base-path";
import { defaultComeBackBy, groupChatsByApp, parseChatRevisitDays } from "../../../contract/chats";
import { todayYmd } from "../../../contract/dates";
import { deskTimezone } from "@/lib/env";
import { listChatPointers } from "@/lib/chats/store";
import { listOwnerRows } from "@/lib/owner-rows";
import { demoDecisions } from "@/lib/seed";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Chats" };

export default async function ChatsPage({ searchParams }: { searchParams: Promise<{ url?: string }> }) {
  if (isStaticDemo()) {
    return (
      <DeskFrame email="owner@acme.test" rows={demoDecisions()} scope={{ area: null, view: "waiting", includeDone: false }}>
        <DemoDesk page="home" />
      </DeskFrame>
    );
  }
  const user = await requireUser();
  const rows = await listOwnerRows();
  const chats = await listChatPointers();
  const today = todayYmd(new Date(), deskTimezone());
  const days = parseChatRevisitDays();
  const open = chats.filter((c) => c.status === "open" || c.status === "resumed");
  const groups = groupChatsByApp(open, today);
  const initialUrl = (await searchParams).url ?? "";
  const pasteBase = `${publicOrigin("http://127.0.0.1:3010")}${withBasePath("/chats")}?url=`;
  return (
    <DeskFrame email={user.email} rows={rows} scope={{ area: null, view: "waiting", includeDone: false }}>
      <div className="desk">
        <header className="desk-head">
          <h1>Chats</h1>
          <p className="desk-sub">URL, next step, date. No transcripts.</p>
        </header>
        <ChatCapture initialUrl={initialUrl} defaultComeBack={defaultComeBackBy(today, days)} bookmarkletHref={pasteBase} />
        <ChatLane groups={groups} extra={chats.length - open.length} snoozeDate={defaultComeBackBy(today, days)} />
      </div>
    </DeskFrame>
  );
}
