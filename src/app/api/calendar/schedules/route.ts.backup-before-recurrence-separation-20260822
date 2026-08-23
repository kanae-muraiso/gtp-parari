// src/app/api/calendar/schedules/route.ts
// 2026-08-20 JST
//
// PARARI CALENDAR v1
//
// GET
// - 自分のSCHEDULE一覧
// - calendarItemId指定時は、そのITEMだけ
//
// POST
// - calendar_item に新しいSCHEDULEを追加
//
// calendar_items     = WHAT
// calendar_schedules = WHEN
// calendar_occurrences = 実際の開催回（次STEP）

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
};


function getBearerToken(
  request: NextRequest,
): string | null {
  const authorization =
    request.headers.get("authorization") ?? "";

  const match =
    authorization.match(
      /^Bearer\s+(.+)$/i,
    );

  return match?.[1]?.trim() || null;
}


async function getAuthenticatedUser(
  request: NextRequest,
) {
  const token =
    getBearerToken(request);

  if (!token) {
    return {
      ok: false as const,
      status: 401,
      message:
        "ログインしてください。",
    };
  }

  const {
    data: { user },
    error,
  } =
    await supabaseAdmin.auth.getUser(
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
  ].includes(value);
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
        timeZone: value,
      },
    );

    return true;
  } catch {
    return false;
  }
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

  // ISO
  // Mon=1 ... Sun=7
  return jsDay === 0
    ? 7
    : jsDay;
}


function getMonthDay(
  dateText: string,
): number {
  return Number(
    dateText.split("-")[2],
  );
}


function buildRecurrenceRule(
  recurrenceType: RecurrenceType,
  startDate: string,
) {
  switch (recurrenceType) {
    case "once":
      return {
        freq: "once",
      };

    case "weekly":
      return {
        freq: "weekly",
        interval: 1,
        byWeekday: [
          getIsoWeekday(
            startDate,
          ),
        ],
      };

    case "biweekly":
      return {
        freq: "weekly",
        interval: 2,
        byWeekday: [
          getIsoWeekday(
            startDate,
          ),
        ],
      };

    case "monthly":
      return {
        freq: "monthly",
        interval: 1,
        byMonthDay: [
          getMonthDay(
            startDate,
          ),
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

  if (auth.ok === false) {
    return NextResponse.json(
      {
        ok: false,
        message: auth.message,
      },
      {
        status: auth.status,
      },
    );
  }


  const calendarItemId =
    request.nextUrl.searchParams
      .get("calendarItemId")
      ?.trim() ?? "";


  let itemIds: string[] = [];


  if (calendarItemId) {
    const {
      data: item,
      error: itemError,
    } =
      await supabaseAdmin
        .from("calendar_items")
        .select("id")
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
          status: 404,
        },
      );
    }


    itemIds = [
      item.id,
    ];
  } else {
    const {
      data: items,
      error: itemsError,
    } =
      await supabaseAdmin
        .from("calendar_items")
        .select("id")
        .eq(
          "owner_user_id",
          auth.user.id,
        );


    if (itemsError) {
      console.error(
        "[calendar/schedules GET] items failed:",
        itemsError,
      );

      return NextResponse.json(
        {
          ok: false,
          message:
            "スケジュールを取得できませんでした。",
        },
        {
          status: 500,
        },
      );
    }


    itemIds =
      (items ?? []).map(
        (item) =>
          String(item.id),
      );
  }


  if (
    itemIds.length === 0
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
      .in(
        "calendar_item_id",
        itemIds,
      )
      .order(
        "start_date",
        {
          ascending: true,
        },
      )
      .order(
        "start_time",
        {
          ascending: true,
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
        status: 500,
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

  if (auth.ok === false) {
    return NextResponse.json(
      {
        ok: false,
        message: auth.message,
      },
      {
        status: auth.status,
      },
    );
  }


  const body =
    (await request
      .json()
      .catch(() => null)) as
      | CreateScheduleBody
      | null;


  const calendarItemId =
    String(
      body?.calendarItemId ??
        "",
    ).trim();

  const recurrenceType =
    String(
      body?.recurrenceType ??
        "",
    ).trim();

  const startDate =
    String(
      body?.startDate ??
        "",
    ).trim();

  const startTime =
    String(
      body?.startTime ??
        "",
    ).trim();

  const endDateRaw =
    String(
      body?.endDate ??
        "",
    ).trim();

  const timezone =
    String(
      body?.timezone ??
        "Asia/Tokyo",
    ).trim();


  if (!calendarItemId) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "クラス・イベントが指定されていません。",
      },
      {
        status: 400,
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
          "開催方法が正しくありません。",
      },
      {
        status: 400,
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
          "開始日を入力してください。",
      },
      {
        status: 400,
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
          "開始時刻を入力してください。",
      },
      {
        status: 400,
      },
    );
  }


  if (
    !isValidTimezone(
      timezone,
    )
  ) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "タイムゾーンが正しくありません。",
      },
      {
        status: 400,
      },
    );
  }


  let endDate:
    | string
    | null =
      null;


  if (
    recurrenceType ===
    "once"
  ) {
    endDate =
      startDate;
  } else if (
    endDateRaw
  ) {
    if (
      !isValidDate(
        endDateRaw,
      )
    ) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "終了日が正しくありません。",
        },
        {
          status: 400,
        },
      );
    }


    if (
      endDateRaw <
      startDate
    ) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "終了日は開始日以降にしてください。",
        },
        {
          status: 400,
        },
      );
    }


    endDate =
      endDateRaw;
  }


  /*
   * 所有権確認
   */

  const {
    data: item,
    error: itemError,
  } =
    await supabaseAdmin
      .from("calendar_items")
      .select("id,status")
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
          "指定されたクラス・イベントを使用できません。",
      },
      {
        status: 404,
      },
    );
  }


  if (
    item.status !==
    "active"
  ) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "このクラス・イベントは現在使用できません。",
      },
      {
        status: 400,
      },
    );
  }


  const recurrenceRule =
    buildRecurrenceRule(
      recurrenceType,
      startDate,
    );


  const {
    data,
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

        start_date:
          startDate,

        start_time:
          startTime,

        end_date:
          endDate,

        recurrence_rule:
          recurrenceRule,

        status:
          "active",
      })
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
    error ||
    !data
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
        status: 500,
      },
    );
  }


  return NextResponse.json({
    ok: true,
    schedule: data,
  });
}
