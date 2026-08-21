// src/app/api/calendar/occurrences/route.ts
// 2026-08-20 JST
//
// PARARI CALENDAR v1
//
// GET
// - 自分の実開催回一覧
//
// POST
// - SCHEDULEから実際の開催回を生成する
//
// calendar_items       = WHAT
// calendar_schedules   = WHEN
// calendar_occurrences = 実際の1回

import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  supabaseAdmin,
} from "@/lib/billing/supabaseAdmin";


type GenerateOccurrencesBody = {
  scheduleId?: unknown;
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


function parseDate(
  value: string,
) {
  const [
    year,
    month,
    day,
  ] =
    value
      .split("-")
      .map(Number);

  return {
    year,
    month,
    day,
  };
}


function formatDate(
  date: Date,
): string {
  return date
    .toISOString()
    .slice(
      0,
      10,
    );
}


function addDays(
  dateText: string,
  days: number,
): string {
  const {
    year,
    month,
    day,
  } =
    parseDate(
      dateText,
    );

  const date =
    new Date(
      Date.UTC(
        year,
        month - 1,
        day + days,
      ),
    );

  return formatDate(
    date,
  );
}


function addOneYear(
  dateText: string,
): string {
  const {
    year,
    month,
    day,
  } =
    parseDate(
      dateText,
    );

  /*
   * 2/29 → 翌年2/28
   */
  const candidate =
    new Date(
      Date.UTC(
        year + 1,
        month - 1,
        day,
      ),
    );

  if (
    candidate.getUTCMonth() !==
    month - 1
  ) {
    return formatDate(
      new Date(
        Date.UTC(
          year + 1,
          month,
          0,
        ),
      ),
    );
  }

  return formatDate(
    candidate,
  );
}


function monthlyDate(
  startDate: string,
  monthOffset: number,
): string | null {
  const {
    year,
    month,
    day,
  } =
    parseDate(
      startDate,
    );

  const firstOfTargetMonth =
    new Date(
      Date.UTC(
        year,
        month - 1 +
          monthOffset,
        1,
      ),
    );

  const targetYear =
    firstOfTargetMonth
      .getUTCFullYear();

  const targetMonth =
    firstOfTargetMonth
      .getUTCMonth();

  const lastDay =
    new Date(
      Date.UTC(
        targetYear,
        targetMonth + 1,
        0,
      ),
    ).getUTCDate();

  /*
   * 「毎月31日」で31日がない月は
   * 無理に月末へずらさず、その月は開催しない。
   */
  if (
    day >
    lastDay
  ) {
    return null;
  }

  return formatDate(
    new Date(
      Date.UTC(
        targetYear,
        targetMonth,
        day,
      ),
    ),
  );
}


function getWallClockParts(
  date: Date,
  timezone: string,
) {
  const formatter =
    new Intl.DateTimeFormat(
      "en-CA",
      {
        timeZone:
          timezone,

        year:
          "numeric",

        month:
          "2-digit",

        day:
          "2-digit",

        hour:
          "2-digit",

        minute:
          "2-digit",

        second:
          "2-digit",

        hourCycle:
          "h23",
      },
    );


  const parts =
    formatter
      .formatToParts(
        date,
      );


  const map =
    new Map<
      string,
      string
    >();


  for (
    const part of parts
  ) {
    if (
      part.type !==
      "literal"
    ) {
      map.set(
        part.type,
        part.value,
      );
    }
  }


  return {
    year:
      Number(
        map.get("year"),
      ),

    month:
      Number(
        map.get("month"),
      ),

    day:
      Number(
        map.get("day"),
      ),

    hour:
      Number(
        map.get("hour"),
      ),

    minute:
      Number(
        map.get("minute"),
      ),

    second:
      Number(
        map.get("second"),
      ),
  };
}


/*
 * 開催地のローカル日時
 *
 * 例:
 * 2026-08-21 21:00 Asia/Tokyo
 *
 * をUTCのDateへ変換する。
 *
 * Date constructorへtimezoneを直接渡せないため、
 * Intlで壁時計との差を補正する。
 */
function localDateTimeToUtc(
  dateText: string,
  timeText: string,
  timezone: string,
): Date | null {
  const {
    year,
    month,
    day,
  } =
    parseDate(
      dateText,
    );

  const [
    hour,
    minute,
  ] =
    timeText
      .slice(
        0,
        5,
      )
      .split(":")
      .map(Number);


  const targetWallClock =
    Date.UTC(
      year,
      month - 1,
      day,
      hour,
      minute,
      0,
    );


  let guess =
    targetWallClock;


  for (
    let i = 0;
    i < 4;
    i += 1
  ) {
    const parts =
      getWallClockParts(
        new Date(
          guess,
        ),
        timezone,
      );


    const representedWallClock =
      Date.UTC(
        parts.year,
        parts.month - 1,
        parts.day,
        parts.hour,
        parts.minute,
        parts.second,
      );


    const difference =
      targetWallClock -
      representedWallClock;


    if (
      difference === 0
    ) {
      break;
    }


    guess +=
      difference;
  }


  const result =
    new Date(
      guess,
    );


  /*
   * 夏時間切替などで、
   * 指定したローカル時刻自体が存在しない場合を検出。
   */
  const verification =
    getWallClockParts(
      result,
      timezone,
    );


  if (
    verification.year !==
      year ||
    verification.month !==
      month ||
    verification.day !==
      day ||
    verification.hour !==
      hour ||
    verification.minute !==
      minute
  ) {
    return null;
  }


  return result;
}


function buildOccurrenceDates(
  schedule: {
    start_date: string;
    end_date:
      | string
      | null;
    recurrence_rule:
      | Record<
          string,
          unknown
        >
      | null;
  },
): string[] {
  const startDate =
    schedule.start_date;

  const rule =
    schedule.recurrence_rule ??
    {};

  const freq =
    String(
      rule.freq ??
        "once",
    );

  /*
   * 終了日未設定の定期開催は
   * まず1年先まで具体化する。
   */
  /*
   * 終了日がない定期開催は、
   * 常に現在または開始日の遅い方から
   * 1年先まで具体化する。
   *
   * 後日もう一度生成すれば、
   * 開催予定が先へ伸びていく。
   */
  const today =
    new Date()
      .toISOString()
      .slice(
        0,
        10,
      );

  const rollingBase =
    today > startDate
      ? today
      : startDate;

  const horizon =
    schedule.end_date ??
    addOneYear(
      rollingBase,
    );


  if (
    freq ===
    "once"
  ) {
    return [
      startDate,
    ];
  }


  if (
    freq ===
    "weekly"
  ) {
    const rawInterval =
      Number(
        rule.interval ??
          1,
      );

    const interval =
      Number.isFinite(
        rawInterval,
      ) &&
      rawInterval > 0
        ? Math.floor(
            rawInterval,
          )
        : 1;


    const stepDays =
      7 *
      interval;


    const dates:
      string[] = [];


    let current =
      startDate;


    while (
      current <=
      horizon
    ) {
      dates.push(
        current,
      );

      current =
        addDays(
          current,
          stepDays,
        );
    }


    return dates;
  }


  if (
    freq ===
    "monthly"
  ) {
    const rawInterval =
      Number(
        rule.interval ??
          1,
      );

    const interval =
      Number.isFinite(
        rawInterval,
      ) &&
      rawInterval > 0
        ? Math.floor(
            rawInterval,
          )
        : 1;


    const dates:
      string[] = [];


    let monthOffset =
      0;


    while (
      monthOffset <
      240
    ) {
      const candidate =
        monthlyDate(
          startDate,
          monthOffset,
        );


      if (
        candidate &&
        candidate >
          horizon
      ) {
        break;
      }


      if (
        candidate
      ) {
        dates.push(
          candidate,
        );
      }


      monthOffset +=
        interval;
    }


    return dates;
  }


  return [
    startDate,
  ];
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
    request.nextUrl.searchParams
      .get(
        "calendarItemId",
      )
      ?.trim() ?? "";


  const {
    data: items,
    error: itemError,
  } =
    await supabaseAdmin
      .from(
        "calendar_items",
      )
      .select("id")
      .eq(
        "owner_user_id",
        auth.user.id,
      );


  if (itemError) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "開催予定を取得できませんでした。",
      },
      {
        status: 500,
      },
    );
  }


  let itemIds =
    (items ?? []).map(
      (item) =>
        String(
          item.id,
        ),
    );


  if (
    calendarItemId
  ) {
    itemIds =
      itemIds.filter(
        (id) =>
          id ===
          calendarItemId,
      );
  }


  if (
    itemIds.length ===
    0
  ) {
    return NextResponse.json({
      ok: true,
      occurrences: [],
    });
  }


  const {
    data,
    error,
  } =
    await supabaseAdmin
      .from(
        "calendar_occurrences",
      )
      .select(
        `
          id,
          calendar_item_id,
          calendar_schedule_id,
          starts_at,
          ends_at,
          timezone,
          title,
          location,
          capacity,
          minimum_capacity,
          fee_amount,
          fee_currency,
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
        "starts_at",
        {
          ascending:
            true,
        },
      );


  if (error) {
    console.error(
      "[calendar/occurrences GET] failed:",
      error,
    );


    return NextResponse.json(
      {
        ok: false,
        message:
          "開催予定を取得できませんでした。",
      },
      {
        status: 500,
      },
    );
  }


  return NextResponse.json({
    ok: true,
    occurrences:
      data ?? [],
  });
}


// ============================================================
// POST
// schedule → occurrence生成
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
      | GenerateOccurrencesBody
      | null;


  const scheduleId =
    String(
      body?.scheduleId ??
        "",
    ).trim();


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


  const {
    data: schedule,
    error:
      scheduleError,
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
        status: 404,
      },
    );
  }


  const {
    data: item,
    error:
      itemError,
  } =
    await supabaseAdmin
      .from(
        "calendar_items",
      )
      .select(
        `
          id,
          owner_user_id,
          title,
          duration_minutes,
          location,
          capacity,
          minimum_capacity,
          fee_amount,
          fee_currency,
          status
        `,
      )
      .eq(
        "id",
        schedule
          .calendar_item_id,
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
          "このスケジュールを使用できません。",
      },
      {
        status: 403,
      },
    );
  }


  if (
    schedule.status !==
      "active" ||
    item.status !==
      "active"
  ) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "このスケジュールは現在有効ではありません。",
      },
      {
        status: 400,
      },
    );
  }


  const dates =
    buildOccurrenceDates(
      schedule,
    );


  const rows:
    Array<
      Record<
        string,
        unknown
      >
    > = [];


  for (
    const dateText of
      dates
  ) {
    const startsAt =
      localDateTimeToUtc(
        dateText,
        schedule.start_time,
        schedule.timezone,
      );


    if (!startsAt) {
      return NextResponse.json(
        {
          ok: false,
          message:
            `${dateText} ${String(
              schedule.start_time,
            ).slice(
              0,
              5,
            )} は、${schedule.timezone}では存在しない時刻です。夏時間の切替などを確認してください。`,
        },
        {
          status: 400,
        },
      );
    }


    const endsAt =
      new Date(
        startsAt.getTime() +
          Number(
            item.duration_minutes,
          ) *
            60 *
            1000,
      );


    rows.push({
      calendar_item_id:
        item.id,

      calendar_schedule_id:
        schedule.id,

      starts_at:
        startsAt.toISOString(),

      ends_at:
        endsAt.toISOString(),

      timezone:
        schedule.timezone,

      title:
        item.title,

      location:
        item.location,

      capacity:
        item.capacity,

      minimum_capacity:
        item.minimum_capacity,

      fee_amount:
        item.fee_amount,

      fee_currency:
        item.fee_currency,

      status:
        "scheduled",
    });
  }


  if (
    rows.length ===
    0
  ) {
    return NextResponse.json({
      ok: true,
      occurrenceCount:
        0,
    });
  }


  const {
    error,
  } =
    await supabaseAdmin
      .from(
        "calendar_occurrences",
      )
      .upsert(
        rows,
        {
          onConflict:
            "calendar_schedule_id,starts_at",

          ignoreDuplicates:
            true,
        },
      );


  if (error) {
    console.error(
      "[calendar/occurrences POST] failed:",
      error,
    );


    return NextResponse.json(
      {
        ok: false,
        message:
          "開催予定を作成できませんでした。",
      },
      {
        status: 500,
      },
    );
  }


  return NextResponse.json({
    ok: true,

    /*
     * 重複が既にあった場合も含め、
     * このSCHEDULEで必要な開催回数。
     */
    occurrenceCount:
      rows.length,
  });
}
