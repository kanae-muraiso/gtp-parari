// src/app/api/application/check-in/cancel/route.ts
// 2026-09-17 JST

import {
  NextRequest,
  NextResponse,
} from "next/server";

import { supabaseAdmin } from "@/lib/billing/supabaseAdmin";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function getBearerToken(
  request: NextRequest,
): string | null {
  const authorization = request.headers.get("authorization") ?? "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}

async function getAuthenticatedUser(
  request: NextRequest,
) {
  const token = getBearerToken(request);

  if (!token) {
    return null;
  }

  const {
    data: { user },
    error,
  } = await supabaseAdmin.auth.getUser(token);

  if (error || !user) {
    return null;
  }

  return user;
}

export async function DELETE(
  request: NextRequest,
) {
  const user = await getAuthenticatedUser(request);

  if (!user) {
    return NextResponse.json(
      {
        ok: false,
        message: "受付開始の取り消しにはログインが必要です。",
      },
      { status: 401 },
    );
  }

  const body =
    (await request.json().catch(() => null)) as
      | {
          applicationId?: unknown;
          occurrenceId?: unknown;
        }
      | null;

  const applicationId =
    typeof body?.applicationId === "string"
      ? body.applicationId.trim()
      : "";

  const occurrenceId =
    typeof body?.occurrenceId === "string"
      ? body.occurrenceId.trim()
      : "";

  if (!UUID_RE.test(applicationId)) {
    return NextResponse.json(
      {
        ok: false,
        message: "APPLICATIONを確認してください。",
      },
      { status: 400 },
    );
  }

  if (occurrenceId && !UUID_RE.test(occurrenceId)) {
    return NextResponse.json(
      {
        ok: false,
        message: "開催回を確認してください。",
      },
      { status: 400 },
    );
  }

  try {
    const {
      data: application,
      error: applicationError,
    } = await supabaseAdmin
      .from("applications")
      .select("id, owner_user_id, origin")
      .eq("id", applicationId)
      .maybeSingle();

    if (applicationError) {
      throw applicationError;
    }

    if (!application) {
      return NextResponse.json(
        {
          ok: false,
          message: "APPLICATIONが見つかりません。",
        },
        { status: 404 },
      );
    }

    if (application.owner_user_id !== user.id) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "このAPPLICATIONの受付開始を取り消す権限がありません。",
        },
        { status: 403 },
      );
    }

    if (application.origin === "calendar") {
      if (!UUID_RE.test(occurrenceId)) {
        return NextResponse.json(
          {
            ok: false,
            message: "受付する開催回を確認してください。",
          },
          { status: 400 },
        );
      }
    } else if (occurrenceId) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "このAPPLICATIONには開催回の指定は不要です。",
        },
        { status: 400 },
      );
    }

    const {
      data,
      error,
    } = await supabaseAdmin.rpc(
      "cancel_application_check_in_start_atomic",
      {
        p_application_id: applicationId,
        p_occurrence_id:
          application.origin === "calendar"
            ? occurrenceId
            : null,
      },
    );

    if (error) {
      throw error;
    }

    const result = String(data ?? "");

    if (result === "has_checkins") {
      return NextResponse.json(
        {
          ok: false,
          message:
            "すでに1人以上を受付済みのため、入場受付の開始は取り消せません。",
        },
        { status: 409 },
      );
    }

    if (result === "not_started") {
      return NextResponse.json({
        ok: true,
        already_cancelled: true,
        message: "入場受付はすでに開始前の状態です。",
      });
    }

    if (result !== "cancelled") {
      throw new Error(
        `Unexpected check-in cancellation result: ${result}`,
      );
    }

    return NextResponse.json({
      ok: true,
      already_cancelled: false,
      message: "入場受付の開始を取り消しました。",
    });
  } catch (error) {
    console.error(
      "[APPLICATION CHECK-IN CANCEL] DELETE failed:",
      error,
    );

    return NextResponse.json(
      {
        ok: false,
        message: "入場受付の開始を取り消せませんでした。",
      },
      { status: 500 },
    );
  }
}
