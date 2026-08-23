// src/app/api/calendar/schedule-bookings/route.ts
// 2026-08-22 JST
//
// PARARI CALENDAR
//
// GET
// - 現在見ている開催回と同じSCHEDULEについて
//   今後の開催回を最大12件返す。
// - 各回について本人の予約状態・残席・締切を返す。
//
// DELETE
// - 本人が1開催回の予約を取り消す。
// - 行は削除せず status = withdrawn として履歴を残す。

import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  supabaseAdmin,
} from "@/lib/billing/supabaseAdmin";


const ACTIVE_ENTRY_STATUSES = [
  "submitted",
  "confirmed",
  "rejected",
];


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


async function getViewerUserId(
  request: NextRequest,
): Promise<string | null> {
  const token =
    getBearerToken(
      request,
    );

  if (!token) {
    return null;
  }

  const {
    data: {
      user,
    },
  } =
    await supabaseAdmin.auth
      .getUser(
        token,
      );

  return (
    user?.id ??
    null
  );
}


async function requireUser(
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


function getBookingSettings(
  definition: unknown,
) {
  const root =
    asRecord(
      definition,
    );

  const booking =
    asRecord(
      root
        ?.calendarBooking,
    );

  const rawMinutes =
    Number(
      booking
        ?.deadlineMinutesBefore ??
        0,
    );

  return {
    deadlineMinutesBefore:
      Number.isFinite(
        rawMinutes,
      ) &&
      rawMinutes >= 0
        ? Math.floor(
            rawMinutes,
          )
        : 0,

    recurringBookingEnabled:
      booking
        ?.recurringBookingEnabled ===
      true,
  };
}


// ============================================================
// GET
// ============================================================

export async function GET(
  request: NextRequest,
) {
  const occurrenceId =
    request.nextUrl
      .searchParams
      .get(
        "occurrenceId",
      )
      ?.trim() ?? "";


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
    data:
      baseOccurrence,
    error:
      baseError,
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
          starts_at
        `,
      )
      .eq(
        "id",
        occurrenceId,
      )
      .maybeSingle();


  if (
    baseError ||
    !baseOccurrence
  ) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "開催回を確認できませんでした。",
      },
      {
        status:
          baseError
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
        `
          id,
          owner_user_id,
          status
        `,
      )
      .eq(
        "id",
        baseOccurrence
          .calendar_item_id,
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
          "クラス・イベントを確認できませんでした。",
      },
      {
        status: 500,
      },
    );
  }


  const {
    data: application,
    error:
      applicationError,
  } =
    await supabaseAdmin
      .from(
        "applications",
      )
      .select(
        `
          id,
          status,
          definition
        `,
      )
      .eq(
        "origin",
        "calendar",
      )
      .eq(
        "calendar_item_id",
        item.id,
      )
      .maybeSingle();


  if (applicationError) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "予約受付情報を確認できませんでした。",
      },
      {
        status: 500,
      },
    );
  }


  const nowIso =
    new Date()
      .toISOString();


  const {
    data: occurrences,
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
          status
        `,
      )
      .eq(
        "calendar_schedule_id",
        baseOccurrence
          .calendar_schedule_id,
      )
      .gte(
        "starts_at",
        nowIso,
      )
      .eq(
        "status",
        "scheduled",
      )
      .order(
        "starts_at",
        {
          ascending: true,
        },
      )
      .limit(12);


  if (occurrencesError) {
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


  const {
    data:
      lastOccurrence,
    error:
      lastOccurrenceError,
  } =
    await supabaseAdmin
      .from(
        "calendar_occurrences",
      )
      .select(
        `
          starts_at,
          timezone
        `,
      )
      .eq(
        "calendar_schedule_id",
        baseOccurrence
          .calendar_schedule_id,
      )
      .gte(
        "starts_at",
        nowIso,
      )
      .eq(
        "status",
        "scheduled",
      )
      .order(
        "starts_at",
        {
          ascending: false,
        },
      )
      .limit(1)
      .maybeSingle();


  if (lastOccurrenceError) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "開催予定を確認できませんでした。",
      },
      {
        status: 500,
      },
    );
  }


  const occurrenceIds =
    (
      occurrences ??
      []
    ).map(
      (occurrence) =>
        occurrence.id,
    );


  const viewerUserId =
    await getViewerUserId(
      request,
    );


  let entries: Array<{
    calendar_occurrence_id:
      string | null;
    user_id:
      string | null;
    status: string;
  }> = [];


  if (
    application &&
    occurrenceIds.length >
      0
  ) {
    const {
      data:
        entryData,
      error:
        entryError,
    } =
      await supabaseAdmin
        .from(
          "application_entries",
        )
        .select(
          `
            calendar_occurrence_id,
            user_id,
            status
          `,
        )
        .eq(
          "application_id",
          application.id,
        )
        .in(
          "calendar_occurrence_id",
          occurrenceIds,
        )
        .in(
          "status",
          ACTIVE_ENTRY_STATUSES,
        );


    if (entryError) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "予約状況を確認できませんでした。",
        },
        {
          status: 500,
        },
      );
    }


    entries =
      entryData ?? [];
  }


  const settings =
    getBookingSettings(
      application
        ?.definition,
    );


  const result =
    (
      occurrences ??
      []
    ).map(
      (occurrence) => {
        const occurrenceEntries =
          entries.filter(
            (entry) =>
              entry
                .calendar_occurrence_id ===
              occurrence.id,
          );


        const reservedCount =
          occurrenceEntries
            .length;


        const capacity =
          occurrence.capacity ===
            null
            ? null
            : Number(
                occurrence.capacity,
              );


        const remaining =
          capacity === null ||
          !Number.isFinite(
            capacity,
          )
            ? null
            : Math.max(
                capacity -
                  reservedCount,
                0,
              );


        const soldOut =
          remaining !==
            null &&
          remaining <= 0;


        const startsAtTime =
          new Date(
            occurrence.starts_at,
          ).getTime();


        const deadlineTime =
          startsAtTime -
          settings
            .deadlineMinutesBefore *
            60_000;


        const deadlinePassed =
          Number.isFinite(
            deadlineTime,
          ) &&
          Date.now() >=
            deadlineTime;


        const isBooked =
          Boolean(
            viewerUserId &&
            occurrenceEntries
              .some(
                (entry) =>
                  entry.user_id ===
                  viewerUserId,
              ),
          );


        const open =
          item.status ===
            "active" &&
          application?.status ===
            "open" &&
          !deadlinePassed &&
          !soldOut;


        return {
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

          reserved_count:
            reservedCount,

          remaining,

          sold_out:
            soldOut,

          deadline_passed:
            deadlinePassed,

          open,

          is_booked:
            isBooked,
        };
      },
    );


  return NextResponse.json({
    ok: true,

    application_id:
      application
        ?.id ??
      null,

    is_owner:
      viewerUserId ===
      item.owner_user_id,

    recurring_booking_enabled:
      settings
        .recurringBookingEnabled,

    available_through:
      lastOccurrence
        ?.starts_at ??
      null,

    occurrences:
      result,
  });
}


