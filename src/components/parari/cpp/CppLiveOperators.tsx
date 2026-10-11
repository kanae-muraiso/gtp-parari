"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Staff = {
  user_id: string;
  display_name: string;
  photo_url: string | null;
  is_me: boolean;
};

export default function CppLiveOperators() {
  const [isOperatorMode, setIsOperatorMode] = useState(false);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    if (!supabase) return;
    const [modeResult, rosterResult] = await Promise.all([
      supabase.rpc("cpp_mode_status"),
      supabase.rpc("cpp_live_operator_roster"),
    ]);
    if (modeResult.error || rosterResult.error) {
      setError("運営スタッフの状態を確認できませんでした。");
      return;
    }
    setIsOperatorMode(modeResult.data?.[0]?.mode === "admin");
    setStaff((rosterResult.data ?? []) as Staff[]);
    setError("");
  }, []);

  useEffect(() => {
    void refresh();
    const interval = window.setInterval(async () => {
      if (!supabase) return;
      const mode = await supabase.rpc("cpp_mode_status");
      const isAdmin = mode.data?.[0]?.mode === "admin";
      if (isAdmin) {
        // Heartbeat only updates an explicitly started presence. It cannot
        // automatically register someone as an operator.
        await supabase.rpc("cpp_live_operator_heartbeat");
      }
      await refresh();
    }, 30000);
    return () => window.clearInterval(interval);
  }, [refresh]);

  const myPresence = staff.some((person) => person.is_me);

  async function toggle() {
    if (!supabase || busy || !isOperatorMode) return;
    setBusy(true);
    const { error: rpcError } = await supabase.rpc("cpp_live_operator_presence", {
      p_active: !myPresence,
    });
    if (rpcError) setError(rpcError.message);
    else await refresh();
    setBusy(false);
  }

  if (!staff.length && !isOperatorMode) return null;
  return (
    <section className="mx-auto mt-4 max-w-5xl rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm"
      aria-label="CPP LIVE運営スタッフ">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold">CPP LIVE 運営スタッフ</h2>
          <p className="mt-1 text-xs text-neutral-500">
            運営者は通常の会話候補には表示されません。
          </p>
        </div>
        {isOperatorMode && (
          <button type="button" onClick={() => void toggle()} disabled={busy}
            className="rounded-full border border-neutral-300 px-4 py-2 text-xs font-bold disabled:opacity-50">
            {busy ? "処理中…" : myPresence ? "運営参加を終了" : "管理者として会場に参加"}
          </button>
        )}
      </div>
      {staff.length > 0 && <div className="mt-4 flex flex-wrap gap-3">
        {staff.map(person => (
          <div key={person.user_id} className="flex items-center gap-2 rounded-xl bg-neutral-50 px-3 py-2">
            {person.photo_url
              ? <img src={person.photo_url} alt="" className="h-8 w-8 rounded-full object-cover" />
              : <div className="flex h-8 w-8 items-center justify-center rounded-full bg-neutral-200 text-xs">運営</div>}
            <span className="text-xs font-semibold">{person.display_name} · 管理者</span>
          </div>
        ))}
      </div>}
      {error && <p role="alert" className="mt-2 text-xs text-red-700">{error}</p>}
    </section>
  );
}
