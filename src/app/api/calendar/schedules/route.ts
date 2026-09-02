// src/app/api/calendar/schedules/route.ts
// 2026-08-22 JST
//
// PARARI CALENDAR
//
// calendar_item     = WHAT
// calendar_schedule = WHEN rule
//
// start_date / end_date
//   = 開催期間
//
// recurrence_rule
//   = その期間中の「いつ開催するか」
//
// weekly:
//   { freq:"weekly", interval:1, byWeekday:[5] }
//
// biweekly:
//   {
//     freq:"weekly",
//     interval:2,
//     byWeekday:[5],
//     anchorDate:"2026-08-07"
//   }
//
// monthly:
//   { freq:"monthly", interval:1, byMonthDay:[15] }

import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  supabaseAdmin,
} from "@/lib/billing/supabaseAdmin";


type RecurrenceType =
  | "once"
  | "weekly"
  | "biweekly"
  | "monthly";


type CreateScheduleBody = {
  calendarItemId?: unknown;
  recurrenceType?: unknown;
  startDate?: unknown;
  startTime?: unknown;
  endDate?: unknown;
  timezone?: unknown;

  name?: unknown;
  occurrenceHorizonDays?: unknown;
  applicationOpenDaysBefore?: unknown;
  applicationCloseMinutesBefore?: unknown;

  location?: unknown;
  durationMinutes?: unknown;

  weekday?: unknown;
  monthDay?: unknown;
  anchorDate?: unknown;
};


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


async function getAuthenticatedUser(
  request: NextRequest,
) {
  const token =
    getBearerToken(
      request,
    );

  if (!token) {
    return {
      ok: false as const,
      status: 401,
      message:
        "ログインしてください。",
    };
  }


  const {
    data: {
      user,
    },
    error,
  } =
    await supabaseAdmin.auth
      .getUser(
        token,
      );


  if (
    error ||
    !user
  ) {
    return {
      ok: false as const,
      status: 401,
      message:
        "ログイン情報を確認できませんでした。",
    };
  }


  return {
    ok: true as const,
    user,
  };
}


function isRecurrenceType(
  value: string,
): value is RecurrenceType {
  return [
    "once",
    "weekly",
    "biweekly",
    "monthly",
  ].includes(
    value,
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
    yearText,
    monthText,
    dayText,
  ] =
    value.split("-");


  const year =
    Number(yearText);

  const month =
    Number(monthText);

  const day =
    Number(dayText);


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


function isValidTime(
  value: string,
): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(
    value,
  );
}


function isValidTimezone(
  value: string,
): boolean {
  try {
    new Intl.DateTimeFormat(
      "en-US",
      {
        timeZone:
          value,
      },
    );

    return true;
  } catch {
    return false;
  }
}


function normalizeInteger(
  value: unknown,
): number | null {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }


  const number =
    Number(value);


  if (
    !Number.isInteger(
      number,
    )
  ) {
    return null;
  }


  return number;
}


function getIsoWeekday(
  dateText: string,
): number {
  const [
    year,
    month,
    day,
  ] =
    dateText
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


  const jsDay =
    date.getUTCDay();


  return (
    jsDay === 0
      ? 7
      : jsDay
  );
}


function buildRecurrenceRule(
  recurrenceType:
    RecurrenceType,
  options: {
    weekday:
      number | null;
    monthDay:
      number | null;
    anchorDate:
      string;
  },
) {
  switch (
    recurrenceType
  ) {
    case "once":
      return {
        freq:
          "once",
      };


    case "weekly":
      return {
        freq:
          "weekly",
        interval:
          1,
        byWeekday: [
          options.weekday,
        ],
      };


    case "biweekly":
      return {
        freq:
          "weekly",
        interval:
          2,
        byWeekday: [
          getIsoWeekday(
            options.anchorDate,
          ),
        ],
        anchorDate:
          options.anchorDate,
      };


    case "monthly":
      return {
        freq:
          "monthly",
        interval:
          1,
        byMonthDay: [
          options.monthDay,
        ],
      };
  }
}


// ============================================================
// GET
// ============================================================

