import { describe, expect, it } from "vitest";

import {
  GENERIC_SIGNIN_ERROR,
  SIGNIN_SUBTITLE,
  WRONG_ACCOUNT_MESSAGE,
  isWrongAccount,
  signInErrorMessage,
} from "@/lib/signin-errors";

describe("signInErrorMessage", () => {
  it("uses the approved subtitle", () => {
    expect(SIGNIN_SUBTITLE).toBe("Owner account only.");
  });

  it("explains a wrong account", () => {
    expect(signInErrorMessage("AccessDenied")).toBe(WRONG_ACCOUNT_MESSAGE);
    expect(WRONG_ACCOUNT_MESSAGE).toContain("the owner");
    expect(isWrongAccount(["AccessDenied"])).toBe(true);
  });

  it("falls back to generic copy and never echoes the code", () => {
    expect(signInErrorMessage("Configuration")).toBe(GENERIC_SIGNIN_ERROR);
    expect(signInErrorMessage("<script>")).toBe(GENERIC_SIGNIN_ERROR);
    expect(isWrongAccount("Configuration")).toBe(false);
  });

  it("is silent with no error", () => {
    expect(signInErrorMessage(undefined)).toBeNull();
    expect(signInErrorMessage("")).toBeNull();
  });
});
