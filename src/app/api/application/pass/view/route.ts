// src/app/api/application/pass/view/route.ts
// 2026-09-17 JST
//
// Public READ ONLY view for an APPLICATION participation pass.
//
// The QR itself is a capability URL intended to be opened by a normal
// phone camera, so this endpoint does not require organizer privileges
// and never performs check-in mutations.

import {
  NextRequest,
  NextResponse,
} from "next/server";

import { supabaseAdmin } from "@/lib/billing/supabaseAdmin";

const PASS_CODE_RE = /^[0-9a-f]{16}$/;

export async function GET(
  request: NextRequest,
) {
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
          checked_in_at,
          calendar_occurrence_id
        `,
      )
      .eq("pass_code", passCode)
      .maybeSingle();

    if (entryError) {
      throw entryError;
    }

    if (!entry) {
      return NextResponse.json(
        {
          ok: false,
          message: "参加証が見つかりません。",
        },
        { status: 404 },
      );
    }

    const {
      data: application,
      error: applicationError,
    } = await supabaseAdmin
      .from("applications")
      .select("id, title")
      .eq("id", entry.application_id)
      .maybeSingle();

    if (applicationError) {
      throw applicationError;
    }

    if (!application) {
      return NextResponse.json(
        {
          ok: false,
          message: "参加証を確認できませんでした。",
        },
        { status: 404 },
      );
    }

    let participantName =
      String(entry.applicant_name ?? "").trim();

    if (!participantName && entry.user_id) {
      const [
        privateProfileResult,
        publicProfileResult,
      ] = await Promise.all([
        supabaseAdmin
          .from("user_private_profiles")
          .select("full_name")
          .eq("user_id", entry.user_id)
          .maybeSingle(),
        supabaseAdmin
          .from("profiles")
          .select("display_name, username")
          .eq("user_id", entry.user_id)
          .maybeSingle(),
      ]);

      if (privateProfileResult.error) {
        console.error(
          "[APPLICATION PASS VIEW] private profile load failed:",
          privateProfileResult.error,
        );
      }

      if (publicProfileResult.error) {
        console.error(
          "[APPLICATION PASS VIEW] public profile load failed:",
          publicProfileResult.error,
        );
      }

      participantName =
        String(
          privateProfileResult.data?.full_name ??
            publicProfileResult.data?.display_name ??
            publicProfileResult.data?.username ??
            "",
        ).trim();
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
          "[APPLICATION PASS VIEW] occurrence load failed:",
          occurrenceError,
        );
      } else if (occurrenceData) {
        occurrence = occurrenceData;
      }
    }

    return NextResponse.json(
      {
        ok: true,
        pass: {
          application_title: application.title,
          participant_name: participantName,
          status: entry.status,
          checked_in_at: entry.checked_in_at,
          occurrence,
          is_guest: entry.user_id === null,
        },
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    console.error(
      "[APPLICATION PASS VIEW] GET failed:",
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
