import Link from "next/link";

export function ForbiddenScreen() {
  return (
    <main className="shell forbidden">
      <p className="kicker">Decision desk · private</p>
      <h1>403</h1>
      <p className="lede">
        That account can&apos;t open this desk. Only the owner&apos;s account can sign in.
      </p>
      <p>
        <Link href="/signin?error=AccessDenied">Use a different account</Link>
      </p>
    </main>
  );
}
