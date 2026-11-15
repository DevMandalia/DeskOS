/**
 * Pane widths and collapsed state for the desk shell (left nav, right chat),
 * remembered in localStorage. The inline boot script applies them to <html>
 * before first paint (CSS variables + data attributes), so there is no jump.
 */
export type PaneSpec = {
  widthKey: string;
  collapsedKey: string;
  cssVar: string;
  attr: string;
  min: number;
  max: number;
  def: number;
};

export const NAV_PANE: PaneSpec = {
  widthKey: "desk-nav-width",
  collapsedKey: "desk-nav-collapsed",
  cssVar: "--nav-w",
  attr: "data-nav",
  min: 200,
  max: 320,
  def: 240,
};

export const CHAT_PANE: PaneSpec = {
  widthKey: "desk-chat-width",
  collapsedKey: "desk-chat-collapsed",
  cssVar: "--chat-w",
  attr: "data-chat",
  min: 280,
  max: 480,
  def: 340,
};

/** Keyboard step on a focused resize handle (Shift for a bigger step). */
export const RESIZE_STEP = 16;
export const RESIZE_STEP_BIG = 64;

/** Docked panes from this width up; below it the nav and chat are drawers. */
export const DOCK_MIN_WIDTH = 1024;

export function clampWidth(value: number, spec: PaneSpec): number {
  if (!Number.isFinite(value)) return spec.def;
  return Math.min(spec.max, Math.max(spec.min, Math.round(value)));
}

export function parseWidth(raw: string | null | undefined, spec: PaneSpec): number {
  if (raw == null || raw.trim() === "") return spec.def;
  return clampWidth(Number(raw), spec);
}

export function parseCollapsed(raw: string | null | undefined): boolean {
  return raw === "1";
}

/** Inline <head> boot. Pure string; mirrors parseWidth / parseCollapsed. */
export const LAYOUT_BOOTSTRAP_SCRIPT = `(function(){
  try {
    var root = document.documentElement;
    var panes = ${JSON.stringify([NAV_PANE, CHAT_PANE])};
    for (var i = 0; i < panes.length; i++) {
      var p = panes[i];
      var n = Number(localStorage.getItem(p.widthKey));
      var w = (!localStorage.getItem(p.widthKey) || !isFinite(n)) ? p.def : Math.min(p.max, Math.max(p.min, Math.round(n)));
      root.style.setProperty(p.cssVar, w + "px");
      root.setAttribute(p.attr, localStorage.getItem(p.collapsedKey) === "1" ? "collapsed" : "open");
    }
  } catch (e) {}
})();`;
