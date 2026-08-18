// src/app/api/membership/preview/route.ts
// 2026/08/18 JST
//
// Membership ownerが
// 「会員から見える棚」を確認するためのAPI

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

    // owner本人であることを確認
    const {
      data: membership,
      error: membershipError,
    } = await supabaseAdmin
      .from("memberships")
      .select(
        "id,name,description,created_at",
      )
      .eq("id", membershipId)
      .eq("owner_user_id", user.id)
      .maybeSingle();

    if (membershipError) {
      console.error(
        "load membership preview failed:",
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
            "このMembershipを確認する権限がありません。",
        },
        { status: 403 },
      );
    }

    // Membershipに登録されている作品
    const {
      data: workRows,
      error: worksError,
    } = await supabaseAdmin
      .from("membership_works")
      .select(
        "book_id,created_at",
      )
      .eq(
        "membership_id",
        membershipId,
      )
      .order("created_at", {
        ascending: false,
      });

    if (worksError) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "Membership作品を取得できませんでした。",
        },
        { status: 500 },
      );
    }

    const bookIds = (
      workRows ?? []
    ).map((row) => row.book_id);

    if (bookIds.length === 0) {
      return NextResponse.json({
        ok: true,
        membership: {
          ...membership,
          works: [],
        },
      });
    }

    const {
      data: books,
      error: booksError,
    } = await supabaseAdmin
      .from("parari_books")
      .select(
        "id,title,content,visibility,updated_at,is_deleted",
      )
      .in("id", bookIds)
      .eq(
        "visibility",
        "membership",
      )
      .or(
        "is_deleted.is.null,is_deleted.eq.false",
      );

    if (booksError) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "Membership作品を取得できませんでした。",
        },
        { status: 500 },
      );
    }

    const bookMap = new Map(
      (books ?? []).map((book) => [
        book.id,
        book,
      ]),
    );

    // membership_works の順番を維持
    const works = (
      workRows ?? []
    )
      .map((row) => {
        const book =
          bookMap.get(row.book_id);

        if (!book) {
          return null;
        }

        return {
          ...book,
          membership_added_at:
            row.created_at ?? null,
        };
      })
      .filter(Boolean);

    return NextResponse.json({
      ok: true,
      membership: {
        ...membership,
        works,
      },
    });
  } catch (error) {
    console.error(
      "GET /api/membership/preview failed:",
      error,
    );

    return NextResponse.json(
      {
        ok: false,
        message:
          "Membership棚を確認できませんでした。",
      },
      { status: 500 },
    );
  }
}
