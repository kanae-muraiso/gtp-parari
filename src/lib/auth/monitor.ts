// src/lib/auth/monitor.ts
// 2026-08-14 JST
// サーバー専用：PARARIモニターの認証・権限確認
//
// コメント:
// - モニター判定のSSOTは profiles.is_monitor
// - クライアントからモニター情報を受け取らない
// - Bearer token から本人を確認する

import "server-only";

import type { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/billing/supabaseAdmin";

export type MonitorAuthResult =
  | {
      ok: true;
      userId: string;
      email: string | null;
    }
  | {
      ok: false;
      status: 401 | 403 | 500;
      message: string;
    };

function getBearerToken(
  request: NextRequest,
): string | null {
  const authorization =
    request.headers.get("authorization") ?? "";

  const match =
    authorization.match(/^Bearer\s+(.+)$/i);

  return match?.[1]?.trim() || null;
}

export async function authenticateMonitor(
  request: NextRequest,
): Promise<MonitorAuthResult> {
  const token = getBearerToken(request);

  if (!token) {
    return {
      ok: false,
      status: 401,
      message: "ログイン情報がありません。",
    };
  }

  const {
    data: { user },
    error: userError,
  } = await supabaseAdmin.auth.getUser(token);

  if (userError || !user) {
    return {
      ok: false,
      status: 401,
      message:
        "ログイン情報を確認できませんでした。",
    };
  }

  const {
    data: profile,
    error: profileError,
  } = await supabaseAdmin
    .from("profiles")
    .select("is_monitor")
    .eq("user_id", user.id)
    .maybeSingle();

  if (profileError) {
    console.error(
      "monitor profile check failed:",
      profileError,
    );

    return {
      ok: false,
      status: 500,
      message:
        "モニター情報を確認できませんでした。",
    };
  }

  if (profile?.is_monitor !== true) {
    return {
      ok: false,
      status: 403,
      message:
        "この機能は現在PARARIモニター限定です。",
    };
  }

  return {
    ok: true,
    userId: user.id,
    email: user.email ?? null,
  };
}
