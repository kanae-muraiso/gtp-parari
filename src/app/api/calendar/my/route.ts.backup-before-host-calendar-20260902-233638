// src/app/api/calendar/my/route.ts
// 2026-08-22 JST
//
// 利用者本人のCALENDAR情報
//
// upcoming:
//   今日から14日間の実際の参加予定
//
// classes:
//   現在参加しているクラスをschedule単位で集約

import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  supabaseAdmin,
} from "@/lib/billing/supabaseAdmin";


export const runtime = "nodejs";


const BOOKING_STATUSES = [
  "submitted",
  "confirmed",
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

  return match?.[1]?.trim() ||
    null;
}


export async function GET(
  request: NextRequest,
) {
  try {
    // ========================================================
    // AUTH
    // ========================================================

    const token =
      getBearerToken(
        request,
      );


    if (!token) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "ログインが必要です。",
        },
        {
          status: 401,
        },
      );
    }


    const {
      data: { user },
      error: userError,
    } =
      await supabaseAdmin
        .auth
        .getUser(
          token,
        );


    if (
      userError ||
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


    const now =
      new Date();


    const twoWeeksLater =
      new Date(
        now.getTime() +
          14 *
            24 *
            60 *
            60 *
            1000,
      );


    // ========================================================
    // ACTIVE CALENDAR ENTRIES
    // ========================================================

    const {
      data: entries,
      error: entriesError,
    } =
      await supabaseAdmin
        .from(
          "application_entries",
        )
        .select(
          `
            id,
            application_id,
            calendar_occurrence_id,
            status,
            created_at
          `,
        )
        .eq(
          "user_id",
          user.id,
        )
        .in(
          "status",
          BOOKING_STATUSES,
        )
        .not(
          "calendar_occurrence_id",
          "is",
          null,
        )
        .order(
          "created_at",
          {
            ascending: false,
          },
        )
        .limit(500);


    if (entriesError) {
      console.error(
        "[calendar/my] entries failed:",
        entriesError,
      );

      return NextResponse.json(
        {
          ok: false,
          message:
            "予定を取得できませんでした。",
        },
        {
          status: 500,
        },
      );
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
                Boolean(id),
            ),
        ),
      );


    // ========================================================
    // OCCURRENCES
    // ========================================================

    const occurrences:
      Array<{
        id: string;
        calendar_item_id: string;
        calendar_schedule_id:
          string;
        starts_at: string;
        ends_at:
          | string
          | null;
        timezone: string;
        title: string;
        location:
          | string
          | null;
        status: string;
      }> = [];


    if (
      occurrenceIds.length >
      0
    ) {
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
              status
            `,
          )
          .in(
            "id",
            occurrenceIds,
          );


      if (error) {
        console.error(
          "[calendar/my] occurrences failed:",
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


      occurrences.push(
        ...(data ?? []),
      );
    }


    const occurrenceById =
      new Map(
        occurrences.map(
          (occurrence) => [
            occurrence.id,
            occurrence,
          ],
        ),
      );


    // ========================================================
    // 14-DAY TIMELINE
    // ========================================================

    const upcoming =
      (entries ?? [])
        .map(
          (entry) => {
            const occurrence =
              occurrenceById.get(
                String(
                  entry
                    .calendar_occurrence_id,
                ),
              );


            if (!occurrence) {
              return null;
            }


            const startsAt =
              new Date(
                occurrence.starts_at,
              );


            if (
              Number.isNaN(
                startsAt.getTime(),
              ) ||
              startsAt < now ||
              startsAt >=
                twoWeeksLater
            ) {
              return null;
            }


            return {
              entry_id:
                entry.id,

              application_id:
                entry
                  .application_id,

              occurrence_id:
                occurrence.id,

              schedule_id:
                occurrence
                  .calendar_schedule_id,

              item_id:
                occurrence
                  .calendar_item_id,

              starts_at:
                occurrence
                  .starts_at,

              ends_at:
                occurrence
                  .ends_at,

              timezone:
                occurrence
                  .timezone,

              title:
                occurrence.title,

              location:
                occurrence
                  .location,

              occurrence_status:
                occurrence.status,

              booking_status:
                entry.status,
            };
          },
        )
        .filter(
          (
            row,
          ): row is NonNullable<
            typeof row
          > => Boolean(row),
        )
        .sort(
          (a, b) =>
            new Date(
              a.starts_at,
            ).getTime() -
            new Date(
              b.starts_at,
            ).getTime(),
        );


    // ========================================================
    // CALENDAR EVENTS
    //
    // 月間カレンダー用。
    // 14日間に限定せず、自分のCALENDAR予約を返す。
    //
    // completed を含む過去の予定も表示できるよう、
    // cancelled だけ除外する。
    // ========================================================

    const calendarEvents =
      (entries ?? [])
        .map(
          (entry) => {
            const occurrence =
              occurrenceById.get(
                String(
                  entry
                    .calendar_occurrence_id,
                ),
              );


            if (
              !occurrence ||
              occurrence.status ===
                "cancelled"
            ) {
              return null;
            }


            return {
              entry_id:
                entry.id,

              application_id:
                entry
                  .application_id,

              occurrence_id:
                occurrence.id,

              schedule_id:
                occurrence
                  .calendar_schedule_id,

              item_id:
                occurrence
                  .calendar_item_id,

              starts_at:
                occurrence
                  .starts_at,

              ends_at:
                occurrence
                  .ends_at,

              timezone:
                occurrence
                  .timezone,

              title:
                occurrence.title,

              location:
                occurrence
                  .location,

              occurrence_status:
                occurrence.status,

              booking_status:
                entry.status,
            };
          },
        )
        .filter(
          (
            row,
          ): row is NonNullable<
            typeof row
          > => Boolean(row),
        )
        .sort(
          (a, b) =>
            new Date(
              a.starts_at,
            ).getTime() -
            new Date(
              b.starts_at,
            ).getTime(),
        );


    // ========================================================
    // ACTIVE RECURRING BOOKINGS
    // ========================================================

    const {
      data:
        recurringBookings,
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
            application_id,
            calendar_schedule_id
          `,
        )
        .eq(
          "user_id",
          user.id,
        )
        .eq(
          "status",
          "active",
        );


    if (recurringError) {
      console.error(
        "[calendar/my] recurring bookings failed:",
        recurringError,
      );

      return NextResponse.json(
        {
          ok: false,
          message:
            "参加中のクラスを取得できませんでした。",
        },
        {
          status: 500,
        },
      );
    }


    // ========================================================
    // PARTICIPATING SCHEDULES
    //
    // ・将来の予約がある
    // ・または自動予約中
    //
    // のどちらかで参加中とみなす。
    // ========================================================

    const futureBookedOccurrences =
      (entries ?? [])
        .map(
          (entry) => {
            const occurrence =
              occurrenceById.get(
                String(
                  entry
                    .calendar_occurrence_id,
                ),
              );

            if (!occurrence) {
              return null;
            }


            const startsAt =
              new Date(
                occurrence.starts_at,
              );


            if (
              Number.isNaN(
                startsAt.getTime(),
              ) ||
              startsAt < now
            ) {
              return null;
            }


            return {
              entry,
              occurrence,
            };
          },
        )
        .filter(
          (
            row,
          ): row is NonNullable<
            typeof row
          > => Boolean(row),
        );


    const scheduleIds =
      Array.from(
        new Set([
          ...futureBookedOccurrences.map(
            (row) =>
              row.occurrence
                .calendar_schedule_id,
          ),

          ...(recurringBookings ??
            []).map(
            (row) =>
              row
                .calendar_schedule_id,
          ),
        ]),
      );


    // ========================================================
    // NEXT OCCURRENCES
    // ========================================================

    const nextOccurrenceBySchedule =
      new Map<
        string,
        {
          id: string;
          calendar_schedule_id:
            string;
          starts_at: string;
          ends_at:
            | string
            | null;
          timezone: string;
          title: string;
          location:
            | string
            | null;
        }
      >();


    if (
      scheduleIds.length >
      0
    ) {
      const {
        data:
          nextOccurrences,
        error:
          nextOccurrencesError,
      } =
        await supabaseAdmin
          .from(
            "calendar_occurrences",
          )
          .select(
            `
              id,
              calendar_schedule_id,
              starts_at,
              ends_at,
              timezone,
              title,
              location
            `,
          )
          .in(
            "calendar_schedule_id",
            scheduleIds,
          )
          .eq(
            "status",
            "scheduled",
          )
          .gte(
            "starts_at",
            now.toISOString(),
          )
          .order(
            "starts_at",
            {
              ascending: true,
            },
          )
          .limit(500);


      if (
        nextOccurrencesError
      ) {
        console.error(
          "[calendar/my] next occurrences failed:",
          nextOccurrencesError,
        );

        return NextResponse.json(
          {
            ok: false,
            message:
              "次回開催を取得できませんでした。",
          },
          {
            status: 500,
          },
        );
      }


      for (
        const occurrence of
        nextOccurrences ?? []
      ) {
        if (
          !nextOccurrenceBySchedule
            .has(
              occurrence
                .calendar_schedule_id,
            )
        ) {
          nextOccurrenceBySchedule
            .set(
              occurrence
                .calendar_schedule_id,
              occurrence,
            );
        }
      }
    }


    // ========================================================
    // APPLICATION TITLES
    // ========================================================

    const applicationIds =
      Array.from(
        new Set([
          ...futureBookedOccurrences.map(
            (row) =>
              row.entry
                .application_id,
          ),

          ...(recurringBookings ??
            []).map(
            (row) =>
              row.application_id,
          ),
        ]),
      );


    const applicationTitleById =
      new Map<
        string,
        string
      >();


    if (
      applicationIds.length >
      0
    ) {
      const {
        data: applications,
        error:
          applicationsError,
      } =
        await supabaseAdmin
          .from(
            "applications",
          )
          .select(
            `
              id,
              title
            `,
          )
          .in(
            "id",
            applicationIds,
          );


      if (applicationsError) {
        console.error(
          "[calendar/my] applications failed:",
          applicationsError,
        );

        return NextResponse.json(
          {
            ok: false,
            message:
              "参加情報を取得できませんでした。",
          },
          {
            status: 500,
          },
        );
      }


      for (
        const application of
        applications ?? []
      ) {
        applicationTitleById
          .set(
            application.id,
            application.title ??
              "クラス",
          );
      }
    }


    // ========================================================
    // CLASS CARDS
    // ========================================================

    const recurringBySchedule =
      new Map(
        (
          recurringBookings ??
          []
        ).map(
          (row) => [
            row
              .calendar_schedule_id,
            row,
          ],
        ),
      );


    const classes =
      scheduleIds
        .map(
          (scheduleId) => {
            const bookingRows =
              futureBookedOccurrences
                .filter(
                  (row) =>
                    row.occurrence
                      .calendar_schedule_id ===
                    scheduleId,
                );


            const recurring =
              recurringBySchedule
                .get(
                  scheduleId,
                ) ??
              null;


            const applicationId =
              bookingRows[0]
                ?.entry
                .application_id ??
              recurring
                ?.application_id ??
              null;


            const nextOccurrence =
              nextOccurrenceBySchedule
                .get(
                  scheduleId,
                ) ??
              null;


            const pendingCount =
              bookingRows.filter(
                (row) =>
                  row.entry
                    .status ===
                  "submitted",
              ).length;


            return {
              schedule_id:
                scheduleId,

              application_id:
                applicationId,

              title:
                applicationId
                  ? applicationTitleById
                      .get(
                        applicationId,
                      ) ??
                    nextOccurrence
                      ?.title ??
                    "クラス"
                  : nextOccurrence
                      ?.title ??
                    "クラス",

              location:
                nextOccurrence
                  ?.location ??
                bookingRows[0]
                  ?.occurrence
                  .location ??
                null,

              next_occurrence_id:
                nextOccurrence
                  ?.id ??
                null,

              next_starts_at:
                nextOccurrence
                  ?.starts_at ??
                null,

              next_ends_at:
                nextOccurrence
                  ?.ends_at ??
                null,

              timezone:
                nextOccurrence
                  ?.timezone ??
                null,

              reservation_count:
                bookingRows.length,

              pending_count:
                pendingCount,

              auto_booking:
                Boolean(
                  recurring,
                ),
            };
          },
        )
        .sort(
          (a, b) => {
            if (
              !a.next_starts_at &&
              !b.next_starts_at
            ) {
              return a.title.localeCompare(
                b.title,
                "ja",
              );
            }

            if (
              !a.next_starts_at
            ) {
              return 1;
            }

            if (
              !b.next_starts_at
            ) {
              return -1;
            }

            return (
              new Date(
                a.next_starts_at,
              ).getTime() -
              new Date(
                b.next_starts_at,
              ).getTime()
            );
          },
        );


    return NextResponse.json({
      ok: true,

      range: {
        from:
          now.toISOString(),

        to:
          twoWeeksLater
            .toISOString(),

        days: 14,
      },

      upcoming,

      events:
        calendarEvents,

      classes,
    });
  } catch (error) {
    console.error(
      "GET /api/calendar/my failed:",
      error,
    );

    return NextResponse.json(
      {
        ok: false,
        message:
          "カレンダー情報を取得できませんでした。",
      },
      {
        status: 500,
      },
    );
  }
}
