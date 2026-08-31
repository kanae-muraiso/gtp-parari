// src/app/api/application/my-entry/route.ts
// src/app/api/application/my-entry/route.ts
// 2026-08-16 JST
//
// ログイン中ユーザー自身のAPPLICATION申込状態
//
// GET   : 自分の申込状態を取得
// PATCH : 「支払いました」を主催者へ連絡

import {
  NextRequest,
  NextResponse,
} from "next/server";

import { supabaseAdmin } from "@/lib/billing/supabaseAdmin";


const UUID_RE =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;


type PaymentMethod =
  | "none"
  | "on_site"
  | "bank_transfer"
  | "payment_link";


function getBearerToken(
  request: NextRequest,
): string | null {
  const authorization =
    request.headers.get(
      "authorization",
    ) ?? "";

  const match =
    authorization.match(
      /^Bearer\s+(.+)$/i,
    );

  return (
    match?.[1]?.trim() ||
    null
  );
}


function getPaymentMethod(
  snapshot: unknown,
): PaymentMethod {
  if (
    !snapshot ||
    typeof snapshot !== "object" ||
    Array.isArray(snapshot)
  ) {
    return "none";
  }

  const value =
    (
      snapshot as Record<
        string,
        unknown
      >
    ).payment_method;

  if (
    value === "on_site" ||
    value === "bank_transfer" ||
    value === "payment_link"
  ) {
    return value;
  }

  return "none";
}


function requiresQualification(
  snapshot: unknown,
) {
  if (
    !snapshot ||
    typeof snapshot !== "object" ||
    Array.isArray(snapshot)
  ) {
    return false;
  }

  return (
    (
      snapshot as Record<
        string,
        unknown
      >
    ).acceptance_mode ===
    "approval"
  );
}


// ============================================================
// GET
// ============================================================

export async function GET(
  request: NextRequest,
) {
  const token =
    getBearerToken(request);

  if (!token) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "ログインが必要です。",
      },
      {
        status: 401,
      },
    );
  }

  const {
    data: { user },
    error: authError,
  } =
    await supabaseAdmin.auth.getUser(
      token,
    );

  if (
    authError ||
    !user
  ) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "ログイン状態を確認できませんでした。",
      },
      {
        status: 401,
      },
    );
  }

  const applicationId =
    request.nextUrl.searchParams
      .get("applicationId")
      ?.trim() ?? "";

  if (
    !UUID_RE.test(
      applicationId,
    )
  ) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "APPLICATIONが指定されていません。",
      },
      {
        status: 400,
      },
    );
  }

  const {
    data: entry,
    error,
  } =
    await supabaseAdmin
      .from(
        "application_entries",
      )
      .select(
        `
          id,
          status,
          qualification_status,
          payment_status,
          payment_reported_at,
          payment_confirmed_at,
          application_snapshot,
          answers,
          created_at,
          agreed_at
        `,
      )
      .eq(
        "application_id",
        applicationId,
      )
      .eq(
        "user_id",
        user.id,
      )
      .order(
        "created_at",
        {
          ascending: false,
        },
      )
      .limit(1)
      .maybeSingle();

  if (error) {
    console.error(
      "[APPLICATION my-entry] load failed:",
      error,
    );

    return NextResponse.json(
      {
        ok: false,
        message:
          "申込状況を確認できませんでした。",
      },
      {
        status: 500,
      },
    );
  }

  return NextResponse.json({
    ok: true,
    entry:
      entry ?? null,
  });
}


// ============================================================
// PATCH
// 参加者本人が「支払いました」と連絡
// ============================================================