// ============================================================
// DELETE
// 本人による1開催回の予約取消
// ============================================================

export async function DELETE(
  request: NextRequest,
) {
  const auth =
    await requireUser(
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
          starts_at
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


  const startsAtTime =
    new Date(
      occurrence.starts_at,
    ).getTime();


  if (
    !Number.isFinite(
      startsAtTime,
    ) ||
    startsAtTime <=
      Date.now()
  ) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "開催済みの予約は変更できません。",
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
    await supabaseAdmin
      .from(
        "applications",
      )
      .select(
        "id",
      )
      .eq(
        "origin",
        "calendar",
      )
      .eq(
        "calendar_item_id",
        occurrence
          .calendar_item_id,
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
    data: entry,
    error:
      entryError,
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


  if (entryError) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "予約を確認できませんでした。",
      },
      {
        status: 500,
      },
    );
  }


  if (!entry) {
    return NextResponse.json({
      ok: true,
      withdrawn: false,
    });
  }


  const {
    error:
      updateError,
  } =
    await supabaseAdmin
      .from(
        "application_entries",
      )
      .update({
        status:
          "withdrawn",
      })
      .eq(
        "id",
        entry.id,
      )
      .eq(
        "user_id",
        auth.user.id,
      );


  if (updateError) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "予約を取り消せませんでした。",
      },
      {
        status: 500,
      },
    );
  }


  return NextResponse.json({
    ok: true,
    withdrawn: true,
  });
}
