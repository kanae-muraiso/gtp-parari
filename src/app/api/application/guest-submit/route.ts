// src/app/api/application/guest-submit/route.ts
// Guest APPLICATION starts as a short-lived verification request.
// The real application_entry is created only after the email link is opened.

import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  CHECK_IN_SUBMISSION_CLOSED_MESSAGE,
  inspectApplicationCheckInGate,
} from "@/features/application/server/checkInGate";
import {
  createGuestApplicationVerificationToken,
} from "@/features/application/server/guestEmailVerification";
import {
  sendGuestApplicationVerificationEmail,
} from "@/features/application/server/sendGuestApplicationVerificationEmail";
import {
  hasMembershipBlock,
  isValidGuestEmail,
  normalizeGuestEmail,
  normalizeGuestName,
  UUID_RE,
  type ApplicationDefinition,
} from "@/features/application/server/submissionDefinition";
import { supabaseAdmin } from "@/lib/billing/supabaseAdmin";

const RESEND_COOLDOWN_MS = 60_000;

type ApplicationRow = {
  id: string;
  title: string;
  status: "draft" | "open" | "closed";
  definition: ApplicationDefinition | null;
};

function optionalUuid(
  value: unknown,
): string {
  return typeof value === "string"
    ? value.trim()
    : "";
}

