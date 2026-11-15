import Link from "next/link";

export function ForbiddenScreen() {
  return (
    <main className="shell forbidden">
      <p className="kicker">DeskOS · private</p>
      <h1>403</h1>
      <p className="lede">
        Owner account only.
      </p>
      <p>
        <Link href="/signin?error=AccessDenied">Use a different account</Link>
      </p>
    </main>
  );
}
