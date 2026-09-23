// src/app/api/application/claim-guest/route.ts
// 2026-09-15 JST
//
// Claim guest APPLICATION entries after an authenticated Magic Link login.
// The authenticated Supabase user's verified email is the only claim key.
// Existing QR/pass codes remain unchanged because the application entry itself is retained.

import { NextRequest, NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/billing/supabaseAdmin";

type GuestEntryRow = {
  id: string;
  calendar_occurrence_id: string | null;
  form_submission_id: string | null;
};

function getBearerToken(request: NextRequest): string {
  const authorization = request.headers.get("authorization") ?? "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() ?? "";
}

function normalizeEmail(value: unknown): string {
  return typeof value === "string"
    ? value.trim().toLowerCase()
    : "";
}

export async function POST(request: NextRequest) {
  const accessToken = getBearerToken(request);

  if (!accessToken) {
    return NextResponse.json(
      { ok: false, message: "ログイン情報を確認できませんでした。" },
      { status: 401 },
    );
  }

  const {
    data: userData,
    error: userError,
  } = await supabaseAdmin.auth.getUser(accessToken);

  const user = userData.user;

  if (userError || !user) {
    return NextResponse.json(
      { ok: false, message: "ログイン情報を確認できませんでした。" },
      { status: 401 },
    );
  }

  const email = normalizeEmail(user.email);

  // A guest booking must never be claimed merely because an email address was typed.
  // Claim only after Supabase has authenticated/confirmed the address.
  if (!email || !user.email_confirmed_at) {
    return NextResponse.json(
      { ok: false, message: "メールアドレスの本人確認が完了していません。" },
      { status: 403 },
    );
  }

  const {
    data: guestEntriesData,
    error: guestEntriesError,
  } = await supabaseAdmin
    .from("application_entries")
    .select("id, calendar_occurrence_id, form_submission_id")
    .is("user_id", null)
    .eq("applicant_email", email)
    .order("created_at", { ascending: true });

  if (guestEntriesError) {
    console.error("claim guest applications: load failed", guestEntriesError);
    return NextResponse.json(
      { ok: false, message: "過去の参加履歴を確認できませんでした。" },
      { status: 500 },
    );
  }

  const guestEntries = (guestEntriesData ?? []) as GuestEntryRow[];

  let claimed = 0;
  let conflicts = 0;
  let formSubmissionsClaimed = 0;
  const failedEntryIds: string[] = [];

  for (const entry of guestEntries) {
    const {
      data: updatedRows,
      error: updateError,
    } = await supabaseAdmin
      .from("application_entries")
      .update({
        user_id: user.id,
        applicant_email_verified_at:
          new Date().toISOString(),
      })
      .eq("id", entry.id)
      .is("user_id", null)
      .select("id");

    if (updateError) {
      // A user may already have a member booking for the same occurrence.
      // Keep the guest entry untouched instead of violating the existing unique guard.
      if (updateError.code === "23505") {
        conflicts += 1;
        continue;
      }

      console.error(
        "claim guest applications: update failed",
        entry.id,
        updateError,
      );
      failedEntryIds.push(entry.id);
      continue;
    }

    if (!updatedRows || updatedRows.length === 0) {
      continue;
    }

    claimed += 1;

    if (entry.form_submission_id) {
      const {
        data: updatedFormRows,
        error: formUpdateError,
      } = await supabaseAdmin
        .from("form_submissions")
        .update({ user_id: user.id })
        .eq("id", entry.form_submission_id)
        .is("user_id", null)
        .select("id");

      if (formUpdateError) {
        console.error(
          "claim guest applications: form claim failed",
          entry.form_submission_id,
          formUpdateError,
        );
      } else if (updatedFormRows && updatedFormRows.length > 0) {
        formSubmissionsClaimed += 1;
      }
    }
  }

  return NextResponse.json({
    ok: failedEntryIds.length === 0,
    claimed,
    conflicts,
    formSubmissionsClaimed,
    failed: failedEntryIds.length,
  });
}
