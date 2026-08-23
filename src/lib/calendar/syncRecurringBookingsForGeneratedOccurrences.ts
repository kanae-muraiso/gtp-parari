// src/lib/calendar/syncRecurringBookingsForGeneratedOccurrences.ts
// 2026-08-22 JST
//
// 新しく生成・再生成されたCALENDAR OCCURRENCEについて、
// 自動予約中のユーザーへapplication_entriesを反映する。
//
// 原則:
// - calendar_recurring_bookings = 継続する参加意思
// - application_entries = 各開催回の予約事実
// - withdrawn = 本人がその回を明示的に外した事実
//
// したがってwithdrawnの回は自動予約で復活させない。

import {
  supabaseAdmin,
} from "@/lib/billing/supabaseAdmin";


const ACTIVE_ENTRY_STATUSES = [
  "submitted",
  "confirmed",
  "rejected",
];


type SyncInput = {
  calendarScheduleId: string;
  sourceStartsAt: string[];
};


type SyncResult = {
  recurringBookingCount: number;
  occurrenceCount: number;
  createdCount: number;
  alreadyBookedCount: number;
  withdrawnCount: number;
  fullCount: number;
  deadlineCount: number;
};


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


function getDeadlineMinutesBefore(
  definition: unknown,
) {
  const root =
    asRecord(
      definition,
    );

  const calendarBooking =
    asRecord(
      root
        ?.calendarBooking,
    );

  const raw =
    Number(
      calendarBooking
        ?.deadlineMinutesBefore ??
        0,
    );

  return (
    Number.isFinite(raw) &&
    raw >= 0
      ? Math.floor(raw)
      : 0
  );
}


function recurringEnabled(
  definition: unknown,
) {
  const root =
    asRecord(
      definition,
    );

  const calendarBooking =
    asRecord(
      root
        ?.calendarBooking,
    );

  return (
    calendarBooking
      ?.recurringBookingEnabled ===
    true
  );
}


