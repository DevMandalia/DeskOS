"use client";

import { useSyncExternalStore } from "react";

import {
  CHAT_PANE,
  clampWidth,
  DOCK_MIN_WIDTH,
  FOCUS_KEY,
  NAV_PANE,
  parseCollapsed,
  parseFocus,
  parseWidth,
  type PaneSpec,
} from "@/lib/layout-prefs";

export type PanePrefs = { width: number; collapsed: boolean };
type Prefs = { nav: PanePrefs; chat: PanePrefs };

const SERVER: Prefs = {
  nav: { width: NAV_PANE.def, collapsed: false },
  chat: { width: CHAT_PANE.def, collapsed: false },
};

const SPECS = { nav: NAV_PANE, chat: CHAT_PANE } as const;
export type Pane = keyof typeof SPECS;

let cache: Prefs | null = null;
const listeners = new Set<() => void>();

function readPane(spec: PaneSpec): PanePrefs {
  try {
    return {
      width: parseWidth(localStorage.getItem(spec.widthKey), spec),
      collapsed: parseCollapsed(localStorage.getItem(spec.collapsedKey)),
    };
  } catch {
    return { width: spec.def, collapsed: false };
  }
}

function snapshot(): Prefs {
  if (!cache) cache = { nav: readPane(NAV_PANE), chat: readPane(CHAT_PANE) };
  return cache;
}

function apply(spec: PaneSpec, prefs: PanePrefs) {
  const root = document.documentElement;
  root.style.setProperty(spec.cssVar, `${prefs.width}px`);
  root.setAttribute(spec.attr, prefs.collapsed ? "collapsed" : "open");
}

function applyFocus(on: boolean) {
  document.documentElement.setAttribute("data-focus", on ? "on" : "off");
}

let focusOn = false;
try {
  focusOn = parseFocus(localStorage.getItem(FOCUS_KEY));
} catch {
  focusOn = false;
}

export function setFocusMode(on: boolean) {
  focusOn = on;
  applyFocus(on);
  try {
    localStorage.setItem(FOCUS_KEY, on ? "1" : "0");
  } catch {
    /* private mode */
  }
  for (const l of listeners) l();
}

export function toggleFocusMode() {
  try {
    focusOn = parseFocus(localStorage.getItem(FOCUS_KEY));
  } catch {
    /* keep */
  }
  setFocusMode(!focusOn);
}

/** Update a pane; applies to <html> right away. `persist: false` while dragging. */
export function setPane(pane: Pane, patch: Partial<PanePrefs>, persist = true) {
  const spec = SPECS[pane];
  const current = snapshot()[pane];
  const next: PanePrefs = {
    width: patch.width === undefined ? current.width : clampWidth(patch.width, spec),
    collapsed: patch.collapsed ?? current.collapsed,
  };
  if (next.width === current.width && next.collapsed === current.collapsed && !persist) return;
  cache = { ...snapshot(), [pane]: next };
  apply(spec, next);
  if (persist) {
    try {
      localStorage.setItem(spec.widthKey, String(next.width));
      localStorage.setItem(spec.collapsedKey, next.collapsed ? "1" : "0");
    } catch {
      /* private mode: still works for this page */
    }
  }
  for (const l of listeners) l();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (!event.key?.startsWith("desk-")) return;
    cache = null;
    const prefs = snapshot();
    apply(NAV_PANE, prefs.nav);
    apply(CHAT_PANE, prefs.chat);
    if (event.key === FOCUS_KEY || event.key === null) {
      try {
        focusOn = parseFocus(localStorage.getItem(FOCUS_KEY));
      } catch {
        focusOn = false;
      }
      applyFocus(focusOn);
    }
    listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export function usePanePrefs(): Prefs {
  return useSyncExternalStore(subscribe, snapshot, () => SERVER);
}

export function useFocusMode(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => focusOn,
    () => false,
  );
}

export function paneSpec(pane: Pane): PaneSpec {
  return SPECS[pane];
}

const QUERY = `(min-width: ${DOCK_MIN_WIDTH}px)`;

function subscribeMedia(listener: () => void) {
  const media = window.matchMedia(QUERY);
  media.addEventListener("change", listener);
  return () => media.removeEventListener("change", listener);
}

/** True when the nav and chat are docked (desktop); false for drawers. */
export function useDocked(): boolean {
  return useSyncExternalStore(
    subscribeMedia,
    () => window.matchMedia(QUERY).matches,
    () => false,
  );
}
