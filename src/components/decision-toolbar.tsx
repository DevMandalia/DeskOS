import Link from "next/link";

export function DecisionToolbar({
  backHref,
  backLabel,
  prevHref,
  nextHref,
  position,
}: {
  backHref: string;
  backLabel: string;
  prevHref: string | null;
  nextHref: string | null;
  position: { index: number; total: number } | null;
}) {
  return (
    <nav className="decision-toolbar" aria-label="Decision">
      <Link href={backHref} className="decision-back">
        <kbd>Esc</kbd> {backLabel}
      </Link>
      <div className="decision-toolbar-end">
        {position ? (
          <span className="decision-pos">
            {position.index} of {position.total}
          </span>
        ) : null}
        {prevHref ? (
          <Link href={prevHref} className="step-mini" rel="prev">
            Prev <kbd>K</kbd>
          </Link>
        ) : (
          <span className="step-mini step-btn-off">
            Prev <kbd>K</kbd>
          </span>
        )}
        {nextHref ? (
          <Link href={nextHref} className="step-mini" rel="next">
            Next <kbd>J</kbd>
          </Link>
        ) : (
          <span className="step-mini step-btn-off">
            Next <kbd>J</kbd>
          </span>
        )}
      </div>
    </nav>
  );
}
