// src/app/api/collaboration/list/route.ts
// 2026/08/10 17:56

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/billing/supabaseAdmin";

export const runtime = "nodejs";

function getBearerToken(request: NextRequest): string | null {
  const authorization = request.headers.get("authorization") ?? "";
  const matched = authorization.match(/^Bearer\s+(.+)$/i);

  return matched?.[1] ?? null;
}

export async function GET(request: NextRequest) {
  try {
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
          message: "ログイン情報を確認できませんでした。",
        },
        { status: 401 },
      );
    }

    // --------------------------------------------------------
    // 自分がOwnerである作品だけを取得
    // --------------------------------------------------------

    const { data: works, error: worksError } = await supabaseAdmin
      .from("parari_books")
      .select("id")
      .eq("owner", user.id)
      .or("is_deleted.is.null,is_deleted.eq.false");

    if (worksError) {
      console.error(
        "[api/collaboration/list] works load failed:",
        worksError,
      );

      return NextResponse.json(
        {
          ok: false,
          message: "作品情報を取得できませんでした。",
        },
        { status: 500 },
      );
    }

    const workIds = (works ?? []).map((work) => work.id);

    if (workIds.length === 0) {
      return NextResponse.json({
        ok: true,
        collaborators: [],
      });
    }

    // --------------------------------------------------------
    // Owner作品に登録されている共同編集者を取得
    // --------------------------------------------------------

    const { data: rows, error: collaboratorError } =
      await supabaseAdmin
        .from("parari_work_collaborators")
        .select("work_id,user_id,role,created_at")
        .in("work_id", workIds);

    if (collaboratorError) {
      console.error(
        "[api/collaboration/list] collaborators load failed:",
        collaboratorError,
      );

      return NextResponse.json(
        {
          ok: false,
          message: "共同編集者を取得できませんでした。",
        },
        { status: 500 },
      );
    }

    const userIds = Array.from(
      new Set(
        (rows ?? [])
          .map((row) => String(row.user_id ?? "").trim())
          .filter(Boolean),
      ),
    );

    if (userIds.length === 0) {
      return NextResponse.json({
        ok: true,
        collaborators: [],
      });
    }

    const { data: profiles, error: profileError } =
      await supabaseAdmin
        .from("profiles")
        .select("user_id,username,display_name")
        .in("user_id", userIds);

    if (profileError) {
      console.error(
        "[api/collaboration/list] profiles load failed:",
        profileError,
      );

      return NextResponse.json(
        {
          ok: false,
          message: "共同編集者のプロフィールを取得できませんでした。",
        },
        { status: 500 },
      );
    }

    const profileMap = new Map(
      (profiles ?? []).map((profile) => [
        profile.user_id,
        profile,
      ]),
    );

    const collaborators = (rows ?? []).map((row) => {
      const profile = profileMap.get(row.user_id);

      return {
        workId: row.work_id,
        userId: row.user_id,
        role: row.role,
        username: profile?.username ?? null,
        displayName: profile?.display_name ?? null,
        createdAt: row.created_at,
      };
    });

    return NextResponse.json({
      ok: true,
      collaborators,
    });
  } catch (error) {
    console.error(
      "[api/collaboration/list] unexpected error:",
      error,
    );

    return NextResponse.json(
      {
        ok: false,
        message: "共同編集者の取得中にエラーが発生しました。",
      },
      { status: 500 },
    );
  }
}
