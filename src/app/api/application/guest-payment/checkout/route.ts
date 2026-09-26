import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  inspectApplicationEntryCancellation,
} from "@/features/application/server/cancelApplicationEntry";
import {
  createSquareCheckoutForEntry,
} from "@/features/application/server/squareApplicationPayment";

const TOKEN_RE = /^[0-9a-f]{32}$/;

function readToken(value: unknown): string {
  return typeof value === "string"
    ? value.trim().toLowerCase()
    : "";
}

export async function POST(
  request: NextRequest,
) {
  const body =
    (await request
      .json()
      .catch(() => null)) as
      | {
          token?: unknown;
        }
      | null;

  const token =
    readToken(body?.token);

  if (!TOKEN_RE.test(token)) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "確認リンクを確認してください。",
      },
      { status: 400 },
    );
  }

  try {
    const result =
      await inspectApplicationEntryCancellation({
        kind: "guest",
        token,
      });

    if (result.ok === false) {
      return NextResponse.json(
        {
          ok: false,
          message: result.message,
        },
        { status: result.status },
      );
    }

    const checkout =
      await createSquareCheckoutForEntry(
        result.entry.id,
      );

    return NextResponse.json({
      ok: true,
      url: checkout.url,
    });
  } catch (error) {
    console.error(
      "[application/guest-payment/checkout]",
      error,
    );

    const code =
      error instanceof Error
        ? error.message
        : "";

    return NextResponse.json(
      {
        ok: false,
        message:
          code === "APPLICATION_PAYMENT_HOLD_EXPIRED"
            ? "お支払いの受付時間を過ぎました。受付中であれば改めてお申し込みください。"
            : code === "APPLICATION_ALREADY_PAID"
              ? "この申込は支払済みです。"
              : code === "APPLICATION_PAYMENT_NOT_ACTIVE"
                ? "この申込は現在支払できません。"
                : "Square決済を開始できませんでした。",
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
