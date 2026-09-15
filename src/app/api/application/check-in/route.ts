// src/app/api/application/check-in/route.ts
// 2026-09-15 JST

import {
  NextRequest,
  NextResponse,
} from "next/server";

import { supabaseAdmin } from "@/lib/billing/supabaseAdmin";

const PASS_CODE_RE = /^[0-9a-f]{16}$/;

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

async function loadAuthorizedPass(
  passCode: string,
  userId: string,
) {
  const {
    data: entry,
    error: entryError,
  } = await supabaseAdmin
    .from("application_entries")
    .select(
      `
        id,
        application_id,
        user_id,
        applicant_name,
        status,
        pass_code,
        checked_in_at,
        checked_in_by,
        calendar_occurrence_id,
        created_at
      `,
    )
    .eq("pass_code", passCode)
    .maybeSingle();

  if (entryError) {
    throw entryError;
  }

  if (!entry) {
    return {
      kind: "not_found" as const,
    };
  }

  const {
    data: application,
    error: applicationError,
  } = await supabaseAdmin
    .from("applications")
    .select("id, owner_user_id, title")
    .eq("id", entry.application_id)
    .maybeSingle();

  if (applicationError) {
    throw applicationError;
  }

  if (!application) {
    return {
      kind: "not_found" as const,
    };
  }

  if (application.owner_user_id !== userId) {
    return {
      kind: "forbidden" as const,
    };
  }

  let participantName =
    String(entry.applicant_name ?? "").trim();

  if (!participantName && entry.user_id) {
    const {
      data: profile,
      error: profileError,
    } = await supabaseAdmin
      .from("profiles")
      .select("display_name, username")
      .eq("user_id", entry.user_id)
      .maybeSingle();

    if (profileError) {
      console.error(
        "[APPLICATION CHECK-IN] profile load failed:",
        profileError,
      );
    } else if (profile) {
      participantName =
        String(
          profile.display_name ??
            profile.username ??
            "",
        ).trim();
    }
  }

  if (!participantName) {
    participantName = "参加者";
  }

  let occurrence:
    | {
        id: string;
        starts_at: string;
        ends_at: string;
        timezone: string;
        title: string | null;
        location: string | null;
      }
    | null = null;

  if (entry.calendar_occurrence_id) {
    const {
      data: occurrenceData,
      error: occurrenceError,
    } = await supabaseAdmin
      .from("calendar_occurrences")
      .select(
        "id, starts_at, ends_at, timezone, title, location",
      )
      .eq("id", entry.calendar_occurrence_id)
      .maybeSingle();

    if (occurrenceError) {
      console.error(
        "[APPLICATION CHECK-IN] occurrence load failed:",
        occurrenceError,
      );
    } else if (occurrenceData) {
      occurrence = occurrenceData;
    }
  }

  return {
    kind: "ok" as const,
    entry,
    application,
    participantName,
    occurrence,
  };
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

  const passCode =
    request.nextUrl.searchParams
      .get("passCode")
      ?.trim()
      .toLowerCase() ?? "";

  if (!PASS_CODE_RE.test(passCode)) {
    return NextResponse.json(
      {
        ok: false,
        message: "参加証コードを確認してください。",
      },
      { status: 400 },
    );
  }

  try {
    const result =
      await loadAuthorizedPass(
        passCode,
        user.id,
      );

    if (result.kind === "not_found") {
      return NextResponse.json(
        {
          ok: false,
          message: "参加証が見つかりません。",
        },
        { status: 404 },
      );
    }

    if (result.kind === "forbidden") {
      return NextResponse.json(
        {
          ok: false,
          message:
            "この参加証を受付する権限がありません。",
        },
        { status: 403 },
      );
    }

    return NextResponse.json({
      ok: true,
      pass: {
        application_title:
          result.application.title,
        participant_name:
          result.participantName,
        status: result.entry.status,
        checked_in_at:
          result.entry.checked_in_at,
        occurrence: result.occurrence,
      },
    });
  } catch (error) {
    console.error(
      "[APPLICATION CHECK-IN] GET failed:",
      error,
    );

    return NextResponse.json(
      {
        ok: false,
        message: "参加証を確認できませんでした。",
      },
      { status: 500 },
    );
  }
}

export async function POST(
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

  const body =
    (await request
      .json()
      .catch(() => null)) as
      | {
          passCode?: unknown;
        }
      | null;

  const passCode =
    typeof body?.passCode === "string"
      ? body.passCode.trim().toLowerCase()
      : "";

  if (!PASS_CODE_RE.test(passCode)) {
    return NextResponse.json(
      {
        ok: false,
        message: "参加証コードを確認してください。",
      },
      { status: 400 },
    );
  }

  try {
    const result =
      await loadAuthorizedPass(
        passCode,
        user.id,
      );

    if (result.kind === "not_found") {
      return NextResponse.json(
        {
          ok: false,
          message: "参加証が見つかりません。",
        },
        { status: 404 },
      );
    }

    if (result.kind === "forbidden") {
      return NextResponse.json(
        {
          ok: false,
          message:
            "この参加証を受付する権限がありません。",
        },
        { status: 403 },
      );
    }

    if (result.entry.status !== "confirmed") {
      return NextResponse.json(
        {
          ok: false,
          message:
            "この申し込みはまだ参加確定していません。",
        },
        { status: 409 },
      );
    }

    if (result.entry.checked_in_at) {
      return NextResponse.json({
        ok: true,
        already_checked_in: true,
        checked_in_at:
          result.entry.checked_in_at,
      });
    }

    const now = new Date().toISOString();

    const {
      data: updated,
      error: updateError,
    } = await supabaseAdmin
      .from("application_entries")
      .update({
        checked_in_at: now,
        checked_in_by: user.id,
      })
      .eq("id", result.entry.id)
      .eq("status", "confirmed")
      .is("checked_in_at", null)
      .select("checked_in_at")
      .maybeSingle();

    if (updateError) {
      throw updateError;
    }

    if (!updated) {
      const {
        data: latest,
        error: latestError,
      } = await supabaseAdmin
        .from("application_entries")
        .select("status, checked_in_at")
        .eq("id", result.entry.id)
        .maybeSingle();

      if (latestError) {
        throw latestError;
      }

      if (latest?.checked_in_at) {
        return NextResponse.json({
          ok: true,
          already_checked_in: true,
          checked_in_at:
            latest.checked_in_at,
        });
      }

      return NextResponse.json(
        {
          ok: false,
          message:
            latest?.status === "cancelled" ||
            latest?.status === "withdrawn"
              ? "この申込はキャンセル済みのため受付できません。"
              : "申込状態が変更されたため、もう一度参加証を確認してください。",
        },
        { status: 409 },
      );
    }

    return NextResponse.json({
      ok: true,
      already_checked_in: false,
      checked_in_at:
        updated.checked_in_at,
    });
  } catch (error) {
    console.error(
      "[APPLICATION CHECK-IN] POST failed:",
      error,
    );

    return NextResponse.json(
      {
        ok: false,
        message: "受付を完了できませんでした。",
      },
      { status: 500 },
    );
  }
}
