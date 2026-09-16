import {
  NextRequest,
  NextResponse,
} from "next/server";

import { supabaseAdmin } from "@/lib/billing/supabaseAdmin";

const PASS_CODE_RE = /^[0-9a-f]{16}$/;
const CANCELLATION_TOKEN_RE = /^[0-9a-f]{32}$/;

function normalizeEmail(value: unknown): string {
  return typeof value === "string"
    ? value.trim().toLowerCase()
    : "";
}

export async function POST(request: NextRequest) {
  const body =
    (await request.json().catch(() => null)) as
      | {
          passCode?: unknown;
          email?: unknown;
        }
      | null;

  const passCode =
    typeof body?.passCode === "string"
      ? body.passCode.trim().toLowerCase()
      : "";
  const email = normalizeEmail(body?.email);

  if (!PASS_CODE_RE.test(passCode) || !email) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "参加証と申込時のメールアドレスを確認してください。",
      },
      { status: 400 },
    );
  }

  try {
    const {
      data: entry,
      error,
    } = await supabaseAdmin
      .from("application_entries")
      .select(
        `
          id,
          user_id,
          applicant_email,
          cancellation_token
        `,
      )
      .eq("pass_code", passCode)
      .maybeSingle();

    if (error) {
      throw error;
    }

    const storedEmail = normalizeEmail(
      entry?.applicant_email,
    );
    const cancellationToken =
      typeof entry?.cancellation_token === "string"
        ? entry.cancellation_token.trim().toLowerCase()
        : "";

    if (
      !entry ||
      entry.user_id !== null ||
      storedEmail !== email ||
      !CANCELLATION_TOKEN_RE.test(cancellationToken)
    ) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "参加証と申込時のメールアドレスを確認してください。",
        },
        { status: 404 },
      );
    }

    return NextResponse.json({
      ok: true,
      cancellation_path:
        `/c/${cancellationToken}`,
    });
  } catch (error) {
    console.error(
      "[APPLICATION guest-pass-access] failed:",
      error,
    );

    return NextResponse.json(
      {
        ok: false,
        message:
          "申込情報を確認できませんでした。",
      },
      { status: 500 },
    );
  }
}
