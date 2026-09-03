import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  supabaseAdmin,
} from "@/lib/billing/supabaseAdmin";

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
          visibility,
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
    item.status !== "active" ||
    item.visibility !== "public"
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
      occurrences ?? [],
  });
}
