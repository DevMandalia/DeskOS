"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  CHOICES,
  SAVED_TOAST,
  type Choice,
} from "@/lib/decide";
import { withBasePath } from "@/lib/base-path";
import { isStaticDemo } from "@/lib/demo-mode";
import { recordDemoVerdict } from "@/lib/demo-store";
import type { BriefRow } from "@/lib/types";

type Props = {
  row: BriefRow;
  prevHref: string | null;
  nextHref: string | null;
  /** 1-based position of this decision in the current desk order. */
  position?: { index: number; total: number } | null;
  onLocalSave?: () => void;
};

function isTyping(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  return (
    el.tagName === "TEXTAREA" ||
    el.tagName === "INPUT" ||
    el.tagName === "SELECT" ||
    el.isContentEditable
  );
}

export function DecisionPanel({ row, prevHref, nextHref, position, onLocalSave }: Props) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [pending, setPending] = useState<Choice | null>(null);
  const [confirming, setConfirming] = useState<Choice | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [saved, setSaved] = useState(row.reply);
  const [status, setStatus] = useState(row.status);
  const submitting = useRef(false);
  const noteRef = useRef<HTMLTextAreaElement>(null);
  const keyRef = useRef(crypto.randomUUID());
  const [noteOpen, setNoteOpen] = useState(false);
  const focusNote = useRef(false);

  const openNote = useCallback(() => {
    focusNote.current = true;
    setNoteOpen(true);
  }, []);

  useEffect(() => {
    if (noteOpen && focusNote.current) {
      focusNote.current = false;
      noteRef.current?.focus();
    }
  }, [noteOpen]);

  // One Prev / Next at a time: a second key press before the next decision
  // renders would act on this page's stale links.
  const navigating = useRef(false);
  useEffect(() => {
    navigating.current = false;
  }, [row.id]);

  const go = useCallback(
    (href: string | null) => {
      if (!href || navigating.current) return;
      navigating.current = true;
      window.setTimeout(() => {
        navigating.current = false;
      }, 3000);
      router.push(href);
    },
    [router],
  );

  const submit = useCallback(
    async (choice: Choice) => {
      if (submitting.current) return;
      submitting.current = true;
      setPending(choice);
      setConfirming(null);
      try {
        if (isStaticDemo()) {
          const savedRow = recordDemoVerdict(row.id, choice, note);
          keyRef.current = crypto.randomUUID();
          setToast("Saved locally in this browser (demo).");
          if (savedRow) {
            setSaved(savedRow.reply);
            setStatus(savedRow.status);
          }
          onLocalSave?.();
          return;
        }
        const response = await fetch(withBasePath("/api/decide"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            row_id: row.id,
            choice,
            note,
            idempotency_key: keyRef.current,
          }),
        });
        const data = (await response.json()) as {
          ok?: boolean;
          toast?: string;
          row?: BriefRow;
          error?: string;
        };
        if (!response.ok || !data.ok) {
          setToast(data.error ?? "Could not save");
          return;
        }
        keyRef.current = crypto.randomUUID();
        setToast(data.toast ?? SAVED_TOAST);
        if (data.row) {
          setSaved(data.row.reply);
          setStatus(data.row.status);
        }
        router.refresh();
      } catch {
        setToast("Could not save");
      } finally {
        submitting.current = false;
        setPending(null);
      }
    },
    [note, row.id, router, onLocalSave],
  );

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setConfirming(null);
        return;
      }
      if (event.defaultPrevented || isTyping(event.target)) return;
      // Arrow keys on a focused resize handle resize the pane, not the queue.
      if ((event.target as HTMLElement | null)?.getAttribute?.("role") === "separator") return;
      const modified = event.altKey || event.ctrlKey || event.metaKey || event.shiftKey;
      const drawerOpen = document.querySelector(".app:not([data-drawer='none'])") !== null;
      if (
        (event.key === "ArrowLeft" || event.key === "ArrowRight") &&
        !modified &&
        !confirming &&
        !drawerOpen
      ) {
        event.preventDefault();
        go(event.key === "ArrowLeft" ? prevHref : nextHref);
        return;
      }
      if (modified) return;
      if (event.key === "n" && !confirming) {
        event.preventDefault();
        openNote();
      } else if (event.key === "j") {
        event.preventDefault();
        go(nextHref);
      } else if (event.key === "k") {
        event.preventDefault();
        go(prevHref);
      } else if (event.key === "a") {
        event.preventDefault();
        setConfirming("Approve");
      } else if (event.key === "d") {
        event.preventDefault();
        setConfirming("Decline");
      } else if (event.key === "x") {
        event.preventDefault();
        setConfirming("Discuss");
      } else if (event.key === "Enter" && confirming && !pending) {
        event.preventDefault();
        void submit(confirming);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [confirming, go, nextHref, openNote, pending, prevHref, submit]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 5000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const disabled = Boolean(pending);

  return (
    <section className="decision-panel">
      {noteOpen ? (
        <div className="note-wrap">
          <label className="note-label" htmlFor="decision-note">
            Note for the lead (optional)
          </label>
          <textarea
            id="decision-note"
            ref={noteRef}
            className="note"
            rows={3}
            placeholder="A sentence for the lead to pass on…"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            disabled={disabled}
          />
        </div>
      ) : (
        <p className="note-open">
          <button type="button" className="text-btn note-open-btn" onClick={openNote}>
            + Add a note
          </button>
        </p>
      )}
      <div className="decide-dock">
        <div className="action-bar">
          {CHOICES.map((choice) => (
            <button
              key={choice}
              type="button"
              className={`btn btn-${choice.toLowerCase()}`}
              disabled={disabled}
              onClick={() => setConfirming(choice)}
            >
              {pending === choice ? "Sending…" : choice}
            </button>
          ))}
        </div>
        <nav className="step-nav" aria-label="Previous and next decision">
          {prevHref ? (
            <Link href={prevHref} className="step-btn" rel="prev">
              <span aria-hidden="true">←</span> Prev
            </Link>
          ) : (
            <span className="step-btn step-btn-off" aria-disabled="true">
              <span aria-hidden="true">←</span> Prev
            </span>
          )}
          {position ? (
            <span className="step-pos" aria-label={`Decision ${position.index} of ${position.total}`}>
              {position.index} / {position.total}
            </span>
          ) : null}
          {nextHref ? (
            <Link href={nextHref} className="step-btn" rel="next">
              Next <span aria-hidden="true">→</span>
            </Link>
          ) : (
            <span className="step-btn step-btn-off" aria-disabled="true">
              Next <span aria-hidden="true">→</span>
            </span>
          )}
        </nav>
      </div>
      <p className="keys">
        <kbd>←</kbd> <kbd>→</kbd> prev · next · <kbd>a</kbd> <kbd>d</kbd> <kbd>x</kbd> approve ·
        decline · discuss · <kbd>n</kbd> note
      </p>

      {saved ? (
        <div className="saved-box">
          <p className="kicker">Saved</p>
          <p className="saved-status">{status}</p>
          <pre>{saved}</pre>
        </div>
      ) : null}

      {toast ? (
        <div className="toast" role="status">
          {toast}
        </div>
      ) : null}

      {confirming ? (
        <div
          className="modal-back"
          onClick={() => setConfirming(null)}
          role="presentation"
        >
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-title"
            onClick={(event) => event.stopPropagation()}
          >
            <p className="kicker">{isStaticDemo() ? "Demo only" : "Confirm"}</p>
            <h2 id="confirm-title">{confirming} this?</h2>
            <p>
              {isStaticDemo()
                ? "This stays in your browser. Nothing is sent anywhere."
                : `Your answer is saved on this desk and the raising agent (${row.owner ?? "the lead"}) is notified.`}
            </p>
            {note.trim() ? <blockquote>{note.trim()}</blockquote> : null}
            <div className="modal-actions">
              <button
                type="button"
                className={`btn btn-${confirming.toLowerCase()}`}
                onClick={() => void submit(confirming)}
                disabled={disabled}
              >
                Confirm {confirming}
              </button>
              <button
                type="button"
                className="btn btn-discuss"
                onClick={() => setConfirming(null)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
