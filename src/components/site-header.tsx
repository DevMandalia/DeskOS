import Link from "next/link";

import { AccountMenu } from "@/components/account-menu";
import { DrawerToggle } from "@/components/app-frame";
import { SignOutButton } from "@/components/sign-out-button";
import { ThemeToggle } from "@/components/theme-toggle";
import { isStaticDemo } from "@/lib/demo-mode";
import { isAuthBypass } from "@/lib/env";

export function SiteHeader({ email }: { email?: string | null }) {
  const demo = isStaticDemo();
  const bypass = isAuthBypass();
  return (
    <header className="site-header">
      <div className="site-header-inner">
        <div className="site-header-start">
          <DrawerToggle drawer="nav" />
          <Link href="/" className="brand">
            <span className="brand-name">DeskOS</span>
          </Link>
        </div>
        <div className="site-header-end">
          <DrawerToggle drawer="chat" />
          <AccountMenu>
            <ThemeToggle />
            {demo ? <span className="kicker muted">Demo</span> : null}
            {!demo && email ? <span className="kicker muted account-email">{email}</span> : null}
            {!demo && !bypass ? <SignOutButton /> : null}
          </AccountMenu>
        </div>
      </div>
    </header>
  );
}
