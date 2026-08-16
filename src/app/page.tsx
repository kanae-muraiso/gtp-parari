// apps/tools/parari/src/app/page.tsx
// apps/tools/parari/src/app/page.tsx
// 2026-04-26 JST

"use client";

/**
 * PART: Root Home Page
 * コメント:
 * - parari.app の公式トップページ
 * - 未ログインならこのページに公式説明を表示する
 * - ログイン済みなら /mypage へ移動する
 * - SEOのため「PARARI（パラリ）」「ぱらり」を本文に明示する
 */

import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabaseClient";

/**
 * PART: device helper
 * コメント:
 * - OnePAGE はスマホ導線を優先する
 * - 開発中のPC判定も含め、まずは幅基準で十分
 */
function isSmartphoneViewport() {
  if (typeof window === "undefined") return false;
  return window.innerWidth <= 768;
}

export default function HomePage() {
  const router = useRouter();
  const [checking, setChecking] = React.useState(true);

  React.useEffect(() => {
    let mounted = true;

    async function checkAuthAndRedirect() {
      if (!supabase) {
        if (!mounted) return;
        setChecking(false);
        return;
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!mounted) return;

      // PART: not logged in
      // コメント:
      // - 未ログインユーザーには公式トップページを表示する
      if (!user) {
        setChecking(false);
        return;
      }

      // PART: logged in
      router.replace("/mypage");
    }

    void checkAuthAndRedirect();

    return () => {
      mounted = false;
    };
  }, [router]);

  if (checking) {
    return <main className="min-h-screen bg-white" />;
  }

  return (
    <main className="min-h-screen bg-[#f7f4ee] text-neutral-900">
      {/* PART: hero */}
      <section className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center px-6 py-16">
        <p className="mb-4 text-sm tracking-[0.28em] text-neutral-500">
          PARARI
        </p>

        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
          PARARI（パラリ）
        </h1>

        <p className="mt-6 text-lg leading-8 text-neutral-700">
          写真と文章でページを作り、束ねて1冊の本にできる
          デジタル・コミュニケーションツールです。
        </p>

        <p className="mt-4 text-base leading-8 text-neutral-600">
          ぱらりと読めて、きちんと届く。SNSでは流れてしまう想いや案内を、
          ひとつのURLにまとめて届けられます。
        </p>

        <div className="mt-10 flex flex-wrap gap-3">
          <Link
            href="/login"
            className="rounded-full bg-neutral-900 px-6 py-3 text-sm font-medium text-white"
          >
            ログイン・登録
          </Link>

          <Link
            href="/parari"
            className="rounded-full border border-neutral-300 bg-white px-6 py-3 text-sm font-medium text-neutral-800"
          >
            サンプルを見る
          </Link>
        </div>
      </section>
    </main>
  );
}
