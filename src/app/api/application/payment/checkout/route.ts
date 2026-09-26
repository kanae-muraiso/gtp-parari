import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  createSquareCheckoutForEntry,
} from "@/features/application/server/squareApplicationPayment";
import { supabaseAdmin } from "@/lib/billing/supabaseAdmin";

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

    const body =
      (await request
        .json()
        .catch(() => null)) as
        | {
            entryId?: unknown;
          }
        | null;

    const entryId =
      typeof body?.entryId === "string"
        ? body.entryId.trim()
        : "";

    if (!entryId) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "申込情報を確認できませんでした。",
        },
        { status: 400 },
      );
    }

    const {
      data: entry,
      error: entryError,
    } = await supabaseAdmin
      .from("application_entries")
      .select("id,user_id")
      .eq("id", entryId)
      .maybeSingle();

    if (
      entryError ||
      !entry ||
      entry.user_id !== user.id
    ) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "この申込の決済を開始できません。",
        },
        { status: 403 },
      );
    }

    const checkout =
      await createSquareCheckoutForEntry(
        entry.id,
      );

    return NextResponse.json({
      ok: true,
      url: checkout.url,
    });
  } catch (error) {
    console.error(
      "[application/payment/checkout]",
      error,
    );

    const code =
      error instanceof Error
        ? error.message
        : "";

    const message =
      code === "SQUARE_NOT_CONNECTED" ||
      code === "SQUARE_RECONNECT_REQUIRED"
        ? "主催者のSquare接続を確認できません。主催者へお問い合わせください。"
        : code === "APPLICATION_PAYMENT_HOLD_EXPIRED"
          ? "お支払いの受付時間を過ぎました。もう一度お申し込みください。"
          : code === "APPLICATION_ALREADY_PAID"
            ? "この申込は支払済みです。"
            : "Square決済を開始できませんでした。";

    return NextResponse.json(
      {
        ok: false,
        message,
      },
      {
        status:
          code === "APPLICATION_PAYMENT_HOLD_EXPIRED"
            ? 409
            : 503,
      },
    );
  }
}