export async function GET(
  request: NextRequest,
) {
  const auth =
    await getAuthenticatedUser(
      request,
    );


  if (
    auth.ok === false
  ) {
    return NextResponse.json(
      {
        ok: false,
        message:
          auth.message,
      },
      {
        status:
          auth.status,
      },
    );
  }


  const calendarItemId =
    request.nextUrl
      .searchParams
      .get(
        "calendarItemId",
      )
      ?.trim() ?? "";


  let itemIds:
    string[] = [];


  if (
    calendarItemId
  ) {
    const {
      data: item,
      error,
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
          calendarItemId,
        )
        .eq(
          "owner_user_id",
          auth.user.id,
        )
        .maybeSingle();


    if (
      error ||
      !item
    ) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "指定されたクラス・イベントが見つかりません。",
        },
        {
          status:
            404,
        },
      );
    }


    itemIds = [
      item.id,
    ];
  } else {
    const {
      data,
      error,
    } =
      await supabaseAdmin
        .from(
          "calendar_items",
        )
        .select(
          "id",
        )
        .eq(
          "owner_user_id",
          auth.user.id,
        );


    if (error) {
      console.error(
        "[calendar/schedules GET] items failed:",
        error,
      );

      return NextResponse.json(
        {
          ok: false,
          message:
            "スケジュールを取得できませんでした。",
        },
        {
          status:
            500,
        },
      );
    }


    itemIds =
      (data ?? []).map(
        (
          item,
        ) =>
          String(
            item.id,
          ),
      );
  }


  if (
    itemIds.length ===
    0
  ) {
    return NextResponse.json({
      ok: true,
      schedules: [],
    });
  }


  const {
    data,
    error,
  } =
    await supabaseAdmin
      .from(
        "calendar_schedules",
      )
      .select(`
        id,
        calendar_item_id,
        timezone,
        start_date,
        start_time,
        end_date,
        name,
        location,
        duration_minutes,
        occurrence_horizon_days,
        application_open_days_before,
        application_close_minutes_before,
        recurrence_rule,
        status,
        created_at,
        updated_at
      `)
      .in(
        "calendar_item_id",
        itemIds,
      )
      .order(
        "created_at",
        {
          ascending:
            true,
        },
      );


  if (error) {
    console.error(
      "[calendar/schedules GET] failed:",
      error,
    );

    return NextResponse.json(
      {
        ok: false,
        message:
          "スケジュールを取得できませんでした。",
      },
      {
        status:
          500,
      },
    );
  }


  return NextResponse.json({
    ok: true,
    schedules:
      data ?? [],
  });
}


// ============================================================
// POST
// ============================================================

