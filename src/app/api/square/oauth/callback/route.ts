import { createHash } from "crypto";
import {
  NextRequest,
  NextResponse,
} from "next/server";

import { supabaseAdmin } from "@/lib/billing/supabaseAdmin";
import {
  exchangeSquareOAuthCode,
  getSquareMainLocation,
} from "@/lib/square/api";
import { saveSquareConnection } from "@/lib/square/connection";

export const runtime = "nodejs";

function resultUrl(
  request: NextRequest,
  result: string,
): URL {
  const url = new URL(
    "/billing",
    request.nextUrl.origin,
  );
  url.searchParams.set("square", result);
  return url;
}

export async function GET(
  request: NextRequest,
) {
  const code =
    request.nextUrl.searchParams
      .get("code")
      ?.trim() ?? "";
  const state =
    request.nextUrl.searchParams
      .get("state")
      ?.trim() ?? "";
  const error =
    request.nextUrl.searchParams
      .get("error")
      ?.trim() ?? "";

  if (error || !code || !state) {
    return NextResponse.redirect(
      resultUrl(request, "cancelled"),
      303,
    );
  }

  try {
    const stateHash = createHash("sha256")
      .update(state)
      .digest("hex");

    const {
      data: stateRow,
      error: stateError,
    } = await supabaseAdmin
      .from("square_oauth_states")
      .select(
        "id,owner_user_id,expires_at,consumed_at",
      )
      .eq("state_hash", stateHash)
      .maybeSingle();

    if (
      stateError ||
      !stateRow ||
      stateRow.consumed_at ||
      new Date(stateRow.expires_at).getTime() <=
        Date.now()
    ) {
      return NextResponse.redirect(
        resultUrl(request, "invalid-state"),
        303,
      );
    }

    const {
      data: consumedState,
      error: consumeError,
    } = await supabaseAdmin
      .from("square_oauth_states")
      .update({
        consumed_at: new Date().toISOString(),
      })
      .eq("id", stateRow.id)
      .is("consumed_at", null)
      .select("id")
      .maybeSingle();

    if (
      consumeError ||
      !consumedState
    ) {
      return NextResponse.redirect(
        resultUrl(request, "invalid-state"),
        303,
      );
    }

    const token =
      await exchangeSquareOAuthCode(code);
    const location =
      await getSquareMainLocation(
        token.access_token,
      );

    const merchantId =
      (
        token.merchant_id ||
        location.merchant_id ||
        ""
      ).trim();

    if (!merchantId) {
      throw new Error(
        "Square merchant ID was not returned.",
      );
    }

    await saveSquareConnection({
      ownerUserId: stateRow.owner_user_id,
      merchantId,
      locationId: location.id,
      accessToken: token.access_token,
      refreshToken:
        token.refresh_token ?? null,
      expiresAt:
        token.expires_at ?? null,
    });

    return NextResponse.redirect(
      resultUrl(request, "connected"),
      303,
    );
  } catch (error) {
    console.error(
      "[square/oauth/callback]",
      error,
    );

    return NextResponse.redirect(
      resultUrl(request, "failed"),
      303,
    );
  }
}
