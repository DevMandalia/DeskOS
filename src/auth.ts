import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";

import { withBasePath } from "@/lib/base-path";
import { authProvider, isAllowedEmail } from "@/lib/env";

function providers() {
  const kind = authProvider();
  if (kind === "github") {
    const ready = Boolean(process.env.AUTH_GITHUB_ID && process.env.AUTH_GITHUB_SECRET);
    return ready ? [GitHub] : [];
  }
  const ready = Boolean(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET);
  return ready ? [Google] : [];
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  trustHost: true,
  basePath: withBasePath("/api/auth"),
  providers: providers(),
  pages: {
    signIn: withBasePath("/signin"),
    error: withBasePath("/signin"),
  },
  callbacks: {
    async signIn({ user }) {
      return isAllowedEmail(user.email);
    },
    async session({ session }) {
      return session;
    },
  },
});