export async function POST(
  request: NextRequest,
) {
  const auth =
    await getAuthenticatedUser(
      request,
    );


  if (
    auth.ok === false
  ) {
    return NextResponse.json(
      {
        ok: false,
        message:
          auth.message,
      },
      {
        status:
          auth.status,
      },
    );
  }


  const body =
    (await request
      .json()
      .catch(
        () => null,
      )) as
      CreateScheduleBody |
      null;


  const calendarItemId =
    typeof body
      ?.calendarItemId ===
      "string"
      ? body.calendarItemId
          .trim()
      : "";


  const recurrenceType =
    typeof body
      ?.recurrenceType ===
      "string"
      ? body.recurrenceType
          .trim()
      : "";


  const startDate =
    typeof body
      ?.startDate ===
      "string"
      ? body.startDate
          .trim()
      : "";


  const startTime =
    typeof body
      ?.startTime ===
      "string"
      ? body.startTime
          .trim()
      : "";


  const endDate =
    typeof body
      ?.endDate ===
      "string"
      ? body.endDate
          .trim()
      : "";


  const timezone =
    typeof body
      ?.timezone ===
      "string"
      ? body.timezone
          .trim()
      : "";


  const name =
    typeof body?.name ===
      "string"
      ? body.name.trim()
      : "";


  const location =
    typeof body?.location ===
      "string"
      ? body.location.trim()
      : "";


  const durationMinutes =
    normalizeInteger(
      typeof body?.durationMinutes ===
        "string"
        ? body.durationMinutes.trim()
        : body?.durationMinutes,
    );


  const occurrenceHorizonDays =
    body?.occurrenceHorizonDays ===
      undefined
      ? 30
      : normalizeInteger(
          body?.occurrenceHorizonDays,
        );


  const applicationOpenDaysBefore =
    body?.applicationOpenDaysBefore ===
      undefined
      ? 30
      : normalizeInteger(
          body?.applicationOpenDaysBefore,
        );


  const applicationCloseMinutesBefore =
    body?.applicationCloseMinutesBefore ===
      undefined
      ? 180
      : normalizeInteger(
          body?.applicationCloseMinutesBefore,
        );


  const weekday =
    normalizeInteger(
      body?.weekday,
    );


  const monthDay =
    normalizeInteger(
      body?.monthDay,
    );


  const anchorDate =
    typeof body
      ?.anchorDate ===
      "string"
      ? body.anchorDate
          .trim()
      : "";


  if (
    !calendarItemId
  ) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "クラス・イベントを指定してください。",
      },
      {
        status:
          400,
      },
    );
  }


  if (
    !isRecurrenceType(
      recurrenceType,
    )
  ) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "開催方法を確認してください。",
      },
      {
        status:
          400,
      },
    );
  }


  if (
    !isValidDate(
      startDate,
    )
  ) {
    return NextResponse.json(
      {
        ok: false,
        message:
          recurrenceType ===
          "once"
            ? "開催日を確認してください。"
            : "開催期間の開始日を確認してください。",
      },
      {
        status:
          400,
      },
    );
  }


  if (
    !isValidTime(
      startTime,
    )
  ) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "開始時刻を確認してください。",
      },
      {
        status:
          400,
      },
    );
  }


  if (
    !timezone ||
    !isValidTimezone(
      timezone,
    )
  ) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "タイムゾーンを確認してください。",
      },
      {
        status:
          400,
      },
    );
  }


  if (
    durationMinutes !==
      null &&
    durationMinutes <=
      0
  ) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "開催時間は1分以上で指定してください。",
      },
      {
        status:
          400,
      },
    );
  }


  if (
    name.length >
    120
  ) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "開催パターン名は120文字以内で入力してください。",
      },
      {
        status:
          400,
      },
    );
  }


  if (
    occurrenceHorizonDays ===
      null ||
    occurrenceHorizonDays <
      1 ||
    occurrenceHorizonDays >
      730
  ) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "予定を作る範囲は1日から730日の間で指定してください。",
      },
      {
        status:
          400,
      },
    );
  }


  if (
    applicationOpenDaysBefore ===
      null ||
    applicationOpenDaysBefore <
      0 ||
    applicationOpenDaysBefore >
      730
  ) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "申込受付開始は0日から730日前の間で指定してください。",
      },
      {
        status:
          400,
      },
    );
  }


  if (
    applicationCloseMinutesBefore ===
      null ||
    applicationCloseMinutesBefore <
      0 ||
    applicationCloseMinutesBefore >
      525600
  ) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "申込受付終了の設定を確認してください。",
      },
      {
        status:
          400,
      },
    );
  }


  if (
    occurrenceHorizonDays <
    applicationOpenDaysBefore
  ) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "予定を作る範囲は申込受付開始日以上にしてください。",
      },
      {
        status:
          400,
      },
    );
  }


  if (
    applicationCloseMinutesBefore >
    applicationOpenDaysBefore *
      1440
  ) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "申込受付終了は申込受付開始より後になるよう設定してください。",
      },
      {
        status:
          400,
      },
    );
  }


  if (
    recurrenceType !==
      "once" &&
    endDate &&
    !isValidDate(
      endDate,
    )
  ) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "開催期間の終了日を確認してください。",
      },
      {
        status:
          400,
      },
    );
  }


  if (
    recurrenceType !==
      "once" &&
    endDate &&
    endDate <
      startDate
  ) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "終了日は開始日以降にしてください。",
      },
      {
        status:
          400,
      },
    );
  }


  if (
    recurrenceType ===
      "weekly" &&
    (
      weekday ===
        null ||
      weekday < 1 ||
      weekday > 7
    )
  ) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "開催曜日を選んでください。",
      },
      {
        status:
          400,
      },
    );
  }


  if (
    recurrenceType ===
    "monthly" &&
    (
      monthDay ===
        null ||
      monthDay < 1 ||
      monthDay > 31
    )
  ) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "毎月の開催日を1日から31日の間で指定してください。",
      },
      {
        status:
          400,
      },
    );
  }


  if (
    recurrenceType ===
    "biweekly"
  ) {
    if (
      !isValidDate(
        anchorDate,
      )
    ) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "最初の開催日を指定してください。",
        },
        {
          status:
            400,
        },
      );
    }


    if (
      anchorDate <
      startDate
    ) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "最初の開催日は開催期間内にしてください。",
        },
        {
          status:
            400,
        },
      );
    }


    if (
      endDate &&
      anchorDate >
      endDate
    ) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "最初の開催日は開催期間内にしてください。",
        },
        {
          status:
            400,
        },
      );
    }
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
        calendarItemId,
      )
      .eq(
        "owner_user_id",
        auth.user.id,
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
          "指定されたクラス・イベントが見つかりません。",
      },
      {
        status:
          404,
      },
    );
  }


  const recurrenceRule =
    buildRecurrenceRule(
      recurrenceType,
      {
        weekday,
        monthDay,
        anchorDate,
      },
    );


  const {
    data: schedule,
    error,
  } =
    await supabaseAdmin
      .from(
        "calendar_schedules",
      )
      .insert({
        calendar_item_id:
          calendarItemId,

        timezone,

        name:
          name ||
          null,

        location:
          location ||
          null,

        duration_minutes:
          durationMinutes,

        occurrence_horizon_days:
          occurrenceHorizonDays,

        application_open_days_before:
          applicationOpenDaysBefore,

        application_close_minutes_before:
          applicationCloseMinutesBefore,

        start_date:
          startDate,

        start_time:
          startTime,

        end_date:
          recurrenceType ===
          "once"
            ? null
            : (
                endDate ||
                null
              ),

        recurrence_rule:
          recurrenceRule,

        status:
          "active",
      })
      .select(`
        id,
        calendar_item_id,
        timezone,
        start_date,
        start_time,
        end_date,
        name,
        location,
        duration_minutes,
        occurrence_horizon_days,
        application_open_days_before,
        application_close_minutes_before,
        recurrence_rule,
        status,
        created_at,
        updated_at
      `)
      .single();


  if (
    error ||
    !schedule
  ) {
    console.error(
      "[calendar/schedules POST] failed:",
      error,
    );

    return NextResponse.json(
      {
        ok: false,
        message:
          "日時を設定できませんでした。",
      },
      {
        status:
          500,
      },
    );
  }


  return NextResponse.json({
    ok: true,
    schedule,
  });
}

