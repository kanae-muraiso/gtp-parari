// apps/tools/parari/src/app/api/membership/public/route.ts
// 2026-08-14 JST
// PART: MEMBERSHIP public recruitment API
//
// コメント:
// - recruitmentId から入会先Membershipを解決する
// - 公開表示に必要なMembership名・説明だけを返す
// - service role はサーバー側だけで使用する

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/billing/supabaseAdmin";

export const runtime = "nodejs";

const UUID_RE =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);

    const recruitmentId = String(
      url.searchParams.get("recruitmentId") ?? "",
    ).trim();

    const membershipId = String(
      url.searchParams.get("membershipId") ?? "",
    ).trim();

    if (
      !membershipId &&
      !recruitmentId
    ) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "Membershipが指定されていません。",
        },
        { status: 400 },
      );
    }

    if (
      membershipId &&
      !UUID_RE.test(membershipId)
    ) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "membershipId が正しくありません。",
        },
        { status: 400 },
      );
    }

    if (
      recruitmentId &&
      !UUID_RE.test(recruitmentId)
    ) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "recruitmentId が正しくありません。",
        },
        { status: 400 },
      );
    }

    let recruitment:
      | {
          id: string;
          membership_id: string;
        }
      | null = null;

    let resolvedMembershipId =
      membershipId;

    if (!resolvedMembershipId) {
      const {
        data,
        error: recruitmentError,
      } = await supabaseAdmin
        .from("membership_recruitments")
        .select("id,membership_id")
        .eq("id", recruitmentId)
        .maybeSingle();

      if (recruitmentError) {
        console.error(
          "load membership recruitment failed:",
          recruitmentError,
        );

        return NextResponse.json(
          {
            ok: false,
            message:
              "会員登録情報を取得できませんでした。",
          },
          { status: 500 },
        );
      }

      if (!data) {
        return NextResponse.json(
          {
            ok: false,
            message:
              "会員登録情報が見つかりません。",
          },
          { status: 404 },
        );
      }

      recruitment = data;
      resolvedMembershipId =
        data.membership_id;
    }

    const {
      data: membership,
      error: membershipError,
    } = await supabaseAdmin
      .from("memberships")
      .select("id,name,description")
      .eq("id", resolvedMembershipId)
      .maybeSingle();

    if (membershipError) {
      console.error(
        "load membership failed:",
        membershipError,
      );

      return NextResponse.json(
        {
          ok: false,
          message: "Membership情報を取得できませんでした。",
        },
        { status: 500 },
      );
    }

    if (!membership) {
      return NextResponse.json(
        {
          ok: false,
          message: "Membershipが見つかりません。",
        },
        { status: 404 },
      );
    }

    return NextResponse.json({
      ok: true,

      membership: {
        id: membership.id,
        name: membership.name,
        description:
          membership.description,
      },

      recruitment:
        recruitment
          ? {
              id:
                recruitment.id,

              membership_id:
                membership.id,

              membership_name:
                membership.name,

              membership_description:
                membership.description,
            }
          : null,
    });
  } catch (error) {
    console.error(
      "GET /api/membership/public failed:",
      error,
    );

    return NextResponse.json(
      {
        ok: false,
        message: "会員登録情報を取得できませんでした。",
      },
      { status: 500 },
    );
  }
}
