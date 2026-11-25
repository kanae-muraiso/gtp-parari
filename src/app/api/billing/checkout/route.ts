// src/app/api/billing/checkout/route.ts
// Stripe Checkout API. WRITERS B（旧Plus）の新規受付は停止中。

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/billing/supabaseAdmin";

export const runtime = "nodejs";

function getBearerToken(request: NextRequest): string | null {
  const authHeader = request.headers.get("authorization");
  if (!authHeader) return null;

  const [type, token] = authHeader.split(" ");
  return type === "Bearer" && token ? token : null;
}

export async function POST(request: NextRequest) {
  const token = getBearerToken(request);
  if (!token) {
    return NextResponse.json(
      { error: "Unauthorized: missing access token" },
      { status: 401 },
    );
  }

  const {
    data: { user },
    error: userError,
  } = await supabaseAdmin.auth.getUser(token);

  if (userError || !user) {
    return NextResponse.json(
      { error: "Unauthorized: invalid access token" },
      { status: 401 },
    );
  }

  const body = await request.json().catch(() => ({}));
  const requestedPlan = body?.plan ?? "plus";

  if (requestedPlan === "plus") {
    return NextResponse.json(
      { error: "PACKAGE_CLOSED", message: "Plusの新規申込は終了しました。" },
      { status: 410 },
    );
  }

  return NextResponse.json(
    { error: "PACKAGE_NOT_AVAILABLE", message: "指定されたプランは現在新規申込を受け付けていません。" },
    { status: 400 },
  );
}
