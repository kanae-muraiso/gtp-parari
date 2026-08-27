// src/app/api/internal/admin-status/route.ts
// ログイン中ユーザーがPARARI内部管理者かをサーバー側で確認する

import { NextRequest, NextResponse } from "next/server";
import { authenticateInternalAdmin } from "@/lib/auth/internalAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await authenticateInternalAdmin(request);

  if (auth.ok === false) {
    return NextResponse.json(
      {
        ok: false,
        isAdmin: false,
        error: auth.message,
      },
      {
        status: auth.status,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  }

  return NextResponse.json(
    {
      ok: true,
      isAdmin: true,
      userId: auth.userId,
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