export async function POST(
  request: NextRequest,
) {
  try {
    const body =
      (await request
        .json()
        .catch(() => null)) as
        | {
            applicationId?: unknown;
            applicantName?: unknown;
            applicantEmail?: unknown;
            formSubmissionId?: unknown;
            occurrenceId?: unknown;
            answers?: unknown;
          }
        | null;

    const applicationId =
      typeof body?.applicationId === "string"
        ? body.applicationId.trim()
        : "";
    const applicantName =
      normalizeGuestName(
        body?.applicantName,
      );
    const applicantEmail =
      normalizeGuestEmail(
        body?.applicantEmail,
      );
    const formSubmissionId =
      optionalUuid(
        body?.formSubmissionId,
      );
    const occurrenceId =
      optionalUuid(
        body?.occurrenceId,
      );

    if (!UUID_RE.test(applicationId)) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "APPLICATIONが指定されていません。",
        },
        { status: 400 },
      );
    }

    if (
      !applicantName ||
      applicantName.length > 120
    ) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "お名前を入力してください。",
        },
        { status: 400 },
      );
    }

    if (
      !isValidGuestEmail(
        applicantEmail,
      )
    ) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "メールアドレスを確認してください。",
        },
        { status: 400 },
      );
    }

    if (
      formSubmissionId &&
      !UUID_RE.test(formSubmissionId)
    ) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "FORM回答を確認できませんでした。",
        },
        { status: 400 },
      );
    }

    if (
      occurrenceId &&
      !UUID_RE.test(occurrenceId)
    ) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "開催回を確認できませんでした。",
        },
        { status: 400 },
      );
    }

    const {
      data: applicationData,
      error: applicationError,
    } = await supabaseAdmin
      .from("applications")
      .select(
        "id,title,status,definition",
      )
      .eq("id", applicationId)
      .maybeSingle();

    if (
      applicationError ||
      !applicationData
    ) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "募集情報を確認できませんでした。",
        },
        {
          status:
            applicationError
              ? 500
              : 404,
        },
      );
    }

    const application =
      applicationData as ApplicationRow;

    if (application.status !== "open") {
      return NextResponse.json(
        {
          ok: false,
          message:
            "現在、この募集は受付していません。",
        },
        { status: 400 },
      );
    }

    if (
      hasMembershipBlock(
        application.definition,
      )
    ) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "この募集はPARARIメンバー向けです。ログインしてお申し込みください。",
        },
        { status: 403 },
      );
    }

    const checkInGate =
      await inspectApplicationCheckInGate({
        applicationId,
        occurrenceId,
      });

    if (checkInGate.closed) {
      return NextResponse.json(
        {
          ok: false,
          message:
            CHECK_IN_SUBMISSION_CLOSED_MESSAGE,
        },
        { status: 409 },
      );
    }

    const answers =
      body?.answers &&
      typeof body.answers === "object" &&
      !Array.isArray(body.answers)
        ? body.answers
        : {};

    const cooldownCutoff =
      new Date(
        Date.now() -
          RESEND_COOLDOWN_MS,
      ).toISOString();

    let cooldownQuery =
      supabaseAdmin
        .from(
          "application_guest_verifications",
        )
        .select("id,created_at")
        .eq(
          "application_id",
          applicationId,
        )
        .eq(
          "applicant_email",
          applicantEmail,
        )
        .gte(
          "created_at",
          cooldownCutoff,
        );

    cooldownQuery =
      occurrenceId
        ? cooldownQuery.eq(
            "calendar_occurrence_id",
            occurrenceId,
          )
        : cooldownQuery.is(
            "calendar_occurrence_id",
            null,
          );

    const {
      data: recentRequest,
      error: cooldownError,
    } =
      await cooldownQuery
        .order(
          "created_at",
          {
            ascending: false,
          },
        )
        .limit(1)
        .maybeSingle();

    if (cooldownError) {
      console.error(
        "[APPLICATION guest verification] cooldown check failed:",
        cooldownError,
      );

      return NextResponse.json(
        {
          ok: false,
          message:
            "確認メールの送信準備に失敗しました。",
        },
        { status: 500 },
      );
    }

    if (recentRequest) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "確認メールは送信済みです。1分ほど待ってから再度お試しください。",
        },
        { status: 429 },
      );
    }

    let staleQuery =
      supabaseAdmin
        .from(
          "application_guest_verifications",
        )
        .delete()
        .eq(
          "application_id",
          applicationId,
        )
        .eq(
          "applicant_email",
          applicantEmail,
        );

    staleQuery =
      occurrenceId
        ? staleQuery.eq(
            "calendar_occurrence_id",
            occurrenceId,
          )
        : staleQuery.is(
            "calendar_occurrence_id",
            null,
          );

    const {
      error: staleDeleteError,
    } =
      await staleQuery;

    if (staleDeleteError) {
      console.error(
        "[APPLICATION guest verification] stale request cleanup failed:",
        staleDeleteError,
      );

      return NextResponse.json(
        {
          ok: false,
          message:
            "確認メールの送信準備に失敗しました。",
        },
        { status: 500 },
      );
    }

    const verification =
      createGuestApplicationVerificationToken();

    const {
      data: pending,
      error: pendingError,
    } = await supabaseAdmin
      .from(
        "application_guest_verifications",
      )
      .insert({
        application_id:
          applicationId,
        applicant_name:
          applicantName,
        applicant_email:
          applicantEmail,
        form_submission_id:
          formSubmissionId ||
          null,
        calendar_occurrence_id:
          occurrenceId ||
          null,
        answers,
        token_hash:
          verification.tokenHash,
        expires_at:
          verification.expiresAt,
      })
      .select("id")
      .single();

    if (
      pendingError ||
      !pending
    ) {
      console.error(
        "[APPLICATION guest verification] pending insert failed:",
        pendingError,
      );

      return NextResponse.json(
        {
          ok: false,
          message:
            "確認メールの送信準備に失敗しました。",
        },
        { status: 500 },
      );
    }

    const emailResult =
      await sendGuestApplicationVerificationEmail({
        applicantEmail,
        applicantName,
        applicationTitle:
          application.title,
        verificationToken:
          verification.token,
      });

    if (!emailResult.ok) {
      await supabaseAdmin
        .from(
          "application_guest_verifications",
        )
        .delete()
        .eq("id", pending.id);

      return NextResponse.json(
        {
          ok: false,
          message:
            "確認メールを送信できませんでした。時間をおいて、もう一度お試しください。",
        },
        { status: 503 },
      );
    }

    return NextResponse.json(
      {
        ok: true,
        verification_required:
          true,
        email_delivery:
          "sent",
      },
      { status: 202 },
    );
  } catch (error) {
    console.error(
      "POST /api/application/guest-submit failed:",
      error,
    );

    return NextResponse.json(
      {
        ok: false,
        message:
          "お申し込みを開始できませんでした。",
      },
      { status: 500 },
    );
  }
}
