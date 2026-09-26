import "server-only";

import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "crypto";

function encryptionKey(): Buffer {
  const secret =
    process.env.SQUARE_TOKEN_ENCRYPTION_KEY?.trim();

  if (!secret) {
    throw new Error(
      "SQUARE_TOKEN_ENCRYPTION_KEY is not configured",
    );
  }

  return createHash("sha256").update(secret).digest();
}

export function encryptSquareToken(value: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(
    "aes-256-gcm",
    encryptionKey(),
    iv,
  );

  const encrypted = Buffer.concat([
    cipher.update(value, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return [
    "v1",
    iv.toString("base64url"),
    tag.toString("base64url"),
    encrypted.toString("base64url"),
  ].join(":");
}

export function decryptSquareToken(payload: string): string {
  const [version, ivText, tagText, encryptedText] =
    payload.split(":");

  if (
    version !== "v1" ||
    !ivText ||
    !tagText ||
    !encryptedText
  ) {
    throw new Error("Invalid Square token ciphertext");
  }

  const decipher = createDecipheriv(
    "aes-256-gcm",
    encryptionKey(),
    Buffer.from(ivText, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(tagText, "base64url"));

  return Buffer.concat([
    decipher.update(
      Buffer.from(encryptedText, "base64url"),
    ),
    decipher.final(),
  ]).toString("utf8");
}
