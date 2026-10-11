"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
type Activity = { messages_7d: number; pairs_7d: number; new_pairs_7d: number };
export default function AlumniMessageActivity() {
  const [data,setData] = useState<Activity | null>(null);
  const [error,setError] = useState("");
  useEffect(() => {
    let mounted = true;
    async function load() {
      if (!supabase) return;
      const { data, error } = await supabase.rpc("cpp_alumni_message_activity");
      if (!mounted) return;
      if (error) setError("交流状況を取得できませんでした。");
      else setData(data?.[0] ?? null);
    }
    void load();
    return () => { mounted = false; };
  }, []);
  return <section aria-label="同窓会の交流状況" className="rounded-3xl border bg-white p-5 shadow-sm sm:p-7">
    <h2 className="text-lg font-bold">同窓会の交流状況（管理者のみ）</h2>
    <p className="mt-1 text-xs text-neutral-500">直近7日間・個人や本文は表示しません。</p>
    {data ? <div className="mt-4 grid grid-cols-3 gap-3">
      {([["送信数",data.messages_7d],["交流した組数",data.pairs_7d],["初めて交流した組数",data.new_pairs_7d]] as const).map(([label,value]) =>
        <div key={label} className="rounded-xl bg-neutral-50 p-3 text-center">
          <div className="text-2xl font-bold tabular-nums">{Number(value).toLocaleString("ja-JP")}</div>
          <div className="mt-1 text-xs text-neutral-600">{label}</div>
        </div>)}
    </div> : <p className="mt-4 text-sm text-neutral-500">{error || "集計中…"}</p>}
  </section>;
}
