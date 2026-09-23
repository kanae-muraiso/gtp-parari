import { createHash, randomBytes } from "node:crypto";

export const GUEST_APPLICATION_VERIFICATION_TTL_MS =
  24 * 60 * 60 * 1000;

export const GUEST_APPLICATION_VERIFICATION_TOKEN_RE =
  /^[0-9a-f]{64}$/;

export function hashGuestApplicationVerificationToken(
  token: string,
): string {
  return createHash("sha256")
    .update(token, "utf8")
    .digest("hex");
}

export function createGuestApplicationVerificationToken() {
  const token = randomBytes(32).toString("hex");

  return {
    token,
    tokenHash:
      hashGuestApplicationVerificationToken(token),
    expiresAt: new Date(
      Date.now() +
        GUEST_APPLICATION_VERIFICATION_TTL_MS,
    ).toISOString(),
  };
}
