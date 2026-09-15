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
};

export default function LiveConversationControl() {
  const supabase = useMemo(() => sharedSupabase, []);
  const [threads, setThreads] = useState<ActiveThread[]>([]);
  const [busyThreadId, setBusyThreadId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const channelRef = useRef<RealtimeChannel | null>(null);

  const refresh = useCallback(async () => {
    if (!supabase) return;
    const { data, error } = await supabase.rpc("cpp_live_active_threads");
    if (error) {
      setErrorMessage(error.message);
      return;
    }
    setThreads((data ?? []) as ActiveThread[]);
    setErrorMessage("");
  }, [supabase]);

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

  const endConversation = async (thread: ActiveThread) => {
    if (!supabase || busyThreadId) return;
    const confirmed = window.confirm(`${thread.display_name}さんとの会話を終了しますか？\nメッセージ履歴は残ります。`);
    if (!confirmed) return;

    setBusyThreadId(thread.thread_id);
    setErrorMessage("");
    const { error } = await supabase.rpc("cpp_live_end_conversation", {
      p_thread_id: thread.thread_id,
    });
    setBusyThreadId(null);

    if (error) {
      setErrorMessage(`会話を終了できませんでした: ${error.message}`);
      return;
    }

    await refresh();
    const channel = channelRef.current;
    if (channel) {
      void channel.send({ type: "broadcast", event: "conversation_refresh", payload: {} });
    }
  };

  if (threads.length === 0 && !errorMessage) return null;

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[70] w-[min(360px,calc(100vw-2rem))]">
      <div className="pointer-events-auto rounded-[1.5rem] border border-neutral-200 bg-white/95 p-4 shadow-xl backdrop-blur">
        <div className="text-[10px] font-black tracking-[0.15em] text-neutral-400">LIVE CHAT CONTROL</div>
        {errorMessage ? (
          <div className="mt-2 rounded-xl bg-red-50 px-3 py-2 text-xs text-red-700">{errorMessage}</div>
        ) : null}
        {threads.length > 0 ? (
          <div className="mt-3 space-y-2">
            {threads.map((thread) => (
              <div key={thread.thread_id} className="flex items-center justify-between gap-3 rounded-2xl bg-neutral-50 px-3 py-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-black text-neutral-950">{thread.display_name}</div>
                  <div className="mt-0.5 truncate text-[11px] text-neutral-500">
                    {[thread.affiliation, thread.role_title].filter(Boolean).join(" · ") || "会話中"}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => void endConversation(thread)}
                  disabled={Boolean(busyThreadId)}
                  className="shrink-0 rounded-full border border-red-200 bg-white px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-50 disabled:opacity-40"
                >
                  {busyThreadId === thread.thread_id ? "終了中…" : "会話を終了"}
                </button>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
