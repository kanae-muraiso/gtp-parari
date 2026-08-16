// src/app/api/form/public/route.ts
// 2026/08/15 11:26

import {
  NextRequest,
  NextResponse,
} from "next/server";
import { supabaseAdmin } from "@/lib/billing/supabaseAdmin";

const UUID_RE =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

export async function GET(
  request: NextRequest,
) {
  const formId =
    request.nextUrl.searchParams
      .get("formId")
      ?.trim() ?? "";

  if (!UUID_RE.test(formId)) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "FORMが指定されていません。",
      },
      {
        status: 400,
      },
    );
  }

  const {
    data: form,
    error,
  } = await supabaseAdmin
    .from("forms")
    .select(
      `
        id,
        name,
        description,
        definition,
        version
      `,
    )
    .eq("id", formId)
    .maybeSingle();

  if (error) {
    console.error(
      "public form load failed:",
      error,
    );

    return NextResponse.json(
      {
        ok: false,
        message:
          "FORMを取得できませんでした。",
      },
      {
        status: 500,
      },
    );
  }

  if (!form) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "FORMが見つかりません。",
      },
      {
        status: 404,
      },
    );
  }

  return NextResponse.json({
    ok: true,
    form,
  });
}
