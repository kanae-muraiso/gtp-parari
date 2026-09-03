import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  supabaseAdmin,
} from "@/lib/billing/supabaseAdmin";

function getBearerToken(
  request: NextRequest,
): string | null {
  const authorization =
    request.headers.get(
      "authorization",
    ) ?? "";

  const match =
    authorization.match(
      /^Bearer\\s+(.+)$/i,
    );

  return (
    match?.[1]?.trim() ||
    null
  );
}

export async function PATCH(
  request: NextRequest,
) {
  const token =
    getBearerToken(
      request,
    );

  if (!token) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "ログインしてください。",
      },
      {
        status: 401,
      },
    );
  }

  const {
    data: authData,
    error: authError,
  } =
    await supabaseAdmin.auth
      .getUser(
        token,
      );

  if (
    authError ||
    !authData.user
  ) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "ログイン情報を確認できませんでした。",
      },
      {
        status: 401,
      },
    );
  }

  const body =
    (await request
      .json()
      .catch(
        () => null,
      )) as
      | {
          scheduleId?: unknown;
          visibility?: unknown;
          showInProfile?: unknown;
        }
      | null;

  const scheduleId =
    typeof body?.scheduleId ===
    "string"
      ? body.scheduleId.trim()
      : "";

  const visibility =
    body?.visibility ===
    "public"
      ? "public"
      : body?.visibility ===
        "private"
        ? "private"
        : null;

  if (
    !scheduleId ||
    !visibility
  ) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "公開設定を確認してください。",
      },
      {
        status: 400,
      },
    );
  }

  const {
    data: schedule,
    error: scheduleError,
  } =
    await supabaseAdmin
      .from(
        "calendar_schedules",
      )
      .select(
        "id, calendar_item_id",
      )
      .eq(
        "id",
        scheduleId,
      )
      .maybeSingle();

  if (
    scheduleError ||
    !schedule
  ) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "クラス・イベントが見つかりません。",
      },
      {
        status: 404,
      },
    );
  }

  const {
    data: item,
    error: itemError,
  } =
    await supabaseAdmin
      .from(
        "calendar_items",
      )
      .select(
        "id",
      )
      .eq(
        "id",
        schedule.calendar_item_id,
      )
      .eq(
        "owner_user_id",
        authData.user.id,
      )
      .maybeSingle();

  if (
    itemError ||
    !item
  ) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "このクラス・イベントを変更する権限がありません。",
      },
      {
        status: 404,
      },
    );
  }

  const {
    data: updated,
    error,
  } =
    await supabaseAdmin
      .from(
        "calendar_schedules",
      )
      .update({
        visibility,
        show_in_profile:
          visibility ===
            "public" &&
          body?.showInProfile ===
            true,
        updated_at:
          new Date().toISOString(),
      })
      .eq(
        "id",
        scheduleId,
      )
      .select(
        `
          id,
          calendar_item_id,
          name,
          visibility,
          show_in_profile,
          status
        `,
      )
      .single();

  if (
    error ||
    !updated
  ) {
    console.error(
      "[calendar/schedules/publication PATCH] failed:",
      error,
    );

    return NextResponse.json(
      {
        ok: false,
        message:
          "公開設定を保存できませんでした。",
      },
      {
        status: 500,
      },
    );
  }

  return NextResponse.json({
    ok: true,
    schedule:
      updated,
  });
}
