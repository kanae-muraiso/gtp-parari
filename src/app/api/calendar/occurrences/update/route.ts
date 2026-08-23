// src/app/api/calendar/occurrences/update/route.ts
// 2026-08-22 JST
//
// PARARI CALENDAR
//
// PATCH
// 「この開催回だけ変更」
//
// SCHEDULEは変更しない。
// calendar_occurrences の実開催情報だけ変更する。
//
// source_starts_at は絶対に変更しない。
// これにより定期予定を再生成しても
// 元の開催回が復活しない。

import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  supabaseAdmin,
} from "@/lib/billing/supabaseAdmin";


type UpdateOccurrenceBody = {
  occurrenceId?: unknown;
  date?: unknown;
  startTime?: unknown;
  durationMinutes?: unknown;
  location?: unknown;
  capacity?: unknown;
  minimumCapacity?: unknown;
  feeAmount?: unknown;
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
    data: { user },
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


function isValidDate(
  value: string,
) {
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


function isValidTime(
  value: string,
) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(
    value,
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


  const map =
    new Map<
      string,
      string
    >();


  for (
    const part of
      formatter.formatToParts(
        date,
      )
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


function localDateTimeToUtc(
  dateText: string,
  timeText: string,
  timezone: string,
): Date | null {
  const [
    year,
    month,
    day,
  ] =
    dateText
      .split("-")
      .map(Number);


  const [
    hour,
    minute,
  ] =
    timeText
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


    const represented =
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
      represented;


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


function normalizeOptionalInteger(
  value: unknown,
): number | null {
  if (
    value === null ||
    value === undefined ||
    String(value).trim() ===
      ""
  ) {
    return null;
  }


  const number =
    Number(
      value,
    );


  if (
    !Number.isInteger(
      number,
    ) ||
    number <= 0
  ) {
    return NaN;
  }


  return number;
}


function normalizeOptionalAmount(
  value: unknown,
): number | null {
  if (
    value === null ||
    value === undefined ||
    String(value).trim() ===
      ""
  ) {
    return null;
  }


  const number =
    Number(
      value,
    );


  if (
    !Number.isFinite(
      number,
    ) ||
    number < 0
  ) {
    return NaN;
  }


  return number;
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
      | UpdateOccurrenceBody
      | null;


  const occurrenceId =
    String(
      body?.occurrenceId ??
        "",
    ).trim();


  const date =
    String(
      body?.date ??
        "",
    ).trim();


  const startTime =
    String(
      body?.startTime ??
        "",
    ).trim();


  const durationMinutes =
    Number(
      body?.durationMinutes,
    );


  const location =
    String(
      body?.location ??
        "",
    ).trim();


  const capacity =
    normalizeOptionalInteger(
      body?.capacity,
    );


  const minimumCapacity =
    normalizeOptionalInteger(
      body?.minimumCapacity,
    );


  const feeAmount =
    normalizeOptionalAmount(
      body?.feeAmount,
    );


  if (
    !occurrenceId
  ) {
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


  if (
    !isValidDate(
      date,
    )
  ) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "開催日を確認してください。",
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
          "開始時刻を確認してください。",
      },
      {
        status: 400,
      },
    );
  }


  if (
    !Number.isInteger(
      durationMinutes,
    ) ||
    durationMinutes <=
      0
  ) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "所要時間を確認してください。",
      },
      {
        status: 400,
      },
    );
  }


  if (
    Number.isNaN(
      capacity,
    ) ||
    Number.isNaN(
      minimumCapacity,
    )
  ) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "定員は1以上の整数で入力してください。",
      },
      {
        status: 400,
      },
    );
  }


  if (
    Number.isNaN(
      feeAmount,
    )
  ) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "料金を確認してください。",
      },
      {
        status: 400,
      },
    );
  }


  if (
    capacity !== null &&
    minimumCapacity !== null &&
    minimumCapacity >
      capacity
  ) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "最低開催人数は定員以下にしてください。",
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
          calendar_schedule_id,
          source_starts_at,
          starts_at,
          ends_at,
          timezone,
          title,
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
        status:
          occurrenceError
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
        "id,owner_user_id",
      )
      .eq(
        "id",
        occurrence.calendar_item_id,
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
          "この開催回を変更する権限がありません。",
      },
      {
        status: 403,
      },
    );
  }


  if (
    occurrence.status !==
    "scheduled"
  ) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "この開催回は現在変更できません。",
      },
      {
        status: 400,
      },
    );
  }


  const startsAt =
    localDateTimeToUtc(
      date,
      startTime,
      occurrence.timezone,
    );


  if (!startsAt) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "指定された日時はこのタイムゾーンでは使用できません。",
      },
      {
        status: 400,
      },
    );
  }


  const endsAt =
    new Date(
      startsAt.getTime() +
        durationMinutes *
          60 *
          1000,
    );


  const {
    data: updated,
    error: updateError,
  } =
    await supabaseAdmin
      .from(
        "calendar_occurrences",
      )
      .update({
        starts_at:
          startsAt.toISOString(),

        ends_at:
          endsAt.toISOString(),

        location:
          location ||
          null,

        capacity,

        minimum_capacity:
          minimumCapacity,

        fee_amount:
          feeAmount,

        updated_at:
          new Date()
            .toISOString(),
      })
      .eq(
        "id",
        occurrence.id,
      )
      .select(
        `
          id,
          calendar_item_id,
          calendar_schedule_id,
          source_starts_at,
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
      .single();


  if (
    updateError ||
    !updated
  ) {
    console.error(
      "[calendar occurrence update] failed:",
      updateError,
    );


    return NextResponse.json(
      {
        ok: false,
        message:
          "開催回を変更できませんでした。",
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
