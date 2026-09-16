"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase as sharedSupabase } from "@/lib/supabaseClient";

export default function CppLiveQueueStatus() {
  const supabase = useMemo(() => sharedSupabase, []);
  const [userId, setUserId] = useState(null);
  const [rows, setRows] = useState([]);

  const refresh = useCallback(async () => {
    if (!supabase) return;
    const { data, error } = await supabase.rpc("cpp_live_queue_snapshot");
    if (!error) setRows(data || []);
  }, [supabase]);

  useEffect(() => {
    if (!supabase) return;
    let cancelled = false;

    void supabase.auth.getUser().then(({ data }) => {
      if (cancelled) return;
      setUserId(data.user?.id || null);
      if (data.user) void refresh();
    });

    const timer = window.setInterval(() => void refresh(), 2500);
    const onFocus = () => void refresh();
    const onVisibility = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [refresh, supabase]);

  if (!userId || rows.length === 0) return null;

  const ordered = [...rows].sort((a, b) => {
    if (a.host_display_name !== b.host_display_name) {
      return String(a.host_display_name || "").localeCompare(String(b.host_display_name || ""), "ja");
    }
    if (a.queue_status !== b.queue_status) return a.queue_status === "waiting" ? -1 : 1;
    return Number(a.queue_position || 0) - Number(b.queue_position || 0);
  });

  return (
    <aside className="fixed bottom-4 left-4 z-[70] w-[min(360px,calc(100vw-2rem))] rounded-2xl border border-amber-200 bg-white/95 p-3 shadow-xl backdrop-blur">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-[10px] font-black tracking-[0.16em] text-amber-700">WAITING</div>
          <div className="mt-0.5 text-xs font-black text-neutral-900">誰を待っているか</div>
        </div>
        <div className="rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-black text-amber-800">{rows.length}人</div>
      </div>

      <div className="mt-2 max-h-52 space-y-1.5 overflow-y-auto pr-1">
        {ordered.map((row) => {
          const mine = row.requester_user_id === userId;
          const position = row.queue_status === "waiting"
            ? `${row.queue_position}番`
            : `キャンセル待ち ${row.queue_position}`;
          return (
            <div key={row.queue_id} className={`flex items-center gap-2 rounded-xl px-2.5 py-2 text-[11px] ${mine ? "bg-amber-100" : "bg-neutral-50"}`}>
              <span className={`min-w-0 flex-1 truncate font-bold ${mine ? "text-amber-950" : "text-neutral-700"}`}>
                {mine ? "あなた" : row.display_name}
              </span>
              <span className="shrink-0 text-neutral-400">→</span>
              <span className="min-w-0 flex-1 truncate font-black text-neutral-900">{row.host_display_name}</span>
              <span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-black ${row.queue_status === "waiting" ? "bg-amber-200 text-amber-900" : "bg-neutral-200 text-neutral-600"}`}>
                {position}
              </span>
            </div>
          );
        })}
      </div>

      <div className="mt-2 text-[10px] leading-4 text-neutral-400">待ち先は1人だけです。別の人を待つと、待ち先が切り替わります。</div>
    </aside>
  );
}
