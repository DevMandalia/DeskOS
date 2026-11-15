import { forbidden } from "next/navigation";

import { auth } from "@/auth";
import { isAllowedEmail, isAuthBypass, ownerEmail } from "@/lib/env";

export type DeskUser = {
  email: string;
  name: string | null;
};

export async function currentUser(): Promise<DeskUser | null> {
  if (isAuthBypass()) {
    return { email: ownerEmail() || "owner@acme.test", name: "Owner" };
  }
  const session = await auth();
  const email = session?.user?.email;
  if (!email || !isAllowedEmail(email)) return null;
  return { email, name: session?.user?.name ?? "Owner" };
}

export async function requireUser(): Promise<DeskUser> {
  const user = await currentUser();
  if (!user) forbidden();
  return user;
}
