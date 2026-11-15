"use client";

import { useRef, type KeyboardEvent, type PointerEvent } from "react";

import { RESIZE_STEP, RESIZE_STEP_BIG } from "@/lib/layout-prefs";

import { paneSpec, setPane, type Pane } from "./pane-prefs";

/**
 * Vertical drag handle on a pane edge. Pointer drag, or focus it and use the
 * arrow keys (Shift for bigger steps, Home / End for min / max). Double-click
 * resets to the default width.
 */
export function ResizeHandle({
  pane,
  width,
  controls,
  label,
}: {
  pane: Pane;
  width: number;
  controls: string;
  label: string;
}) {
  const spec = paneSpec(pane);
  const drag = useRef<{ x: number; w: number } | null>(null);
  // The nav grows to the right; the chat grows to the left.
  const dir = pane === "nav" ? 1 : -1;

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { x: event.clientX, w: width };
    document.documentElement.classList.add("is-resizing");
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!drag.current) return;
    setPane(pane, { width: drag.current.w + dir * (event.clientX - drag.current.x) }, false);
  }

  function end(event: PointerEvent<HTMLDivElement>) {
    if (!drag.current) return;
    drag.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    document.documentElement.classList.remove("is-resizing");
    setPane(pane, {}, true);
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const step = event.shiftKey ? RESIZE_STEP_BIG : RESIZE_STEP;
    let next: number | null = null;
    if (event.key === "ArrowRight") next = width + dir * step;
    else if (event.key === "ArrowLeft") next = width - dir * step;
    else if (event.key === "Home") next = spec.min;
    else if (event.key === "End") next = spec.max;
    if (next === null) return;
    event.preventDefault();
    event.stopPropagation();
    setPane(pane, { width: next });
  }

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      aria-controls={controls}
      aria-valuemin={spec.min}
      aria-valuemax={spec.max}
      aria-valuenow={width}
      tabIndex={0}
      className={`resize-handle resize-handle-${pane}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={end}
      onPointerCancel={end}
      onKeyDown={onKeyDown}
      onDoubleClick={() => setPane(pane, { width: spec.def })}
      title="Drag to resize · double-click to reset"
    />
  );
}
