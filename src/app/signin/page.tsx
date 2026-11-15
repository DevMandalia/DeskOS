import { signIn } from "@/auth";
import { DemoDesk } from "@/components/demo-desk";
import { safeCallbackPath } from "@/lib/base-path";
import { isStaticDemo } from "@/lib/demo-mode";
import { authProvider, isAuthBypass } from "@/lib/env";
import { SIGNIN_SUBTITLE, isWrongAccount, signInErrorMessage } from "@/lib/signin-errors";

export const metadata = { title: "Sign in" };

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; error?: string | string[] }>;
}) {
  if (isStaticDemo()) {
    return <DemoDesk page="signin" />;
  }

  const { callbackUrl, error } = await searchParams;
  const provider = authProvider();
  const googleReady = Boolean(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET);
  const githubReady = Boolean(process.env.AUTH_GITHUB_ID && process.env.AUTH_GITHUB_SECRET);
  const ready = provider === "github" ? githubReady : googleReady;
  const message = signInErrorMessage(error);
  const wrongAccount = isWrongAccount(error);
  const label = provider === "github" ? "GitHub" : "Google";

  return (
    <main className="signin-screen">
      <section className="signin-card" aria-labelledby="signin-title">
        <p className="kicker signin-kicker">Private · Desk</p>
        <h1 id="signin-title" className="signin-title">
          DeskOS
        </h1>
        <p className="signin-subtitle">{SIGNIN_SUBTITLE}</p>
        {message ? (
          <div className="signin-error" role="alert">
            <p className="signin-error-title">
              {wrongAccount ? `Wrong ${label} account` : "Couldn't sign you in"}
            </p>
            <p>{message}</p>
          </div>
        ) : null}
        {ready && !isAuthBypass() ? (
          <form
            className="signin-form"
            action={async () => {
              "use server";
              await signIn(
                provider,
                { redirectTo: safeCallbackPath(callbackUrl) },
                provider === "google" && wrongAccount ? { prompt: "select_account" } : undefined,
              );
            }}
          >
            <button type="submit" className="btn btn-approve signin-btn">
              {wrongAccount ? `Use a different ${label} account` : `Continue with ${label}`}
            </button>
          </form>
        ) : (
          <p className="empty signin-note">
            {isAuthBypass()
              ? "Local bypass is on. Open the desk at /."
              : `Set AUTH_${provider.toUpperCase()}_ID and AUTH_${provider.toUpperCase()}_SECRET, or AUTH_DEV_BYPASS=1 for local development.`}
          </p>
        )}
      </section>
    </main>
  );
}
