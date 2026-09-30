"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { isCppTestSession } from "@/lib/cppTestSession";

export default function CppTestBanner() {
  const [testing, setTesting] = useState(false);
  useEffect(() => { setTesting(isCppTestSession()); }, []);
  if (!testing) return null;
  return <aside aria-label="一般会員テスト" className="fixed bottom-3 left-3 right-3 z-[200] mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3 rounded-2xl border-2 border-red-600 bg-white p-4 text-sm shadow-xl">
    <div><strong className="text-red-700">一般会員としてテスト中</strong><p className="mt-1 text-xs text-neutral-600">専用アカウントに保存されます。ご本人のプロフィールは変更されません。</p></div>
    <Link href="/my/cpp/test/exit" className="rounded-full bg-red-700 px-4 py-2 font-bold text-white">テストを終了して管理者に戻る</Link>
  </aside>;
}
