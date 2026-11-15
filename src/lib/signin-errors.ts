export const SIGNIN_SUBTITLE = "Owner account only.";

export const WRONG_ACCOUNT_MESSAGE =
  "Wrong account. Sign in as the owner.";

export const GENERIC_SIGNIN_ERROR = "Sign-in didn't finish. Try again.";

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
