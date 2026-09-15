// src/app/api/application/pass/route.ts
// 2026-09-15 JST

import {
  NextRequest,
  NextResponse,
} from "next/server";

import { supabaseAdmin } from "@/lib/billing/supabaseAdmin";

const UUID_RE =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

export async function GET(
  request: NextRequest,
) {
  const entryId =
    request.nextUrl.searchParams
      .get("entryId")
      ?.trim() ?? "";

  if (!UUID_RE.test(entryId)) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "参加証を確認できませんでした。",
      },
      { status: 400 },
    );
  }

  const {
    data: entry,
    error,
  } = await supabaseAdmin
    .from("application_entries")
    .select("id, status, pass_code")
    .eq("id", entryId)
    .maybeSingle();

  if (error) {
    console.error(
      "[APPLICATION PASS] load failed:",
      error,
    );

    return NextResponse.json(
      {
        ok: false,
        message:
          "参加証を確認できませんでした。",
      },
      { status: 500 },
    );
  }

  if (!entry) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "参加証が見つかりません。",
      },
      { status: 404 },
    );
  }

  if (entry.status !== "confirmed") {
    return NextResponse.json(
      {
        ok: false,
        message:
          "参加が確定すると参加証が表示されます。",
      },
      { status: 409 },
    );
  }

  const passCode =
    String(entry.pass_code ?? "").trim();

  if (!/^[0-9a-f]{16}$/.test(passCode)) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "参加証を発行できませんでした。",
      },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    pass: {
      code: passCode,
    },
  });
}
