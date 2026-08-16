// src/app/api/membership/manage/route.ts
// 2026-08-14 JST
// PART: Membership owner management API
//
// GET
// - ログインユーザーが開設したMembership一覧を返す
//
// POST
// - ログインユーザー自身をownerとしてMembershipを開設する
//
// コメント:
// - owner_user_id はクライアントから受け取らない
// - service role はサーバー側だけで使用する
// - DB上は将来の複数Membershipを許容する

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/billing/supabaseAdmin";
import { authenticateMonitor } from "@/lib/auth/monitor";

export const runtime = "nodejs";

function getBearerToken(
  request: NextRequest,
): string | null {
  const authorization =
    request.headers.get("authorization") ?? "";

  if (!authorization.startsWith("Bearer ")) {
    return null;
  }

  const token = authorization
    .slice("Bearer ".length)
    .trim();

  return token || null;
}

async function getAuthenticatedUser(
  request: NextRequest,
) {
  const token = getBearerToken(request);

  if (!token) {
    return null;
  }

  const {
    data: { user },
    error,
  } = await supabaseAdmin.auth.getUser(token);

  if (error || !user) {
    return null;
  }

  return user;
}

export async function GET(
  request: NextRequest,
) {
  try {
    const user =
      await getAuthenticatedUser(request);

    if (!user) {
      return NextResponse.json(
        {
          ok: false,
          message: "ログインが必要です。",
        },
        { status: 401 },
      );
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
          "load monitor status failed:",
          profileError,
        );

        return NextResponse.json(
          {
            ok: false,
            message:
              "モニター情報を確認できませんでした。",
          },
          { status: 500 },
        );
      }

      const isMonitor =
        profile?.is_monitor === true;
      
    const {
      data: memberships,
      error,
    } = await supabaseAdmin
      .from("memberships")
      .select(
        "id,name,description,created_at",
      )
      .eq("owner_user_id", user.id)
      .order("created_at", {
        ascending: true,
      });

    if (error) {
      console.error(
        "load owned memberships failed:",
        error,
      );

      return NextResponse.json(
        {
          ok: false,
          message:
            "Membership情報を取得できませんでした。",
        },
        { status: 500 },
      );
    }

      return NextResponse.json({
        ok: true,
        isMonitor,
        memberships: memberships ?? [],
      });
      
  } catch (error) {
    console.error(
      "GET /api/membership/manage failed:",
      error,
    );

    return NextResponse.json(
      {
        ok: false,
        message:
          "Membership情報を取得できませんでした。",
      },
      { status: 500 },
    );
  }
}

export async function POST(
  request: NextRequest,
) {
  try {
      const monitorAuth =
        await authenticateMonitor(request);

      if (monitorAuth.ok === false) {
        return NextResponse.json(
          {
            ok: false,
            message: monitorAuth.message,
          },
          {
            status: monitorAuth.status,
          },
        );
      }
      
    const body = await request
      .json()
      .catch(() => null);

    const name = String(
      body?.name ?? "",
    ).trim();

    const description = String(
      body?.description ?? "",
    ).trim();

    if (!name) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "Membership名を入力してください。",
        },
        { status: 400 },
      );
    }

    if (name.length > 120) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "Membership名は120文字以内で入力してください。",
        },
        { status: 400 },
      );
    }

    if (description.length > 2000) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "説明は2000文字以内で入力してください。",
        },
        { status: 400 },
      );
    }

    const {
      data: membership,
      error,
    } = await supabaseAdmin
      .from("memberships")
      .insert({
          owner_user_id: monitorAuth.userId,
        name,
        description:
          description || null,
      })
      .select(
        "id,name,description,created_at",
      )
      .single();

    if (error) {
      console.error(
        "create membership failed:",
        error,
      );

      return NextResponse.json(
        {
          ok: false,
          message:
            "Membershipを開設できませんでした。",
        },
        { status: 500 },
      );
    }

    return NextResponse.json({
      ok: true,
      membership,
    });
  } catch (error) {
    console.error(
      "POST /api/membership/manage failed:",
      error,
    );

    return NextResponse.json(
      {
        ok: false,
        message:
          "Membershipを開設できませんでした。",
      },
      { status: 500 },
    );
  }
}
