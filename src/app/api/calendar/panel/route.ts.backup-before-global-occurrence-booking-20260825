import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  supabaseAdmin,
} from "@/lib/billing/supabaseAdmin";

const VIEWER_BOOKING_STATUSES = [
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
    getBearerToken(request);

  if (!token) {
    return null;
  }

  const {
    data: {
      user,
    },
  } =
    await supabaseAdmin.auth
      .getUser(token);

  return user?.id ?? null;
}

export async function GET(
  request: NextRequest,
) {
  const calendarItemId =
    String(
      request.nextUrl.searchParams.get(
        "calendarItemId",
      ) ?? "",
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

  const {
    data: item,
    error: itemError,
  } =
    await supabaseAdmin
      .from("calendar_items")
      .select(
        `
          id,
          title,
          summary,
          duration_minutes,
          location,
          fee_amount,
          fee_currency,
          status
        `,
      )
      .eq(
        "id",
        calendarItemId,
      )
      .maybeSingle();

  if (
    itemError ||
    !item ||
    item.status !== "active"
  ) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "公開中のクラス・イベントが見つかりません。",
      },
      {
        status:
          itemError
            ? 500
            : 404,
      },
    );
  }

  const now =
    new Date().toISOString();

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
          starts_at,
          ends_at,
          timezone,
          title,
          location,
          status
        `,
      )
      .eq(
        "calendar_item_id",
        calendarItemId,
      )
      .eq(
        "status",
        "scheduled",
      )
      .gte(
        "ends_at",
        now,
      )
      .order(
        "starts_at",
        {
          ascending: true,
        },
      )
      .limit(12);

  if (occurrencesError) {
    console.error(
      "[calendar/panel] occurrence load failed:",
      occurrencesError,
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

  const viewerUserId =
    await getViewerUserId(
      request,
    );

  const occurrenceIds =
    (
      occurrences ??
      []
    ).map(
      (occurrence) =>
        occurrence.id,
    );

  const bookingStatusByOccurrenceId =
    new Map<
      string,
      string
    >();

  if (
    viewerUserId &&
    occurrenceIds.length > 0
  ) {
    const {
      data:
        bookingApplication,
      error:
        applicationError,
    } =
      await supabaseAdmin
        .from(
          "applications",
        )
        .select("id")
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
      console.error(
        "[calendar/panel] booking application load failed:",
        applicationError,
      );
    } else if (
      bookingApplication
    ) {
      const {
        data:
          viewerEntries,
        error:
          viewerEntriesError,
      } =
        await supabaseAdmin
          .from(
            "application_entries",
          )
          .select(
            `
              calendar_occurrence_id,
              status,
              created_at
            `,
          )
          .eq(
            "application_id",
            bookingApplication.id,
          )
          .eq(
            "user_id",
            viewerUserId,
          )
          .in(
            "calendar_occurrence_id",
            occurrenceIds,
          )
          .in(
            "status",
            VIEWER_BOOKING_STATUSES,
          )
          .order(
            "created_at",
            {
              ascending: false,
            },
          );

      if (viewerEntriesError) {
        console.error(
          "[calendar/panel] viewer booking load failed:",
          viewerEntriesError,
        );
      } else {
        for (
          const entry of
            viewerEntries ?? []
        ) {
          const occurrenceId =
            entry.calendar_occurrence_id;

          if (
            occurrenceId &&
            !bookingStatusByOccurrenceId.has(
              occurrenceId,
            )
          ) {
            bookingStatusByOccurrenceId.set(
              occurrenceId,
              entry.status,
            );
          }
        }
      }
    }
  }

  return NextResponse.json({
    ok: true,

    item: {
      id:
        item.id,
      title:
        item.title,
      summary:
        item.summary,
      duration_minutes:
        item.duration_minutes,
      location:
        item.location,
      fee_amount:
        item.fee_amount,
      fee_currency:
        item.fee_currency,
    },

    occurrences:
      (
        occurrences ??
        []
      ).map(
        (occurrence) => ({
          ...occurrence,

          viewer_booking_status:
            bookingStatusByOccurrenceId.get(
              occurrence.id,
            ) ??
            null,
        }),
      ),
  });
}
