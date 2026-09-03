import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  supabaseAdmin,
} from "@/lib/billing/supabaseAdmin";


const UUID_RE =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;


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
    data: authData,
    error: authError,
  } =
    await supabaseAdmin.auth
      .getUser(
        token,
      );

  const user =
    authData.user;

  if (
    authError ||
    !user
  ) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "ログイン状態を確認できませんでした。",
      },
      {
        status: 401,
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
    error: occurrenceError,
  } =
    await supabaseAdmin
      .from(
        "calendar_occurrences",
      )
      .select(
        `
          id,
          calendar_item_id
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
          kind
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
          "クラス・イベントを確認できませんでした。",
      },
      {
        status:
          itemError
            ? 500
            : 404,
      },
    );
  }

  if (
    item.owner_user_id !==
    user.id
  ) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "この開催回の参加状況を見る権限がありません。",
      },
      {
        status: 403,
      },
    );
  }

  if (
    item.kind ===
    "personal"
  ) {
    return NextResponse.json({
      ok: true,
      participation:
        null,
    });
  }


  const {
    data: entryRows,
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
          user_id,
          status,
          created_at
        `,
      )
      .eq(
        "calendar_occurrence_id",
        occurrenceId,
      )
      .in(
        "status",
        [
          "submitted",
          "confirmed",
        ],
      )
      .order(
        "created_at",
        {
          ascending: true,
        },
      );

  if (entriesError) {
    console.error(
      "[application/occurrence-participants] entries load failed:",
      entriesError,
    );

    return NextResponse.json(
      {
        ok: false,
        message:
          "参加状況を取得できませんでした。",
      },
      {
        status: 500,
      },
    );
  }

  const entries =
    entryRows ?? [];

  const applicationIds =
    Array.from(
      new Set(
        entries
          .map(
            (entry) =>
              entry.application_id,
          )
          .filter(
            (
              value,
            ): value is string =>
              typeof value ===
                "string" &&
              value.length > 0,
          ),
      ),
    );

  const ownedApplicationIds =
    new Set<string>();

  const approvalApplicationIds =
    new Set<string>();

  if (
    applicationIds.length >
    0
  ) {
    const {
      data: applications,
      error: applicationsError,
    } =
      await supabaseAdmin
        .from(
          "applications",
        )
        .select(
          `
            id,
            owner_user_id,
            acceptance_mode
          `,
        )
        .in(
          "id",
          applicationIds,
        );

    if (
      applicationsError
    ) {
      console.error(
        "[application/occurrence-participants] applications load failed:",
        applicationsError,
      );

      return NextResponse.json(
        {
          ok: false,
          message:
            "参加受付情報を確認できませんでした。",
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
      if (
        application.owner_user_id ===
        user.id
      ) {
        ownedApplicationIds.add(
          application.id,
        );

        if (
          application.acceptance_mode ===
          "approval"
        ) {
          approvalApplicationIds.add(
            application.id,
          );
        }
      }
    }
  }

  const ownedEntries =
    entries.filter(
      (entry) =>
        ownedApplicationIds.has(
          entry.application_id,
        ),
    );

  const confirmedEntries =
    ownedEntries.filter(
      (entry) =>
        entry.status ===
        "confirmed",
    );

  const submittedEntries =
    ownedEntries.filter(
      (entry) =>
        entry.status ===
          "submitted" &&
        approvalApplicationIds.has(
          entry.application_id,
        ),
    );

  const participantUserIds =
    Array.from(
      new Set(
        confirmedEntries
          .map(
            (entry) =>
              entry.user_id,
          )
          .filter(
            (
              value,
            ): value is string =>
              typeof value ===
                "string" &&
              value.length > 0,
          ),
      ),
    );

  const profileMap =
    new Map<
      string,
      {
        username:
          | string
          | null;
        display_name:
          | string
          | null;
      }
    >();

  if (
    participantUserIds.length >
    0
  ) {
    const {
      data: profiles,
      error: profilesError,
    } =
      await supabaseAdmin
        .from(
          "profiles",
        )
        .select(
          `
            user_id,
            username,
            display_name
          `,
        )
        .in(
          "user_id",
          participantUserIds,
        );

    if (profilesError) {
      console.error(
        "[application/occurrence-participants] profiles load failed:",
        profilesError,
      );
    } else {
      for (
        const profile of
        profiles ?? []
      ) {
        profileMap.set(
          profile.user_id,
          {
            username:
              profile.username ??
              null,
            display_name:
              profile.display_name ??
              null,
          },
        );
      }
    }
  }

  const participants =
    confirmedEntries.map(
      (entry) => {
        const profile =
          entry.user_id
            ? profileMap.get(
                entry.user_id,
              )
            : undefined;

        return {
          entry_id:
            entry.id,

          application_id:
            entry.application_id,

          user_id:
            entry.user_id,

          username:
            profile?.username ??
            null,

          display_name:
            profile
              ?.display_name ??
            null,
        };
      },
    );

  return NextResponse.json({
    ok: true,

    participation: {
      confirmed_count:
        confirmedEntries.length,

      approval_required:
        approvalApplicationIds.size >
        0,

      submitted_count:
        submittedEntries.length,

      participants,
    },
  });
}
