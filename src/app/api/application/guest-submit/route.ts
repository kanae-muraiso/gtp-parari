// src/app/api/application/guest-submit/route.ts
// 2026-09-15 JST
//
// Public guest adapter for the shared APPLICATION submit service.

import {
  NextRequest,
  NextResponse,
} from "next/server";

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

    const result = await submitApplication({
      applicationId:
        typeof body?.applicationId === "string"
          ? body.applicationId
          : "",
      formSubmissionId:
        typeof body?.formSubmissionId === "string"
          ? body.formSubmissionId
          : "",
      occurrenceId:
        typeof body?.occurrenceId === "string"
          ? body.occurrenceId
          : "",
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
