// src/app/api/collaboration/remove/route.ts
// 2026/08/10 17:57

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/billing/supabaseAdmin";

export const runtime = "nodejs";

type RemoveCollaboratorBody = {
  workId?: unknown;
  userId?: unknown;
};

function getBearerToken(request: NextRequest): string | null {
  const authorization = request.headers.get("authorization") ?? "";
  const matched = authorization.match(/^Bearer\s+(.+)$/i);

  return matched?.[1] ?? null;
}

export async function DELETE(request: NextRequest) {
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

    const body =
      (await request.json().catch(() => null)) as
        | RemoveCollaboratorBody
        | null;

    const workId = String(body?.workId ?? "").trim();
    const collaboratorUserId = String(body?.userId ?? "").trim();

    if (!workId || !collaboratorUserId) {
      return NextResponse.json(
        {
          ok: false,
          message: "解除する共同編集者を指定してください。",
        },
        { status: 400 },
      );
    }

    // --------------------------------------------------------
    // Owner確認
    // --------------------------------------------------------

    const { data: work, error: workError } = await supabaseAdmin
      .from("parari_books")
      .select("id,owner,title")
      .eq("id", workId)
      .maybeSingle();

    if (workError) {
      console.error(
        "[api/collaboration/remove] work load failed:",
        workError,
      );

      return NextResponse.json(
        {
          ok: false,
          message: "作品情報を確認できませんでした。",
        },
        { status: 500 },
      );
    }

    if (!work) {
      return NextResponse.json(
        {
          ok: false,
          message: "作品が見つかりません。",
        },
        { status: 404 },
      );
    }

    if (work.owner !== user.id) {
      return NextResponse.json(
        {
          ok: false,
          message: "共同編集者を解除できるのは作品のOwnerだけです。",
        },
        { status: 403 },
      );
    }

    // --------------------------------------------------------
    // 共同編集権限を解除
    // --------------------------------------------------------

    const { error: deleteError } = await supabaseAdmin
      .from("parari_work_collaborators")
      .delete()
      .eq("work_id", workId)
      .eq("user_id", collaboratorUserId);

    if (deleteError) {
      console.error(
        "[api/collaboration/remove] delete failed:",
        deleteError,
      );

      return NextResponse.json(
        {
          ok: false,
          message: "共同編集者を解除できませんでした。",
        },
        { status: 500 },
      );
    }

    return NextResponse.json({
      ok: true,
      workId,
      userId: collaboratorUserId,
      message: "共同編集を解除しました。",
    });
  } catch (error) {
    console.error(
      "[api/collaboration/remove] unexpected error:",
      error,
    );

    return NextResponse.json(
      {
        ok: false,
        message: "共同編集者の解除中にエラーが発生しました。",
      },
      { status: 500 },
    );
  }
}