export async function PATCH(
  request: NextRequest,
) {
  const auth =
    await getAuthenticatedUser(
      request,
    );

  if (
    auth.ok === false
  ) {
    return NextResponse.json(
      {
        ok: false,
        message:
          auth.message,
      },
      {
        status:
          auth.status,
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
          name?: unknown;
        }
      | null;

  const scheduleId =
    typeof body?.scheduleId ===
    "string"
      ? body.scheduleId.trim()
      : "";

  const name =
    typeof body?.name ===
    "string"
      ? body.name.trim()
      : "";

  if (!scheduleId) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "変更するクラス・イベントが指定されていません。",
      },
      {
        status: 400,
      },
    );
  }

  if (!name) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "クラス名・イベント名を入力してください。",
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
        auth.user.id,
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
        name,
      })
      .eq(
        "id",
        scheduleId,
      )
      .select(`
        id,
        calendar_item_id,
        timezone,
        start_date,
        start_time,
        end_date,
        name,
        location,
        duration_minutes,
        occurrence_horizon_days,
        application_open_days_before,
        application_close_minutes_before,
        recurrence_rule,
        status,
        created_at,
        updated_at
      `)
      .single();

  if (
    error ||
    !updated
  ) {
    console.error(
      "[calendar/schedules PATCH] failed:",
      error,
    );

    return NextResponse.json(
      {
        ok: false,
        message:
          "クラス名・イベント名を変更できませんでした。",
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
