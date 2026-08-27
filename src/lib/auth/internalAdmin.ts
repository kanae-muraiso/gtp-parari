// src/lib/auth/internalAdmin.ts
// サーバー専用：PARARI内部管理者の認証・権限確認

import "server-only";

import type { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/billing/supabaseAdmin";

function parseCsv(value: string | undefined): string[] {
  return String(value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

const INTERNAL_ADMIN_USER_IDS = parseCsv(
  process.env.PARARI_INTERNAL_ADMIN_USER_IDS,
);

const INTERNAL_ADMIN_EMAILS = parseCsv(
  process.env.PARARI_INTERNAL_ADMIN_EMAILS,
).map((email) => email.toLowerCase());

export type InternalAdminAuthResult =
  | {
      ok: true;
      userId: string;
    }
  | {
      ok: false;
      status: 401 | 403 | 500;
      message: string;
    };

function getBearerToken(request: NextRequest): string | null {
  const authorization = request.headers.get("authorization") ?? "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);

  return match?.[1]?.trim() || null;
}

export function isInternalAdminUser(user: {
  id: string;
  email?: string | null;
}): boolean {
  const email = String(user.email ?? "")
    .trim()
    .toLowerCase();

  return (
    INTERNAL_ADMIN_USER_IDS.includes(user.id) ||
    (email.length > 0 && INTERNAL_ADMIN_EMAILS.includes(email))
  );
}

export async function authenticateInternalAdmin(
  request: NextRequest,
): Promise<InternalAdminAuthResult> {
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
    error,
  } = await supabaseAdmin.auth.getUser(token);

  if (error || !user) {
    return {
      ok: false,
      status: 401,
      message: "ログイン情報を確認できませんでした。",
    };
  }

  if (!isInternalAdminUser(user)) {
    return {
      ok: false,
      status: 403,
      message: "この機能を利用する権限がありません。",
    };
  }

  return {
    ok: true,
    userId: user.id,
  };
}
