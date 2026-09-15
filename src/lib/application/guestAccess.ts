// src/lib/application/guestAccess.ts
// 2026-09-15 JST

import {
  createHash,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

export function createGuestAccessToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashGuestAccessToken(
  token: string,
): string {
  return createHash("sha256")
    .update(token, "utf8")
    .digest("hex");
}

export function guestAccessTokenMatches(
  token: string,
  expectedHash: string,
): boolean {
  const actualHash =
    hashGuestAccessToken(token);

  const actual = Buffer.from(
    actualHash,
    "hex",
  );
  const expected = Buffer.from(
    expectedHash,
    "hex",
  );

  if (actual.length !== expected.length) {
    return false;
  }

  return timingSafeEqual(actual, expected);
}
