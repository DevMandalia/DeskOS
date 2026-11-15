import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const KEY_PREFIX = "ddk_";

export function hashSecret(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export function secretsEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function hashesEqual(plaintext: string, hash: string): boolean {
  return secretsEqual(hashSecret(plaintext), hash);
}

export function mintApiKey(): { plaintext: string; hash: string; prefix: string } {
  const plaintext = `${KEY_PREFIX}${randomBytes(24).toString("hex")}`;
  return { plaintext, hash: hashSecret(plaintext), prefix: plaintext.slice(0, 12) };
}

export function mintWebhookSecret(): string {
  return randomBytes(32).toString("hex");
}

export function signBody(secret: string, body: string): string {
  return createHmac("sha256", secret).update(body, "utf8").digest("hex");
}

export function verifySignature(secret: string, body: string, signature: string): boolean {
  const expected = signBody(secret, body);
  const got = signature.replace(/^sha256=/i, "");
  return secretsEqual(expected, got);
}
