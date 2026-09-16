"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase as sharedSupabase } from "@/lib/supabaseClient";

export default function CppLiveStayWarning() {
  const supabase = useMemo(() => sharedSupabase, []);
  const [state, setState] = useState(null);

  useEffect(() => {
    let active = true;
    const refresh = async () => {
      if (!supabase) return;
      const { data } = await supabase.rpc("cpp_live_session_state");
      if (!active) return;
      setState((data || [])[0] || null);
    };
    void refresh();
    const timer = window.setInterval(() => void refresh(), 10000);
    return () => { active = false; window.clearInterval(timer); };
  }, [supabase]);

  if (!state?.is_live || state.remaining_seconds <= 0 || state.remaining_seconds > 300) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-3 z-[90] flex justify-center px-4">
      <div className="rounded-full border border-amber-200 bg-amber-50/95 px-4 py-2 text-xs font-black text-amber-800 shadow-sm backdrop-blur">
        LIVE終了予定まであと{Math.max(1, Math.ceil(state.remaining_seconds / 60))}分 · 必要なら上部から＋30分
      </div>
    </div>
  );
}
