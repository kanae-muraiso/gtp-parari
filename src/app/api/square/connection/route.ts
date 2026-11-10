import {
  NextRequest,
  NextResponse,
} from "next/server";

import { supabaseAdmin } from "@/lib/billing/supabaseAdmin";
import {
  getSquareConnection,
  getUsableSquareConnection,
} from "@/lib/square/connection";
import {
  getSquareEnvironment,
  squarePlatformConfigured,
} from "@/lib/square/config";
import {
  decryptSquareToken,
} from "@/lib/square/crypto";
import {
  getSquareLocation,
  revokeSquareOAuthAuthorization,
} from "@/lib/square/api";

function bearerToken(
  request: NextRequest,
): string | null {
  return (
    request.headers
      .get("authorization")
      ?.match(/^Bearer\s+(.+)$/i)?.[1]
      ?.trim() ?? null
  );
}

export async function GET(
  request: NextRequest,
) {
  const token = bearerToken(request);

  if (!token) {
    return NextResponse.json(
      { ok: false },
      { status: 401 },
    );
  }

  const {
    data: { user },
    error,
  } = await supabaseAdmin.auth.getUser(token);

  if (error || !user) {
    return NextResponse.json(
      { ok: false },
      { status: 401 },
    );
  }

  const connection =
    await getSquareConnection(user.id);

  let locationName: string | null = null;
  let locationStatus: { active: boolean | null; cardPayments: boolean | null; automaticTransfers: boolean | null } | null = null;
  if (connection?.status === "active") {
    try {
      const usable = await getUsableSquareConnection(user.id);
      if (usable.locationId === connection.location_id && usable.merchantId === connection.merchant_id) {
        const location = await getSquareLocation(usable.accessToken, usable.locationId);
        if (location.id === connection.location_id) {
          locationName = location.name?.trim() || null;
          locationStatus = {
            active: location.status ? location.status === "ACTIVE" : null,
            cardPayments: location.capabilities?.includes("CREDIT_CARD_PROCESSING") ?? null,
            automaticTransfers: location.capabilities?.includes("AUTOMATIC_TRANSFERS") ?? null,
          };
        }
      }
    } catch {
      // A location lookup failure does not change the recorded connection status.
    }
  }

  return NextResponse.json({
    ok: true,
    environment: getSquareEnvironment(),
    configured:
      squarePlatformConfigured(),
    connection: connection
      ? {
          connected:
            connection.status === "active",
          merchantId:
            connection.merchant_id,
          locationId:
            connection.location_id,
          status: connection.status,
          locationName,
          locationStatus,
        }
      : {
          connected: false,
          merchantId: null,
          locationId: null,
          status: null,
          locationName: null,
          locationStatus: null,
        },
  });
}


export async function DELETE(
  request: NextRequest,
) {
  const token = bearerToken(request);

  if (!token) {
    return NextResponse.json(
      {
        ok: false,
        message: "ログインが必要です。",
      },
      { status: 401 },
    );
  }

  const {
    data: { user },
    error: userError,
  } = await supabaseAdmin.auth.getUser(token);

  if (userError || !user) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "ログイン情報を確認できませんでした。",
      },
      { status: 401 },
    );
  }

  try {
    const connection =
      await getSquareConnection(user.id);

    if (!connection) {
      return NextResponse.json({
        ok: true,
        disconnected: true,
      });
    }

    const accessToken =
      decryptSquareToken(
        connection.access_token_enc,
      );

    await revokeSquareOAuthAuthorization(
      accessToken,
    );

    const { error: deleteError } =
      await supabaseAdmin
        .from("square_connections")
        .delete()
        .eq("owner_user_id", user.id)
        .eq(
          "environment",
          getSquareEnvironment(),
        );

    if (deleteError) {
      throw deleteError;
    }

    return NextResponse.json({
      ok: true,
      disconnected: true,
    });
  } catch (error) {
    console.error(
      "[square/connection DELETE]",
      error,
    );

    return NextResponse.json(
      {
        ok: false,
        message:
          "Square連携を解除できませんでした。時間をおいて、もう一度お試しください。",
      },
      { status: 502 },
    );
  }
}
