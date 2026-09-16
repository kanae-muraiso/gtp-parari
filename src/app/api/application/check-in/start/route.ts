// src/app/api/application/check-in/start/route.ts
// 2026-09-17 JST
//
// Starts organizer check-in for one APPLICATION context.
// Manual APPLICATIONs store the timestamp on applications.
// Calendar APPLICATIONs store it on the selected calendar occurrence.
// The operation is idempotent: the first timestamp always wins.

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

export async function POST(
  request: NextRequest,
) {
  const user =
    await getAuthenticatedUser(request);

  if (!user) {
    return NextResponse.json(
      {
        ok: false,
        message: "受付開始にはログインが必要です。",
      },
      { status: 401 },
    );
  }

  const body =
    (await request
      .json()
      .catch(() => null)) as
      | {
          applicationId?: unknown;
          occurrenceId?: unknown;
        }
      | null;

  const applicationId =
    typeof body?.applicationId === "string"
      ? body.applicationId.trim()
      : "";

  const occurrenceId =
    typeof body?.occurrenceId === "string"
      ? body.occurrenceId.trim()
      : "";

  if (!UUID_RE.test(applicationId)) {
    return NextResponse.json(
      {
        ok: false,
        message: "APPLICATIONを確認してください。",
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
        "id, owner_user_id, origin, calendar_item_id, check_in_started_at",
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
            "このAPPLICATIONの受付を開始する権限がありません。",
        },
        { status: 403 },
      );
    }

    const isCalendar =
      application.origin === "calendar";

    if (!isCalendar) {
      if (occurrenceId) {
        return NextResponse.json(
          {
            ok: false,
            message:
              "このAPPLICATIONには開催回の指定は不要です。",
          },
          { status: 400 },
        );
      }

      if (application.check_in_started_at) {
        return NextResponse.json({
          ok: true,
          already_started: true,
          check_in_started_at:
            application.check_in_started_at,
          scope: "application",
          application_id: application.id,
          occurrence_id: null,
        });
      }

      const now = new Date().toISOString();

      const {
        data: updatedApplication,
        error: updateError,
      } = await supabaseAdmin
        .from("applications")
        .update({
          check_in_started_at: now,
        })
        .eq("id", application.id)
        .is("check_in_started_at", null)
        .select("id, check_in_started_at")
        .maybeSingle();

      if (updateError) {
        throw updateError;
      }

      if (updatedApplication?.check_in_started_at) {
        return NextResponse.json({
          ok: true,
          already_started: false,
          check_in_started_at:
            updatedApplication.check_in_started_at,
          scope: "application",
          application_id: application.id,
          occurrence_id: null,
        });
      }

      const {
        data: latestApplication,
        error: latestApplicationError,
      } = await supabaseAdmin
        .from("applications")
        .select("check_in_started_at")
        .eq("id", application.id)
        .maybeSingle();

      if (latestApplicationError) {
        throw latestApplicationError;
      }

      if (latestApplication?.check_in_started_at) {
        return NextResponse.json({
          ok: true,
          already_started: true,
          check_in_started_at:
            latestApplication.check_in_started_at,
          scope: "application",
          application_id: application.id,
          occurrence_id: null,
        });
      }

      throw new Error(
        "APPLICATION check-in start was not persisted",
      );
    }

    if (!UUID_RE.test(occurrenceId)) {
      return NextResponse.json(
        {
          ok: false,
          message: "受付する開催回を選択してください。",
        },
        { status: 400 },
      );
    }

    const {
      data: occurrence,
      error: occurrenceError,
    } = await supabaseAdmin
      .from("calendar_occurrences")
      .select(
        "id, calendar_item_id, check_in_started_at",
      )
      .eq("id", occurrenceId)
      .maybeSingle();

    if (occurrenceError) {
      throw occurrenceError;
    }

    if (
      !occurrence ||
      occurrence.calendar_item_id !==
        application.calendar_item_id
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

    if (occurrence.check_in_started_at) {
      return NextResponse.json({
        ok: true,
        already_started: true,
        check_in_started_at:
          occurrence.check_in_started_at,
        scope: "occurrence",
        application_id: application.id,
        occurrence_id: occurrence.id,
      });
    }

    const now = new Date().toISOString();

    const {
      data: updatedOccurrence,
      error: updateOccurrenceError,
    } = await supabaseAdmin
      .from("calendar_occurrences")
      .update({
        check_in_started_at: now,
      })
      .eq("id", occurrence.id)
      .eq(
        "calendar_item_id",
        application.calendar_item_id,
      )
      .is("check_in_started_at", null)
      .select("id, check_in_started_at")
      .maybeSingle();

    if (updateOccurrenceError) {
      throw updateOccurrenceError;
    }

    if (updatedOccurrence?.check_in_started_at) {
      return NextResponse.json({
        ok: true,
        already_started: false,
        check_in_started_at:
          updatedOccurrence.check_in_started_at,
        scope: "occurrence",
        application_id: application.id,
        occurrence_id: occurrence.id,
      });
    }

    const {
      data: latestOccurrence,
      error: latestOccurrenceError,
    } = await supabaseAdmin
      .from("calendar_occurrences")
      .select("check_in_started_at")
      .eq("id", occurrence.id)
      .maybeSingle();

    if (latestOccurrenceError) {
      throw latestOccurrenceError;
    }

    if (latestOccurrence?.check_in_started_at) {
      return NextResponse.json({
        ok: true,
        already_started: true,
        check_in_started_at:
          latestOccurrence.check_in_started_at,
        scope: "occurrence",
        application_id: application.id,
        occurrence_id: occurrence.id,
      });
    }

    throw new Error(
      "Occurrence check-in start was not persisted",
    );
  } catch (error) {
    console.error(
      "[APPLICATION CHECK-IN START] POST failed:",
      error,
    );

    return NextResponse.json(
      {
        ok: false,
        message: "受付開始を記録できませんでした。",
      },
      { status: 500 },
    );
  }
}
