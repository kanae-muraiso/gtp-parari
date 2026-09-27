import "server-only";

import { supabaseAdmin } from "@/lib/billing/supabaseAdmin";
import {
  decryptSquareToken,
  encryptSquareToken,
} from "./crypto";
import { refreshSquareOAuthToken } from "./api";

type SquareConnectionRow = {
  owner_user_id: string;
  merchant_id: string;
  location_id: string;
  access_token_enc: string;
  refresh_token_enc: string | null;
  token_expires_at: string | null;
  status: "active" | "revoked" | "error";
};

export type UsableSquareConnection = {
  ownerUserId: string;
  merchantId: string;
  locationId: string;
  accessToken: string;
};

function tokenNeedsRefresh(
  expiresAt: string | null,
): boolean {
  if (!expiresAt) return false;

  const expiresMs = new Date(expiresAt).getTime();
  if (!Number.isFinite(expiresMs)) return true;

  return expiresMs <= Date.now() + 10 * 60_000;
}

export async function getSquareConnection(
  ownerUserId: string,
): Promise<SquareConnectionRow | null> {
  const { data, error } = await supabaseAdmin
    .from("square_connections")
    .select(
      "owner_user_id,merchant_id,location_id,access_token_enc,refresh_token_enc,token_expires_at,status",
    )
    .eq("owner_user_id", ownerUserId)
    .maybeSingle();

  if (error) {
    throw new Error(
      `Failed to load Square connection: ${error.message}`,
    );
  }

  return (data as SquareConnectionRow | null) ?? null;
}

export async function saveSquareConnection(input: {
  ownerUserId: string;
  merchantId: string;
  locationId: string;
  accessToken: string;
  refreshToken?: string | null;
  expiresAt?: string | null;
}): Promise<void> {
  const { error } = await supabaseAdmin
    .from("square_connections")
    .upsert(
      {
        owner_user_id: input.ownerUserId,
        merchant_id: input.merchantId,
        location_id: input.locationId,
        access_token_enc:
          encryptSquareToken(input.accessToken),
        refresh_token_enc:
          input.refreshToken
            ? encryptSquareToken(input.refreshToken)
            : null,
        token_expires_at: input.expiresAt ?? null,
        status: "active",
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "owner_user_id",
      },
    );

  if (error) {
    throw new Error(
      `Failed to save Square connection: ${error.message}`,
    );
  }
}

export async function getUsableSquareConnection(
  ownerUserId: string,
): Promise<UsableSquareConnection> {
  const connection =
    await getSquareConnection(ownerUserId);

  if (!connection || connection.status !== "active") {
    throw new Error("SQUARE_NOT_CONNECTED");
  }

  let accessToken =
    decryptSquareToken(connection.access_token_enc);

  if (
    tokenNeedsRefresh(connection.token_expires_at)
  ) {
    if (!connection.refresh_token_enc) {
      throw new Error("SQUARE_RECONNECT_REQUIRED");
    }

    const refreshToken =
      decryptSquareToken(
        connection.refresh_token_enc,
      );

    const refreshed =
      await refreshSquareOAuthToken(refreshToken);

    accessToken = refreshed.access_token;

    await saveSquareConnection({
      ownerUserId,
      merchantId:
        refreshed.merchant_id ||
        connection.merchant_id,
      locationId: connection.location_id,
      accessToken,
      refreshToken:
        refreshed.refresh_token ?? refreshToken,
      expiresAt:
        refreshed.expires_at ??
        connection.token_expires_at,
    });
  }

  return {
    ownerUserId,
    merchantId: connection.merchant_id,
    locationId: connection.location_id,
    accessToken,
  };
}
