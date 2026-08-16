// apps/tools/parari/src/app/api/my-books/route.ts
// apps/tools/parari/src/app/api/my-books/route.ts
// 2026-03-26 JST

import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { isExpired } from "../../../lib/parariExpiry";

/**
 * PART: GET /api/my-books
 * コメント:
 * - ログイン中ユーザー自身の作品一覧を返す
 * - expires_at を返す
 * - expired 状態はDB保存せず、APIレスポンスで isExpired として付与する
 */
export async function GET() {
  const cookieStore = await cookies();

  /**
   * PART: supabase server client
   * コメント:
   * - Route Handler 用の Supabase クライアント
   * - 将来の refresh などでも cookie を扱える形を維持
   */
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: any) {
          cookieStore.set({ name, value, ...options });
        },
        remove(name: string, options: any) {
          cookieStore.set({ name, value: "", ...options, maxAge: 0 });
        },
      },
    }
  );

  /**
   * PART: auth check
   * コメント:
   * - 認証ユーザー確認
   */
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData.user) {
    return NextResponse.json({ error: "not_logged_in" }, { status: 401 });
  }

  /**
   * PART: fetch my books
   * コメント:
   * - 自分の作品（削除除外）を最新順に返す
   * - expires_at を select に追加
   */
  const { data, error } = await supabase
    .from("parari_books")
    .select("id,title,is_public,updated_at,is_deleted,expires_at")
    .eq("owner", userData.user.id)
    .or("is_deleted.is.null,is_deleted.eq.false")
    .order("updated_at", { ascending: false })
    .limit(20);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  /**
   * PART: attach expiry state
   * コメント:
   * - DBの expires_at から期限切れ判定を付与
   * - expired は保存せず、このレスポンスで毎回計算する
   */
  const books = (data ?? []).map((book) => ({
    ...book,
    isExpired: isExpired(book.expires_at),
  }));

  return NextResponse.json({ books });
}
