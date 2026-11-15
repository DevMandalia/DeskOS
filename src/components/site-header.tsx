import Link from "next/link";

import { AccountMenu } from "@/components/account-menu";
import { DrawerToggle } from "@/components/app-frame";
import { FocusToggle } from "@/components/focus-toggle";
import { SignOutButton } from "@/components/sign-out-button";
import { ThemeToggle } from "@/components/theme-toggle";
import { isStaticDemo } from "@/lib/demo-mode";
import { isAuthBypass } from "@/lib/env";

export function SiteHeader({
  email,
  waiting = 0,
}: {
  email?: string | null;
  waiting?: number;
}) {
  const demo = isStaticDemo();
  const bypass = isAuthBypass();
  return (
    <header className="site-header">
      <div className="site-header-inner">
        <div className="site-header-start">
          <DrawerToggle drawer="nav" />
          <Link href="/" className="brand">
            <span className="brand-name">
              <span className="live-dot" aria-hidden="true" />
              Desk
            </span>
          </Link>
        </div>
        <div className="site-header-end">
          {waiting > 0 ? (
            <Link href="/waiting" className="waiting-pill">
              {waiting} waiting
            </Link>
          ) : null}
          <DrawerToggle drawer="chat" />
          <FocusToggle />
          <ThemeToggle />
          <AccountMenu>
            {demo ? <span className="kicker muted">Demo</span> : null}
            {!demo && email ? <span className="kicker muted account-email">{email}</span> : null}
            {!demo && !bypass ? <SignOutButton /> : null}
          </AccountMenu>
        </div>
      </div>
    </header>
  );
}
