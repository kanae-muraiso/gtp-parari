// src/app/api/application/my-passes/route.ts
// 2026-09-15 JST
//
// Authenticated list of confirmed APPLICATION participation passes.
// Guest applications become visible here automatically after claim fills user_id.

import { NextRequest, NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/billing/supabaseAdmin";
import {
  isApplicationPassEnabledFromDefinition,
} from "@/features/application/domain/pass";

type JsonRecord = Record<string, unknown>;

function getBearerToken(request: NextRequest): string | null {
  const authorization = request.headers.get("authorization") ?? "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}

function asRecord(value: unknown): JsonRecord | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as JsonRecord;
}

export async function GET(request: NextRequest) {
  const token = getBearerToken(request);

  if (!token) {
    return NextResponse.json(
      { ok: false, message: "ログインが必要です。" },
      { status: 401 },
    );
  }

  const {
    data: { user },
    error: userError,
  } = await supabaseAdmin.auth.getUser(token);

  if (userError || !user) {
    return NextResponse.json(
      { ok: false, message: "ログイン情報を確認できませんでした。" },
      { status: 401 },
    );
  }

  const {
    data: entries,
    error: entriesError,
  } = await supabaseAdmin
    .from("application_entries")
    .select(
      "id, application_id, calendar_occurrence_id, application_snapshot, applicant_name, checked_in_at, created_at",
    )
    .eq("user_id", user.id)
    .eq("status", "confirmed")
    .order("created_at", { ascending: false });

  if (entriesError) {
    console.error("[MY PASSES] entries load failed:", entriesError);
    return NextResponse.json(
      { ok: false, message: "参加証を取得できませんでした。" },
      { status: 500 },
    );
  }


  const applicationIds = Array.from(
    new Set(
      (entries ?? [])
        .map((entry) => entry.application_id)
        .filter(Boolean),
    ),
  );

  const passEnabledByApplicationId =
    new Map<string, boolean>();

  if (applicationIds.length > 0) {
    const {
      data: applications,
      error: applicationsError,
    } = await supabaseAdmin
      .from("applications")
      .select("id,definition")
      .in("id", applicationIds);

    if (applicationsError) {
      console.error(
        "[MY PASSES] applications load failed:",
        applicationsError,
      );

      return NextResponse.json(
        {
          ok: false,
          message:
            "参加証を取得できませんでした。",
        },
        { status: 500 },
      );
    }

    for (
      const application of
      applications ?? []
    ) {
      passEnabledByApplicationId.set(
        application.id,
        isApplicationPassEnabledFromDefinition(
          application.definition,
        ),
      );
    }
  }

  const passEntries =
    (entries ?? []).filter(
      (entry) =>
        passEnabledByApplicationId.get(
          entry.application_id,
        ) ??
        isApplicationPassEnabledFromDefinition(
          asRecord(
            entry.application_snapshot,
          )?.definition,
        ),
    );

  if (
    request.nextUrl.searchParams.get(
      "summary",
    ) === "1"
  ) {
    return NextResponse.json({
      ok: true,
      hasPasses:
        passEntries.length > 0,
    });
  }

  const occurrenceIds = Array.from(
    new Set(
      passEntries
        .map((entry) => entry.calendar_occurrence_id)
        .filter((id): id is string => typeof id === "string" && Boolean(id)),
    ),
  );

  const occurrenceById = new Map<
    string,
    {
      starts_at: string;
      ends_at: string | null;
      timezone: string;
      title: string;
      location: string | null;
    }
  >();

  if (occurrenceIds.length > 0) {
    const {
      data: occurrences,
      error: occurrencesError,
    } = await supabaseAdmin
      .from("calendar_occurrences")
      .select("id, starts_at, ends_at, timezone, title, location")
      .in("id", occurrenceIds);

    if (occurrencesError) {
      console.error("[MY PASSES] occurrences load failed:", occurrencesError);
    } else {
      for (const occurrence of occurrences ?? []) {
        occurrenceById.set(occurrence.id, occurrence);
      }
    }
  }

  const passes = passEntries.map((entry) => {
    const snapshot = asRecord(entry.application_snapshot) ?? {};
    const occurrence = entry.calendar_occurrence_id
      ? occurrenceById.get(entry.calendar_occurrence_id) ?? null
      : null;

    const snapshotTitle =
      typeof snapshot.title === "string" ? snapshot.title.trim() : "";

    return {
      entry_id: entry.id,
      application_id: entry.application_id,
      title: snapshotTitle || occurrence?.title || "参加証",
      participant_name:
        typeof entry.applicant_name === "string"
          ? entry.applicant_name.trim()
          : "",
      starts_at: occurrence?.starts_at ?? null,
      ends_at: occurrence?.ends_at ?? null,
      timezone: occurrence?.timezone ?? null,
      location: occurrence?.location ?? null,
      checked_in_at: entry.checked_in_at,
      created_at: entry.created_at,
    };
  });

  return NextResponse.json({
    ok: true,
    passes,
  });
}
