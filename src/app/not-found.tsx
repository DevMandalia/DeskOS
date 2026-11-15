import Link from "next/link";

export default function NotFound() {
  return (
    <main className="shell forbidden">
      <p className="kicker">DeskOS</p>
      <h1>Not found</h1>
      <p className="lede">Not on this desk.</p>
      <p>
        <Link href="/">Home</Link>
      </p>
    </main>
  );
}
