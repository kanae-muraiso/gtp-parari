// apps/tools/parari/src/components/AuthorBar.tsx
// apps/tools/parari/src/components/AuthorBar.tsx
// 2026-03-01 10:40 JST

"use client";

import React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "../lib/supabaseClient";

function getCookie(name: string) {
  if (typeof document === "undefined") return "";
  const m = document.cookie.match(new RegExp("(^| )" + name + "=([^;]+)"));
  return m ? decodeURIComponent(m[2]) : "";
}

function setCookie(name: string, value: string) {
  if (typeof document === "undefined") return;
  document.cookie = `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=31536000; SameSite=Lax`;
}

// pathname から bookId を抜く（useParamsに依存しない）
function extractBookId(pathname: string): string | null {
  const m = pathname.match(/^\/(p|editor)\/([^\/\?#]+)/);
  if (!m) return null;
  const id = m[2];
  const uuidLike = /^[0-9a-fA-F-]{16,}$/; // "new" 等を弾く
  return uuidLike.test(id) ? id : null;
}

export default function AuthorBar() {
  const router = useRouter();
  const pathname = usePathname();

  const isMyPage = pathname === "/mypage" || pathname.startsWith("/mypage/");
  const isEditor = pathname.startsWith("/editor/");
  const isPublicView = pathname.startsWith("/p/");

  const bookId = (isEditor || isPublicView) ? extractBookId(pathname) : null;

  const [userId, setUserId] = React.useState<string | null>(null);
  const [isOwner, setIsOwner] = React.useState(false);
  const [checking, setChecking] = React.useState(false);

  // ログイン状態
  React.useEffect(() => {
    const run = async () => {
      const { data } = await supabase.auth.getUser();
      setUserId(data.user?.id ?? null);
    };
    run();
  }, []);

  // 作者判定（RPC）
  React.useEffect(() => {
    const run = async () => {
      setChecking(true);
      setIsOwner(false);

      if (!userId) {
        setChecking(false);
        return;
      }

      // bookIdなしページ（/mypage等）は「ログイン作者モード」として表示OK
      if (!bookId) {
        setChecking(false);
        return;
      }

      const { data, error } = await supabase.rpc("parari_is_owner", { book_id: bookId });

      if (error) {
        // RPCが未作成/権限不足の場合は黙って非表示（安全側）
        setIsOwner(false);
        setChecking(false);
        return;
      }

      setIsOwner(Boolean(data));
      setChecking(false);
    };

    run();
  }, [bookId, userId]);

  // 表示条件
  if (!userId) return null;

  // /p/[id], /editor/[id] は「作者だけ」
  if (isEditor || isPublicView) {
    if (checking) return null;
    if (!isOwner) return null;
  }

  // 言語（将来ここに集約）
  const locale = (getCookie("parari_locale") === "en" ? "en" : "ja") as "ja" | "en";
  const toggleLocale = () => {
    setCookie("parari_locale", locale === "ja" ? "en" : "ja");
    router.refresh();
  };

  const go = (href: string) => router.push(href);

  const canGoEdit = !!bookId;
  const canGoView = !!bookId;

  return (
    <>
      <div className="fixed left-0 right-0 top-0 z-50 bg-black/90 text-white">
        <div className="mx-auto flex h-10 max-w-2xl items-center gap-3 px-3 text-xs">
          <div className="flex items-center gap-3">
            <button
              className="rounded-md border border-white/25 px-2 py-1 hover:bg-white/10"
              onClick={() => go("/mypage")}
              title="My Page"
            >
              My
            </button>

            {canGoEdit ? (
              <button
                className="rounded-md border border-white/25 px-2 py-1 hover:bg-white/10"
                onClick={() => go(`/editor/${bookId}`)}
                title="Edit"
              >
                Edit
              </button>
            ) : null}

            {canGoView ? (
              <button
                className="rounded-md border border-white/25 px-2 py-1 hover:bg-white/10"
                onClick={() => go(`/p/${bookId}`)}
                title="View"
              >
                View
              </button>
            ) : null}
          </div>

          <div className="ml-auto flex items-center gap-2">
            <button
              className="rounded-md border border-white/25 px-2 py-1 hover:bg-white/10"
              onClick={toggleLocale}
              title="Language"
            >
              {locale.toUpperCase()}
            </button>

            <Link className="rounded-md border border-white/25 px-2 py-1 hover:bg-white/10" href="/" title="Home">
              Home
            </Link>
          </div>
        </div>
      </div>

      {/* fixedバーの分だけ下げる */}
      <div className="h-10" />
    </>
  );
}
