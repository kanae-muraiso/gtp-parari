// src/app/api/calendar/occurrences/participants/route.ts
// 2026-08-23 JST
//
// 作者専用
// 1開催回の予約者一覧を返す。
//
// CALENDAR OCCURRENCE
//   ↓
// calendar-origin APPLICATION
//   ↓
// application_entries
//
// 氏名は user_private_profiles.full_name を優先。
// 公開プロフィール名はフォールバックとして使用する。

import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  supabaseAdmin,
} from "@/lib/billing/supabaseAdmin";


const VISIBLE_ENTRY_STATUSES = [
  "submitted",
  "confirmed",
  "rejected",
];


function getBearerToken(
  request: NextRequest,
): string | null {
  const authorization =
    request.headers.get("authorization") ?? "";

  const match =
    authorization.match(
      /^Bearer\s+(.+)$/i,
    );

  return match?.[1]?.trim() || null;
}


async function getAuthenticatedUser(
  request: NextRequest,
) {
  const token =
    getBearerToken(request);

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
    await supabaseAdmin.auth.getUser(
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
    String(
      new URL(
        request.url,
      ).searchParams.get(
        "occurrenceId",
      ) ?? "",
    ).trim();


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
    error: occurrenceError,
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


  // =========================================================
  // OWNER CHECK
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
          owner_user_id
        `,
      )
      .eq(
        "id",
        occurrence
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
        status: 404,
      },
    );
  }


  if (
    item.owner_user_id !==
    auth.user.id
  ) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "この開催回の参加者を確認する権限がありません。",
      },
      {
        status: 403,
      },
    );
  }


  // =========================================================
  // CALENDAR APPLICATION
  // =========================================================

  const {
    data: application,
    error: applicationError,
  } =
    await supabaseAdmin
      .from(
        "applications",
      )
      .select(
        `
          id,
          acceptance_mode
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
    console.error(
      "[calendar participants] application load failed:",
      applicationError,
    );

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


  if (!application) {
    return NextResponse.json({
      ok: true,

      occurrence,

      acceptance_mode:
        null,

      reservation_count:
        0,

      participants: [],
    });
  }


  // =========================================================
  // ENTRIES
  // =========================================================

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
          user_id,
          status,
          calendar_recurring_booking_id,
          created_at
        `,
      )
      .eq(
        "calendar_occurrence_id",
        occurrence.id,
      )
      .in(
        "status",
        VISIBLE_ENTRY_STATUSES,
      )
      .order(
        "created_at",
        {
          ascending: true,
        },
      );


  if (entriesError) {
    console.error(
      "[calendar participants] entries load failed:",
      entriesError,
    );

    return NextResponse.json(
      {
        ok: false,
        message:
          "参加者を取得できませんでした。",
      },
      {
        status: 500,
      },
    );
  }


  const safeEntries =
    entries ?? [];


  const userIds =
    Array.from(
      new Set(
        safeEntries
          .map(
            (entry) =>
              String(
                entry.user_id ??
                  "",
              ),
          )
          .filter(Boolean),
      ),
    );


  // =========================================================
  // NAMES
  // =========================================================

  const privateNameMap =
    new Map<
      string,
      string
    >();

  const publicProfileMap =
    new Map<
      string,
      {
        display_name:
          string | null;
        username:
          string | null;
      }
    >();


  if (
    userIds.length >
    0
  ) {
    const {
      data: privateProfiles,
      error: privateProfilesError,
    } =
      await supabaseAdmin
        .from(
          "user_private_profiles",
        )
        .select(
          `
            user_id,
            full_name
          `,
        )
        .in(
          "user_id",
          userIds,
        );


    if (privateProfilesError) {
      console.error(
        "[calendar participants] private profiles load failed:",
        privateProfilesError,
      );
    } else {
      for (
        const profile of
        privateProfiles ?? []
      ) {
        const userId =
          String(
            profile.user_id ??
              "",
          );

        const fullName =
          String(
            profile.full_name ??
              "",
          ).trim();

        if (
          userId &&
          fullName
        ) {
          privateNameMap.set(
            userId,
            fullName,
          );
        }
      }
    }


    const {
      data: publicProfiles,
      error: publicProfilesError,
    } =
      await supabaseAdmin
        .from(
          "profiles",
        )
        .select(
          `
            user_id,
            display_name,
            username
          `,
        )
        .in(
          "user_id",
          userIds,
        );


    if (publicProfilesError) {
      console.error(
        "[calendar participants] public profiles load failed:",
        publicProfilesError,
      );
    } else {
      for (
        const profile of
        publicProfiles ?? []
      ) {
        publicProfileMap.set(
          String(
            profile.user_id,
          ),
          {
            display_name:
              profile.display_name ??
              null,

            username:
              profile.username ??
              null,
          },
        );
      }
    }
  }


  const participants =
    safeEntries.map(
      (entry) => {
        const userId =
          String(
            entry.user_id,
          );

        const publicProfile =
          publicProfileMap.get(
            userId,
          );

        const fullName =
          privateNameMap.get(
            userId,
          ) ??
          null;

        const displayName =
          publicProfile
            ?.display_name ??
          null;

        const username =
          publicProfile
            ?.username ??
          null;


        return {
          entry_id:
            entry.id,

          user_id:
            userId,

          name:
            fullName ||
            displayName ||
            username ||
            "名前未設定",

          full_name:
            fullName,

          display_name:
            displayName,

          username,

          status:
            entry.status,

          auto_booking:
            Boolean(
              entry
                .calendar_recurring_booking_id,
            ),

          created_at:
            entry.created_at,
        };
      },
    );


  return NextResponse.json({
    ok: true,

    occurrence,

    acceptance_mode:
      application
        .acceptance_mode,

    reservation_count:
      participants.length,

    participants,
  });
}
