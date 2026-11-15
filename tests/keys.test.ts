import { describe, expect, it } from "vitest";

import { hashSecret, hashesEqual, mintApiKey, signBody, verifySignature } from "@/lib/keys";

describe("api keys", () => {
  it("mints ddk_ keys and hashes them", () => {
    const key = mintApiKey();
    expect(key.plaintext.startsWith("ddk_")).toBe(true);
    expect(key.prefix).toBe(key.plaintext.slice(0, 12));
    expect(hashesEqual(key.plaintext, key.hash)).toBe(true);
    expect(hashesEqual("ddk_nope", key.hash)).toBe(false);
  });

  it("is stable sha256", () => {
    expect(hashSecret("abc")).toBe(hashSecret("abc"));
    expect(hashSecret("abc")).not.toBe(hashSecret("abd"));
  });
});

describe("HMAC signatures", () => {
  it("signs and verifies a body", () => {
    const secret = "s3cret";
    const body = JSON.stringify({ type: "desk_verdict", choice: "Approve" });
    const sig = signBody(secret, body);
    expect(verifySignature(secret, body, sig)).toBe(true);
    expect(verifySignature(secret, body, `sha256=${sig}`)).toBe(true);
    expect(verifySignature(secret, body + "x", sig)).toBe(false);
  });
});
