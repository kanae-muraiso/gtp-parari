// src/app/api/application/guest-meta/route.ts
// 2026-09-15 JST
//
// Minimal public metadata needed by the guest APPLICATION renderer.
// The regular public API intentionally stays unchanged.

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/billing/supabaseAdmin";

const UUID_RE =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

export async function GET(
  request: Request,
) {
  const url = new URL(request.url);
  const applicationId =
    String(
      url.searchParams.get(
        "applicationId",
      ) ?? "",
    ).trim();

  if (!UUID_RE.test(applicationId)) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "APPLICATIONが指定されていません。",
      },
      { status: 400 },
    );
  }

  const {
    data,
    error,
  } = await supabaseAdmin
    .from("applications")
    .select(
      "id, origin, calendar_item_id, status",
    )
    .eq("id", applicationId)
    .maybeSingle();

  if (
    error ||
    !data
  ) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "募集情報を確認できませんでした。",
      },
      {
        status: error ? 500 : 404,
      },
    );
  }

  return NextResponse.json({
    ok: true,
    meta: {
      origin: data.origin,
      calendar_item_id:
        data.calendar_item_id,
      status: data.status,
    },
  });
}
