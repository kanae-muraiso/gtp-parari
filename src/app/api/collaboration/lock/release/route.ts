// src/app/api/collaboration/lock/release/route.ts
// 2026/08/11 8:15

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/billing/supabaseAdmin";

export const runtime = "nodejs";

type ReleaseLockBody = {
  workId?: unknown;
};

function getBearerToken(request: NextRequest): string | null {
  const authorization = request.headers.get("authorization");

  if (!authorization?.startsWith("Bearer ")) {
    return null;
  }

  const token = authorization.slice("Bearer ".length).trim();

  return token || null;
}

function normalizeWorkId(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();

  return normalized || null;
}

export async function POST(request: NextRequest) {
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

    const body = (await request.json().catch(() => null)) as
      | ReleaseLockBody
      | null;

    const workId = normalizeWorkId(body?.workId);

    if (!workId) {
      return NextResponse.json(
        {
          ok: false,
          message: "作品IDを確認できませんでした。",
        },
        { status: 400 },
      );
    }

    /*
     * 自分が持っている編集権だけを削除する。
     *
     * 他人のロックは絶対に削除しない。
     */
    const {
      data: releasedLock,
      error: deleteError,
    } = await supabaseAdmin
      .from("parari_work_edit_locks")
      .delete()
      .eq("work_id", workId)
      .eq("user_id", user.id)
      .select("work_id")
      .maybeSingle<{ work_id: string }>();

    if (deleteError) {
      console.error(
        "[api/collaboration/lock/release] lock delete failed:",
        deleteError,
      );

      return NextResponse.json(
        {
          ok: false,
          message: "編集権を解放できませんでした。",
        },
        { status: 500 },
      );
    }

    /*
     * すでにロックが消えていてもエラーにはしない。
     *
     * 例:
     * - timeoutですでに期限切れ
     * - 二重にreleaseが呼ばれた
     *
     * どちらも安全なので成功扱いにする。
     */
    return NextResponse.json({
      ok: true,
      released: releasedLock !== null,
      workId,
    });
  } catch (error) {
    console.error(
      "[api/collaboration/lock/release] unexpected error:",
      error,
    );

    return NextResponse.json(
      {
        ok: false,
        message: "編集権の解放中にエラーが発生しました。",
      },
      { status: 500 },
    );
  }
}
