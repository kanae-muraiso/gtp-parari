// src/app/api/calendar/public/route.ts
// 2026-08-20 JST
//
// PARARI CALENDAR v1
//
// 公開開催回API
//
// GET ?occurrenceId=...
//
// - 開催内容
// - 主催者
// - 予約受付状態
// - 定員 / 残席
// - ログイン中なら自分の予約状態
//
// 閲覧自体はログイン不要。

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


  // =========================================================
  // OCCURRENCE
  // =========================================================

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
          "開催情報が見つかりません。",
      },
      {
        status:
          occurrenceError
            ? 500
            : 404,
      },
    );
  }


  // =========================================================
  // CALENDAR ITEM
  // =========================================================

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
          description_work_id,
          status
        `,
      )
      .eq(
        "id",
        occurrence.calendar_item_id,
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
          "クラス・イベント情報を確認できませんでした。",
      },
      {
        status: 500,
      },
    );
  }


  // =========================================================
  // 主催者プロフィール
  // =========================================================

  const {
    data: profile,
  } =
    await supabaseAdmin
      .from("profiles")
      .select(
        `
          username,
          display_name
        `,
      )
      .eq(
        "user_id",
        item.owner_user_id,
      )
      .maybeSingle();


  // =========================================================
  // CALENDAR BOOKING APPLICATION
  // =========================================================

  const {
    data:
      bookingApplication,
    error:
      bookingError,
  } =
    await supabaseAdmin
      .from(
        "applications",
      )
      .select(
        `
          id,
          status,
          acceptance_mode,
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


  if (bookingError) {
    console.error(
      "[calendar/public] booking load failed:",
      bookingError,
    );

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


  // =========================================================
  // 現在予約数
  // =========================================================

  let reservedCount =
    0;


  if (
    bookingApplication
  ) {
    const {
      count,
      error: countError,
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
          "calendar_occurrence_id",
          occurrence.id,
        )
        .in(
          "status",
          ACTIVE_ENTRY_STATUSES,
        );


    if (countError) {
      console.error(
        "[calendar/public] reservation count failed:",
        countError,
      );

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


    reservedCount =
      count ?? 0;
  }


  const capacity =
    occurrence.capacity ===
      null
      ? null
      : Number(
          occurrence.capacity,
        );


  const remaining =
    capacity === null
      ? null
      : Math.max(
          capacity -
            reservedCount,
          0,
        );


  const soldOut =
    capacity !== null &&
    reservedCount >=
      capacity;


  const startsAtTime =
    new Date(
      occurrence.starts_at,
    ).getTime();


  const isPast =
    Number.isFinite(
      startsAtTime,
    ) &&
    startsAtTime <=
      Date.now();


  // =========================================================
  // 予約締切
  //
  // APPLICATIONには
  // 「開催何分前まで受付するか」だけを保存する。
  //
  // 実際の締切日時は各OCCURRENCEの
  // starts_atから計算する。
  // =========================================================

  const rawDefinition =
    bookingApplication
      ?.definition;


  const definition =
    rawDefinition &&
    typeof rawDefinition ===
      "object" &&
    !Array.isArray(
      rawDefinition,
    )
      ? rawDefinition as
          Record<string, unknown>
      : null;


  const rawCalendarBooking =
    definition
      ?.calendarBooking;


  const calendarBooking =
    rawCalendarBooking &&
    typeof rawCalendarBooking ===
      "object" &&
    !Array.isArray(
      rawCalendarBooking,
    )
      ? rawCalendarBooking as
          Record<string, unknown>
      : null;


  const rawDeadlineMinutes =
    Number(
      calendarBooking
        ?.deadlineMinutesBefore ??
        0,
    );


  const deadlineMinutesBefore =
    Number.isFinite(
      rawDeadlineMinutes,
    ) &&
    rawDeadlineMinutes >= 0
      ? Math.floor(
          rawDeadlineMinutes,
        )
      : 0;


  const bookingDeadlineTime =
    startsAtTime -
    deadlineMinutesBefore *
      60_000;


  const bookingDeadlinePassed =
    Boolean(
      bookingApplication,
    ) &&
    Number.isFinite(
      bookingDeadlineTime,
    ) &&
    bookingDeadlineTime <=
      Date.now();


  const bookingDeadlineAt =
    bookingApplication &&
    Number.isFinite(
      bookingDeadlineTime,
    )
      ? new Date(
          bookingDeadlineTime,
        ).toISOString()
      : null;


  const recurringBookingEnabled =
    calendarBooking
      ?.recurringBookingEnabled ===
    true;


  // =========================================================
  // 閲覧中ユーザー
  // =========================================================

  let viewerUserId:
    | string
    | null =
      null;


  const token =
    getBearerToken(
      request,
    );


  if (token) {
    const {
      data: {
        user,
      },
    } =
      await supabaseAdmin.auth
        .getUser(
          token,
        );


    viewerUserId =
      user?.id ??
      null;
  }


  const isOwner =
    viewerUserId !== null &&
    viewerUserId ===
      item.owner_user_id;


  let isBooked =
    false;

  let bookedAt:
    | string
    | null =
      null;

  let occurrenceHistory:
    Array<{
      id: string;
      event_type: string;
      before_data:
        Record<string, unknown>
        | null;
      after_data:
        Record<string, unknown>
        | null;
      created_at: string;
    }> = [];


  if (
    viewerUserId &&
    bookingApplication
  ) {
    const {
      data:
        viewerEntry,
      error:
        viewerEntryError,
    } =
      await supabaseAdmin
        .from(
          "application_entries",
        )
        .select(
          `
            id,
            status,
            created_at
          `,
        )
        .eq(
          "calendar_occurrence_id",
          occurrence.id,
        )
        .eq(
          "user_id",
          viewerUserId,
        )
        .in(
          "status",
          ACTIVE_ENTRY_STATUSES,
        )
        .limit(1)
        .maybeSingle();


    if (
      viewerEntryError
    ) {
      console.error(
        "[calendar/public] viewer booking check failed:",
        viewerEntryError,
      );
    } else {
      isBooked =
        Boolean(
          viewerEntry,
        );

      bookedAt =
        viewerEntry
          ?.created_at ??
        null;
    }
  }


  /*
   * 詳細な変更履歴は
   * 主催者本人または予約者本人だけに返す。
   */
  if (
    viewerUserId &&
    (
      isOwner ||
      isBooked
    )
  ) {
    let historyQuery =
      supabaseAdmin
        .from(
          "calendar_occurrence_events",
        )
        .select(
          `
            id,
            event_type,
            before_data,
            after_data,
            created_at
          `,
        )
        .eq(
          "calendar_occurrence_id",
          occurrence.id,
        );


    /*
     * 主催者：
     *   開催回の全履歴を見る。
     *
     * 予約者：
     *   自分が予約した後に起きた変更だけを見る。
     *
     * 予約前の変更履歴は、その人とは
     * 関係のない過去なので表示しない。
     */
    if (
      !isOwner &&
      bookedAt
    ) {
      historyQuery =
        historyQuery.gt(
          "created_at",
          bookedAt,
        );
    }


    const {
      data:
        historyData,
      error:
        historyError,
    } =
      await historyQuery
        .order(
          "created_at",
          {
            ascending:
              true,
          },
        );


    if (historyError) {
      console.error(
        "[calendar/public] history load failed:",
        historyError,
      );
    } else {
      occurrenceHistory =
        historyData ?? [];
    }
  }


  const bookingOpen =
    item.status ===
      "active" &&
    occurrence.status ===
      "scheduled" &&
    bookingApplication
      ?.status ===
      "open" &&
    !bookingDeadlinePassed &&
    !isPast &&
    !soldOut;


  return NextResponse.json({
    ok: true,

    occurrence: {
      id:
        occurrence.id,

      title:
        occurrence.title,

      starts_at:
        occurrence.starts_at,

      ends_at:
        occurrence.ends_at,

      timezone:
        occurrence.timezone,

      location:
        occurrence.location,

      capacity,

      minimum_capacity:
        occurrence.minimum_capacity,

      fee_amount:
        occurrence.fee_amount,

      fee_currency:
        occurrence.fee_currency,

      status:
        occurrence.status,

      description_work_id:
        item.description_work_id,
    },

    organizer: {
      username:
        profile?.username ??
        null,

      display_name:
        profile
          ?.display_name ??
        null,
    },

    booking: {
      application_id:
        bookingApplication
          ?.id ??
        null,

      acceptance_mode:
        bookingApplication
          ?.acceptance_mode ??
        null,

      open:
        bookingOpen,

      deadline_minutes_before:
        deadlineMinutesBefore,

      deadline_at:
        bookingDeadlineAt,

      deadline_passed:
        bookingDeadlinePassed,

      recurring_booking_enabled:
        recurringBookingEnabled,

      reserved_count:
        reservedCount,

      remaining,

      sold_out:
        soldOut,

      is_past:
        isPast,

      is_booked:
        isBooked,

      is_owner:
        isOwner,

      booked_at:
        bookedAt,

      history:
        occurrenceHistory,
    },
  });
}
