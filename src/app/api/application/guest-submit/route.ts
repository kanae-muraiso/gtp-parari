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

    return NextResponse.json({
      ok: true,
      entry: result.entry,
      guest: result.guest,
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
