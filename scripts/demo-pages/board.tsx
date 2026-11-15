import type { Metadata } from "next";

import { DemoDesk } from "@/components/demo-desk";
import { DeskFrame } from "@/components/desk-frame";
import { demoDecisions } from "@/lib/seed";

export const metadata: Metadata = { title: "Board" };

export default function BoardPage() {
  return (
    <DeskFrame
      email="owner@acme.test"
      rows={demoDecisions()}
      scope={{ area: null, view: "waiting", includeDone: false }}
      board
    >
      <DemoDesk page="board" />
    </DeskFrame>
  );
}
