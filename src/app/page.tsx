// apps/tools/parari/src/app/page.tsx
// 2026-09-15 JST

"use client";

/**
 * PART: Root Home Page
 * コメント:
 * - parari.app の公式トップページ
 * - 未ログインならこのページに公式説明を表示する
 * - ログイン済みならユーザー設定に応じて LIBRARY / STUDIO へ移動する
 */

import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabaseClient";
import { resolveParariStartPath } from "@/lib/parariWorkspace";

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

      if (!user) {
        setChecking(false);
        return;
      }

      const startPath = await resolveParariStartPath(user.id);
      if (!mounted) return;

      router.replace(startPath);
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
            href="https://parari.cpp.co.jp/"
            className="rounded-full border border-neutral-300 bg-white px-6 py-3 text-sm font-medium text-neutral-800"
          >
            パラリとは？
          </Link>
        </div>
      </section>
    </main>
  );
}
