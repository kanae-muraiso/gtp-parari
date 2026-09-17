// src/app/api/application/pass/route.ts
// 2026-09-15 JST

import {
  NextRequest,
  NextResponse,
} from "next/server";

import { supabaseAdmin } from "@/lib/billing/supabaseAdmin";

const UUID_RE =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

function getBearerToken(
  request: NextRequest,
): string | null {
  const authorization =
    request.headers.get("authorization") ?? "";
  const match =
    authorization.match(/^Bearer\s+(.+)$/i);

  return match?.[1]?.trim() || null;
}

export async function GET(
  request: NextRequest,
) {
  const token = getBearerToken(request);

  if (!token) {
    return NextResponse.json(
      {
        ok: false,
        message: "ログインが必要です。",
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
    .select(
      "id, application_id, user_id, status, pass_code",
    )
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

  let authorized =
    entry.user_id === user.id;

  if (!authorized) {
    const {
      data: application,
      error: applicationError,
    } = await supabaseAdmin
      .from("applications")
      .select("owner_user_id")
      .eq("id", entry.application_id)
      .maybeSingle();

    if (applicationError) {
      console.error(
        "[APPLICATION PASS] owner load failed:",
        applicationError,
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

    authorized =
      application?.owner_user_id === user.id;
  }

  if (!authorized) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "この参加証を見る権限がありません。",
      },
      { status: 403 },
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
