"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import SocialProfileCard from "@/components/parari/matching/SocialProfileCard";
import { supabase as sharedSupabase } from "@/lib/supabaseClient";

type ContextRow = {
  membership_id: string;
  organization_id: string | null;
  organization_key: string | null;
  view_organization_id: string | null;
  view_organization_key: string | null;
  joined_at: string;
};

type LiveProfile = {
  user_id: string;
  display_name: string;
  photo_url: string | null;
  affiliation: string | null;
  role_title: string | null;
  topics: string[] | null;
  intro: string | null;
  organization_key: string;
  joined_at: string;
  can_view_deep: boolean;
  deep_kind: "researcher" | "company" | null;
  deep_target_id: string | null;
};

type PendingRequest = {
  request_id: string;
  direction: "incoming" | "outgoing";
  other_user_id: string;
  display_name: string;
  photo_url: string | null;
  affiliation: string | null;
  role_title: string | null;
  organization_key: string;
  created_at: string;
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

type ChatMessage = {
  message_id: string;
  sender_user_id: string;
  body: string;
  created_at: string;
};

type ConversationResult = {
  request_id: string | null;
  request_status: string;
  thread_id: string | null;
};

type ConnectionState = "joining" | "live" | "error";

export default function CppLivePage() {
  const supabase = useMemo(() => sharedSupabase, []);
  const [userId, setUserId] = useState<string | null>(null);
  const [context, setContext] = useState<ContextRow | null>(null);
  const [profiles, setProfiles] = useState<LiveProfile[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [pendingRequests, setPendingRequests] = useState<PendingRequest[]>([]);
  const [activeThreads, setActiveThreads] = useState<ActiveThread[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [connectionState, setConnectionState] = useState<ConnectionState>("joining");
  const [errorMessage, setErrorMessage] = useState("");

  const syncSerial = useRef(0);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const selectedUserIdRef = useRef<string | null>(null);
  const activeThreadIdRef = useRef<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    selectedUserIdRef.current = selectedUserId;
  }, [selectedUserId]);

  useEffect(() => {
    activeThreadIdRef.current = activeThreadId;
  }, [activeThreadId]);

  const refreshMessages = useCallback(async (threadId: string) => {
    if (!supabase) return;
    const { data, error } = await supabase.rpc("cpp_live_messages", { p_thread_id: threadId });
    if (error) {
      setErrorMessage(`チャットの取得に失敗しました: ${error.message}`);
      return;
    }
    setMessages((data ?? []) as ChatMessage[]);
  }, [supabase]);

  const refreshConversations = useCallback(async () => {
    if (!supabase) return;
    const [pendingResult, threadsResult] = await Promise.all([
      supabase.rpc("cpp_live_pending_requests"),
      supabase.rpc("cpp_live_active_threads"),
    ]);

    const firstError = pendingResult.error || threadsResult.error;
    if (firstError) {
      setErrorMessage(`会話状態の取得に失敗しました: ${firstError.message}`);
      return;
    }

    const nextPending = (pendingResult.data ?? []) as PendingRequest[];
    const nextThreads = (threadsResult.data ?? []) as ActiveThread[];
    setPendingRequests(nextPending);
    setActiveThreads(nextThreads);

    const currentThreadId = activeThreadIdRef.current;
    if (currentThreadId && !nextThreads.some((row) => row.thread_id === currentThreadId)) {
      setActiveThreadId(null);
      setMessages([]);
      return;
    }

    if (!currentThreadId) {
      const selectedId = selectedUserIdRef.current;
      const selectedThread = selectedId
        ? nextThreads.find((row) => row.other_user_id === selectedId)
        : null;
      if (selectedThread) setActiveThreadId(selectedThread.thread_id);
    }
  }, [supabase]);

  const broadcastRefresh = useCallback(() => {
    const channel = channelRef.current;
    if (!channel) return;
    void channel.send({ type: "broadcast", event: "conversation_refresh", payload: {} });
  }, []);

  useEffect(() => {
    if (!activeThreadId) {
      setMessages([]);
      return;
    }
    void refreshMessages(activeThreadId);
  }, [activeThreadId, refreshMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ block: "end" });
  }, [messages]);

  useEffect(() => {
    let active = true;
    let cleanupChannel: (() => void) | null = null;

    const start = async () => {
      if (!supabase) {
        setErrorMessage("PARARIの接続設定を確認できませんでした。");
        setConnectionState("error");
        setLoading(false);
        return;
      }

      const [{ data: authData, error: authError }, { data: sessionData }] = await Promise.all([
        supabase.auth.getUser(),
        supabase.auth.getSession(),
      ]);

      if (!active) return;
      if (authError || !authData.user) {
        setLoading(false);
        return;
      }

      const user = authData.user;
      setUserId(user.id);

      const { data: contextData, error: contextError } = await supabase.rpc("cpp_matching_context");
      if (!active) return;
      if (contextError) {
        setErrorMessage(`CPP LIVEの参加情報を取得できませんでした: ${contextError.message}`);
        setConnectionState("error");
        setLoading(false);
        return;
      }

      const nextContext = ((contextData ?? [])[0] as ContextRow | undefined) ?? null;
      setContext(nextContext);
      setLoading(false);
      if (!nextContext) return;

      await refreshConversations();

      if (sessionData.session?.access_token) {
        await supabase.realtime.setAuth(sessionData.session.access_token);
      }
      if (!active) return;

      const channel = supabase.channel(`cpp-live:${nextContext.membership_id}`, {
        config: {
          private: true,
          presence: { key: user.id },
          broadcast: { self: false },
        },
      });
      channelRef.current = channel;

      const refreshProfiles = async () => {
        const state = channel.presenceState();
        const userIds = Object.keys(state);
        const serial = ++syncSerial.current;

        if (userIds.length === 0) {
          if (active) setProfiles([]);
          return;
        }

        const { data, error } = await supabase.rpc("cpp_matching_live_profiles", {
          p_target_user_ids: userIds,
        });
        if (!active || serial !== syncSerial.current) return;

        if (error) {
          setErrorMessage(`LIVEプロフィールの取得に失敗しました: ${error.message}`);
          return;
        }

        const rows = (data ?? []) as LiveProfile[];
        setProfiles(rows);
        setSelectedUserId((current) => (current && rows.some((row) => row.user_id === current) ? current : null));
      };

      channel.on("presence", { event: "sync" }, () => {
        void refreshProfiles();
      });

      channel.on("broadcast", { event: "conversation_refresh" }, () => {
        void refreshConversations();
        const threadId = activeThreadIdRef.current;
        if (threadId) void refreshMessages(threadId);
      });

      channel.subscribe(async (status, error) => {
        if (!active) return;
        if (status === "SUBSCRIBED") {
          setConnectionState("live");
          setErrorMessage("");
          await channel.track({
            user_id: user.id,
            entered_at: new Date().toISOString(),
          });
          await refreshConversations();
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          setConnectionState("error");
          setErrorMessage(error?.message || "CPP LIVEへの接続に失敗しました。");
        }
      });

      cleanupChannel = () => {
        channelRef.current = null;
        void channel.untrack();
        void supabase.removeChannel(channel);
      };
    };

    void start();

    return () => {
      active = false;
      cleanupChannel?.();
    };
  }, [supabase, refreshConversations, refreshMessages]);

  const requestConversation = async (targetUserId: string) => {
    if (!supabase || actionBusy) return;
    setActionBusy(`request:${targetUserId}`);
    setErrorMessage("");
    const { data, error } = await supabase.rpc("cpp_live_request_conversation", {
      p_target_user_id: targetUserId,
    });
    setActionBusy(null);

    if (error) {
      setErrorMessage(`話しかけられませんでした: ${error.message}`);
      return;
    }

    const row = ((data ?? [])[0] as ConversationResult | undefined) ?? null;
    await refreshConversations();
    if (row?.request_status === "accepted" && row.thread_id) {
      setActiveThreadId(row.thread_id);
    }
    broadcastRefresh();
  };

  const respondConversation = async (requestId: string, accept: boolean) => {
    if (!supabase || actionBusy) return;
    setActionBusy(`respond:${requestId}`);
    setErrorMessage("");
    const { data, error } = await supabase.rpc("cpp_live_respond_conversation", {
      p_request_id: requestId,
      p_accept: accept,
    });
    setActionBusy(null);

    if (error) {
      setErrorMessage(`返答できませんでした: ${error.message}`);
      return;
    }

    const row = ((data ?? [])[0] as ConversationResult | undefined) ?? null;
    await refreshConversations();
    if (accept && row?.thread_id) setActiveThreadId(row.thread_id);
    broadcastRefresh();
  };

  const cancelRequest = async (requestId: string) => {
    if (!supabase || actionBusy) return;
    setActionBusy(`cancel:${requestId}`);
    const { error } = await supabase.rpc("cpp_live_cancel_conversation_request", {
      p_request_id: requestId,
    });
    setActionBusy(null);
    if (error) {
      setErrorMessage(`取り消せませんでした: ${error.message}`);
      return;
    }
    await refreshConversations();
    broadcastRefresh();
  };

  const sendMessage = async () => {
    if (!supabase || !activeThreadId || !draft.trim() || actionBusy) return;
    const body = draft.trim();
    setActionBusy("message");
    setErrorMessage("");
    const { error } = await supabase.rpc("cpp_live_send_message", {
      p_thread_id: activeThreadId,
      p_body: body,
    });
    setActionBusy(null);
    if (error) {
      setErrorMessage(`送信できませんでした: ${error.message}`);
      return;
    }
    setDraft("");
    await Promise.all([refreshMessages(activeThreadId), refreshConversations()]);
    broadcastRefresh();
  };

  const selected = profiles.find((profile) => profile.user_id === selectedUserId) ?? null;
  const incomingRequests = pendingRequests.filter((row) => row.direction === "incoming");
  const selectedOutgoing = selected
    ? pendingRequests.find((row) => row.direction === "outgoing" && row.other_user_id === selected.user_id)
    : null;
  const selectedIncoming = selected
    ? pendingRequests.find((row) => row.direction === "incoming" && row.other_user_id === selected.user_id)
    : null;
  const selectedThread = selected
    ? activeThreads.find((row) => row.other_user_id === selected.user_id)
    : null;
  const activeThread = activeThreads.find((row) => row.thread_id === activeThreadId) ?? null;

  if (loading) return <CenteredCard>CPP LIVEを準備しています…</CenteredCard>;

  if (!userId) {
    return (
      <CenteredCard>
        <h1 className="text-xl font-black text-neutral-950">PARARIへのログインが必要です</h1>
        <Link href="/login?returnTo=/my/cpp/live" className="mt-6 inline-block rounded-full bg-neutral-900 px-5 py-2.5 text-sm font-bold text-white">
          ログインする
        </Link>
      </CenteredCard>
    );
  }

  if (!context) {
    return (
      <CenteredCard>
        <div className="text-xs font-black tracking-[0.16em] text-neutral-400">CPP MATCHING · LIVE</div>
        <h1 className="mt-3 text-xl font-black text-neutral-950">まだCPPへの入室許可がありません</h1>
        <p className="mt-3 text-sm leading-7 text-neutral-600">
          CPP-R または CPP-C のメンバーシップが発行されるとLIVE空間に入れます。
        </p>
        <Link href="/my/cpp/members" className="mt-6 inline-block rounded-full bg-neutral-900 px-5 py-2.5 text-sm font-bold text-white">
          参加メンバーへ
        </Link>
      </CenteredCard>
    );
  }

  return (
    <main className="min-h-screen bg-neutral-100 px-3 py-5 sm:px-6 sm:py-8">
      <div className="mx-auto max-w-7xl">
        <header className="flex flex-wrap items-end justify-between gap-4 px-1">
          <div>
            <div className="text-xs font-black tracking-[0.18em] text-neutral-400">CPP MATCHING · LIVE</div>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-neutral-950">今ここにいる人</h1>
            <p className="mt-2 text-sm leading-6 text-neutral-600">
              ドットから話しかけ、相手が承諾すると右側で1対1チャットが始まります。空間はそのまま見え続けます。
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-3 py-2 text-xs font-bold ${connectionState === "live" ? "bg-emerald-50 text-emerald-700" : connectionState === "error" ? "bg-red-50 text-red-700" : "bg-white text-neutral-500"}`}>
              {connectionState === "live" ? "● LIVE 接続中" : connectionState === "error" ? "接続エラー" : "接続中…"}
            </span>
            <Link href="/my/cpp/members" className="rounded-full border border-neutral-300 bg-white px-4 py-2.5 text-xs font-bold text-neutral-700">BROWSE</Link>
            <Link href="/my/cpp/social-profile" className="rounded-full border border-neutral-300 bg-white px-4 py-2.5 text-xs font-bold text-neutral-700">SOCIAL PROFILE</Link>
          </div>
        </header>

        {errorMessage ? (
          <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">{errorMessage}</div>
        ) : null}

        {incomingRequests.length > 0 ? (
          <div className="mt-5 space-y-3">
            {incomingRequests.map((request) => (
              <div key={request.request_id} className="flex flex-wrap items-center justify-between gap-4 rounded-[1.5rem] border border-amber-200 bg-amber-50 px-5 py-4 shadow-sm">
                <div className="min-w-0">
                  <div className="text-xs font-black tracking-[0.12em] text-amber-700">TALK REQUEST</div>
                  <div className="mt-1 font-black text-neutral-950">{request.display_name}さんから話しかけられています</div>
                  <div className="mt-1 text-xs text-neutral-600">{[request.affiliation, request.role_title].filter(Boolean).join(" · ")}</div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link href={`/my/cpp/members/${request.other_user_id}`} className="rounded-full border border-neutral-300 bg-white px-4 py-2 text-xs font-bold text-neutral-700">プロフィール</Link>
                  <button type="button" onClick={() => void respondConversation(request.request_id, true)} disabled={Boolean(actionBusy)} className="rounded-full bg-neutral-900 px-4 py-2 text-xs font-bold text-white disabled:opacity-40">話す</button>
                  <button type="button" onClick={() => void respondConversation(request.request_id, false)} disabled={Boolean(actionBusy)} className="rounded-full border border-neutral-300 bg-white px-4 py-2 text-xs font-bold text-neutral-600 disabled:opacity-40">今回は見送る</button>
                </div>
              </div>
            ))}
          </div>
        ) : null}

        <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
          <section className="relative min-h-[540px] overflow-hidden rounded-[2rem] border border-neutral-200 bg-white shadow-sm sm:min-h-[640px]">
            <div className="absolute inset-x-0 top-0 z-10 flex flex-wrap items-center justify-between gap-3 border-b border-neutral-100 bg-white/90 px-5 py-3 backdrop-blur">
              <div className="text-xs font-bold text-neutral-500">現在 {profiles.length} 人</div>
              <div className="flex items-center gap-4 text-[11px] font-bold text-neutral-500">
                <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-full bg-neutral-900" />研究者</span>
                <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-full border-2 border-neutral-900 bg-white" />企業</span>
              </div>
            </div>

            <div className="absolute inset-0 top-12 bg-[radial-gradient(circle_at_center,_rgba(0,0,0,0.035)_1px,_transparent_1px)] [background-size:28px_28px]" />

            {profiles.length === 0 && connectionState === "live" ? (
              <div className="absolute inset-0 flex items-center justify-center px-6 text-center">
                <div>
                  <div className="text-lg font-black text-neutral-900">今はまだ誰もいません</div>
                  <p className="mt-2 text-sm leading-7 text-neutral-500">別のCPPメンバーがLIVEを開くと、ここにドットが現れます。</p>
                </div>
              </div>
            ) : null}

            {profiles.map((profile) => {
              const position = stablePosition(profile.user_id);
              const isResearcher = profile.organization_key === "CPP-R";
              const isSelf = profile.user_id === userId;
              const isSelected = profile.user_id === selectedUserId;
              const isChatting = activeThreads.some((row) => row.other_user_id === profile.user_id);

              return (
                <button
                  key={profile.user_id}
                  type="button"
                  onClick={() => setSelectedUserId(profile.user_id)}
                  aria-label={`${profile.display_name}のプロフィールを見る`}
                  className="absolute z-20 -translate-x-1/2 -translate-y-1/2 focus:outline-none"
                  style={{ left: `${position.x}%`, top: `${position.y}%` }}
                >
                  <span className={`relative flex h-8 w-8 items-center justify-center rounded-full transition ${isResearcher ? "bg-neutral-900" : "border-[3px] border-neutral-900 bg-white"} ${isSelected ? "scale-125 shadow-lg" : "hover:scale-110"} ${isSelf ? "ring-4 ring-neutral-300 ring-offset-2" : ""}`}>
                    {!isResearcher ? <span className="h-2 w-2 rounded-full bg-neutral-900" /> : null}
                    {isChatting && !isSelf ? <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full border-2 border-white bg-emerald-500" /> : null}
                  </span>
                  {isSelf ? <span className="mt-2 inline-block rounded-full bg-neutral-900 px-2 py-1 text-[9px] font-black tracking-wider text-white">YOU</span> : null}
                </button>
              );
            })}
          </section>

          <aside className="min-h-[260px]">
            {activeThreadId ? (
              <div className="lg:sticky lg:top-5">
                {activeThread ? (
                  <section className="overflow-hidden rounded-[2rem] border border-neutral-200 bg-white shadow-sm">
                    <div className="flex items-center justify-between gap-3 border-b border-neutral-100 px-5 py-4">
                      <div className="min-w-0">
                        <div className="text-[10px] font-black tracking-[0.14em] text-neutral-400">DIRECT CHAT</div>
                        <div className="mt-1 truncate font-black text-neutral-950">{activeThread.display_name}</div>
                        <div className="truncate text-xs text-neutral-500">{[activeThread.affiliation, activeThread.role_title].filter(Boolean).join(" · ")}</div>
                      </div>
                      <button type="button" onClick={() => { setActiveThreadId(null); setSelectedUserId(null); }} className="shrink-0 text-xs font-bold text-neutral-400 hover:text-neutral-800">空間を見る</button>
                    </div>

                    <div className="h-[390px] overflow-y-auto bg-neutral-50 px-4 py-4">
                      {messages.length === 0 ? (
                        <div className="flex h-full items-center justify-center text-center text-sm leading-7 text-neutral-400">会話が始まりました。<br />最初のメッセージを送ってみてください。</div>
                      ) : (
                        <div className="space-y-3">
                          {messages.map((message) => {
                            const mine = message.sender_user_id === userId;
                            return (
                              <div key={message.message_id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                                <div className={`max-w-[82%] rounded-2xl px-4 py-2.5 text-sm leading-6 ${mine ? "bg-neutral-900 text-white" : "border border-neutral-200 bg-white text-neutral-800"}`}>
                                  <div className="whitespace-pre-wrap break-words">{message.body}</div>
                                  <div className={`mt-1 text-[9px] ${mine ? "text-neutral-400" : "text-neutral-400"}`}>{formatTime(message.created_at)}</div>
                                </div>
                              </div>
                            );
                          })}
                          <div ref={messagesEndRef} />
                        </div>
                      )}
                    </div>

                    <form onSubmit={(event) => { event.preventDefault(); void sendMessage(); }} className="border-t border-neutral-100 p-3">
                      <textarea value={draft} onChange={(event) => setDraft(event.target.value.slice(0, 2000))} rows={3} placeholder="メッセージを入力" className="w-full resize-none rounded-2xl border border-neutral-300 px-4 py-3 text-sm outline-none focus:border-neutral-700" />
                      <div className="mt-2 flex items-center justify-between gap-3">
                        <span className="text-[10px] text-neutral-400">{draft.length}/2000</span>
                        <button type="submit" disabled={!draft.trim() || Boolean(actionBusy)} className="rounded-full bg-neutral-900 px-5 py-2.5 text-xs font-bold text-white disabled:opacity-40">送信</button>
                      </div>
                    </form>
                  </section>
                ) : (
                  <div className="rounded-[2rem] border border-neutral-200 bg-white p-7 text-center text-sm text-neutral-500 shadow-sm">チャットを開いています…</div>
                )}
              </div>
            ) : selected ? (
              <div className="lg:sticky lg:top-5">
                <div className="mb-3 flex items-center justify-between px-1">
                  <div className="text-xs font-black tracking-[0.14em] text-neutral-400">SELECTED</div>
                  <button type="button" onClick={() => setSelectedUserId(null)} className="text-xs font-bold text-neutral-400 hover:text-neutral-800">閉じる</button>
                </div>
                <SocialProfileCard
                  displayName={selected.display_name}
                  photoUrl={selected.photo_url}
                  affiliation={selected.affiliation}
                  roleTitle={selected.role_title}
                  topics={selected.topics}
                  intro={selected.intro}
                />
                <div className="mt-3 flex flex-wrap gap-2">
                  {selected.user_id === userId ? (
                    <Link href="/my/cpp/social-profile" className="rounded-full bg-neutral-900 px-4 py-2.5 text-xs font-bold text-white">自分の名札を編集</Link>
                  ) : (
                    <>
                      <Link href={`/my/cpp/members/${selected.user_id}`} className="rounded-full border border-neutral-300 bg-white px-4 py-2.5 text-xs font-bold text-neutral-700">SOCIAL PROFILE</Link>
                      {selectedThread ? (
                        <button type="button" onClick={() => setActiveThreadId(selectedThread.thread_id)} className="rounded-full bg-neutral-900 px-4 py-2.5 text-xs font-bold text-white">チャットを開く</button>
                      ) : selectedIncoming ? (
                        <>
                          <button type="button" onClick={() => void respondConversation(selectedIncoming.request_id, true)} disabled={Boolean(actionBusy)} className="rounded-full bg-neutral-900 px-4 py-2.5 text-xs font-bold text-white disabled:opacity-40">話す</button>
                          <button type="button" onClick={() => void respondConversation(selectedIncoming.request_id, false)} disabled={Boolean(actionBusy)} className="rounded-full border border-neutral-300 bg-white px-4 py-2.5 text-xs font-bold text-neutral-600 disabled:opacity-40">見送る</button>
                        </>
                      ) : selectedOutgoing ? (
                        <>
                          <span className="rounded-full bg-amber-100 px-4 py-2.5 text-xs font-bold text-amber-800">返事待ち</span>
                          <button type="button" onClick={() => void cancelRequest(selectedOutgoing.request_id)} disabled={Boolean(actionBusy)} className="rounded-full border border-neutral-300 bg-white px-4 py-2.5 text-xs font-bold text-neutral-500 disabled:opacity-40">取り消す</button>
                        </>
                      ) : (
                        <button type="button" onClick={() => void requestConversation(selected.user_id)} disabled={Boolean(actionBusy)} className="rounded-full bg-neutral-900 px-4 py-2.5 text-xs font-bold text-white disabled:opacity-40">話しかける</button>
                      )}
                    </>
                  )}
                  {selected.user_id !== userId ? (
                    selected.can_view_deep
                      ? <span className="rounded-full bg-neutral-100 px-4 py-2.5 text-xs font-bold text-neutral-600">MATCHING相手</span>
                      : <span className="rounded-full bg-neutral-100 px-4 py-2.5 text-xs font-bold text-neutral-600">同じ側のメンバー</span>
                  ) : null}
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="rounded-[2rem] border border-dashed border-neutral-300 bg-white/60 p-7 text-center">
                  <div className="text-base font-black text-neutral-900">ドットを選んでください</div>
                  <p className="mt-2 text-sm leading-7 text-neutral-500">SOCIAL PROFILEを見て、そのまま話しかけられます。</p>
                </div>
                {activeThreads.length > 0 ? (
                  <div className="rounded-[2rem] border border-neutral-200 bg-white p-5 shadow-sm">
                    <div className="text-xs font-black tracking-[0.14em] text-neutral-400">CHATS</div>
                    <div className="mt-3 space-y-2">
                      {activeThreads.slice(0, 5).map((thread) => (
                        <button key={thread.thread_id} type="button" onClick={() => setActiveThreadId(thread.thread_id)} className="block w-full rounded-2xl bg-neutral-50 px-4 py-3 text-left hover:bg-neutral-100">
                          <div className="text-sm font-bold text-neutral-900">{thread.display_name}</div>
                          <div className="mt-1 truncate text-xs text-neutral-500">{thread.last_message_body || "会話を開く"}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            )}
          </aside>
        </div>
      </div>
    </main>
  );
}

function stablePosition(userId: string) {
  const a = hashString(`${userId}:x`);
  const b = hashString(`${userId}:y`);
  return { x: 9 + (a % 82), y: 15 + (b % 75) };
}

function hashString(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("ja-JP", { hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function CenteredCard({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-neutral-100 px-4 py-16">
      <div className="mx-auto max-w-xl rounded-[2rem] border border-neutral-200 bg-white p-8 text-center text-neutral-600 shadow-sm">{children}</div>
    </main>
  );
}
