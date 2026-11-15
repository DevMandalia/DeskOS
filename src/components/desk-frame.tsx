import Link from "next/link";
import type { ReactNode } from "react";

import { AppFrame } from "@/components/app-frame";
import { ChatPanel } from "@/components/chat-panel";
import { SideNav } from "@/components/side-nav";
import { SiteHeader } from "@/components/site-header";
import { isChatConfigured } from "@/lib/chat";
import { isStaticDemo } from "@/lib/demo-mode";
import { BOARD_HREF, buildNav, deskHref, HOME_HREF, type DeskScope } from "@/lib/nav";
import { displayTitle } from "@/lib/queue";
import type { BriefRow } from "@/lib/types";

/** Header + left nav + main + right chat panel, shared by the desk and decision pages. */
export function DeskFrame({
  email,
  rows,
  scope,
  currentId,
  home = false,
  board = false,
  children,
}: {
  email?: string | null;
  rows: BriefRow[];
  scope: DeskScope;
  currentId?: string | null;
  home?: boolean;
  board?: boolean;
  children: ReactNode;
}) {
  const current = currentId ? rows.find((r) => r.id === currentId) : undefined;
  const navModel = buildNav(rows, scope);
  const waiting = navModel.views.find((v) => v.key === "waiting")?.count ?? 0;
  return (
    <AppFrame
      header={<SiteHeader email={email} waiting={waiting} />}
      nav={<SideNav nav={navModel} scope={scope} currentId={currentId} home={home} board={board} />}
      navRail={
        <>
          <Link href={HOME_HREF} className="rail-link" aria-label="Home" title="Home">
            <span aria-hidden="true">⌂</span>
          </Link>
          <Link href={BOARD_HREF} className="rail-link" aria-label="Board" title="Board">
            <span aria-hidden="true">▦</span>
          </Link>
          <Link
            href={deskHref({ view: "waiting" })}
            className="rail-link rail-link-wait"
            aria-label={`Waiting on you: ${waiting}`}
            title="Waiting on you"
          >
            {waiting}
          </Link>
        </>
      }
      panel={
        isStaticDemo() ? (
          <p className="chat-empty-copy">Chat is off in the demo.</p>
        ) : (
          <ChatPanel
            configured={isChatConfigured()}
            rowId={current?.id ?? null}
            title={current ? displayTitle(current.item) : null}
          />
        )
      }
    >
      {children}
    </AppFrame>
  );
}
