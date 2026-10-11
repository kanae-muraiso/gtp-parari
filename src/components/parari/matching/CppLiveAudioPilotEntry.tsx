"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Thread = { thread_id: string; display_name: string | null; session_started_at: string | null; session_expires_at: string | null };

export default function CppLiveAudioPilotEntry() {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    async function load() {
      if (!supabase) return;
      const { data, error: queryError } = await supabase.rpc("cpp_live_active_threads_timed");
      if (!active) return;
      if (queryError) { setError("通話候補を取得できませんでした。"); return; }
      const now = Date.now();
      setThreads(((data ?? []) as Thread[]).filter(t => {
        if (!t.session_started_at || !t.session_expires_at) return false;
        const start = Date.parse(t.session_started_at);
        const end = Math.min(Date.parse(t.session_expires_at), start + 600000);
        return Number.isFinite(start) && start <= now && now < end;
      }));
    }
    void load();
    return () => { active = false; };
  }, []);
  return (
    <aside className="mx-auto max-w-5xl px-4 py-4">
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
        <h2 className="text-sm font-bold">Preview限定：Daily通話テスト</h2>
        <p className="mt-1 text-xs text-neutral-600">有効なCPP LIVE会話がある場合だけ、その会話の音声テストに進めます。</p>
        {threads.map(t => (
          <Link key={t.thread_id}
            href={`/my/cpp/live/audio-pilot?threadId=${encodeURIComponent(t.thread_id)}`}
            className="mt-3 block rounded-lg bg-neutral-900 px-4 py-3 text-sm text-white">
            {t.display_name || "会話相手"}と通話テスト
          </Link>
        ))}
        {error && <p className="mt-2 text-xs text-red-700">{error}</p>}
        {!threads.length && !error && <p className="mt-2 text-xs text-neutral-600">現在、通話可能な会話はありません。</p>}
      </div>
    </aside>
  );
}
