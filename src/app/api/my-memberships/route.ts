// src/app/api/my-memberships/route.ts
// 2026/08/18 JST
//
// ログインユーザーが active member になっている
// Membershipと、そのMembership限定作品を返す。

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

    // --------------------------------------------------------
    // 1. active Membershipを取得
    // --------------------------------------------------------

    const {
      data: memberRows,
      error: memberError,
    } = await supabaseAdmin
      .from("membership_members")
      .select("membership_id")
      .eq("user_id", user.id)
      .eq("status", "active");

    if (memberError) {
      console.error(
        "load membership members failed:",
        memberError,
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

    const membershipIds = Array.from(
      new Set(
        (memberRows ?? [])
          .map((row) => row.membership_id)
          .filter(Boolean),
      ),
    );

    if (membershipIds.length === 0) {
      return NextResponse.json({
        ok: true,
        memberships: [],
      });
    }

    // --------------------------------------------------------
    // 2. Membership本体
    // --------------------------------------------------------

    const {
      data: memberships,
      error: membershipsError,
    } = await supabaseAdmin
      .from("memberships")
      .select(
        "id,name,description,created_at",
      )
      .in("id", membershipIds)
      .order("created_at", {
        ascending: true,
      });

    if (membershipsError) {
      console.error(
        "load memberships failed:",
        membershipsError,
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

    // --------------------------------------------------------
    // 3. Membership作品との関連
    // --------------------------------------------------------

    const {
      data: workRows,
      error: worksError,
    } = await supabaseAdmin
      .from("membership_works")
      .select(
        "membership_id,book_id,created_at",
      )
      .in("membership_id", membershipIds)
      .order("created_at", {
        ascending: false,
      });

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

    const bookIds = Array.from(
      new Set(
        (workRows ?? [])
          .map((row) => row.book_id)
          .filter(Boolean),
      ),
    );

    // Membershipは存在するが、まだ作品がない場合
    if (bookIds.length === 0) {
      return NextResponse.json({
        ok: true,
        memberships: (memberships ?? []).map(
          (membership) => ({
            ...membership,
            works: [],
          }),
        ),
      });
    }

    // --------------------------------------------------------
    // 4. 作品本体
    //
    // visibility=membership の作品だけ返す。
    // --------------------------------------------------------

    const {
      data: books,
      error: booksError,
    } = await supabaseAdmin
      .from("parari_books")
      .select(
        "id,title,content,visibility,updated_at,is_deleted,stable_slug,custom_slug,slug",
      )
      .in("id", bookIds)
      .eq("visibility", "membership")
      .or(
        "is_deleted.is.null,is_deleted.eq.false",
      );

    if (booksError) {
      console.error(
        "load membership books failed:",
        booksError,
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

    const bookMap = new Map(
      (books ?? []).map((book) => [
        book.id,
        book,
      ]),
    );

    const worksByMembership =
      new Map<string, Array<Record<string, unknown>>>();

    for (const row of workRows ?? []) {
      const book = bookMap.get(row.book_id);

      if (!book) {
        continue;
      }

      const current =
        worksByMembership.get(
          row.membership_id,
        ) ?? [];

      current.push({
        ...book,
        membership_added_at:
          row.created_at ?? null,
      });

      worksByMembership.set(
        row.membership_id,
        current,
      );
    }

    // --------------------------------------------------------
    // 5. Membership単位にまとめて返す
    // --------------------------------------------------------

    return NextResponse.json({
      ok: true,
      memberships: (memberships ?? []).map(
        (membership) => ({
          ...membership,
          works:
            worksByMembership.get(
              membership.id,
            ) ?? [],
        }),
      ),
    });
  } catch (error) {
    console.error(
      "GET /api/my-memberships failed:",
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
