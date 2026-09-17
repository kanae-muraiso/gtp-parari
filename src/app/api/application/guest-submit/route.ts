// src/app/api/application/guest-submit/route.ts
// 2026-09-17 JST
//
// Public guest adapter for the shared APPLICATION submit service.

import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  CHECK_IN_SUBMISSION_CLOSED_MESSAGE,
  inspectApplicationCheckInGate,
} from "@/features/application/server/checkInGate";
import {
  submitApplication,
} from "@/features/application/server/submitApplication";
import {
  sendGuestApplicationConfirmationEmail,
} from "@/features/application/server/sendGuestApplicationConfirmationEmail";

type GuestEntryEmailContext = {
  cancellationMode:
    | "not_allowed"
    | "anytime"
    | "until_deadline";
  cancellationToken: string;
  entryStatus: string;
  title: string;
};

function readGuestEntryEmailContext(
  entry: unknown,
): GuestEntryEmailContext | null {
  if (
    !entry ||
    typeof entry !== "object" ||
    Array.isArray(entry)
  ) {
    return null;
  }

  const row = entry as Record<string, unknown>;
  const snapshot =
    row.application_snapshot &&
    typeof row.application_snapshot === "object" &&
    !Array.isArray(row.application_snapshot)
      ? (row.application_snapshot as Record<string, unknown>)
      : null;
  const cancellationMode = snapshot?.cancellation_mode;
  const cancellationToken =
    typeof row.cancellation_token === "string"
      ? row.cancellation_token.trim().toLowerCase()
      : "";
  const title =
    typeof snapshot?.title === "string"
      ? snapshot.title.trim()
      : "";

  if (
    (cancellationMode !== "not_allowed" &&
      cancellationMode !== "anytime" &&
      cancellationMode !== "until_deadline") ||
    !title
  ) {
    return null;
  }

  return {
    cancellationMode,
    cancellationToken,
    entryStatus:
      typeof row.status === "string"
        ? row.status
        : "submitted",
    title,
  };
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
        ? body.applicationId
        : "";
    const occurrenceId =
      typeof body?.occurrenceId === "string"
        ? body.occurrenceId
        : "";

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

    const result = await submitApplication({
      applicationId,
      formSubmissionId:
        typeof body?.formSubmissionId === "string"
          ? body.formSubmissionId
          : "",
      occurrenceId,
      answers: body?.answers,
      identity: {
        kind: "guest",
        name: body?.applicantName,
        email: body?.applicantEmail,
      },
    });

    if (result.ok === false) {
      return NextResponse.json(
        {
          ok: false,
          message: result.message,
        },
        { status: result.status },
      );
    }

    let emailDelivery:
      | "sent"
      | "failed"
      | "not_applicable" = "not_applicable";
    const emailContext =
      readGuestEntryEmailContext(result.entry);

    if (emailContext) {
      const emailResult =
        await sendGuestApplicationConfirmationEmail({
          applicantEmail: result.guest?.email ?? "",
          applicantName: result.guest?.name ?? "",
          applicationTitle: emailContext.title,
          cancellationToken:
            emailContext.cancellationToken,
          entryStatus: emailContext.entryStatus,
        });

      emailDelivery = emailResult.ok
        ? "sent"
        : "failed";
    }

    return NextResponse.json({
      ok: true,
      entry: result.entry,
      guest: result.guest,
      email_delivery: emailDelivery,
    });
  } catch (error) {
    console.error(
      "POST /api/application/guest-submit failed:",
      error,
    );

    return NextResponse.json(
      {
        ok: false,
        message:
          "お申し込みを完了できませんでした。",
      },
      { status: 500 },
    );
  }
}
