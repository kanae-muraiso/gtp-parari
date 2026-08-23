// src/app/api/calendar/recurring-bookings/route.ts
// 2026-08-22 JST
//
// PARARI CALENDAR
//
// GET
//   この開催回のSCHEDULEについて
//   閲覧中ユーザーが継続予約中か確認。
//
// POST
//   この開催回から継続予約を開始。
//   現在生成済みの将来OCCURRENCEへ予約を作る。
//
// DELETE
//   継続予約を停止。
//   表示中の開催回は残し、それより後の
//   自動生成予約だけ cancelled にする。
//
// SSOT:
//   calendar_recurring_bookings
//     = 継続して参加する意思
//
//   application_entries
//     = 各開催回について実際に成立した予約

import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  supabaseAdmin,
} from "@/lib/billing/supabaseAdmin";


const UUID_RE =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;


const DATE_KEY_RE =
  /^\d{4}-\d{2}-\d{2}$/;


const ACTIVE_ENTRY_STATUSES = [
  "submitted",
  "confirmed",
  "rejected",
];


type CalendarBookingSettings = {
  deadlineMinutesBefore: number;
  recurringBookingEnabled: boolean;
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


function isValidDateKey(
  value: string,
): boolean {
  if (
    !DATE_KEY_RE.test(
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


function getDateKeyInTimeZone(
  iso: string,
  timeZone: string,
): string | null {
  const date =
    new Date(iso);

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return null;
  }

  try {
    const parts =
      new Intl.DateTimeFormat(
        "en-US",
        {
          timeZone,
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        },
      ).formatToParts(date);

    const year =
      parts.find(
        (part) =>
          part.type ===
          "year",
      )?.value;

    const month =
      parts.find(
        (part) =>
          part.type ===
          "month",
      )?.value;

    const day =
      parts.find(
        (part) =>
          part.type ===
          "day",
      )?.value;

    if (
      !year ||
      !month ||
      !day
    ) {
      return null;
    }

    return `${year}-${month}-${day}`;
  } catch {
    return null;
  }
}


function asRecord(
  value: unknown,
): Record<string, unknown> | null {
  if (
    value &&
    typeof value ===
      "object" &&
    !Array.isArray(
      value,
    )
  ) {
    return value as
      Record<string, unknown>;
  }

  return null;
}


function getCalendarBookingSettings(
  definition: unknown,
): CalendarBookingSettings {
  const definitionRecord =
    asRecord(
      definition,
    );

  const calendarBooking =
    asRecord(
      definitionRecord
        ?.calendarBooking,
    );

  const rawDeadline =
    Number(
      calendarBooking
        ?.deadlineMinutesBefore ??
        0,
    );

  return {
    deadlineMinutesBefore:
      Number.isFinite(
        rawDeadline,
      ) &&
      rawDeadline >= 0
        ? Math.floor(
            rawDeadline,
          )
        : 0,

    recurringBookingEnabled:
      calendarBooking
        ?.recurringBookingEnabled ===
      true,
  };
}


async function loadOccurrence(
  occurrenceId: string,
) {
  return supabaseAdmin
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
}


async function loadBookingApplication(
  calendarItemId: string,
) {
  return supabaseAdmin
    .from(
      "applications",
    )
    .select(
      `
        id,
        owner_user_id,
        application_type,
        title,
        description,
        definition,
        form_id,
        acceptance_mode,
        payment_method,
        payment_amount,
        payment_currency,
        payment_url,
        payment_instructions,
        payment_confirmation_required,
        status,
        version,
        calendar_item_id
      `,
    )
    .eq(
      "origin",
      "calendar",
    )
    .eq(
      "calendar_item_id",
      calendarItemId,
    )
    .maybeSingle();
}


async function getRecurringBookingSummary(
  applicationId: string,
  calendarScheduleId: string,
  userId: string,
  startSourceStartsAt: string,
  endOn: string | null,
) {
  const {
    data: entries,
    error: entriesError,
  } =
    await supabaseAdmin
      .from(
        "application_entries",
      )
      .select(
        "calendar_occurrence_id",
      )
      .eq(
        "application_id",
        applicationId,
      )
      .eq(
        "user_id",
        userId,
      )
      .in(
        "status",
        ACTIVE_ENTRY_STATUSES,
      )
      .not(
        "calendar_occurrence_id",
        "is",
        null,
      );


  if (entriesError) {
    throw entriesError;
  }


  const occurrenceIds =
    Array.from(
      new Set(
        (entries ?? [])
          .map(
            (entry) =>
              entry
                .calendar_occurrence_id,
          )
          .filter(
            (
              id,
            ): id is string =>
              typeof id ===
                "string" &&
              id.length > 0,
          ),
      ),
    );


  if (
    occurrenceIds.length ===
    0
  ) {
    return {
      reservedCount: 0,
      firstStartsAt: null,
      lastStartsAt: null,
    };
  }


  const {
    data: occurrences,
    error: occurrencesError,
  } =
    await supabaseAdmin
      .from(
        "calendar_occurrences",
      )
      .select(
        `
          id,
          calendar_schedule_id,
          source_starts_at,
          starts_at,
          timezone,
          status
        `,
      )
      .in(
        "id",
        occurrenceIds,
      )
      .eq(
        "calendar_schedule_id",
        calendarScheduleId,
      )
      .gte(
        "source_starts_at",
        startSourceStartsAt,
      )
      .eq(
        "status",
        "scheduled",
      )
      .order(
        "source_starts_at",
        {
          ascending: true,
        },
      );


  if (occurrencesError) {
    throw occurrencesError;
  }


  const now =
    Date.now();


  const reserved =
    (occurrences ?? [])
      .filter(
        (occurrence) => {
          const startsAtTime =
            new Date(
              occurrence.starts_at,
            ).getTime();

          if (
            !Number.isFinite(
              startsAtTime,
            ) ||
            startsAtTime <
              now
          ) {
            return false;
          }

          if (!endOn) {
            return true;
          }

          const occurrenceDate =
            getDateKeyInTimeZone(
              occurrence.starts_at,
              occurrence.timezone,
            );

          return (
            occurrenceDate !==
              null &&
            occurrenceDate <=
              endOn
          );
        },
      );


  return {
    reservedCount:
      reserved.length,

    firstStartsAt:
      reserved[0]
        ?.starts_at ??
      null,

    lastStartsAt:
      reserved[
        reserved.length - 1
      ]?.starts_at ??
      null,
  };
}


// ============================================================
// GET
// 継続予約中か確認
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


  const occurrenceId =
    request.nextUrl
      .searchParams
      .get(
        "occurrenceId",
      )
      ?.trim() ?? "";


  if (
    !UUID_RE.test(
      occurrenceId,
    )
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


  const {
    data: occurrence,
    error:
      occurrenceError,
  } =
    await loadOccurrence(
      occurrenceId,
    );


  if (
    occurrenceError ||
    !occurrence
  ) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "開催回を確認できませんでした。",
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
          end_date,
          status
        `,
      )
      .eq(
        "id",
        occurrence
          .calendar_schedule_id,
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
          "開催期間を確認できませんでした。",
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
    data:
      scheduleLastOccurrence,
    error:
      scheduleLastOccurrenceError,
  } =
    await supabaseAdmin
      .from(
        "calendar_occurrences",
      )
      .select(
        `
          id,
          starts_at,
          source_starts_at,
          timezone
        `,
      )
      .eq(
        "calendar_schedule_id",
        occurrence
          .calendar_schedule_id,
      )
      .eq(
        "status",
        "scheduled",
      )
      .order(
        "source_starts_at",
        {
          ascending:
            false,
        },
      )
      .limit(1)
      .maybeSingle();


  if (
    scheduleLastOccurrenceError
  ) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "最終開催回を確認できませんでした。",
      },
      {
        status: 500,
      },
    );
  }


  const scheduleEndOn =
    typeof schedule
      .end_date ===
    "string"
      ? schedule
          .end_date
      : null;


  const scheduleLastOccurrenceStartsAt =
    typeof scheduleLastOccurrence
      ?.starts_at ===
    "string"
      ? scheduleLastOccurrence
          .starts_at
      : null;


  const {
    data: application,
    error:
      applicationError,
  } =
    await loadBookingApplication(
      occurrence
        .calendar_item_id,
    );


  if (
    applicationError
  ) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "予約情報を確認できませんでした。",
      },
      {
        status: 500,
      },
    );
  }


  if (
    !application
  ) {
    return NextResponse.json({
      ok: true,
      active: false,
      recurringBookingEnabled:
        false,
    });
  }


  const settings =
    getCalendarBookingSettings(
      application.definition,
    );


  const {
    data:
      recurringBooking,
    error:
      recurringError,
  } =
    await supabaseAdmin
      .from(
        "calendar_recurring_bookings",
      )
      .select(
        `
          id,
          status,
          start_source_starts_at,
          end_on,
          remind_on,
          started_at
        `,
      )
      .eq(
        "application_id",
        application.id,
      )
      .eq(
        "calendar_schedule_id",
        occurrence
          .calendar_schedule_id,
      )
      .eq(
        "user_id",
        auth.user.id,
      )
      .eq(
        "status",
        "active",
      )
      .maybeSingle();


  if (
    recurringError
  ) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "継続予約情報を確認できませんでした。",
      },
      {
        status: 500,
      },
    );
  }


  let summary = {
    reservedCount: 0,
    firstStartsAt:
      null as string | null,
    lastStartsAt:
      null as string | null,
  };


  if (recurringBooking) {
    try {
      summary =
        await getRecurringBookingSummary(
          application.id,
          occurrence
            .calendar_schedule_id,
          auth.user.id,
          recurringBooking
            .start_source_starts_at,
          recurringBooking
            .end_on,
        );
    } catch (error) {
      console.error(
        "[calendar recurring GET] summary failed:",
        error,
      );

      return NextResponse.json(
        {
          ok: false,
          message:
            "継続予約の内容を確認できませんでした。",
        },
        {
          status: 500,
        },
      );
    }
  }


  return NextResponse.json({
    ok: true,

    active:
      Boolean(
        recurringBooking,
      ),

    recurringBookingEnabled:
      settings
        .recurringBookingEnabled,

    recurringBooking:
      recurringBooking ??
      null,

    summary,

    schedule: {
      endOn:
        scheduleEndOn,

      lastOccurrenceStartsAt:
        scheduleLastOccurrenceStartsAt,
    },
  });
}


// ============================================================
// POST
// この開催回から継続予約を開始
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
      | {
          occurrenceId?: unknown;
          endOn?: unknown;
          remindOn?: unknown;
        }
      | null;


  const occurrenceId =
    typeof body
      ?.occurrenceId ===
    "string"
      ? body
          .occurrenceId
          .trim()
      : "";


  const rawEndOn =
    body?.endOn;

  let endOn =
    rawEndOn ===
      null ||
    rawEndOn ===
      undefined ||
    rawEndOn ===
      ""
      ? null
      : typeof rawEndOn ===
          "string"
        ? rawEndOn.trim()
        : "__invalid__";


  const rawRemindOn =
    body?.remindOn;

  const remindOn =
    rawRemindOn ===
      null ||
    rawRemindOn ===
      undefined ||
    rawRemindOn ===
      ""
      ? null
      : typeof rawRemindOn ===
          "string"
        ? rawRemindOn.trim()
        : "__invalid__";


  if (
    !UUID_RE.test(
      occurrenceId,
    )
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
    endOn !== null &&
    !isValidDateKey(
      endOn,
    )
  ) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "継続予約の終了日を確認してください。",
      },
      {
        status: 400,
      },
    );
  }


  if (
    remindOn !== null &&
    !isValidDateKey(
      remindOn,
    )
  ) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "お知らせ日を確認してください。",
      },
      {
        status: 400,
      },
    );
  }


  if (
    remindOn !== null &&
    endOn === null
  ) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "お知らせ日を設定する場合は終了日も指定してください。",
      },
      {
        status: 400,
      },
    );
  }


  if (
    remindOn !== null &&
    endOn !== null &&
    remindOn > endOn
  ) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "お知らせ日は終了日以前に設定してください。",
      },
      {
        status: 400,
      },
    );
  }


  const {
    data:
      startOccurrence,
    error:
      occurrenceError,
  } =
    await loadOccurrence(
      occurrenceId,
    );


  if (
    occurrenceError ||
    !startOccurrence
  ) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "開催回を確認できませんでした。",
      },
      {
        status:
          occurrenceError
            ? 500
            : 404,
      },
    );
  }


  if (
    startOccurrence.status !==
    "scheduled"
  ) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "この開催回から継続予約を開始できません。",
      },
      {
        status: 400,
      },
    );
  }


  const startTime =
    new Date(
      startOccurrence
        .starts_at,
    ).getTime();


  if (
    !Number.isFinite(
      startTime,
    ) ||
    startTime <=
      Date.now()
  ) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "この開催回はすでに終了しています。",
      },
      {
        status: 400,
      },
    );
  }


  const {
    data:
      recurringSchedule,
    error:
      recurringScheduleError,
  } =
    await supabaseAdmin
      .from(
        "calendar_schedules",
      )
      .select(
        `
          id,
          end_date,
          status
        `,
      )
      .eq(
        "id",
        startOccurrence
          .calendar_schedule_id,
      )
      .maybeSingle();


  if (
    recurringScheduleError ||
    !recurringSchedule
  ) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "開催期間を確認できませんでした。",
      },
      {
        status:
          recurringScheduleError
            ? 500
            : 404,
      },
    );
  }


  const startDateKey =
    getDateKeyInTimeZone(
      startOccurrence
        .starts_at,
      startOccurrence
        .timezone,
    );


  if (
    endOn !== null &&
    startDateKey !== null &&
    endOn < startDateKey
  ) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "終了日は、この開催日以降に設定してください。",
      },
      {
        status: 400,
      },
    );
  }


  const {
    data: application,
    error:
      applicationError,
  } =
    await loadBookingApplication(
      startOccurrence
        .calendar_item_id,
    );


  if (
    applicationError ||
    !application
  ) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "予約受付情報を確認できませんでした。",
      },
      {
        status:
          applicationError
            ? 500
            : 404,
      },
    );
  }


  if (
    application.status !==
    "open"
  ) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "現在、予約受付を行っていません。",
      },
      {
        status: 400,
      },
    );
  }


  if (
    application
      .owner_user_id ===
    auth.user.id
  ) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "主催者本人は予約できません。",
      },
      {
        status: 400,
      },
    );
  }


  const settings =
    getCalendarBookingSettings(
      application.definition,
    );


  if (
    !settings
      .recurringBookingEnabled
  ) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "このクラス・イベントでは継続予約を受け付けていません。",
      },
      {
        status: 400,
      },
    );
  }


  const firstDeadlineTime =
    startTime -
    settings
      .deadlineMinutesBefore *
      60_000;


  if (
    Date.now() >=
    firstDeadlineTime
  ) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "この開催回の予約締切を過ぎています。",
      },
      {
        status: 400,
      },
    );
  }


  // ----------------------------------------------------------
  // 既存のACTIVE継続予約
  // ----------------------------------------------------------

  let {
    data:
      recurringBooking,
    error:
      recurringLookupError,
  } =
    await supabaseAdmin
      .from(
        "calendar_recurring_bookings",
      )
      .select(
        `
          id,
          application_id,
          calendar_schedule_id,
          user_id,
          status,
          start_source_starts_at,
          end_on,
          remind_on,
          started_at
        `,
      )
      .eq(
        "application_id",
        application.id,
      )
      .eq(
        "calendar_schedule_id",
        startOccurrence
          .calendar_schedule_id,
      )
      .eq(
        "user_id",
        auth.user.id,
      )
      .eq(
        "status",
        "active",
      )
      .maybeSingle();


  if (
    recurringLookupError
  ) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "継続予約情報を確認できませんでした。",
      },
      {
        status: 500,
      },
    );
  }


  // ----------------------------------------------------------
  // 既存の継続予約なら期間設定を更新
  // ----------------------------------------------------------

  if (recurringBooking) {
    const {
      data:
        updatedRecurring,
      error:
        updateRecurringError,
    } =
      await supabaseAdmin
        .from(
          "calendar_recurring_bookings",
        )
        .update({
          end_on:
            endOn,

          remind_on:
            remindOn,

          updated_at:
            new Date()
              .toISOString(),
        })
        .eq(
          "id",
          recurringBooking.id,
        )
        .eq(
          "user_id",
          auth.user.id,
        )
        .eq(
          "status",
          "active",
        )
        .select(
          `
            id,
            application_id,
            calendar_schedule_id,
            user_id,
            status,
            start_source_starts_at,
            end_on,
            remind_on,
            started_at
          `,
        )
        .single();


    if (
      updateRecurringError ||
      !updatedRecurring
    ) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "継続予約の期間を更新できませんでした。",
        },
        {
          status: 500,
        },
      );
    }


    recurringBooking =
      updatedRecurring;
  }


  // ----------------------------------------------------------
  // 新規継続予約
  // ----------------------------------------------------------

  if (
    !recurringBooking
  ) {
    const {
      data:
        createdRecurring,
      error:
        createRecurringError,
    } =
      await supabaseAdmin
        .from(
          "calendar_recurring_bookings",
        )
        .insert({
          application_id:
            application.id,

          calendar_schedule_id:
            startOccurrence
              .calendar_schedule_id,

          user_id:
            auth.user.id,

          start_occurrence_id:
            startOccurrence.id,

          start_source_starts_at:
            startOccurrence
              .source_starts_at,

          status:
            "active",

          end_on:
            endOn,

          remind_on:
            remindOn,
        })
        .select(
          `
            id,
            application_id,
            calendar_schedule_id,
            user_id,
            status,
            start_source_starts_at,
            end_on,
            remind_on,
            started_at
          `,
        )
        .single();


    if (
      createRecurringError ||
      !createdRecurring
    ) {
      console.error(
        "[calendar recurring POST] create failed:",
        createRecurringError,
      );

      return NextResponse.json(
        {
          ok: false,
          message:
            "継続予約を開始できませんでした。",
        },
        {
          status: 500,
        },
      );
    }


    recurringBooking =
      createdRecurring;
  }


  // ----------------------------------------------------------
  // 現在生成済みの、この回以降のOCCURRENCE
  //
  // starts_atではなくsource_starts_atで
  // recurrence上の順序を決める。
  // ----------------------------------------------------------

  const {
    data:
      occurrences,
    error:
      occurrencesError,
  } =
    await supabaseAdmin
      .from(
        "calendar_occurrences",
      )
      .select(
        `
          id,
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
        "calendar_schedule_id",
        startOccurrence
          .calendar_schedule_id,
      )
      .gte(
        "source_starts_at",
        startOccurrence
          .source_starts_at,
      )
      .eq(
        "status",
        "scheduled",
      )
      .order(
        "source_starts_at",
        {
          ascending:
            true,
        },
      );


  if (
    occurrencesError
  ) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "今後の開催予定を確認できませんでした。",
      },
      {
        status: 500,
      },
    );
  }


  let createdCount =
    0;

  let alreadyBookedCount =
    0;

  let fullCount =
    0;

  let deadlineCount =
    0;

  const outsidePeriodIds:
    string[] = [];


  for (
    const occurrence of
      occurrences ?? []
  ) {
    const occurrenceStart =
      new Date(
        occurrence.starts_at,
      ).getTime();


    if (
      !Number.isFinite(
        occurrenceStart,
      )
    ) {
      continue;
    }


    if (endOn) {
      const occurrenceDate =
        getDateKeyInTimeZone(
          occurrence.starts_at,
          occurrence.timezone,
        );

      if (
        occurrenceDate !==
          null &&
        occurrenceDate >
          endOn
      ) {
        outsidePeriodIds.push(
          occurrence.id,
        );

        continue;
      }
    }


    const deadlineTime =
      occurrenceStart -
      settings
        .deadlineMinutesBefore *
        60_000;


    if (
      Date.now() >=
      deadlineTime
    ) {
      deadlineCount += 1;
      continue;
    }


    // すでに本人の有効な予約がある場合は
    // 単発予約であってもそのまま尊重する。
    const {
      data:
        existingEntry,
      error:
        existingEntryError,
    } =
      await supabaseAdmin
        .from(
          "application_entries",
        )
        .select(
          "id",
        )
        .eq(
          "application_id",
          application.id,
        )
        .eq(
          "calendar_occurrence_id",
          occurrence.id,
        )
        .eq(
          "user_id",
          auth.user.id,
        )
        .in(
          "status",
          ACTIVE_ENTRY_STATUSES,
        )
        .limit(1)
        .maybeSingle();


    if (
      existingEntryError
    ) {
      console.error(
        "[calendar recurring POST] existing entry check failed:",
        existingEntryError,
      );

      continue;
    }


    if (
      existingEntry
    ) {
      alreadyBookedCount +=
        1;

      continue;
    }


    const capacity =
      occurrence.capacity ===
      null
        ? null
        : Number(
            occurrence.capacity,
          );


    if (
      capacity !== null &&
      Number.isFinite(
        capacity,
      )
    ) {
      const {
        count,
        error:
          countError,
      } =
        await supabaseAdmin
          .from(
            "application_entries",
          )
          .select(
            "id",
            {
              count:
                "exact",
              head:
                true,
            },
          )
          .eq(
            "application_id",
            application.id,
          )
          .eq(
            "calendar_occurrence_id",
            occurrence.id,
          )
          .in(
            "status",
            ACTIVE_ENTRY_STATUSES,
          );


      if (
        countError
      ) {
        console.error(
          "[calendar recurring POST] capacity check failed:",
          countError,
        );

        continue;
      }


      if (
        (count ?? 0) >=
        capacity
      ) {
        fullCount += 1;
        continue;
      }
    }


    const qualificationStatus =
      application
        .acceptance_mode ===
      "approval"
        ? "pending"
        : "not_required";


    const paymentStatus =
      application
        .payment_method ===
      "none"
        ? "not_required"
        : "unpaid";


    const qualificationSatisfied =
      qualificationStatus ===
      "not_required";


    const paymentSatisfied =
      application
        .payment_confirmation_required !==
      true;


    const entryStatus =
      qualificationSatisfied &&
      paymentSatisfied
        ? "confirmed"
        : "submitted";


    const applicationSnapshot = {
      id:
        application.id,

      application_type:
        application
          .application_type,

      title:
        application.title,

      description:
        application.description,

      definition:
        application.definition,

      form_id:
        application.form_id,

      acceptance_mode:
        application
          .acceptance_mode,

      payment_method:
        application
          .payment_method,

      payment_amount:
        application
          .payment_amount,

      payment_currency:
        application
          .payment_currency,

      payment_url:
        application
          .payment_url,

      payment_instructions:
        application
          .payment_instructions,

      payment_confirmation_required:
        application
          .payment_confirmation_required,

      version:
        application.version,

      calendar_occurrence: {
        id:
          occurrence.id,

        starts_at:
          occurrence.starts_at,

        ends_at:
          occurrence.ends_at,

        timezone:
          occurrence.timezone,

        title:
          occurrence.title,

        location:
          occurrence.location,

        capacity:
          occurrence.capacity,

        minimum_capacity:
          occurrence
            .minimum_capacity,

        fee_amount:
          occurrence.fee_amount,

        fee_currency:
          occurrence
            .fee_currency,
      },
    };


    const {
      error:
        insertError,
    } =
      await supabaseAdmin
        .from(
          "application_entries",
        )
        .insert({
          application_id:
            application.id,

          application_version:
            application.version,

          user_id:
            auth.user.id,

          calendar_occurrence_id:
            occurrence.id,

          calendar_recurring_booking_id:
            recurringBooking.id,

          form_submission_id:
            null,

          status:
            entryStatus,

          qualification_status:
            qualificationStatus,

          payment_status:
            paymentStatus,

          application_snapshot:
            applicationSnapshot,
        });


    if (
      insertError
    ) {
      if (
        insertError.code ===
        "23505"
      ) {
        alreadyBookedCount +=
          1;

        continue;
      }


      console.error(
        "[calendar recurring POST] entry insert failed:",
        insertError,
      );

      continue;
    }


    createdCount += 1;
  }


  let cancelledOutsidePeriodCount =
    0;


  if (
    endOn &&
    outsidePeriodIds.length >
      0
  ) {
    const {
      data:
        cancelledOutside,
      error:
        cancelledOutsideError,
    } =
      await supabaseAdmin
        .from(
          "application_entries",
        )
        .update({
          status:
            "cancelled",
        })
        .eq(
          "calendar_recurring_booking_id",
          recurringBooking.id,
        )
        .eq(
          "user_id",
          auth.user.id,
        )
        .in(
          "calendar_occurrence_id",
          outsidePeriodIds,
        )
        .in(
          "status",
          ACTIVE_ENTRY_STATUSES,
        )
        .select(
          "id",
        );


    if (
      cancelledOutsideError
    ) {
      console.error(
        "[calendar recurring POST] cancel outside period failed:",
        cancelledOutsideError,
      );

      return NextResponse.json(
        {
          ok: false,
          message:
            "継続期間は保存しましたが、期間外の予約取消を完了できませんでした。",
        },
        {
          status: 500,
        },
      );
    }


    cancelledOutsidePeriodCount =
      cancelledOutside
        ?.length ??
      0;
  }


  let summary;

  try {
    summary =
      await getRecurringBookingSummary(
        application.id,
        startOccurrence
          .calendar_schedule_id,
        auth.user.id,
        recurringBooking
          .start_source_starts_at,
        endOn,
      );
  } catch (error) {
    console.error(
      "[calendar recurring POST] summary failed:",
      error,
    );

    summary = {
      reservedCount: 0,
      firstStartsAt: null,
      lastStartsAt: null,
    };
  }


  return NextResponse.json({
    ok: true,

    active: true,

    recurringBookingId:
      recurringBooking.id,

    endOn,
    remindOn,

    summary,

    createdCount,
    alreadyBookedCount,
    fullCount,
    deadlineCount,
    cancelledOutsidePeriodCount,
  });
}


