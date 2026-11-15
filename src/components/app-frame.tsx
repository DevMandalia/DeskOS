"use client";

import { ResizeHandle } from "@/components/resize-handle";
import { setPane, useDocked, usePanePrefs } from "@/components/pane-prefs";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
  type RefObject,
} from "react";

type Drawer = "nav" | "chat";

type FrameState = {
  open: Drawer | null;
  toggle: (drawer: Drawer) => void;
  close: () => void;
  toggleRefs: Record<Drawer, RefObject<HTMLButtonElement | null>>;
};

const FrameContext = createContext<FrameState | null>(null);

const DRAWER_IDS: Record<Drawer, string> = { nav: "desk-nav", chat: "desk-chat" };

/**
 * Desk shell. Docked (≥1024px): a resizable, collapsible left nav, the main
 * column, and the chat docked on the right (resizable, collapsible to a rail,
 * open by default). Narrower: the nav and the chat are drawers opened from the
 * header. Escape, the scrim, or a nav link closes a drawer.
 */
export function AppFrame({
  header,
  nav,
  navRail,
  panel,
  children,
}: {
  header: ReactNode;
  nav: ReactNode;
  navRail?: ReactNode;
  panel: ReactNode;
  children: ReactNode;
}) {
  const [open, setOpen] = useState<Drawer | null>(null);
  const prefs = usePanePrefs();
  const docked = useDocked();
  const navToggle = useRef<HTMLButtonElement | null>(null);
  const chatToggle = useRef<HTMLButtonElement | null>(null);
  const navClose = useRef<HTMLButtonElement | null>(null);
  const chatClose = useRef<HTMLButtonElement | null>(null);
  const toggleRefs = { nav: navToggle, chat: chatToggle };
  const last = useRef<Drawer | null>(null);

  const close = useCallback(() => setOpen(null), []);
  const toggle = useCallback((drawer: Drawer) => {
    setOpen((current) => (current === drawer ? null : drawer));
  }, []);

  // A drawer left open on a phone means nothing once the panes dock.
  const drawer = docked ? null : open;

  useEffect(() => {
    if (drawer) {
      last.current = drawer;
      (drawer === "nav" ? navClose : chatClose).current?.focus();
      function onKey(event: KeyboardEvent) {
        if (event.key === "Escape") {
          event.stopPropagation();
          setOpen(null);
        }
      }
      document.addEventListener("keydown", onKey, true);
      return () => document.removeEventListener("keydown", onKey, true);
    }
    if (last.current) {
      const toggleButton = (last.current === "nav" ? navToggle : chatToggle).current;
      if (toggleButton && toggleButton.offsetParent !== null) toggleButton.focus();
      last.current = null;
    }
  }, [drawer]);

  function closeOnLink(event: MouseEvent<HTMLElement>) {
    if ((event.target as HTMLElement).closest("a")) setOpen(null);
  }

  // "Visible" for the chat's reply polling: docked and expanded, or the drawer is open.
  const chatVisible = docked ? !prefs.chat.collapsed : drawer === "chat";
  const navVisible = docked ? !prefs.nav.collapsed : drawer === "nav";

  return (
    <FrameContext.Provider value={{ open: drawer, toggle, close, toggleRefs }}>
      <div className="app" data-drawer={drawer ?? "none"}>
        {header}
        <div className="app-body">
          <aside
            id={DRAWER_IDS.nav}
            className="side-nav"
            aria-label="Desk navigation"
            data-open={navVisible ? "true" : "false"}
            onClick={closeOnLink}
          >
            <div className="side-scroll side-full">
              <div className="drawer-head">
                <span className="kicker muted">Desk</span>
                <button ref={navClose} type="button" className="drawer-close" onClick={close}>
                  Close<span className="sr-only"> desk menu</span>
                </button>
                <button
                  type="button"
                  className="dock-collapse"
                  aria-label="Collapse menu"
                  aria-expanded="true"
                  aria-controls={DRAWER_IDS.nav}
                  title="Collapse menu"
                  onClick={() => setPane("nav", { collapsed: true })}
                >
                  <span aria-hidden="true">«</span>
                </button>
              </div>
              {nav}
            </div>
            <div className="side-rail">
              <button
                type="button"
                className="rail-btn"
                aria-label="Expand menu"
                aria-expanded="false"
                aria-controls={DRAWER_IDS.nav}
                title="Expand menu"
                onClick={() => setPane("nav", { collapsed: false })}
              >
                <MenuIcon />
              </button>
              {navRail}
            </div>
            <ResizeHandle pane="nav" width={prefs.nav.width} controls={DRAWER_IDS.nav} label="Resize menu" />
          </aside>
          <main className="app-main">{children}</main>
          <aside
            id={DRAWER_IDS.chat}
            className="side-panel"
            aria-label="Chat"
            data-open={chatVisible ? "true" : "false"}
          >
            <ResizeHandle pane="chat" width={prefs.chat.width} controls={DRAWER_IDS.chat} label="Resize chat" />
            <div className="side-scroll side-full">
              <div className="drawer-head">
                <span className="kicker muted">Agent chat</span>
                <button ref={chatClose} type="button" className="drawer-close" onClick={close}>
                  Close<span className="sr-only"> chat panel</span>
                </button>
                <button
                  type="button"
                  className="dock-collapse"
                  aria-label="Collapse chat"
                  aria-expanded="true"
                  aria-controls={DRAWER_IDS.chat}
                  title="Collapse chat"
                  onClick={() => setPane("chat", { collapsed: true })}
                >
                  <span aria-hidden="true">»</span>
                </button>
              </div>
              {panel}
            </div>
            <div className="side-rail">
              <button
                type="button"
                className="rail-btn rail-btn-chat"
                aria-label="Open chat"
                aria-expanded="false"
                aria-controls={DRAWER_IDS.chat}
                title="Open chat"
                onClick={() => setPane("chat", { collapsed: false })}
              >
                <ChatIcon />
                <span className="rail-label" aria-hidden="true">
                  Chat
                </span>
              </button>
            </div>
          </aside>
        </div>
        <div className="drawer-scrim" onClick={close} aria-hidden="true" />
      </div>
    </FrameContext.Provider>
  );
}

function MenuIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path d="M2 4.5h14M2 9h14M2 13.5h14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function ChatIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path
        d="M3 3.5h12a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1H8l-3.5 3v-3H3a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Header button that opens the nav or chat drawer. Hidden on wide screens. */
export function DrawerToggle({ drawer }: { drawer: Drawer }) {
  const frame = useContext(FrameContext);
  if (!frame) return null;
  const expanded = frame.open === drawer;
  const label = drawer === "nav" ? "Menu" : "Chat";
  return (
    <button
      ref={frame.toggleRefs[drawer]}
      type="button"
      className={`drawer-toggle drawer-toggle-${drawer}`}
      aria-expanded={expanded}
      aria-controls={DRAWER_IDS[drawer]}
      aria-label={drawer === "nav" ? "Desk menu" : "Chat"}
      onClick={() => frame.toggle(drawer)}
    >
      {drawer === "nav" ? <MenuIcon /> : <ChatIcon />}
      <span className="drawer-toggle-text" aria-hidden="true">
        {label}
      </span>
    </button>
  );
}