export async function PATCH(
  request: NextRequest,
) {
  const token =
    getBearerToken(request);

  if (!token) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "ログインが必要です。",
      },
      {
        status: 401,
      },
    );
  }

  const {
    data: { user },
    error: authError,
  } =
    await supabaseAdmin.auth.getUser(
      token,
    );

  if (
    authError ||
    !user
  ) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "ログイン状態を確認できませんでした。",
      },
      {
        status: 401,
      },
    );
  }

  const body =
    (await request
      .json()
      .catch(() => null)) as
      | {
          applicationId?: unknown;
          action?: unknown;
        }
      | null;

  const applicationId =
    typeof body?.applicationId ===
    "string"
      ? body.applicationId.trim()
      : "";

  const action =
    typeof body?.action ===
    "string"
      ? body.action.trim()
      : "";

  if (
    !UUID_RE.test(
      applicationId,
    )
  ) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "APPLICATIONが指定されていません。",
      },
      {
        status: 400,
      },
    );
  }

  if (
    action !==
    "payment_report"
  ) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "操作内容が正しくありません。",
      },
      {
        status: 400,
      },
    );
  }

  const {
    data: entry,
    error: entryError,
  } =
    await supabaseAdmin
      .from(
        "application_entries",
      )
      .select(
        `
          id,
          status,
          qualification_status,
          payment_status,
          payment_reported_at,
          payment_confirmed_at,
          application_snapshot
        `,
      )
      .eq(
        "application_id",
        applicationId,
      )
      .eq(
        "user_id",
        user.id,
      )
      .order(
        "created_at",
        {
          ascending: false,
        },
      )
      .limit(1)
      .maybeSingle();

  if (
    entryError ||
    !entry
  ) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "申込情報を確認できませんでした。",
      },
      {
        status: 404,
      },
    );
  }

  if (
    entry.status ===
    "rejected"
  ) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "受付されなかった申込について支払連絡はできません。",
      },
      {
        status: 409,
      },
    );
  }

  const paymentMethod =
    getPaymentMethod(
      entry.application_snapshot,
    );

  if (
    paymentMethod !==
      "bank_transfer" &&
    paymentMethod !==
      "payment_link"
  ) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "この支払方法では支払連絡は必要ありません。",
      },
      {
        status: 400,
      },
    );
  }

  /*
   * 資格確認が必要な募集では、
   * OKになる前に支払わせない。
   *
   * NGになった後の返金問題を避けるため。
   */
  if (
    requiresQualification(
      entry.application_snapshot,
    ) &&
    entry.qualification_status !==
      "approved"
  ) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "主催者の確認が終わってからお支払いください。",
      },
      {
        status: 409,
      },
    );
  }

  if (
    entry.payment_status ===
    "paid"
  ) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "支払はすでに確認されています。",
      },
      {
        status: 409,
      },
    );
  }

  /*
   * 二度押ししても壊さない。
   */
  if (
    entry.payment_status ===
    "reported"
  ) {
    return NextResponse.json({
      ok: true,
      entry,
    });
  }

  if (
    entry.payment_status !==
    "unpaid"
  ) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "現在この支払連絡はできません。",
      },
      {
        status: 409,
      },
    );
  }

  const {
    data: updatedEntry,
    error: updateError,
  } =
    await supabaseAdmin
      .from(
        "application_entries",
      )
      .update({
        payment_status:
          "reported",

        payment_reported_at:
          new Date().toISOString(),
      })
      .eq(
        "id",
        entry.id,
      )
      .eq(
        "user_id",
        user.id,
      )
      .eq(
        "payment_status",
        "unpaid",
      )
      .select(
        `
          id,
          status,
          qualification_status,
          payment_status,
          payment_reported_at,
          payment_confirmed_at,
          application_snapshot,
          created_at,
          agreed_at
        `,
      )
      .single();

  if (
    updateError ||
    !updatedEntry
  ) {
    console.error(
      "[APPLICATION my-entry] payment report failed:",
      updateError,
    );

    return NextResponse.json(
      {
        ok: false,
        message:
          "支払の連絡を保存できませんでした。",
      },
      {
        status: 500,
      },
    );
  }

  return NextResponse.json({
    ok: true,
    entry:
      updatedEntry,
  });
}
