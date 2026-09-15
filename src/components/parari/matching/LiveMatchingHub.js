"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase as sharedSupabase } from "@/lib/supabaseClient";

export default function LiveMatchingHub() {
  const supabase = useMemo(() => sharedSupabase, []);
  const [userId, setUserId] = useState(null);
  const [context, setContext] = useState(null);
  const [roster, setRoster] = useState([]);
  const [pending, setPending] = useState([]);
  const [openQueue, setOpenQueue] = useState([]);
  const [myOpenEntries, setMyOpenEntries] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [activeRoomId, setActiveRoomId] = useState(null);
  const [roomMessages, setRoomMessages] = useState([]);
  const [groupSelection, setGroupSelection] = useState(new Set());
  const [groupDraft, setGroupDraft] = useState("");
  const [showGroupBuilder, setShowGroupBuilder] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [busy, setBusy] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [liveUserIds, setLiveUserIds] = useState([]);
  const channelRef = useRef(null);

  const self = roster.find((row) => row.user_id === userId) || null;
  const incoming = pending.filter((row) => row.direction === "incoming");
  const activeRoom = rooms.find((room) => room.room_id === activeRoomId) || null;

  const broadcastRefresh = useCallback(() => {
    const channel = channelRef.current;
    if (!channel) return;
    void channel.send({ type: "broadcast", event: "conversation_refresh", payload: {} });
  }, []);

  const refreshRoster = useCallback(async (ids) => {
    if (!supabase || !ids.length) {
      setRoster([]);
      return;
    }
    const { data, error } = await supabase.rpc("cpp_live_roster", { p_target_user_ids: ids });
    if (error) {
      setErrorMessage(`LIVE STATUSを取得できませんでした: ${error.message}`);
      return;
    }
    setRoster(data || []);
  }, [supabase]);

  const refreshCoordination = useCallback(async () => {
    if (!supabase) return;
    const [pendingResult, queueResult, entriesResult, roomsResult] = await Promise.all([
      supabase.rpc("cpp_live_pending_requests"),
      supabase.rpc("cpp_live_open_talk_queue"),
      supabase.rpc("cpp_live_my_open_talk_entries"),
      supabase.rpc("cpp_live_group_rooms"),
    ]);
    const error = pendingResult.error || queueResult.error || entriesResult.error || roomsResult.error;
    if (error) {
      setErrorMessage(`LIVE HUBを更新できませんでした: ${error.message}`);
      return;
    }
    setPending(pendingResult.data || []);
    setOpenQueue(queueResult.data || []);
    setMyOpenEntries(entriesResult.data || []);
    setRooms(roomsResult.data || []);
    setErrorMessage("");
  }, [supabase]);

  const refreshRoomMessages = useCallback(async (roomId) => {
    if (!supabase || !roomId) return;
    const { data, error } = await supabase.rpc("cpp_live_group_messages", { p_room_id: roomId });
    if (error) {
      setErrorMessage(`GROUP TALKを取得できませんでした: ${error.message}`);
      return;
    }
    setRoomMessages(data || []);
  }, [supabase]);

  const refreshAll = useCallback(async () => {
    await Promise.all([refreshRoster(liveUserIds), refreshCoordination()]);
    if (activeRoomId) await refreshRoomMessages(activeRoomId);
  }, [liveUserIds, activeRoomId, refreshRoster, refreshCoordination, refreshRoomMessages]);

  useEffect(() => {
    if (!activeRoomId) {
      setRoomMessages([]);
      return;
    }
    void refreshRoomMessages(activeRoomId);
  }, [activeRoomId, refreshRoomMessages]);

  useEffect(() => {
    let active = true;
    let cleanup = null;

    const start = async () => {
      if (!supabase) return;
      const [{ data: authData }, { data: sessionData }] = await Promise.all([
        supabase.auth.getUser(),
        supabase.auth.getSession(),
      ]);
      if (!active || !authData.user) return;
      setUserId(authData.user.id);

      const { data: contextData } = await supabase.rpc("cpp_matching_context");
      if (!active) return;
      const nextContext = (contextData || [])[0] || null;
      setContext(nextContext);
      if (!nextContext) return;

      await refreshCoordination();
      if (sessionData.session?.access_token) await supabase.realtime.setAuth(sessionData.session.access_token);
      if (!active) return;

      const channel = supabase.channel(`cpp-live:${nextContext.membership_id}`, {
        config: { private: true, presence: { key: authData.user.id }, broadcast: { self: false } },
      });
      channelRef.current = channel;

      const syncRoster = async () => {
        const ids = Object.keys(channel.presenceState()).filter((value) => /^[0-9a-f-]{36}$/i.test(value));
        if (!active) return;
        setLiveUserIds(ids);
        await refreshRoster(ids);
      };

      channel.on("presence", { event: "sync" }, () => void syncRoster());
      channel.on("broadcast", { event: "conversation_refresh" }, () => {
        void syncRoster();
        void refreshCoordination();
        if (activeRoomId) void refreshRoomMessages(activeRoomId);
      });
      channel.subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await syncRoster();
          await refreshCoordination();
        }
      });

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
  }, [supabase, refreshCoordination, refreshRoster, refreshRoomMessages, activeRoomId]);

  const run = async (key, work) => {
    if (busy) return false;
    setBusy(key);
    setErrorMessage("");
    const result = await work();
    setBusy(null);
    if (result.error) {
      setErrorMessage(result.error.message);
      return false;
    }
    await refreshAll();
    broadcastRefresh();
    return true;
  };

  const setAvailability = async (availability) => {
    if (!supabase) return;
    await run("availability", () => supabase.rpc("cpp_live_set_availability", { p_availability: availability }));
  };

  const setOpenTalk = async (enabled) => {
    if (!supabase) return;
    await run("open-talk", () => supabase.rpc("cpp_live_set_open_talk", { p_enabled: enabled }));
  };

  const joinOpenTalk = async (hostUserId) => {
    if (!supabase) return;
    await run(`join:${hostUserId}`, () => supabase.rpc("cpp_live_join_open_talk", { p_host_user_id: hostUserId }));
  };

  const cancelOpenTalk = async (queueId) => {
    if (!supabase) return;
    await run(`cancel:${queueId}`, () => supabase.rpc("cpp_live_cancel_open_talk", { p_queue_id: queueId }));
  };

  const startNextOpenTalk = async () => {
    if (!supabase) return;
    await run("next-open", () => supabase.rpc("cpp_live_start_next_open_talk"));
  };

  const respondDirect = async (requestId, accept) => {
    if (!supabase) return;
    await run(`direct:${requestId}`, () => supabase.rpc("cpp_live_respond_conversation", { p_request_id: requestId, p_accept: accept }));
  };

  const createGroup = async () => {
    if (!supabase || groupSelection.size < 2) return;
    const ok = await run("create-group", () => supabase.rpc("cpp_live_create_group_room", { p_member_ids: Array.from(groupSelection) }));
    if (ok) {
      setGroupSelection(new Set());
      setShowGroupBuilder(false);
    }
  };

  const respondGroupInvite = async (roomId, accept) => {
    if (!supabase) return;
    const ok = await run(`room:${roomId}`, () => supabase.rpc("cpp_live_respond_group_invite", { p_room_id: roomId, p_accept: accept }));
    if (ok && accept) setActiveRoomId(roomId);
  };

  const leaveGroup = async (roomId) => {
    if (!supabase) return;
    const ok = await run(`leave:${roomId}`, () => supabase.rpc("cpp_live_leave_group_room", { p_room_id: roomId }));
    if (ok && activeRoomId === roomId) setActiveRoomId(null);
  };

  const sendGroupMessage = async () => {
    if (!supabase || !activeRoomId || !groupDraft.trim() || busy) return;
    const body = groupDraft.trim();
    const ok = await run("group-message", () => supabase.rpc("cpp_live_send_group_message", { p_room_id: activeRoomId, p_body: body }));
    if (ok) {
      setGroupDraft("");
      await refreshRoomMessages(activeRoomId);
    }
  };

  const toggleSelected = (id) => {
    setGroupSelection((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  if (!context) return null;

  return (
    <div className="pointer-events-none fixed bottom-4 left-4 z-[69] w-[min(430px,calc(100vw-2rem))]">
      <div className="pointer-events-auto overflow-hidden rounded-[1.5rem] border border-neutral-200 bg-white/95 shadow-xl backdrop-blur">
        <div className="flex items-center justify-between gap-3 border-b border-neutral-100 px-4 py-3">
          <div>
            <div className="text-[10px] font-black tracking-[0.15em] text-neutral-400">LIVE HUB · STEP 6–8</div>
            <div className="mt-0.5 text-sm font-black text-neutral-950">STATUS · OPEN TALK · GROUP</div>
          </div>
          <button type="button" onClick={() => setCollapsed((v) => !v)} className="rounded-full border border-neutral-200 px-3 py-1.5 text-xs font-bold text-neutral-500">{collapsed ? "開く" : "しまう"}</button>
        </div>

        {!collapsed ? (
          <div className="max-h-[72vh] overflow-y-auto p-4">
            {errorMessage ? <div className="mb-3 rounded-xl bg-red-50 px-3 py-2 text-xs text-red-700">{errorMessage}</div> : null}

            <section className="rounded-2xl bg-neutral-50 p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-[10px] font-black tracking-[0.12em] text-neutral-400">MY STATUS</div>
                  <div className="mt-1 text-sm font-black text-neutral-900">{statusLabel(self?.live_status || "available")}</div>
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => void setAvailability("available")} disabled={!!busy} className={`rounded-full px-3 py-2 text-xs font-bold ${self?.live_status !== "away" ? "bg-neutral-900 text-white" : "border border-neutral-300 bg-white text-neutral-600"}`}>話せます</button>
                  <button type="button" onClick={() => void setAvailability("away")} disabled={!!busy || self?.live_status === "chatting"} className={`rounded-full px-3 py-2 text-xs font-bold ${self?.live_status === "away" ? "bg-neutral-900 text-white" : "border border-neutral-300 bg-white text-neutral-600"}`}>離席</button>
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between gap-3 border-t border-neutral-200 pt-3">
                <div><div className="text-xs font-black text-neutral-900">OPEN TALK</div><div className="mt-0.5 text-[11px] text-neutral-500">先着順で10分ずつ話します</div></div>
                <button type="button" onClick={() => void setOpenTalk(!self?.open_talk)} disabled={!!busy} className={`rounded-full px-4 py-2 text-xs font-black ${self?.open_talk ? "bg-emerald-600 text-white" : "border border-neutral-300 bg-white text-neutral-600"}`}>{self?.open_talk ? "ON" : "OFF"}</button>
              </div>
            </section>

            {incoming.length ? (
              <section className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-3">
                <div className="text-[10px] font-black tracking-[0.12em] text-amber-700">WAITING REQUESTS</div>
                <div className="mt-2 space-y-2">
                  {incoming.map((request) => (
                    <div key={request.request_id} className="flex items-center justify-between gap-3 rounded-xl bg-white/80 px-3 py-2">
                      <div className="min-w-0"><div className="truncate text-xs font-black text-neutral-900">{request.display_name}</div><div className="text-[10px] text-neutral-500">{self?.live_status === "chatting" ? "会話終了後に対応できます" : "話したいリクエスト"}</div></div>
                      <div className="flex gap-1.5">
                        <button type="button" onClick={() => void respondDirect(request.request_id, true)} disabled={!!busy || self?.live_status === "chatting"} className="rounded-full bg-neutral-900 px-3 py-1.5 text-[11px] font-bold text-white disabled:opacity-35">話す</button>
                        <button type="button" onClick={() => void respondDirect(request.request_id, false)} disabled={!!busy} className="rounded-full border border-neutral-300 bg-white px-3 py-1.5 text-[11px] font-bold text-neutral-500">見送る</button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

            {self?.open_talk ? (
              <section className="mt-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div><div className="text-[10px] font-black tracking-[0.12em] text-emerald-700">OPEN TALK QUEUE</div><div className="mt-1 text-xs font-bold text-neutral-700">{openQueue.length}人待ち</div></div>
                  <button type="button" onClick={() => void startNextOpenTalk()} disabled={!!busy || !openQueue.length || self.live_status === "chatting"} className="rounded-full bg-emerald-700 px-3 py-2 text-xs font-bold text-white disabled:opacity-35">次の人と話す</button>
                </div>
                {openQueue.length ? <div className="mt-2 space-y-1.5">{openQueue.map((row, i) => <div key={row.queue_id} className="rounded-xl bg-white/80 px-3 py-2 text-xs text-neutral-700"><b>{i + 1}.</b> {row.display_name}</div>)}</div> : null}
              </section>
            ) : null}

            <section className="mt-3">
              <div className="mb-2 flex items-center justify-between gap-3 px-1"><div className="text-[10px] font-black tracking-[0.12em] text-neutral-400">NOW IN LIVE</div><div className="text-[10px] text-neutral-400">{roster.length}人</div></div>
              <div className="space-y-1.5">
                {roster.filter((row) => row.user_id !== userId).map((row) => {
                  const entry = myOpenEntries.find((item) => item.host_user_id === row.user_id);
                  return (
                    <div key={row.user_id} className="flex items-center justify-between gap-3 rounded-xl border border-neutral-200 bg-white px-3 py-2.5">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2"><span className="truncate text-xs font-black text-neutral-900">{row.display_name}</span><span className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-black ${statusClass(row.live_status)}`}>{statusLabel(row.live_status)}</span>{row.open_talk ? <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-[9px] font-black text-emerald-700">OPEN</span> : null}</div>
                        <div className="mt-0.5 truncate text-[10px] text-neutral-500">{[row.affiliation, row.role_title].filter(Boolean).join(" · ")}</div>
                      </div>
                      {row.open_talk ? (entry ? <button type="button" onClick={() => void cancelOpenTalk(entry.queue_id)} disabled={!!busy} className="shrink-0 rounded-full border border-amber-300 bg-amber-50 px-3 py-1.5 text-[10px] font-bold text-amber-700">待機取消</button> : <button type="button" onClick={() => void joinOpenTalk(row.user_id)} disabled={!!busy || row.live_status === "away"} className="shrink-0 rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-[10px] font-bold text-emerald-700 disabled:opacity-35">列に並ぶ</button>) : null}
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="mt-4 border-t border-neutral-200 pt-4">
              <div className="flex items-center justify-between gap-3">
                <div><div className="text-[10px] font-black tracking-[0.12em] text-neutral-400">GROUP TALK</div><div className="mt-1 text-xs text-neutral-500">3人以上のテキスト会話</div></div>
                <button type="button" onClick={() => setShowGroupBuilder((v) => !v)} disabled={self?.live_status === "chatting"} className="rounded-full bg-neutral-900 px-3 py-2 text-xs font-bold text-white disabled:opacity-35">＋作る</button>
              </div>

              {showGroupBuilder ? (
                <div className="mt-3 rounded-2xl bg-neutral-50 p-3">
                  <div className="text-xs font-bold text-neutral-700">一緒に話す人を2人以上選択</div>
                  <div className="mt-2 space-y-1.5">
                    {roster.filter((row) => row.user_id !== userId && row.live_status !== "away").map((row) => (
                      <label key={row.user_id} className="flex cursor-pointer items-center gap-2 rounded-xl bg-white px-3 py-2 text-xs"><input type="checkbox" checked={groupSelection.has(row.user_id)} onChange={() => toggleSelected(row.user_id)} /><span className="font-bold text-neutral-800">{row.display_name}</span><span className="ml-auto text-[10px] text-neutral-400">{statusLabel(row.live_status)}</span></label>
                    ))}
                  </div>
                  <button type="button" onClick={() => void createGroup()} disabled={groupSelection.size < 2 || !!busy} className="mt-3 w-full rounded-full bg-neutral-900 px-4 py-2.5 text-xs font-bold text-white disabled:opacity-35">{groupSelection.size + 1}人でGROUP TALKを作る</button>
                </div>
              ) : null}

              <div className="mt-3 space-y-2">
                {rooms.map((room) => {
                  const participants = room.participants || [];
                  const activeCount = participants.filter((m) => m.status === "active").length;
                  const names = participants.filter((m) => !["declined", "left"].includes(m.status)).map((m) => m.display_name).join("、");
                  return (
                    <div key={room.room_id} className="rounded-2xl border border-neutral-200 bg-white p-3">
                      <div className="text-xs font-black text-neutral-900">{names || "GROUP TALK"}</div><div className="mt-1 text-[10px] text-neutral-500">参加中 {activeCount}人</div>
                      {room.my_status === "invited" ? <div className="mt-2 flex gap-2"><button type="button" onClick={() => void respondGroupInvite(room.room_id, true)} disabled={!!busy || self?.live_status === "chatting"} className="rounded-full bg-neutral-900 px-3 py-1.5 text-[11px] font-bold text-white disabled:opacity-35">参加する</button><button type="button" onClick={() => void respondGroupInvite(room.room_id, false)} disabled={!!busy} className="rounded-full border border-neutral-300 px-3 py-1.5 text-[11px] font-bold text-neutral-500">見送る</button></div> : <div className="mt-2 flex gap-2"><button type="button" onClick={() => setActiveRoomId(room.room_id)} className="rounded-full bg-neutral-900 px-3 py-1.5 text-[11px] font-bold text-white">チャット</button><button type="button" onClick={() => void leaveGroup(room.room_id)} disabled={!!busy} className="rounded-full border border-red-200 px-3 py-1.5 text-[11px] font-bold text-red-600">退出</button></div>}
                    </div>
                  );
                })}
              </div>

              {activeRoom && activeRoom.my_status === "active" ? (
                <div className="mt-3 overflow-hidden rounded-2xl border border-neutral-200 bg-white">
                  <div className="flex items-center justify-between border-b border-neutral-100 px-3 py-2"><div className="text-xs font-black text-neutral-900">GROUP CHAT</div><button type="button" onClick={() => setActiveRoomId(null)} className="text-[10px] font-bold text-neutral-400">閉じる</button></div>
                  <div className="max-h-52 space-y-2 overflow-y-auto bg-neutral-50 p-3">
                    {!roomMessages.length ? <div className="py-6 text-center text-xs text-neutral-400">まだメッセージはありません。</div> : roomMessages.map((message) => <div key={message.message_id} className={`rounded-xl px-3 py-2 text-xs ${message.sender_user_id === userId ? "ml-8 bg-neutral-900 text-white" : "mr-8 border border-neutral-200 bg-white text-neutral-800"}`}><div className="mb-1 text-[9px] font-black text-neutral-400">{message.sender_name}</div><div className="whitespace-pre-wrap break-words">{message.body}</div></div>)}
                  </div>
                  <form onSubmit={(e) => { e.preventDefault(); void sendGroupMessage(); }} className="border-t border-neutral-100 p-2"><textarea value={groupDraft} onChange={(e) => setGroupDraft(e.target.value.slice(0, 2000))} rows={2} placeholder="グループへメッセージ" className="w-full resize-none rounded-xl border border-neutral-300 px-3 py-2 text-xs outline-none" /><div className="mt-1 flex justify-end"><button type="submit" disabled={!groupDraft.trim() || !!busy} className="rounded-full bg-neutral-900 px-4 py-2 text-[11px] font-bold text-white disabled:opacity-35">送信</button></div></form>
                </div>
              ) : null}
            </section>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function statusLabel(status) {
  if (status === "chatting") return "会話中";
  if (status === "away") return "離席中";
  return "話せます";
}

function statusClass(status) {
  if (status === "chatting") return "bg-amber-100 text-amber-700";
  if (status === "away") return "bg-neutral-200 text-neutral-500";
  return "bg-emerald-100 text-emerald-700";
}
