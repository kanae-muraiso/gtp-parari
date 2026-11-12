// src/app/api/application/status/route.ts
// 2026-08-16 JST
//
// APPLICATION 受付状態変更API
//
// draft  -> open
// open   -> closed
// closed -> open

import {
  NextRequest,
  NextResponse,
} from "next/server";

import { supabaseAdmin } from "@/lib/billing/supabaseAdmin";
import { readSellerDisclosure, sellerDisclosureReady } from "@/lib/parari/sales/sellerDisclosure";
import { getUsableSquareConnection } from "@/lib/square/connection";


function getBearerToken(
  request: NextRequest,
): string | null {
  const authorization =
    request.headers.get("authorization") ?? "";

  const match =
    authorization.match(/^Bearer\s+(.+)$/i);

  return match?.[1]?.trim() || null;
}


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
          status?: unknown;
        }
      | null;

  const applicationId =
    typeof body?.applicationId ===
    "string"
      ? body.applicationId.trim()
      : "";

  const nextStatus =
    typeof body?.status ===
    "string"
      ? body.status.trim()
      : "";


  if (!applicationId) {
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
    nextStatus !== "open" &&
    nextStatus !== "closed"
  ) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "受付状態が正しくありません。",
      },
      {
        status: 400,
      },
    );
  }


  const {
    data: application,
    error: applicationError,
  } =
    await supabaseAdmin
      .from("applications")
      .select(
        `
          id,
          owner_user_id,
          status,
          payment_method,
          archived_at
        `,
      )
      .eq(
        "id",
        applicationId,
      )
      .maybeSingle();

  if (
    applicationError ||
    !application
  ) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "APPLICATIONを確認できませんでした。",
      },
      {
        status: 404,
      },
    );
  }


  if (
    application.owner_user_id !==
    user.id
  ) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "このAPPLICATIONを変更する権限がありません。",
      },
      {
        status: 403,
      },
    );
  }


  if (application.archived_at) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "アーカイブ済みのAPPLICATIONは受付状態を変更できません。先に復活してください。",
      },
      {
        status: 409,
      },
    );
  }

  if (nextStatus === "open" && application.payment_method === "parari") {
    try {
      const disclosure = await readSellerDisclosure(user.id);
      if (!sellerDisclosureReady(disclosure)) {
        return NextResponse.json({
          ok: false,
          code: "SELLER_DISCLOSURE_REQUIRED",
          message: "有料受付の開始前に販売者情報・特商法表記・個人情報の取扱いを公開してください。",
          settingsUrl: "/my/settings/seller",
        }, { status: 409 });
      }
      const square = await getUsableSquareConnection(user.id);
      if (!square) {
        return NextResponse.json({
          ok: false,
          code: "SQUARE_CONNECTION_REQUIRED",
          message: "有料受付の開始前にSquareを接続してください。",
          settingsUrl: "/my/settings#sell-work",
        }, { status: 409 });
      }
    } catch (error) {
      console.error("[application status] paid opening check failed:", error);
      return NextResponse.json({
        ok: false, message: "決済設定を確認できませんでした。",
      }, { status: 503 });
    }
  }

  const currentStatus =
    application.status;

  const allowed =
    (
      currentStatus === "draft" &&
      nextStatus === "open"
    ) ||
    (
      currentStatus === "open" &&
      nextStatus === "closed"
    ) ||
    (
      currentStatus === "closed" &&
      nextStatus === "open"
    );

  if (!allowed) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "この受付状態には変更できません。",
      },
      {
        status: 409,
      },
    );
  }


  const {
    data: updatedApplication,
    error: updateError,
  } =
    await supabaseAdmin
      .from("applications")
      .update({
        status:
          nextStatus,
      })
      .eq(
        "id",
        applicationId,
      )
      .eq(
        "owner_user_id",
        user.id,
      )
      .select(
        `
          id,
          status,
          updated_at
        `,
      )
      .maybeSingle();


  if (
    updateError ||
    !updatedApplication
  ) {
    console.error(
      "application status update failed:",
      updateError,
    );

    return NextResponse.json(
      {
        ok: false,
        message:
          "受付状態を変更できませんでした。",
      },
      {
        status: 500,
      },
    );
  }


  return NextResponse.json({
    ok: true,
    application:
      updatedApplication,
  });
}
