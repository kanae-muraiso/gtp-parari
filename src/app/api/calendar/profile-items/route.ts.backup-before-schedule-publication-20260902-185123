// src/app/api/calendar/profile-items/route.ts
// 2026-08-23 JST
//
// 公開プロフィールに表示するイベント・クラス一覧。
//
// username
//   ↓
// profiles.user_id
//   ↓
// calendar_items.show_in_profile = true
//   ↓
// 各itemの次回calendar_occurrence
//
// ログイン不要。

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
  const username =
    String(
      request.nextUrl.searchParams.get(
        "username",
      ) ?? "",
    ).trim();

  if (!username) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "ユーザー名を指定してください。",
      },
      {
        status: 400,
      },
    );
  }


  // =========================================================
  // PROFILE
  // =========================================================

  const {
    data: profile,
    error: profileError,
  } =
    await supabaseAdmin
      .from("profiles")
      .select(
        `
          user_id,
          username,
          display_name
        `,
      )
      .eq(
        "username",
        username,
      )
      .maybeSingle();


  if (
    profileError ||
    !profile
  ) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "ユーザーが見つかりません。",
      },
      {
        status:
          profileError
            ? 500
            : 404,
      },
    );
  }


  // =========================================================
  // CALENDAR ITEMS
  // =========================================================

  const {
    data: items,
    error: itemsError,
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
          fee_currency
        `,
      )
      .eq(
        "owner_user_id",
        profile.user_id,
      )
      .eq(
        "status",
        "active",
      )
      .eq(
        "visibility",
        "public",
      )
      .eq(
        "show_in_profile",
        true,
      )
      .order(
        "created_at",
        {
          ascending: true,
        },
      );


  if (itemsError) {
    console.error(
      "[calendar/profile-items] items load failed:",
      itemsError,
    );

    return NextResponse.json(
      {
        ok: false,
        message:
          "クラス・イベント一覧を取得できませんでした。",
      },
      {
        status: 500,
      },
    );
  }


  const itemRows =
    items ?? [];

  if (
    itemRows.length === 0
  ) {
    return NextResponse.json({
      ok: true,
      organizer: {
        username:
          profile.username,
        display_name:
          profile.display_name,
      },
      items: [],
    });
  }


  // =========================================================
  // NEXT OCCURRENCES
  // =========================================================

  const itemIds =
    itemRows.map(
      (
        item,
      ) =>
        item.id,
    );

  const now =
    new Date().toISOString();

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
          calendar_item_id,
          starts_at,
          ends_at,
          timezone,
          status
        `,
      )
      .in(
        "calendar_item_id",
        itemIds,
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
      );


  if (occurrencesError) {
    console.error(
      "[calendar/profile-items] occurrences load failed:",
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


  const nextOccurrenceByItem =
    new Map<
      string,
      {
        id: string;
        starts_at: string;
        ends_at: string;
        timezone: string;
      }
    >();


  for (
    const occurrence of
      occurrences ?? []
  ) {
    if (
      nextOccurrenceByItem.has(
        occurrence.calendar_item_id,
      )
    ) {
      continue;
    }

    nextOccurrenceByItem.set(
      occurrence.calendar_item_id,
      {
        id:
          occurrence.id,
        starts_at:
          occurrence.starts_at,
        ends_at:
          occurrence.ends_at,
        timezone:
          occurrence.timezone,
      },
    );
  }


  return NextResponse.json({
    ok: true,

    organizer: {
      username:
        profile.username,

      display_name:
        profile.display_name,
    },

    items:
      itemRows.map(
        (
          item,
        ) => ({
          ...item,

          next_occurrence:
            nextOccurrenceByItem.get(
              item.id,
            ) ?? null,
        }),
      ),
  });
}
