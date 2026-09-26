import {
  NextRequest,
  NextResponse,
} from "next/server";

import { supabaseAdmin } from "@/lib/billing/supabaseAdmin";
import { getSquareConnection } from "@/lib/square/connection";
import {
  squarePlatformConfigured,
} from "@/lib/square/config";

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
