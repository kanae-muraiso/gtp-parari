"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase as sharedSupabase } from "@/lib/supabaseClient";

export default function CppLiveKnockLayer() {
  const supabase = useMemo(() => sharedSupabase, []);
  const [userId, setUserId] = useState(null);
  const [membershipId, setMembershipId] = useState(null);
  const [knocks, setKnocks] = useState([]);
  const [busyId, setBusyId] = useState(null);
  const [notice, setNotice] = useState("");
  const channelRef = useRef(null);

  const refreshKnocks = useCallback(async () => {
    if (!supabase) return [];
    const { data, error } = await supabase.rpc("cpp_live_pending_knocks");
    if (error) {
      console.error("CPP LIVE knocks:", error);
      return [];
    }
    const rows = data || [];
    setKnocks(rows);
    return rows;
  }, [supabase]);

  const broadcastRefresh = useCallback(async () => {
    const channel = channelRef.current;
    if (!channel) return;
    await channel.send({ type: "broadcast", event: "conversation_refresh", payload: {} });
  }, []);

  useEffect(() => {
    if (!supabase) return;
    let cancelled = false;

    const start = async () => {
      const { data: authData } = await supabase.auth.getUser();
      if (cancelled || !authData.user) return;
      setUserId(authData.user.id);

      const { data: contextData } = await supabase.rpc("cpp_matching_context");
      if (cancelled) return;
      const context = (contextData || [])[0];
      if (!context?.membership_id) return;
      setMembershipId(context.membership_id);
      await refreshKnocks();
    };

    void start();
    return () => { cancelled = true; };
  }, [refreshKnocks, supabase]);

  useEffect(() => {
    if (!supabase || !userId || !membershipId) return;
    let cancelled = false;

    const connect = async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      if (cancelled) return;
      if (sessionData.session?.access_token) {
        await supabase.realtime.setAuth(sessionData.session.access_token);
      }

      const channel = supabase.channel(`cpp-live:${membershipId}`, {
        config: { private: true, broadcast: { self: true } },
      });
      channelRef.current = channel;
      channel.on("broadcast", { event: "conversation_refresh" }, () => void refreshKnocks());
      channel.subscribe();
    };

    void connect();

    const poll = window.setInterval(() => void refreshKnocks(), 2500);
    const onFocus = () => void refreshKnocks();
    const onVisibility = () => {
      if (document.visibilityState === "visible") void refreshKnocks();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      window.clearInterval(poll);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
      const channel = channelRef.current;
      channelRef.current = null;
      if (channel) void supabase.removeChannel(channel);
    };
  }, [membershipId, refreshKnocks, supabase, userId]);

  const acknowledge = async (requestId) => {
    const { error } = await supabase.rpc("cpp_live_acknowledge_knock", { p_request_id: requestId });
    if (error) throw error;
  };

  const dismissKnock = async (knock) => {
    if (!supabase || busyId) return;
    setBusyId(knock.request_id);
    setNotice("");
    try {
      await acknowledge(knock.request_id);
      await refreshKnocks();
      await broadcastRefresh();
    } catch (error) {
      setNotice(error?.message || "ノックを閉じられませんでした。");
    } finally {
      setBusyId(null);
    }
  };

  const returnKnock = async (knock) => {
    if (!supabase || busyId) return;
    setBusyId(knock.request_id);
    setNotice("");
    try {
      const { data, error } = await supabase.rpc("cpp_live_request_conversation", {
        p_target_user_id: knock.other_user_id,
      });
      if (error) throw error;

      await acknowledge(knock.request_id);
      const nextKnocks = await refreshKnocks();
      await broadcastRefresh();

      const result = (data || [])[0];
      if (result?.request_status === "accepted" && result?.thread_id) {
        setNotice(`${knock.display_name}さんとの会話を開きます。`);
      } else if (nextKnocks.some((row) => row.direction === "outgoing" && row.other_user_id === knock.other_user_id)) {
        setNotice(`${knock.display_name}さんも今は離席中です。声をかけておきました。`);
      } else {
        setNotice(`${knock.display_name}さんに話しかけました。`);
      }
    } catch (error) {
      const message = error?.message || "話しかけられませんでした。";
      setNotice(message.includes("not currently in CPP LIVE") ? `${knock.display_name}さんは今はLIVEにいないようです。` : message);
    } finally {
      setBusyId(null);
    }
  };

  const cancelKnock = async (knock) => {
    if (!supabase || busyId) return;
    setBusyId(knock.request_id);
    setNotice("");
    try {
      const { error } = await supabase.rpc("cpp_live_cancel_conversation_request", {
        p_request_id: knock.request_id,
      });
      if (error) throw error;
      await refreshKnocks();
      await broadcastRefresh();
    } catch (error) {
      setNotice(error?.message || "声かけを取り消せませんでした。");
    } finally {
      setBusyId(null);
    }
  };

  const incoming = knocks.filter((row) => row.direction === "incoming" && row.my_is_live && row.my_availability !== "away");
  const outgoing = knocks.filter((row) => row.direction === "outgoing" && row.my_is_live);

  if (!incoming.length && !outgoing.length && !notice) return null;

  return (
    <div className="pointer-events-none fixed right-3 top-24 z-[80] w-[min(92vw,390px)] space-y-2 sm:right-6">
      {notice ? (
        <div className="pointer-events-auto flex items-start justify-between gap-3 rounded-2xl border border-neutral-200 bg-neutral-950 px-4 py-3 text-sm font-bold text-white shadow-xl">
          <span>{notice}</span>
          <button type="button" onClick={() => setNotice("")} className="shrink-0 text-xs text-white/60 hover:text-white">閉じる</button>
        </div>
      ) : null}

      {incoming.length ? (
        <section className="pointer-events-auto overflow-hidden rounded-3xl border border-amber-200 bg-white shadow-xl">
          <div className="border-b border-amber-100 bg-amber-50 px-4 py-3">
            <div className="text-[10px] font-black tracking-[0.14em] text-amber-700">KNOCK</div>
            <div className="mt-1 text-sm font-black text-neutral-950">離席中に声をかけた人がいます · {incoming.length}</div>
          </div>
          <div className="divide-y divide-neutral-100">
            {incoming.map((knock) => (
              <div key={knock.request_id} className="px-4 py-3">
                <div className="flex items-center gap-3">
                  {knock.photo_url ? <img src={knock.photo_url} alt="" className="h-9 w-9 rounded-full object-cover" /> : <div className="flex h-9 w-9 items-center justify-center rounded-full bg-neutral-900 text-xs font-black text-white">{String(knock.display_name || "P").slice(0, 1)}</div>}
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-black text-neutral-950">{knock.display_name}</div>
                    <div className="mt-0.5 text-[11px] text-neutral-500">{formatTime(knock.created_at)} に声をかけました</div>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" onClick={() => void returnKnock(knock)} disabled={Boolean(busyId)} className="rounded-full bg-neutral-950 px-4 py-2 text-xs font-black text-white disabled:opacity-35">話しかけ返す</button>
                  <button type="button" onClick={() => void dismissKnock(knock)} disabled={Boolean(busyId)} className="rounded-full border border-neutral-300 px-4 py-2 text-xs font-bold text-neutral-500 disabled:opacity-35">閉じる</button>
                  {!knock.other_is_live ? <span className="self-center text-[10px] font-bold text-neutral-400">現在はLIVE外</span> : knock.other_availability === "away" ? <span className="self-center text-[10px] font-bold text-neutral-400">相手も離席中</span> : null}
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {outgoing.map((knock) => (
        <div key={knock.request_id} className="pointer-events-auto rounded-2xl border border-neutral-200 bg-white px-4 py-3 shadow-lg">
          <div className="text-[10px] font-black tracking-[0.12em] text-neutral-400">KNOCK</div>
          <div className="mt-1 text-sm font-black text-neutral-900">{knock.display_name}さんに声をかけてあります</div>
          <div className="mt-1 text-[11px] text-neutral-500">返事待ちではありません。あなたはそのままLIVEを動けます。</div>
          <button type="button" onClick={() => void cancelKnock(knock)} disabled={Boolean(busyId)} className="mt-2 rounded-full border border-neutral-300 px-3 py-1.5 text-[11px] font-bold text-neutral-500 disabled:opacity-35">取り消す</button>
        </div>
      ))}
    </div>
  );
}

function formatTime(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat("ja-JP", { hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}
