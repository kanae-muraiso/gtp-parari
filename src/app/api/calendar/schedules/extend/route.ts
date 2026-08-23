// src/app/api/calendar/schedules/extend/route.ts
// 2026/08/22 JST
//
// PARARI CALENDAR
// 既存の定期スケジュールの開催期間を後ろへ延長する。
//
// このAPIは calendar_schedules.end_date だけを変更する。
// OCCURRENCE生成は既存 /api/calendar/occurrences を再利用する。
//
// 短縮は別機能として扱う。
// 予約済み開催回への影響があるため、ここでは許可しない。

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


function isValidDate(
  value: string,
): boolean {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(
      value,
    )
  ) {
    return false;
  }


  const [
    year,
    month,
    day,
  ] =
    value
      .split("-")
      .map(Number);


  const date =
    new Date(
      Date.UTC(
        year,
        month - 1,
        day,
      ),
    );


  return (
    date.getUTCFullYear() ===
      year &&
    date.getUTCMonth() ===
      month - 1 &&
    date.getUTCDate() ===
      day
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


  const scheduleId =
    typeof body?.scheduleId ===
    "string"
      ? body.scheduleId.trim()
      : "";


  const newEndDate =
    typeof body?.newEndDate ===
    "string"
      ? body.newEndDate.trim()
      : "";


  if (!scheduleId) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "スケジュールが指定されていません。",
      },
      {
        status: 400,
      },
    );
  }


  if (
    !isValidDate(
      newEndDate,
    )
  ) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "新しい終了日を確認してください。",
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
        `
          id,
          calendar_item_id,
          start_date,
          end_date,
          recurrence_rule,
          status
        `,
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
          "スケジュールが見つかりません。",
      },
      {
        status:
          scheduleError
            ? 500
            : 404,
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
        "id,owner_user_id,title",
      )
      .eq(
        "id",
        schedule.calendar_item_id,
      )
      .eq(
        "owner_user_id",
        user.id,
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
          "このスケジュールを変更する権限がありません。",
      },
      {
        status: 403,
      },
    );
  }


  const recurrenceRule =
    schedule.recurrence_rule as
      | {
          freq?: unknown;
        }
      | null;


  const frequency =
    typeof recurrenceRule?.freq ===
    "string"
      ? recurrenceRule.freq
      : "";


  if (
    frequency === "once"
  ) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "1回だけの開催には期間延長はありません。",
      },
      {
        status: 400,
      },
    );
  }


  if (
    schedule.status !==
    "active"
  ) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "現在有効なスケジュールではありません。",
      },
      {
        status: 400,
      },
    );
  }


  if (
    !schedule.end_date
  ) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "このスケジュールには終了日が設定されていません。",
      },
      {
        status: 400,
      },
    );
  }


  /*
   * このAPIは「延長」専用。
   * 同日・短縮は受け付けない。
   */
  if (
    newEndDate <=
    schedule.end_date
  ) {
    return NextResponse.json(
      {
        ok: false,
        message:
          `現在の終了日 ${schedule.end_date} より後の日付を指定してください。`,
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
        "calendar_schedules",
      )
      .update({
        end_date:
          newEndDate,

        updated_at:
          new Date()
            .toISOString(),
      })
      .eq(
        "id",
        schedule.id,
      )
      .select(
        `
          id,
          calendar_item_id,
          timezone,
          start_date,
          start_time,
          end_date,
          recurrence_rule,
          status,
          created_at,
          updated_at
        `,
      )
      .single();


  if (
    updateError ||
    !updated
  ) {
    console.error(
      "[calendar schedule extend]",
      updateError,
    );

    return NextResponse.json(
      {
        ok: false,
        message:
          "開催期間を延長できませんでした。",
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

    previous_end_date:
      schedule.end_date,

    new_end_date:
      newEndDate,
  });
}
