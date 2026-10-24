// src/app/my/cpp/ai/page.tsx
// 2026-10-09 JST — PART: CPP AI identity boundary
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import CppAiChat from "@/components/parari/cpp/CppAiChat";
import { supabase } from "@/lib/supabaseClient";

export default function CppAiPage() {
  const [userId, setUserId] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    if (!supabase) { setUserId(null); return; }
    // INITIAL_SESSION and subsequent changes come through the same ordered channel.
    // A different identity remounts the chat, discarding all private in-memory state.
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user.id ?? null);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  return (
    <main className="min-h-screen bg-neutral-100 px-4 py-8 sm:px-6 sm:py-12">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 text-sm">
          <Link href="/my/cpp/home" className="font-bold text-neutral-600 hover:underline">← CPPホーム</Link>
          <Link href="/my/cpp" target="_blank" rel="noopener noreferrer" className="font-bold text-neutral-600 hover:underline">プロフィールを編集（別タブ） ↗</Link>
        </div>
        <header className="rounded-3xl border border-neutral-200 bg-white p-6 sm:p-8">
          <p className="text-xs font-black tracking-widest text-neutral-500">CPP AI</p>
          <h1 className="mt-3 text-2xl font-black tracking-tight text-neutral-950 sm:text-3xl">研究経験から、これからを考える。</h1>
          <p className="mt-4 text-sm leading-7 text-neutral-600">あなたが何を問い、どう考え、何をしてきたのか。対話を通じて専門性や関心を言葉にし、プロフィールと次の一歩を一緒に考えます。</p>
        </header>
        {userId === undefined ? <p role="status" className="py-8 text-sm text-neutral-600">ログインを確認しています…</p> : userId ? (
          <CppAiChat key={userId} userId={userId} onIdentityChange={setUserId} />
        ) : (
          <section className="mt-5 rounded-3xl border border-neutral-200 bg-white p-6">
            <p className="text-sm text-neutral-600">CPPに登録したPARARIアカウントでログインしてください。</p>
            <Link href="/login?returnTo=/my/cpp/ai" className="mt-4 inline-flex rounded-full bg-neutral-950 px-5 py-3 text-sm font-bold text-white">ログインする</Link>
          </section>
        )}
      </div>
    </main>
  );
}