// ============================================================
// DELETE
// 継続予約を停止
//
// 表示中の開催回そのものは残す。
// それより後の自動予約のみcancelled。
// ============================================================

export async function DELETE(
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
          occurrenceId?: unknown;
        }
      | null;


  const occurrenceId =
    typeof body
      ?.occurrenceId ===
    "string"
      ? body
          .occurrenceId
          .trim()
      : "";


  if (
    !UUID_RE.test(
      occurrenceId,
    )
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


  const {
    data: occurrence,
    error:
      occurrenceError,
  } =
    await loadOccurrence(
      occurrenceId,
    );


  if (
    occurrenceError ||
    !occurrence
  ) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "開催回を確認できませんでした。",
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
    data: application,
    error:
      applicationError,
  } =
    await loadBookingApplication(
      occurrence
        .calendar_item_id,
    );


  if (
    applicationError ||
    !application
  ) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "予約情報を確認できませんでした。",
      },
      {
        status:
          applicationError
            ? 500
            : 404,
      },
    );
  }


  const {
    data:
      recurringBooking,
    error:
      recurringError,
  } =
    await supabaseAdmin
      .from(
        "calendar_recurring_bookings",
      )
      .select(
        `
          id,
          status
        `,
      )
      .eq(
        "application_id",
        application.id,
      )
      .eq(
        "calendar_schedule_id",
        occurrence
          .calendar_schedule_id,
      )
      .eq(
        "user_id",
        auth.user.id,
      )
      .eq(
        "status",
        "active",
      )
      .maybeSingle();


  if (recurringError) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "自動予約情報を確認できませんでした。",
      },
      {
        status: 500,
      },
    );
  }


  if (!recurringBooking) {
    return NextResponse.json({
      ok: true,
      active: false,
    });
  }


  const now =
    new Date()
      .toISOString();


  const {
    error:
      stopError,
  } =
    await supabaseAdmin
      .from(
        "calendar_recurring_bookings",
      )
      .update({
        status:
          "stopped",

        stopped_at:
          now,

        updated_at:
          now,
      })
      .eq(
        "id",
        recurringBooking.id,
      )
      .eq(
        "user_id",
        auth.user.id,
      )
      .eq(
        "status",
        "active",
      );


  if (stopError) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "自動予約を終了できませんでした。",
      },
      {
        status: 500,
      },
    );
  }


  /*
   * ここでは application_entries を変更しない。
   *
   * 自動予約をやめる
   * =
   * 今後追加される開催回への
   * 自動予約だけを停止する。
   *
   * すでに成立している予約は
   * ユーザーが開催日一覧から
   * 個別に取り消せる。
   */
  return NextResponse.json({
    ok: true,
    active: false,
  });
}
