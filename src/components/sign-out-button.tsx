import { signOut } from "@/auth";
import { withBasePath } from "@/lib/base-path";

export function SignOutButton() {
  return (
    <form
      action={async () => {
        "use server";
        await signOut({ redirectTo: withBasePath("/signin") });
      }}
    >
      <button type="submit" className="text-btn">
        Sign out
      </button>
    </form>
  );
}
