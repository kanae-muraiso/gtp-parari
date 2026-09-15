// src/app/api/application/submit/route.ts
// 2026-09-15 JST
//
// Authenticated member adapter for the shared APPLICATION submit service.

import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  submitApplication,
} from "@/features/application/server/submitApplication";
import { supabaseAdmin } from "@/lib/billing/supabaseAdmin";

function getBearerToken(
  request: NextRequest,
): string | null {
  const authorization =
    request.headers.get("authorization") ?? "";
  const match = authorization.match(
    /^Bearer\s+(.+)$/i,
  );

  return match?.[1]?.trim() || null;
}

export async function POST(
  request: NextRequest,
) {
  try {
    const token = getBearerToken(request);

    if (!token) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "お申し込みにはログインが必要です。",
        },
        { status: 401 },
      );
    }

    const {
      data: { user },
      error: userError,
    } = await supabaseAdmin.auth.getUser(token);

    if (userError || !user) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "ログイン情報を確認できませんでした。",
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
        kind: "member",
        userId: user.id,
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
    });
  } catch (error) {
    console.error(
      "POST /api/application/submit failed:",
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
