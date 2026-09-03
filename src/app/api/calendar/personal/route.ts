import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  supabaseAdmin,
} from "@/lib/billing/supabaseAdmin";


export const runtime = "nodejs";


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

  return match?.[1]?.trim() || null;
}


function nullableText(
  value: unknown,
): string | null {
  const text =
    String(
      value ?? "",
    ).trim();

  return text || null;
}


export async function POST(
  request: NextRequest,
) {
  const token =
    getBearerToken(
      request,
    );

  if (!token) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "ログインしてください。",
      },
      {
        status: 401,
      },
    );
  }

  const {
    data: {
      user,
    },
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

  const body =
    (await request
      .json()
      .catch(
        () => null,
      )) as
      | {
          title?: unknown;
          startsAt?: unknown;
          endsAt?: unknown;
          timezone?: unknown;
          location?: unknown;
          memo?: unknown;
        }
      | null;

  const title =
    String(
      body?.title ?? "",
    ).trim();

  if (!title) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "タイトルを入力してください。",
      },
      {
        status: 400,
      },
    );
  }

  if (
    title.length >
    120
  ) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "タイトルは120文字以内で入力してください。",
      },
      {
        status: 400,
      },
    );
  }

  const startsAt =
    new Date(
      String(
        body?.startsAt ?? "",
      ),
    );

  const endsAt =
    new Date(
      String(
        body?.endsAt ?? "",
      ),
    );

  if (
    Number.isNaN(
      startsAt.getTime(),
    ) ||
    Number.isNaN(
      endsAt.getTime(),
    ) ||
    endsAt <= startsAt
  ) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "開始日時と終了日時を確認してください。",
      },
      {
        status: 400,
      },
    );
  }

  const timezone =
    String(
      body?.timezone ??
        "Asia/Tokyo",
    ).trim() ||
    "Asia/Tokyo";

  const location =
    nullableText(
      body?.location,
    );

  const memo =
    nullableText(
      body?.memo,
    );

  const durationMinutes =
    Math.max(
      1,
      Math.ceil(
        (
          endsAt.getTime() -
          startsAt.getTime()
        ) /
          60000,
      ),
    );

  const {
    data: item,
    error: itemError,
  } =
    await supabaseAdmin
      .from(
        "calendar_items",
      )
      .insert({
        owner_user_id:
          user.id,

        kind:
          "personal",

        title,

        duration_minutes:
          durationMinutes,

        location,

        capacity:
          null,

        minimum_capacity:
          null,

        fee_amount:
          null,

        fee_currency:
          "JPY",

        description_work_id:
          null,

        summary:
          memo,

        show_in_profile:
          false,

        visibility:
          "private",

        status:
          "active",
      })
      .select(
        `
          id,
          title,
          summary
        `,
      )
      .single();

  if (
    itemError ||
    !item
  ) {
    console.error(
      "[calendar/personal POST] item create failed:",
      itemError,
    );

    return NextResponse.json(
      {
        ok: false,
        message:
          "予定を保存できませんでした。",
      },
      {
        status: 500,
      },
    );
  }

  const startsIso =
    startsAt.toISOString();

  const endsIso =
    endsAt.toISOString();

  const {
    data: occurrence,
    error: occurrenceError,
  } =
    await supabaseAdmin
      .from(
        "calendar_occurrences",
      )
      .insert({
        calendar_item_id:
          item.id,

        calendar_schedule_id:
          null,

        starts_at:
          startsIso,

        ends_at:
          endsIso,

        timezone,

        title,

        location,

        capacity:
          null,

        minimum_capacity:
          null,

        fee_amount:
          null,

        fee_currency:
          "JPY",

        status:
          "scheduled",

        source_starts_at:
          startsIso,
      })
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
      .single();

  if (
    occurrenceError ||
    !occurrence
  ) {
    console.error(
      "[calendar/personal POST] occurrence create failed:",
      occurrenceError,
    );

    await supabaseAdmin
      .from(
        "calendar_items",
      )
      .delete()
      .eq(
        "id",
        item.id,
      )
      .eq(
        "owner_user_id",
        user.id,
      )
      .eq(
        "kind",
        "personal",
      );

    return NextResponse.json(
      {
        ok: false,
        message:
          "予定を保存できませんでした。",
      },
      {
        status: 500,
      },
    );
  }

  return NextResponse.json({
    ok: true,

    event: {
      ...occurrence,

      item_id:
        item.id,

      memo:
        item.summary ??
        null,

      source:
        "personal",
    },
  });
}
