// src/app/api/application/check-in/roster/route.ts
// 2026-09-17 JST
//
// Organizer-only CHECK-IN roster preload endpoint.
// Returns only the minimum participant data needed for local QR matching.

import {
  NextRequest,
  NextResponse,
} from "next/server";

import { supabaseAdmin } from "@/lib/billing/supabaseAdmin";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function getBearerToken(
  request: NextRequest,
): string | null {
  const authorization =
    request.headers.get("authorization") ?? "";

  const match =
    authorization.match(/^Bearer\s+(.+)$/i);

  return match?.[1]?.trim() || null;
}

async function getAuthenticatedUser(
  request: NextRequest,
) {
  const token = getBearerToken(request);

  if (!token) {
    return null;
  }

  const {
    data: { user },
    error,
  } = await supabaseAdmin.auth.getUser(token);

  if (error || !user) {
    return null;
  }

  return user;
}

export async function GET(
  request: NextRequest,
) {
  const user =
    await getAuthenticatedUser(request);

  if (!user) {
    return NextResponse.json(
      {
        ok: false,
        message: "受付にはログインが必要です。",
      },
      { status: 401 },
    );
  }

  const applicationId =
    request.nextUrl.searchParams
      .get("applicationId")
      ?.trim() ?? "";

  const occurrenceId =
    request.nextUrl.searchParams
      .get("occurrenceId")
      ?.trim() ?? "";

  if (!UUID_RE.test(applicationId)) {
    return NextResponse.json(
      {
        ok: false,
        message: "APPLICATIONが指定されていません。",
      },
      { status: 400 },
    );
  }

  if (occurrenceId && !UUID_RE.test(occurrenceId)) {
    return NextResponse.json(
      {
        ok: false,
        message: "開催回を確認してください。",
      },
      { status: 400 },
    );
  }

  try {
    const {
      data: application,
      error: applicationError,
    } = await supabaseAdmin
      .from("applications")
      .select(
        "id, owner_user_id, title, origin, calendar_item_id",
      )
      .eq("id", applicationId)
      .maybeSingle();

    if (applicationError) {
      throw applicationError;
    }

    if (!application) {
      return NextResponse.json(
        {
          ok: false,
          message: "APPLICATIONが見つかりません。",
        },
        { status: 404 },
      );
    }

    if (application.owner_user_id !== user.id) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "このAPPLICATIONを受付する権限がありません。",
        },
        { status: 403 },
      );
    }

    const isCalendar =
      application.origin === "calendar";

    if (isCalendar && !occurrenceId) {
      return NextResponse.json(
        {
          ok: false,
          message: "受付する開催回を選択してください。",
        },
        { status: 400 },
      );
    }

    if (isCalendar && occurrenceId) {
      const {
        data: occurrence,
        error: occurrenceError,
      } = await supabaseAdmin
        .from("calendar_occurrences")
        .select("id, calendar_item_id")
        .eq("id", occurrenceId)
        .maybeSingle();

      if (occurrenceError) {
        throw occurrenceError;
      }

      if (
        !occurrence ||
        occurrence.calendar_item_id !== application.calendar_item_id
      ) {
        return NextResponse.json(
          {
            ok: false,
            message:
              "このAPPLICATIONの開催回を確認できませんでした。",
          },
          { status: 404 },
        );
      }
    }

    let entriesQuery =
      supabaseAdmin
        .from("application_entries")
        .select(
          `
            id,
            user_id,
            applicant_name,
            status,
            payment_status,
            pass_code,
            checked_in_at,
            calendar_occurrence_id,
            created_at
          `,
        )
        .eq("application_id", applicationId)
        .order("created_at", {
          ascending: true,
        });

    if (isCalendar && occurrenceId) {
      entriesQuery =
        entriesQuery.eq(
          "calendar_occurrence_id",
          occurrenceId,
        );
    }

    const {
      data: entries,
      error: entriesError,
    } = await entriesQuery;

    if (entriesError) {
      throw entriesError;
    }

    const rows = entries ?? [];

    const userIds =
      Array.from(
        new Set(
          rows
            .map((entry) =>
              typeof entry.user_id === "string"
                ? entry.user_id
                : "",
            )
            .filter(Boolean),
        ),
      );

    const privateNameMap =
      new Map<string, string>();

    const publicNameMap =
      new Map<string, string>();

    if (userIds.length > 0) {
      const [
        privateProfilesResult,
        publicProfilesResult,
      ] = await Promise.all([
        supabaseAdmin
          .from("user_private_profiles")
          .select("user_id, full_name")
          .in("user_id", userIds),
        supabaseAdmin
          .from("profiles")
          .select("user_id, display_name, username")
          .in("user_id", userIds),
      ]);

      if (privateProfilesResult.error) {
        console.error(
          "[APPLICATION CHECK-IN ROSTER] private profile load failed:",
          privateProfilesResult.error,
        );
      } else {
        for (const profile of privateProfilesResult.data ?? []) {
          const name =
            String(profile.full_name ?? "").trim();

          if (profile.user_id && name) {
            privateNameMap.set(
              String(profile.user_id),
              name,
            );
          }
        }
      }

      if (publicProfilesResult.error) {
        console.error(
          "[APPLICATION CHECK-IN ROSTER] public profile load failed:",
          publicProfilesResult.error,
        );
      } else {
        for (const profile of publicProfilesResult.data ?? []) {
          const name =
            String(
              profile.display_name ??
                profile.username ??
                "",
            ).trim();

          if (profile.user_id && name) {
            publicNameMap.set(
              String(profile.user_id),
              name,
            );
          }
        }
      }
    }

    const roster = rows.map((entry) => {
      const userId =
        typeof entry.user_id === "string"
          ? entry.user_id
          : "";

      const participantName =
        String(entry.applicant_name ?? "").trim() ||
        (userId
          ? privateNameMap.get(userId) ||
            publicNameMap.get(userId) ||
            ""
          : "") ||
        "参加者";

      return {
        entry_id: entry.id,
        pass_code: entry.pass_code,
        name: participantName,
        status: entry.status,
        payment_status: entry.payment_status,
        checked_in_at: entry.checked_in_at,
      };
    });

    return NextResponse.json({
      ok: true,
      application: {
        id: application.id,
        title: application.title,
        origin: application.origin,
      },
      occurrence_id:
        isCalendar ? occurrenceId : null,
      roster,
    });
  } catch (error) {
    console.error(
      "[APPLICATION CHECK-IN ROSTER] GET failed:",
      error,
    );

    return NextResponse.json(
      {
        ok: false,
        message: "受付名簿を取得できませんでした。",
      },
      { status: 500 },
    );
  }
}
