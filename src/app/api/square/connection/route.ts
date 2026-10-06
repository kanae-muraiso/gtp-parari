import {
  NextRequest,
  NextResponse,
} from "next/server";

import { supabaseAdmin } from "@/lib/billing/supabaseAdmin";
import {
  getSquareConnection,
} from "@/lib/square/connection";
import {
  getSquareEnvironment,
  squarePlatformConfigured,
} from "@/lib/square/config";
import {
  decryptSquareToken,
} from "@/lib/square/crypto";
import {
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

  return NextResponse.json({
    ok: true,
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
        }
      : {
          connected: false,
          merchantId: null,
          locationId: null,
          status: null,
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
