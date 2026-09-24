import {
  NextRequest,
  NextResponse,
} from "next/server";

import { supabaseAdmin } from "@/lib/billing/supabaseAdmin";

export const runtime = "nodejs";

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
  const token =
    getBearerToken(request);

  if (!token) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "ログインが必要です。",
      },
      { status: 401 },
    );
  }

  const {
    data: { user },
    error: authError,
  } =
    await supabaseAdmin.auth.getUser(
      token,
    );

  if (
    authError ||
    !user
  ) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "ログイン状態を確認できませんでした。",
      },
      { status: 401 },
    );
  }

  const {
    data,
    error,
  } =
    await supabaseAdmin
      .from("parari_books")
      .select(
        "id,title,visibility,updated_at,is_deleted",
      )
      .eq("owner", user.id)
      .or(
        "is_deleted.is.null,is_deleted.eq.false",
      )
      .order(
        "updated_at",
        { ascending: false },
      )
      .limit(200);

  if (error) {
    console.error(
      "[APPLICATION DELIVERY works] load failed:",
      error,
    );

    return NextResponse.json(
      {
        ok: false,
        message:
          "PARARI作品を取得できませんでした。",
      },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    works:
      (data ?? []).map(
        (work) => ({
          id: work.id,
          title:
            String(
              work.title ?? "",
            ).trim() ||
            "（無題）",
          visibility:
            work.visibility ?? "private",
          updated_at:
            work.updated_at ?? null,
        }),
      ),
  });
}