export async function syncRecurringBookingsForGeneratedOccurrences({
  calendarScheduleId,
  sourceStartsAt,
}: SyncInput): Promise<SyncResult> {
  const result: SyncResult = {
    recurringBookingCount: 0,
    occurrenceCount: 0,
    createdCount: 0,
    alreadyBookedCount: 0,
    withdrawnCount: 0,
    fullCount: 0,
    deadlineCount: 0,
  };


  const sourceValues =
    Array.from(
      new Set(
        sourceStartsAt
          .filter(
            (value) =>
              typeof value ===
                "string" &&
              value.length > 0,
          ),
      ),
    );


  if (
    !calendarScheduleId ||
    sourceValues.length ===
      0
  ) {
    return result;
  }


  // =========================================================
  // OCCURRENCES
  // =========================================================

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
        "calendar_schedule_id",
        calendarScheduleId,
      )
      .in(
        "source_starts_at",
        sourceValues,
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
    throw new Error(
      `calendar occurrences load failed: ${occurrencesError.message}`,
    );
  }


  if (
    !occurrences ||
    occurrences.length ===
      0
  ) {
    return result;
  }


  result.occurrenceCount =
    occurrences.length;


  const calendarItemId =
    String(
      occurrences[0]
        .calendar_item_id,
    );


  // =========================================================
  // APPLICATION
  // =========================================================

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


  if (applicationError) {
    throw new Error(
      `calendar application load failed: ${applicationError.message}`,
    );
  }


  if (
    !application ||
    application.status !==
      "open" ||
    !recurringEnabled(
      application.definition,
    )
  ) {
    return result;
  }


  // =========================================================
  // ACTIVE AUTO BOOKINGS
  // =========================================================

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
          user_id,
          start_source_starts_at,
          status
        `,
      )
      .eq(
        "application_id",
        application.id,
      )
      .eq(
        "calendar_schedule_id",
        calendarScheduleId,
      )
      .eq(
        "status",
        "active",
      );


  if (recurringError) {
    throw new Error(
      `recurring bookings load failed: ${recurringError.message}`,
    );
  }


  if (
    !recurringBookings ||
    recurringBookings.length ===
      0
  ) {
    return result;
  }


  result.recurringBookingCount =
    recurringBookings.length;


  const deadlineMinutesBefore =
    getDeadlineMinutesBefore(
      application.definition,
    );


  // =========================================================
  // USER × OCCURRENCE
  // =========================================================

  for (
    const recurringBooking of
    recurringBookings
  ) {
    /*
     * 主催者自身は予約者にしない。
     */
    if (
      recurringBooking.user_id ===
      application.owner_user_id
    ) {
      continue;
    }


    const recurringStartTime =
      new Date(
        recurringBooking
          .start_source_starts_at,
      ).getTime();


    for (
      const occurrence of
      occurrences
    ) {
      const occurrenceSourceTime =
        new Date(
          occurrence
            .source_starts_at,
        ).getTime();


      /*
       * 自動予約を開始した回より前には遡らない。
       */
      if (
        Number.isFinite(
          recurringStartTime,
        ) &&
        Number.isFinite(
          occurrenceSourceTime,
        ) &&
        occurrenceSourceTime <
          recurringStartTime
      ) {
        continue;
      }


      /*
       * 締切確認。
       */
      const startsAtTime =
        new Date(
          occurrence.starts_at,
        ).getTime();


      const deadlineTime =
        startsAtTime -
        deadlineMinutesBefore *
          60_000;


      if (
        !Number.isFinite(
          startsAtTime,
        ) ||
        Date.now() >=
          deadlineTime
      ) {
        result.deadlineCount +=
          1;

        continue;
      }


      // =====================================================
      // 既存履歴
      //
      // ACTIVEなら重複予約しない。
      // 最新がwithdrawnなら、
      // 本人が「この日は休む」と決めた事実なので復活させない。
      // =====================================================

      const {
        data:
          previousEntries,
        error:
          previousEntryError,
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
            "application_id",
            application.id,
          )
          .eq(
            "calendar_occurrence_id",
            occurrence.id,
          )
          .eq(
            "user_id",
            recurringBooking
              .user_id,
          )
          .order(
            "created_at",
            {
              ascending:
                false,
            },
          )
          .limit(1);


      if (previousEntryError) {
        throw new Error(
          `existing entry load failed: ${previousEntryError.message}`,
        );
      }


      const previousEntry =
        previousEntries
          ?.[0] ??
        null;


      if (
        previousEntry &&
        ACTIVE_ENTRY_STATUSES
          .includes(
            previousEntry.status,
          )
      ) {
        result
          .alreadyBookedCount +=
          1;

        continue;
      }


      if (
        previousEntry
          ?.status ===
        "withdrawn"
      ) {
        result.withdrawnCount +=
          1;

        continue;
      }


      // =====================================================
      // CAPACITY
      // =====================================================

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


        if (countError) {
          throw new Error(
            `capacity check failed: ${countError.message}`,
          );
        }


        if (
          (count ?? 0) >=
          capacity
        ) {
          result.fullCount +=
            1;

          continue;
        }
      }


      // =====================================================
      // ENTRY STATUS
      // 既存recurring APIと同じ判定
      // =====================================================

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


      // =====================================================
      // SNAPSHOT
      // =====================================================

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


      // =====================================================
      // INSERT
      // =====================================================

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
              recurringBooking
                .user_id,

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


      if (insertError) {
        /*
         * 並行実行などで既に作られていた場合は正常扱い。
         */
        if (
          insertError.code ===
          "23505"
        ) {
          result
            .alreadyBookedCount +=
            1;

          continue;
        }

        throw new Error(
          `automatic booking insert failed: ${insertError.message}`,
        );
      }


      result.createdCount +=
        1;
    }
  }


  return result;
}
