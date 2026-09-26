export const SQUARE_API_VERSION = "2026-09-16";

export type SquareEnvironment = "sandbox" | "production";

export function getSquareEnvironment(): SquareEnvironment {
  return process.env.SQUARE_ENVIRONMENT === "production"
    ? "production"
    : "sandbox";
}

export function getSquareApiBase(): string {
  return getSquareEnvironment() === "production"
    ? "https://connect.squareup.com"
    : "https://connect.squareupsandbox.com";
}

export function getSquareApplicationId(): string {
  const value = process.env.SQUARE_APPLICATION_ID?.trim();
  if (!value) throw new Error("SQUARE_APPLICATION_ID is not configured");
  return value;
}

export function getSquareApplicationSecret(): string {
  const value = process.env.SQUARE_APPLICATION_SECRET?.trim();
  if (!value) throw new Error("SQUARE_APPLICATION_SECRET is not configured");
  return value;
}

export function getSquareOAuthRedirectUrl(): string {
  const explicit = process.env.SQUARE_OAUTH_REDIRECT_URL?.trim();
  if (explicit) return explicit;

  const base =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_BASE_URL?.trim();

  if (!base) {
    throw new Error(
      "SQUARE_OAUTH_REDIRECT_URL or NEXT_PUBLIC_APP_URL is not configured",
    );
  }

  return new URL("/api/square/oauth/callback", base).toString();
}

export function getSquareWebhookNotificationUrl(): string {
  const explicit =
    process.env.SQUARE_WEBHOOK_NOTIFICATION_URL?.trim();
  if (explicit) return explicit;

  const base =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_BASE_URL?.trim();

  if (!base) {
    throw new Error(
      "SQUARE_WEBHOOK_NOTIFICATION_URL or NEXT_PUBLIC_APP_URL is not configured",
    );
  }

  return new URL("/api/square/webhook", base).toString();
}

export function getSquareWebhookSignatureKey(): string {
  const value =
    process.env.SQUARE_WEBHOOK_SIGNATURE_KEY?.trim();
  if (!value) {
    throw new Error(
      "SQUARE_WEBHOOK_SIGNATURE_KEY is not configured",
    );
  }
  return value;
}

export function getParariSquareApplicationFeeBps(): number {
  const raw =
    process.env.PARARI_SQUARE_APPLICATION_FEE_BPS?.trim();

  if (!raw) return 0;

  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0 || value > 10000) {
    throw new Error(
      "PARARI_SQUARE_APPLICATION_FEE_BPS must be between 0 and 10000",
    );
  }

  return value;
}
