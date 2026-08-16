import { redirect } from "next/navigation";

export default function MyPage() {
  redirect("/my/works");
}


// 以下初期画面が本棚にするためのスクリプト
// apps/tools/parari/src/app/mypage/page.tsx
// apps/tools/parari/src/app/mypage/page.tsx
// 2026-04-25 JST

//"use client";
//
///**
// * PART: Reader Home / My Shelf
// * コメント:
// * - /mypage を「読者HOME / 自分の書棚」にする
// * - 本棚環境では黒帯 ControlBar を使わない
// * - 上部は BookshelfControlBar の1本だけにする
// * - 外側背景色は profiles の shelf_page_theme を使う
// * - バー色は profiles の shelf_bar_theme を使う
// * - アコーディオン内部色は BookShelfPanel 側で別途対応する
// */
//
//import React from "react";
//import { useRouter } from "next/navigation";
//import { supabase } from "../../lib/supabaseClient";
//import BookShelfPanel from "../../components/parari/BookShelfPanel";
//import BookshelfControlBar from "../../components/parari/BookshelfControlBar";
//import { getThemeClass, normalizeTheme } from "../../lib/shelfTheme";
//
///**
// * PART: profile theme row type
// * コメント:
// * - 本棚用テーマ3項目を profiles から読む
// */
//type ProfileThemeRow = {
//  shelf_bar_theme: string | null;
//  shelf_page_theme: string | null;
//  shelf_panel_theme: string | null;
//};
//
///**
// * PART: ShelfTab
// * コメント:
// * - 本棚内の表示タブ
// * - BookshelfControlBar と BookShelfPanel に渡す
// */
//type ShelfTab =
//  | "home"
//  | "shelf"
//  | "managed"
//  | "participant"
//  | "read_later"
//  | "viewed";
//
//export default function MyPage() {
//  const router = useRouter();
//
//  /**
//   * PART: screen state
//   * コメント:
//   * - status はログイン確認用
//   * - theme は本棚の見た目用
//   */
//  const [status, setStatus] = React.useState<string>("loading…");
//  const [barTheme, setBarTheme] = React.useState<string | null>("cream");
//  const [pageTheme, setPageTheme] = React.useState<string | null>("cream");
//    
//    // apps/tools/parari/src/app/mypage/page.tsx
//    // 2026-04-25 JST
//
//    /**
//     * PART: active shelf tab state
//     * コメント:
//     * - ピンクのバー側で選んだ棚を本文に反映する
//     */
//    const [activeShelfTab, setActiveShelfTab] =
//      React.useState<ShelfTab>("shelf");
//
//  React.useEffect(() => {
//    let mounted = true;
//
//    async function checkLoginAndLoadTheme() {
//      if (!supabase) {
//        if (!mounted) return;
//        setStatus("not-logged-in");
//        return;
//      }
//
//      /**
//       * PART: get auth user
//       * コメント:
//       * - まずログイン状態を確認する
//       */
//      const { data: userData, error: userErr } = await supabase.auth.getUser();
//
//      if (!mounted) return;
//
//      if (userErr) {
//        setStatus("failed: " + userErr.message);
//        return;
//      }
//
//      if (!userData.user) {
//        setStatus("not-logged-in");
//        return;
//      }
//
//      /**
//       * PART: load profile theme
//       * コメント:
//       * - user_id 基準で profiles を読む
//       * - 値が null のときは normalizeTheme 側で cream に寄せる
//       */
//      const { data: profile, error: profileErr } = await supabase
//        .from("profiles")
//        .select("shelf_bar_theme, shelf_page_theme, shelf_panel_theme")
//        .eq("user_id", userData.user.id)
//        .maybeSingle<ProfileThemeRow>();
//
//      if (!mounted) return;
//
//      if (profileErr) {
//        setStatus("failed: " + profileErr.message);
//        return;
//      }
//
//      setBarTheme(profile?.shelf_bar_theme ?? "cream");
//      setPageTheme(profile?.shelf_page_theme ?? "cream");
//      setStatus("");
//    }
//
//    void checkLoginAndLoadTheme();
//
//    return () => {
//      mounted = false;
//    };
//  }, []);
//
//  React.useEffect(() => {
//    if (status === "not-logged-in") {
//      router.replace("/");
//    }
//  }, [status, router]);
//
//  if (status === "not-logged-in") return null;
//
//  /**
//   * PART: theme class resolve
//   * コメント:
//   * - page は外側背景
//   * - bar は BookshelfControlBar に渡す
//   */
//  const resolvedPageTheme = normalizeTheme(pageTheme);
//  const themePage = getThemeClass(resolvedPageTheme);
//
//  return (
//    <main className={`min-h-screen ${themePage.page}`}>
//          <BookshelfControlBar
//            current="bookshelf"
//            barTheme={barTheme}
//            activeShelfTab={activeShelfTab}
//            onShelfTabChange={setActiveShelfTab}
//          />
//
//      <div className="mx-auto max-w-5xl space-y-5 px-4 py-4">
//        {status ? <div className="text-xs opacity-70">{status}</div> : null}
//          
//
//          {/* PART: PARARI official shelf */}
//          {/* コメント:
//              - 左端の 🏠 タブで表示するPARARI公式本棚
//              - まずは静的カードで場所だけ確保する
//              - 将来は parari 公式アカウントの作品一覧に差し替える
//          */}
//          {activeShelfTab === "home" ? (
//            <section className="rounded-2xl border border-neutral-200 bg-white/75 p-4 shadow-sm">
//              <div className="mb-4">
//                <div className="text-sm font-semibold text-neutral-900">
//                  PARARI公式本棚
//                </div>
//                <p className="mt-1 text-xs leading-5 text-neutral-500">
//                  PARARIからのお知らせ、使い方ガイド、メンテナンス情報を置く場所です。
//                </p>
//              </div>
//
//                                                      <div className="mb-4 rounded-xl border border-neutral-200 bg-white/70 p-4">
//                                                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
//                                                          <div>
//                                                            <div className="text-sm font-semibold text-neutral-900">
//                                                              プランとお支払い
//                                                            </div>
//                                                            <p className="mt-1 text-xs leading-5 text-neutral-500">
//                                                              現在のプラン確認、Plus申込、請求管理はこちらから行えます。
//                                                            </p>
//                                                          </div>
//
//                                                          <a
//                                                            href="/billing"
//                                                            className="inline-flex items-center justify-center rounded-full border border-neutral-300 bg-white px-4 py-2 text-xs font-semibold text-neutral-800 shadow-sm transition hover:bg-neutral-50"
//                                                          >
//                                                            プランを確認する
//                                                          </a>
//                                                        </div>
//                                                      </div>
//                                        
//              <div className="grid gap-3 sm:grid-cols-2">
//                <a
//                  href="/parari"
//                  className="rounded-xl border border-neutral-200 bg-white p-4 text-sm shadow-sm transition hover:bg-neutral-50"
//                >
//                  <div className="font-semibold text-neutral-900">
//                    PARARI公式ページ
//                  </div>
//                  <p className="mt-2 text-xs leading-5 text-neutral-500">
//                    公式BOOKやお知らせはこちらから確認できます。
//                  </p>
//                </a>
//
//                <div className="rounded-xl border border-dashed border-neutral-200 bg-white/60 p-4 text-sm">
//                  <div className="font-semibold text-neutral-700">
//                    お知らせBOOK準備中
//                  </div>
//                  <p className="mt-2 text-xs leading-5 text-neutral-500">
//                    障害・メンテナンス情報や更新履歴を、PARARI作品として置けるようにします。
//                  </p>
//                </div>
//              </div>
//            </section>
//          ) : (
//            <BookShelfPanel activeTab={activeShelfTab} />
//          )}
//          
//      </div>
//    </main>
//  );
//}
