"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase as sharedSupabase } from "@/lib/supabaseClient";

type ContextRow = {
  membership_id: string;
};

type ActiveThread = {
  thread_id: string;
  other_user_id: string;
  display_name: string;
  photo_url: string | null;
  affiliation: string | null;
  role_title: string | null;
  organization_key: string;
  last_message_at: string | null;
  last_message_body: string | null;
  session_started_at: string | null;
  session_expires_at: string | null;
  extension_count: number;
};

export default function LiveConversationControl() {
  const supabase = useMemo(() => sharedSupabase, []);
  const [threads, setThreads] = useState<ActiveThread[]>([]);
  const [busyThreadId, setBusyThreadId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [nowMs, setNowMs] = useState(() => Date.now());
  const channelRef = useRef<RealtimeChannel | null>(null);
  const autoEndingRef = useRef<Set<string>>(new Set());

  const refresh = useCallback(async () => {
    if (!supabase) return;
    const { data, error } = await supabase.rpc("cpp_live_active_threads_timed");
    if (error) {
      setErrorMessage(error.message);
      return;
    }
    setThreads((data ?? []) as ActiveThread[]);
    setErrorMessage("");
  }, [supabase]);

  const broadcastRefresh = useCallback(() => {
    const channel = channelRef.current;
    if (!channel) return;
    void channel.send({ type: "broadcast", event: "conversation_refresh", payload: {} });
  }, []);

  const finishConversation = useCallback(async (thread: ActiveThread, askConfirm: boolean) => {
    if (!supabase || busyThreadId || autoEndingRef.current.has(thread.thread_id)) return;

    if (askConfirm) {
      const confirmed = window.confirm(`${thread.display_name}さんとの会話を終了しますか？\nメッセージ履歴は残ります。`);
      if (!confirmed) return;
    }

    autoEndingRef.current.add(thread.thread_id);
    setBusyThreadId(thread.thread_id);
    setErrorMessage("");

    const { error } = await supabase.rpc("cpp_live_end_conversation", {
      p_thread_id: thread.thread_id,
    });

    setBusyThreadId(null);
    autoEndingRef.current.delete(thread.thread_id);

    if (error) {
      setErrorMessage(`会話を終了できませんでした: ${error.message}`);
      return;
    }

    await refresh();
    broadcastRefresh();
  }, [supabase, busyThreadId, refresh, broadcastRefresh]);

  const extendConversation = useCallback(async (thread: ActiveThread) => {
    if (!supabase || busyThreadId || thread.extension_count >= 1) return;

    setBusyThreadId(thread.thread_id);
    setErrorMessage("");

    const { error } = await supabase.rpc("cpp_live_extend_conversation", {
      p_thread_id: thread.thread_id,
    });

    setBusyThreadId(null);

    if (error) {
      setErrorMessage(`延長できませんでした: ${error.message}`);
      return;
    }

    await refresh();
    broadcastRefresh();
  }, [supabase, busyThreadId, refresh, broadcastRefresh]);

  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    for (const thread of threads) {
      if (!thread.session_expires_at) continue;
      const remainingMs = new Date(thread.session_expires_at).getTime() - nowMs;
      if (remainingMs <= 0 && !autoEndingRef.current.has(thread.thread_id)) {
        void finishConversation(thread, false);
      }
    }
  }, [threads, nowMs, finishConversation]);

  useEffect(() => {
    let active = true;
    let cleanup: (() => void) | null = null;

    const start = async () => {
      if (!supabase) return;

      const [{ data: authData }, { data: sessionData }] = await Promise.all([
        supabase.auth.getUser(),
        supabase.auth.getSession(),
      ]);
      if (!active || !authData.user) return;

      const { data: contextData } = await supabase.rpc("cpp_matching_context");
      if (!active) return;
      const context = ((contextData ?? [])[0] as ContextRow | undefined) ?? null;
      if (!context) return;

      await refresh();

      if (sessionData.session?.access_token) {
        await supabase.realtime.setAuth(sessionData.session.access_token);
      }
      if (!active) return;

      const channel = supabase.channel(`cpp-live:${context.membership_id}`, {
        config: {
          private: true,
          broadcast: { self: false },
        },
      });
      channelRef.current = channel;

      channel.on("broadcast", { event: "conversation_refresh" }, () => {
        void refresh();
      });

      channel.subscribe();

      cleanup = () => {
        channelRef.current = null;
        void supabase.removeChannel(channel);
      };
    };

    void start();
    return () => {
      active = false;
      cleanup?.();
    };
  }, [supabase, refresh]);

  if (threads.length === 0 && !errorMessage) return null;

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[70] w-[min(380px,calc(100vw-2rem))]">
      <div className="pointer-events-auto rounded-[1.5rem] border border-neutral-200 bg-white/95 p-4 shadow-xl backdrop-blur">
        <div className="flex items-center justify-between gap-3">
          <div className="text-[10px] font-black tracking-[0.15em] text-neutral-400">LIVE CHAT CONTROL</div>
          <div className="text-[10px] font-bold text-neutral-400">1 TALK = 10 MIN</div>
        </div>

        {errorMessage ? (
          <div className="mt-2 rounded-xl bg-red-50 px-3 py-2 text-xs text-red-700">{errorMessage}</div>
        ) : null}

        {threads.length > 0 ? (
          <div className="mt-3 space-y-2">
            {threads.map((thread) => {
              const remainingSeconds = getRemainingSeconds(thread.session_expires_at, nowMs);
              const warning = remainingSeconds <= 120;
              const expired = remainingSeconds <= 0;

              return (
                <div key={thread.thread_id} className={`rounded-2xl px-3 py-3 ${warning ? "bg-amber-50" : "bg-neutral-50"}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-black text-neutral-950">{thread.display_name}</div>
                      <div className="mt-0.5 truncate text-[11px] text-neutral-500">
                        {[thread.affiliation, thread.role_title].filter(Boolean).join(" · ") || "会話中"}
                      </div>
                    </div>
                    <div className={`shrink-0 font-mono text-lg font-black tabular-nums ${warning ? "text-amber-700" : "text-neutral-900"}`}>
                      {expired ? "0:00" : formatRemaining(remainingSeconds)}
                    </div>
                  </div>

                  {warning && !expired ? (
                    <div className="mt-2 text-[11px] font-bold text-amber-700">残り2分を切りました。</div>
                  ) : null}

                  <div className="mt-3 flex flex-wrap justify-end gap-2">
                    {thread.extension_count < 1 && !expired ? (
                      <button
                        type="button"
                        onClick={() => void extendConversation(thread)}
                        disabled={Boolean(busyThreadId)}
                        className="rounded-full border border-neutral-300 bg-white px-3 py-2 text-xs font-bold text-neutral-700 hover:bg-neutral-100 disabled:opacity-40"
                      >
                        {busyThreadId === thread.thread_id ? "処理中…" : "＋5分延長"}
                      </button>
                    ) : thread.extension_count >= 1 ? (
                      <span className="rounded-full bg-white px-3 py-2 text-[11px] font-bold text-neutral-400">延長済み</span>
                    ) : null}

                    <button
                      type="button"
                      onClick={() => void finishConversation(thread, true)}
                      disabled={Boolean(busyThreadId)}
                      className="rounded-full border border-red-200 bg-white px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-50 disabled:opacity-40"
                    >
                      {busyThreadId === thread.thread_id ? "終了中…" : "会話を終了"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function getRemainingSeconds(expiresAt: string | null, nowMs: number) {
  if (!expiresAt) return 0;
  return Math.max(0, Math.ceil((new Date(expiresAt).getTime() - nowMs) / 1000));
}

function formatRemaining(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${minutes}:${String(rest).padStart(2, "0")}`;
}
