// src/app/api/collaboration/lock/heartbeat/route.ts
// 2026/08/11 8:17

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/billing/supabaseAdmin";

export const runtime = "nodejs";

type HeartbeatBody = {
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
      | HeartbeatBody
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

    const now = new Date();
    const nowIso = now.toISOString();

    const expiresAt = new Date(
      now.getTime() + 3 * 60 * 1000,
    ).toISOString();

    /*
     * 自分が現在持っている編集権だけを延長する。
     */
    const {
      data: lock,
      error: updateError,
    } = await supabaseAdmin
      .from("parari_work_edit_locks")
      .update({
        heartbeat_at: nowIso,
        expires_at: expiresAt,
      })
      .eq("work_id", workId)
      .eq("user_id", user.id)
      .gt("expires_at", nowIso)
      .select(
        "work_id,user_id,revision,acquired_at,heartbeat_at,expires_at",
      )
      .maybeSingle();

    if (updateError) {
      console.error(
        "[api/collaboration/lock/heartbeat] lock refresh failed:",
        updateError,
      );

      return NextResponse.json(
        {
          ok: false,
          message: "編集状態を更新できませんでした。",
        },
        { status: 500 },
      );
    }

    /*
     * 行が見つからない場合：
     * - すでに期限切れ
     * - 自分のロックではない
     * - ロックが存在しない
     *
     * いずれにしても「もう編集権を持っていない」。
     */
    if (!lock) {
      return NextResponse.json(
        {
          ok: false,
          code: "LOCK_LOST",
          message: "編集権の有効期限が切れました。",
        },
        { status: 409 },
      );
    }

    return NextResponse.json({
      ok: true,
      lock,
    });
  } catch (error) {
    console.error(
      "[api/collaboration/lock/heartbeat] unexpected error:",
      error,
    );

    return NextResponse.json(
      {
        ok: false,
        message: "編集状態の更新中にエラーが発生しました。",
      },
      { status: 500 },
    );
  }
}
