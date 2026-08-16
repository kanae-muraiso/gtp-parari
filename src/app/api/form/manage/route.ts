// src/app/api/form/manage/route.ts
// 2026-08-15 JST
//
// PARARI FORM 管理API
//
// GET  : 自分が作成したFORM一覧を取得
// POST : 新しいFORMを作成
//
// FORMの質問項目は definition JSONB に保存する。

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/billing/supabaseAdmin";


function getBearerToken(
  request: NextRequest,
): string | null {
  const authorization =
    request.headers.get("authorization") ?? "";

  const match =
    authorization.match(/^Bearer\s+(.+)$/i);

  return match?.[1]?.trim() || null;
}


async function getAuthenticatedUser(
  request: NextRequest,
) {
  const token = getBearerToken(request);

  if (!token) {
    return {
      ok: false as const,
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
      ok: false as const,
      status: 401,
      message:
        "ログイン情報を確認できませんでした。",
    };
  }

  return {
    ok: true as const,
    user,
  };
}


// ============================================================
// GET
// 自分のFORM一覧
// ============================================================

export async function GET(
  request: NextRequest,
) {
  const auth =
    await getAuthenticatedUser(request);

  if (auth.ok === false) {
    return NextResponse.json(
      {
        ok: false,
        message: auth.message,
      },
      {
        status: auth.status,
      },
    );
  }

  const {
    data: forms,
    error,
  } = await supabaseAdmin
    .from("forms")
    .select(
      `
        id,
        name,
        description,
        definition,
        version,
        created_at,
        updated_at
      `,
    )
    .eq(
      "owner_user_id",
      auth.user.id,
    )
    .order(
      "created_at",
      {
        ascending: false,
      },
    );

  if (error) {
    console.error(
      "form list failed:",
      error,
    );

    return NextResponse.json(
      {
        ok: false,
        message:
          "FORM一覧を取得できませんでした。",
      },
      {
        status: 500,
      },
    );
  }

  return NextResponse.json({
    ok: true,
    forms: forms ?? [],
  });
}


// ============================================================
// POST
// 新しいFORMを作成
// ============================================================

export async function POST(
  request: NextRequest,
) {
  const auth =
    await getAuthenticatedUser(request);

  if (auth.ok === false) {
    return NextResponse.json(
      {
        ok: false,
        message: auth.message,
      },
      {
        status: auth.status,
      },
    );
  }

  const body = (await request
    .json()
    .catch(() => null)) as
    | {
        name?: unknown;
        description?: unknown;
        definition?: unknown;
      }
    | null;

  const name =
    typeof body?.name === "string"
      ? body.name.trim()
      : "";

  const description =
    typeof body?.description === "string"
      ? body.description.trim()
      : "";

  if (!name) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "FORM名を入力してください。",
      },
      {
        status: 400,
      },
    );
  }

  if (name.length > 120) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "FORM名は120文字以内で入力してください。",
      },
      {
        status: 400,
      },
    );
  }

  if (description.length > 2000) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "説明は2000文字以内で入力してください。",
      },
      {
        status: 400,
      },
    );
  }

  const definition =
    body?.definition &&
    typeof body.definition === "object" &&
    !Array.isArray(body.definition)
      ? body.definition
      : {
          fields: [],
        };

  const {
    data: form,
    error,
  } = await supabaseAdmin
    .from("forms")
    .insert({
      owner_user_id:
        auth.user.id,

      name,

      description:
        description || null,

      definition,
    })
    .select(
      `
        id,
        name,
        description,
        definition,
        version,
        created_at,
        updated_at
      `,
    )
    .single();

  if (error) {
    console.error(
      "form create failed:",
      error,
    );

    return NextResponse.json(
      {
        ok: false,
        message:
          "FORMを保存できませんでした。",
      },
      {
        status: 500,
      },
    );
  }

  return NextResponse.json({
    ok: true,
    form,
  });
}

// ============================================================
// PATCH
// 既存FORMを編集
// ============================================================

export async function PATCH(
  request: NextRequest,
) {
  const auth =
    await getAuthenticatedUser(request);

  if (auth.ok === false) {
    return NextResponse.json(
      {
        ok: false,
        message: auth.message,
      },
      {
        status: auth.status,
      },
    );
  }

  const body = (await request
    .json()
    .catch(() => null)) as
    | {
        formId?: unknown;
        name?: unknown;
        description?: unknown;
        definition?: unknown;
      }
    | null;

  const formId =
    typeof body?.formId === "string"
      ? body.formId.trim()
      : "";

  const name =
    typeof body?.name === "string"
      ? body.name.trim()
      : "";

  const description =
    typeof body?.description === "string"
      ? body.description.trim()
      : "";

  if (!formId) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "編集するFORMが指定されていません。",
      },
      {
        status: 400,
      },
    );
  }

  if (!name) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "FORM名を入力してください。",
      },
      {
        status: 400,
      },
    );
  }

  if (name.length > 120) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "FORM名は120文字以内で入力してください。",
      },
      {
        status: 400,
      },
    );
  }

  if (description.length > 2000) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "説明は2000文字以内で入力してください。",
      },
      {
        status: 400,
      },
    );
  }

  const definition =
    body?.definition &&
    typeof body.definition === "object" &&
    !Array.isArray(body.definition)
      ? body.definition
      : {
          fields: [],
        };

  const {
    data: form,
    error,
  } = await supabaseAdmin
    .from("forms")
    .update({
      name,
      description:
        description || null,
      definition,
    })
    .eq(
      "id",
      formId,
    )
    .eq(
      "owner_user_id",
      auth.user.id,
    )
    .select(
      `
        id,
        name,
        description,
        definition,
        version,
        created_at,
        updated_at
      `,
    )
    .maybeSingle();

  if (error) {
    console.error(
      "form update failed:",
      error,
    );

    return NextResponse.json(
      {
        ok: false,
        message:
          "FORMを更新できませんでした。",
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
          "編集するFORMが見つかりません。",
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
