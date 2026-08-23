// src/app/api/calendar/occurrences/resume/route.ts
// 2026/08/22 JST
//
// PARARI CALENDAR
// 休講にした開催回を再び開催予定へ戻す。
//
// 日時・会場などは変更しない。
// status だけ cancelled -> scheduled に戻す。

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
      /^Bearer\s+(.+)$/i,
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
    data: {
      user,
    },
    error: authError,
  } =
    await supabaseAdmin.auth
      .getUser(
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
          "ログイン情報を確認できませんでした。",
      },
      {
        status: 401,
      },
    );
  }


  const body =
    await request
      .json()
      .catch(
        () => null,
      );


  const occurrenceId =
    typeof body?.occurrenceId ===
    "string"
      ? body.occurrenceId.trim()
      : "";


  if (!occurrenceId) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "開催回が指定されていません。",
      },
      {
        status: 400,
      },
    );
  }


  const {
    data: occurrence,
    error:
      occurrenceError,
  } =
    await supabaseAdmin
      .from(
        "calendar_occurrences",
      )
      .select(
        `
          id,
          calendar_item_id,
          status
        `,
      )
      .eq(
        "id",
        occurrenceId,
      )
      .maybeSingle();


  if (
    occurrenceError ||
    !occurrence
  ) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "開催回が見つかりません。",
      },
      {
        status: 404,
      },
    );
  }


  const {
    data: item,
  } =
    await supabaseAdmin
      .from(
        "calendar_items",
      )
      .select(
        "id,owner_user_id",
      )
      .eq(
        "id",
        occurrence.calendar_item_id,
      )
      .eq(
        "owner_user_id",
        user.id,
      )
      .maybeSingle();


  if (!item) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "この開催回を変更する権限がありません。",
      },
      {
        status: 403,
      },
    );
  }


  if (
    occurrence.status !==
    "cancelled"
  ) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "この開催回は休講ではありません。",
      },
      {
        status: 400,
      },
    );
  }


  const {
    data: updated,
    error: updateError,
  } =
    await supabaseAdmin
      .from(
        "calendar_occurrences",
      )
      .update({
        status:
          "scheduled",

        updated_at:
          new Date()
            .toISOString(),
      })
      .eq(
        "id",
        occurrence.id,
      )
      .select("*")
      .single();


  if (
    updateError ||
    !updated
  ) {
    console.error(
      "[calendar occurrence resume]",
      updateError,
    );

    return NextResponse.json(
      {
        ok: false,
        message:
          "開催予定に戻せませんでした。",
      },
      {
        status: 500,
      },
    );
  }


  return NextResponse.json({
    ok: true,
    occurrence:
      updated,
  });
}
