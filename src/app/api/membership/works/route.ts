// src/app/api/membership/works/route.ts

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/billing/supabaseAdmin";

export const runtime = "nodejs";

function getBearerToken(
  request: NextRequest,
): string | null {
  const authorization =
    request.headers.get("authorization") ?? "";

  if (!authorization.startsWith("Bearer ")) {
    return null;
  }

  return (
    authorization
      .slice("Bearer ".length)
      .trim() || null
  );
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

    const membershipId =
      request.nextUrl.searchParams.get(
        "membership_id",
      );

    if (!membershipId) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "Membershipが指定されていません。",
        },
        { status: 400 },
      );
    }

    // このMembershipのowner本人か確認
    const {
      data: membership,
      error: membershipError,
    } = await supabaseAdmin
      .from("memberships")
      .select("id,name")
      .eq("id", membershipId)
      .eq("owner_user_id", user.id)
      .maybeSingle();

    if (membershipError) {
      console.error(
        "load membership failed:",
        membershipError,
      );

      return NextResponse.json(
        {
          ok: false,
          message:
            "Membershipを確認できませんでした。",
        },
        { status: 500 },
      );
    }

    if (!membership) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "このMembershipを管理する権限がありません。",
        },
        { status: 403 },
      );
    }

    // owner本人のPARARI作品
    const {
      data: books,
      error: booksError,
    } = await supabaseAdmin
      .from("parari_books")
      .select(
        "id,title,visibility,updated_at",
      )
      .eq("owner", user.id)
      .order("updated_at", {
        ascending: false,
      });

    if (booksError) {
      console.error(
        "load owner books failed:",
        booksError,
      );

      return NextResponse.json(
        {
          ok: false,
          message:
            "作品一覧を取得できませんでした。",
        },
        { status: 500 },
      );
    }

    // このMembershipに登録済みの作品
    const {
      data: membershipWorks,
      error: worksError,
    } = await supabaseAdmin
      .from("membership_works")
      .select("book_id")
      .eq("membership_id", membershipId);

    if (worksError) {
      console.error(
        "load membership works failed:",
        worksError,
      );

      return NextResponse.json(
        {
          ok: false,
          message:
            "Membership作品を取得できませんでした。",
        },
        { status: 500 },
      );
    }

    const registeredBookIds = new Set(
      (membershipWorks ?? []).map(
        (item) => item.book_id,
      ),
    );

    return NextResponse.json({
      ok: true,
      membership,
      books: (books ?? []).map((book) => ({
        ...book,
        in_membership:
          registeredBookIds.has(book.id),
      })),
    });
  } catch (error) {
    console.error(
      "GET /api/membership/works failed:",
      error,
    );

    return NextResponse.json(
      {
        ok: false,
        message:
          "Membership作品を取得できませんでした。",
      },
      { status: 500 },
    );
  }
}
