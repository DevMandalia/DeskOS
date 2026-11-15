import Link from "next/link";

import { BOARD_HREF, HOME_HREF, type DeskScope, type NavModel } from "@/lib/nav";

const SETTINGS_HREF = "/settings";

/**
 * Slim left nav: the status views with counts, then areas (folded unless one
 * is selected). The waiting list itself lives on the desk, not here.
 */
export function SideNav({
  nav,
  scope,
  currentId,
  home = false,
  board = false,
}: {
  nav: NavModel;
  scope: DeskScope;
  currentId?: string | null;
  home?: boolean;
  board?: boolean;
}) {
  const page = home || board;
  return (
    <nav className="side-nav-inner" aria-label="Desk">
      <div className="side-top">
        <Link
          href={HOME_HREF}
          className={`side-link side-home ${home ? "side-link-active" : ""}`}
          aria-current={home ? "page" : undefined}
        >
          <span className="side-link-name">Home</span>
        </Link>
        <Link
          href={BOARD_HREF}
          className={`side-link side-home side-board ${board ? "side-link-active" : ""}`}
          aria-current={board ? "page" : undefined}
        >
          <span className="side-link-name">Board</span>
        </Link>
      </div>
      <div className="side-section">
        <h2 className="side-label">Views</h2>
        <ul className="side-list">
          {nav.views.map((view) => (
            <li key={view.key}>
              <Link
                href={view.href}
                className={`side-link ${view.active && !page ? "side-link-active" : ""} ${
                  view.key === "waiting" && view.count > 0 ? "side-link-wait" : ""
                }`}
                aria-current={view.active && !currentId && !page ? "page" : undefined}
              >
                <span className="side-link-name">{view.label}</span>
                <span className="side-count" aria-label={`${view.count} items`}>
                  {view.count}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>

      <details className="side-section side-areas" open={Boolean(scope.area)}>
        <summary className="side-label side-summary">
          Areas <span className="side-label-note">· waiting</span>
        </summary>
        <ul className="side-list">
          <li>
            <Link
              href={nav.allAreasHref}
              className={`side-link ${scope.area || page ? "" : "side-link-active"}`}
            >
              <span className="side-link-name">All areas</span>
              <span className="side-count" aria-label={`${nav.totalWaiting} waiting`}>
                {nav.totalWaiting}
              </span>
            </Link>
          </li>
          {nav.areas.map((area) => (
            <li key={area.area}>
              <Link
                href={area.href}
                className={`side-link ${area.active ? "side-link-active" : ""}`}
              >
                <span className="side-link-name">{area.area}</span>
                <span className="side-count" aria-label={`${area.count} waiting`}>
                  {area.count}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </details>
      <div className="side-section">
        <Link href={SETTINGS_HREF} className="side-link">
          <span className="side-link-name">Settings</span>
        </Link>
      </div>
    </nav>
  );
}
