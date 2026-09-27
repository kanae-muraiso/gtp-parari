import {
  createHash,
  randomBytes,
} from "crypto";
import {
  NextRequest,
  NextResponse,
} from "next/server";

import { supabaseAdmin } from "@/lib/billing/supabaseAdmin";
import {
  getSquareApiBase,
  getSquareApplicationId,
  getSquareEnvironment,
  getSquareOAuthRedirectUrl,
} from "@/lib/square/config";

export const runtime = "nodejs";

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

export async function POST(
  request: NextRequest,
) {
  try {
    const token = bearerToken(request);

    if (!token) {
      return NextResponse.json(
        { ok: false, message: "ログインが必要です。" },
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

    const state = randomBytes(32).toString("base64url");
    const stateHash = createHash("sha256")
      .update(state)
      .digest("hex");

    const { error: stateError } =
      await supabaseAdmin
        .from("square_oauth_states")
        .insert({
          owner_user_id: user.id,
          state_hash: stateHash,
          expires_at: new Date(
            Date.now() + 10 * 60_000,
          ).toISOString(),
        });

    if (stateError) {
      throw stateError;
    }

    const scopes = [
      "MERCHANT_PROFILE_READ",
      "PAYMENTS_READ",
      "PAYMENTS_WRITE",
      "PAYMENTS_WRITE_ADDITIONAL_RECIPIENTS",
      "ORDERS_READ",
      "ORDERS_WRITE",
    ].join(" ");

    const authorizeUrl = new URL(
      "/oauth2/authorize",
      getSquareApiBase(),
    );

    authorizeUrl.searchParams.set(
      "client_id",
      getSquareApplicationId(),
    );
    authorizeUrl.searchParams.set(
      "scope",
      scopes,
    );
    authorizeUrl.searchParams.set(
      "state",
      state,
    );
    if (getSquareEnvironment() === "production") {
      authorizeUrl.searchParams.set(
        "session",
        "false",
      );
    }
    authorizeUrl.searchParams.set(
      "redirect_uri",
      getSquareOAuthRedirectUrl(),
    );

    return NextResponse.json({
      ok: true,
      url: authorizeUrl.toString(),
    });
  } catch (error) {
    console.error("[square/oauth/start]", error);

    return NextResponse.json(
      {
        ok: false,
        message:
          "Square接続を開始できませんでした。",
      },
      { status: 500 },
    );
  }
}
