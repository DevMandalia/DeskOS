import type { Metadata } from "next";

import { BoardView } from "@/components/board-view";
import { DemoDesk } from "@/components/demo-desk";
import { DeskFrame } from "@/components/desk-frame";
import { boardToday } from "@/lib/board";
import { isStaticDemo } from "@/lib/demo-mode";
import { listOwnerRows } from "@/lib/owner-rows";
import { demoDecisions } from "@/lib/seed";
import { requireUser } from "@/lib/session";
import { taskStore } from "@/lib/tasks/store";
import { parseWipEnforce, parseWipLimit } from "@/lib/desk-contract";
import { TaskStoreError, type TaskBoard } from "@/lib/tasks/types";

export const metadata: Metadata = { title: "Board" };

export default async function BoardPage() {
  if (isStaticDemo()) {
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

  const user = await requireUser();
  const store = await taskStore();
  const [rows, loaded] = await Promise.all([
    listOwnerRows(),
    (async (): Promise<{ board: TaskBoard | null; error: string | null }> => {
      try {
        return { board: await store.list(), error: null };
      } catch (err) {
        return {
          board: null,
          error: err instanceof TaskStoreError ? err.message : "Couldn't load the board.",
        };
      }
    })(),
  ]);

  return (
    <DeskFrame email={user.email} rows={rows} scope={{ area: null, view: "waiting", includeDone: false }} board>
      <BoardView
        initial={loaded.board}
        initialError={loaded.error}
        today={boardToday()}
        storeLabel={store.label}
        wipLimit={parseWipLimit()}
        wipEnforce={parseWipEnforce()}
      />
    </DeskFrame>
  );
}
