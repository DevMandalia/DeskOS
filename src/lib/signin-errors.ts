export const SIGNIN_SUBTITLE = "Private desk. Only the owner's account can sign in.";

export const WRONG_ACCOUNT_MESSAGE =
  "That account can't open this desk. Sign in with the owner email.";

export const GENERIC_SIGNIN_ERROR = "Sign-in didn't finish. Please try again.";

export function signInErrorMessage(code: string | string[] | null | undefined): string | null {
  const value = Array.isArray(code) ? code[0] : code;
  if (!value) return null;
  if (value === "AccessDenied") return WRONG_ACCOUNT_MESSAGE;
  return GENERIC_SIGNIN_ERROR;
}

export function isWrongAccount(code: string | string[] | null | undefined): boolean {
  const value = Array.isArray(code) ? code[0] : code;
  return value === "AccessDenied";
}
