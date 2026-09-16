"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import SocialProfileCard from "@/components/parari/matching/SocialProfileCard";
import { supabase as sharedSupabase } from "@/lib/supabaseClient";

const DEFAULT_STAY_MINUTES = 60;
const EXTEND_STAY_MINUTES = 30;

export default function CppLiveSpace() {
  const supabase = useMemo(() => sharedSupabase, []);
  const [booting, setBooting] = useState(true);
  const [userId, setUserId] = useState(null);
  const [context, setContext] = useState(null);
  const [lobbyCount, setLobbyCount] = useState(0);
  const [entered, setEntered] = useState(false);
  const [liveUntil, setLiveUntil] = useState(null);
  const [availability, setAvailabilityState] = useState("available");
  const [clock, setClock] = useState(Date.now());
  const [profiles, setProfiles] = useState([]);
  const [positions, setPositions] = useState({});
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [threads, setThreads] = useState([]);
  const [conversationMap, setConversationMap] = useState([]);
  const [queueRows, setQueueRows] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [activeThreadId, setActiveThreadId] = useState(null);
  const [directMessages, setDirectMessages] = useState([]);
  const [activeRoomId, setActiveRoomId] = useState(null);
  const [roomMessages, setRoomMessages] = useState([]);
  const [directDraft, setDirectDraft] = useState("");
  const [roomDraft, setRoomDraft] = useState("");
  const [busy, setBusy] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [approachTargetId, setApproachTargetId] = useState(null);

  const channelRef = useRef(null);
  const enteredRef = useRef(false);
  const liveUntilRef = useRef(null);
  const selfPositionRef = useRef(null);
  const activeThreadIdRef = useRef(null);
  const activeRoomIdRef = useRef(null);
  const approachTargetRef = useRef(null);
  const endingThreadRef = useRef(new Set());

  useEffect(() => { enteredRef.current = entered; }, [entered]);
  useEffect(() => { liveUntilRef.current = liveUntil; }, [liveUntil]);
  useEffect(() => { activeThreadIdRef.current = activeThreadId; }, [activeThreadId]);
  useEffect(() => { activeRoomIdRef.current = activeRoomId; }, [activeRoomId]);
  useEffect(() => { approachTargetRef.current = approachTargetId; }, [approachTargetId]);

  const refreshLobbyCount = useCallback(async () => {
    if (!supabase) return;
    const { data } = await supabase.rpc("cpp_live_lobby_count");
    if (typeof data === "number") setLobbyCount(data);
  }, [supabase]);

  const refreshMessages = useCallback(async (threadId) => {
    if (!supabase || !threadId) return;
    const { data, error } = await supabase.rpc("cpp_live_messages", { p_thread_id: threadId });
    if (error) return setErrorMessage(`チャットを取得できませんでした: ${error.message}`);
    setDirectMessages(data || []);
  }, [supabase]);

  const refreshRoomMessages = useCallback(async (roomId) => {
    if (!supabase || !roomId) return;
    const { data, error } = await supabase.rpc("cpp_live_group_messages", { p_room_id: roomId });
    if (error) return setErrorMessage(`OPEN会話を取得できませんでした: ${error.message}`);
    setRoomMessages(data || []);
  }, [supabase]);

  const moveSelfTo = useCallback(async (nextPosition, nextAvailability = availability) => {
    if (!enteredRef.current || !channelRef.current || !userId) return;
    const safe = { x: clamp(nextPosition.x, 7, 93), y: clamp(nextPosition.y, 15, 88) };
    selfPositionRef.current = safe;
    setPositions((current) => ({ ...current, [userId]: safe }));
    await channelRef.current.track({
      user_id: userId,
      x: safe.x,
      y: safe.y,
      availability: nextAvailability,
      entered_at: new Date().toISOString(),
    });
  }, [availability, userId]);

  const broadcastRefresh = useCallback(() => {
    const channel = channelRef.current;
    if (!channel) return;
    void channel.send({ type: "broadcast", event: "conversation_refresh", payload: {} });
  }, []);

  const refreshCoordination = useCallback(async () => {
    if (!supabase || !enteredRef.current) return;
    const [pendingResult, threadsResult, mapResult, queuesResult, roomsResult] = await Promise.all([
      supabase.rpc("cpp_live_pending_requests"),
      supabase.rpc("cpp_live_active_threads_timed"),
      supabase.rpc("cpp_live_conversation_map"),
      supabase.rpc("cpp_live_queue_snapshot"),
      supabase.rpc("cpp_live_group_rooms"),
    ]);
    const firstError = pendingResult.error || threadsResult.error || mapResult.error || queuesResult.error || roomsResult.error;
    if (firstError) {
      setErrorMessage(`LIVE状態を更新できませんでした: ${firstError.message}`);
      return;
    }

    const nextPending = pendingResult.data || [];
    const nextThreads = threadsResult.data || [];
    const nextMap = mapResult.data || [];
    const nextQueues = queuesResult.data || [];
    const nextRooms = roomsResult.data || [];
    setPendingRequests(nextPending);
    setThreads(nextThreads);
    setConversationMap(nextMap);
    setQueueRows(nextQueues);
    setRooms(nextRooms);

    const currentThread = activeThreadIdRef.current;
    if (currentThread && !nextThreads.some((row) => row.thread_id === currentThread)) {
      setActiveThreadId(null);
      setDirectMessages([]);
    }

    if (!currentThread && nextThreads.length === 1) {
      setActiveThreadId(nextThreads[0].thread_id);
    }

    const currentRoom = activeRoomIdRef.current;
    const activeOwnRooms = nextRooms.filter((room) => room.my_status === "active");
    if (currentRoom && !activeOwnRooms.some((room) => room.room_id === currentRoom)) {
      setActiveRoomId(null);
      setRoomMessages([]);
    } else if (!currentRoom && !nextThreads.length && activeOwnRooms.length === 1) {
      setActiveRoomId(activeOwnRooms[0].room_id);
    }

    const target = approachTargetRef.current;
    if (target) {
      const stillPending = nextPending.some((row) => row.direction === "outgoing" && row.other_user_id === target);
      const nowThread = nextThreads.some((row) => row.other_user_id === target);
      if (!stillPending && !nowThread) {
        setApproachTargetId(null);
        const home = stablePosition(userId || "self");
        void moveSelfTo(home);
      }
    }
  }, [moveSelfTo, supabase, userId]);

  const syncPresence = useCallback(async () => {
    const channel = channelRef.current;
    if (!channel || !supabase || !enteredRef.current) return;
    const state = channel.presenceState();
    const ids = Object.keys(state);
    const nextPositions = {};
    ids.forEach((id) => {
      const list = state[id] || [];
      const meta = list[list.length - 1] || {};
      nextPositions[id] = Number.isFinite(meta.x) && Number.isFinite(meta.y)
        ? { x: meta.x, y: meta.y }
        : stablePosition(id);
    });
    setPositions(nextPositions);
    if (!ids.length) {
      setProfiles([]);
      return;
    }
    const { data, error } = await supabase.rpc("cpp_matching_live_profiles", { p_target_user_ids: ids });
    if (error) return setErrorMessage(`LIVEプロフィールを取得できませんでした: ${error.message}`);
    setProfiles(data || []);
  }, [supabase]);

  const refreshAll = useCallback(async () => {
    await Promise.all([syncPresence(), refreshCoordination()]);
    const threadId = activeThreadIdRef.current;
    const roomId = activeRoomIdRef.current;
    if (threadId) await refreshMessages(threadId);
    if (roomId) await refreshRoomMessages(roomId);
  }, [refreshCoordination, refreshMessages, refreshRoomMessages, syncPresence]);

  useEffect(() => {
    const start = async () => {
      if (!supabase) {
        setBooting(false);
        setErrorMessage("PARARIの接続設定を確認できませんでした。");
        return;
      }
      const { data: authData } = await supabase.auth.getUser();
      if (!authData.user) {
        setBooting(false);
        return;
      }
      setUserId(authData.user.id);
      const { data: contextData, error } = await supabase.rpc("cpp_matching_context");
      if (error) setErrorMessage(`CPP参加情報を取得できませんでした: ${error.message}`);
      setContext((contextData || [])[0] || null);
      await refreshLobbyCount();
      setBooting(false);
    };
    void start();
  }, [refreshLobbyCount, supabase]);

  useEffect(() => {
    const timer = window.setInterval(() => setClock(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (entered) return;
    const timer = window.setInterval(() => void refreshLobbyCount(), 20000);
    return () => window.clearInterval(timer);
  }, [entered, refreshLobbyCount]);

  useEffect(() => {
    if (!entered || !supabase) return;
    const heartbeat = window.setInterval(async () => {
      const { data } = await supabase.rpc("cpp_live_heartbeat");
      if (data) setLiveUntil(data);
    }, 30000);
    return () => window.clearInterval(heartbeat);
  }, [entered, supabase]);

  useEffect(() => {
    return () => {
      const channel = channelRef.current;
      if (channel) {
        void channel.untrack();
        if (supabase) void supabase.removeChannel(channel);
      }
      if (enteredRef.current && supabase) void supabase.rpc("cpp_live_leave");
    };
  }, [supabase]);

  const enterLive = async () => {
    if (!supabase || !context || !userId || busy) return;
    setBusy("enter");
    setErrorMessage("");
    const { data, error } = await supabase.rpc("cpp_live_enter", { p_minutes: DEFAULT_STAY_MINUTES });
    if (error) {
      setBusy(null);
      return setErrorMessage(`LIVEに入れませんでした: ${error.message}`);
    }
    const until = (data || [])[0]?.live_until || new Date(Date.now() + DEFAULT_STAY_MINUTES * 60000).toISOString();
    setLiveUntil(until);
    liveUntilRef.current = until;
    setAvailabilityState("available");
    const startPosition = stablePosition(userId);
    selfPositionRef.current = startPosition;

    const { data: sessionData } = await supabase.auth.getSession();
    if (sessionData.session?.access_token) await supabase.realtime.setAuth(sessionData.session.access_token);

    const channel = supabase.channel(`cpp-live:${context.membership_id}`, {
      config: { private: true, presence: { key: userId }, broadcast: { self: false } },
    });
    channelRef.current = channel;

    channel.on("presence", { event: "sync" }, () => void syncPresence());
    channel.on("broadcast", { event: "conversation_refresh" }, () => void refreshAll());
    channel.subscribe(async (status, channelError) => {
      if (status === "SUBSCRIBED") {
        setEntered(true);
        enteredRef.current = true;
        await channel.track({ user_id: userId, x: startPosition.x, y: startPosition.y, availability: "available", entered_at: new Date().toISOString() });
        await refreshAll();
        await refreshLobbyCount();
        setBusy(null);
      } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        setErrorMessage(channelError?.message || "LIVEへのRealtime接続に失敗しました。");
        setBusy(null);
      }
    });
  };

  const leaveLive = useCallback(async () => {
    if (!supabase) return;
    setBusy("leave");
    const channel = channelRef.current;
    channelRef.current = null;
    if (channel) {
      await channel.untrack();
      await supabase.removeChannel(channel);
    }
    await supabase.rpc("cpp_live_leave");
    enteredRef.current = false;
    setEntered(false);
    setProfiles([]);
    setPositions({});
    setSelectedUserId(null);
    setPendingRequests([]);
    setThreads([]);
    setConversationMap([]);
    setQueueRows([]);
    setRooms([]);
    setActiveThreadId(null);
    setActiveRoomId(null);
    setDirectMessages([]);
    setRoomMessages([]);
    setLiveUntil(null);
    setBusy(null);
    await refreshLobbyCount();
  }, [refreshLobbyCount, supabase]);

  useEffect(() => {
    if (!entered || !liveUntil) return;
    if (new Date(liveUntil).getTime() <= clock) void leaveLive();
  }, [clock, entered, leaveLive, liveUntil]);

  useEffect(() => {
    if (!entered || !threads.length) return;
    threads.forEach((thread) => {
      if (!thread.session_expires_at) return;
      if (new Date(thread.session_expires_at).getTime() <= clock && !endingThreadRef.current.has(thread.thread_id)) {
        endingThreadRef.current.add(thread.thread_id);
        void (async () => {
          await supabase.rpc("cpp_live_end_conversation", { p_thread_id: thread.thread_id });
          endingThreadRef.current.delete(thread.thread_id);
          await refreshCoordination();
          broadcastRefresh();
        })();
      }
    });
  }, [broadcastRefresh, clock, entered, refreshCoordination, supabase, threads]);

  useEffect(() => {
    if (!activeThreadId) return setDirectMessages([]);
    void refreshMessages(activeThreadId);
  }, [activeThreadId, refreshMessages]);

  useEffect(() => {
    if (!activeRoomId) return setRoomMessages([]);
    void refreshRoomMessages(activeRoomId);
  }, [activeRoomId, refreshRoomMessages]);

  const setAvailability = async (next) => {
    if (!supabase || busy || !entered) return;
    setBusy("availability");
    const { error } = await supabase.rpc("cpp_live_set_availability", { p_availability: next });
    if (!error) {
      setAvailabilityState(next);
      const current = selfPositionRef.current || stablePosition(userId);
      await moveSelfTo(current, next);
      broadcastRefresh();
    } else setErrorMessage(error.message);
    setBusy(null);
  };

  const extendStay = async () => {
    if (!supabase || busy) return;
    setBusy("extend-stay");
    const { data, error } = await supabase.rpc("cpp_live_extend_stay", { p_minutes: EXTEND_STAY_MINUTES });
    if (error) setErrorMessage(error.message); else setLiveUntil(data);
    setBusy(null);
    await refreshCoordination();
    broadcastRefresh();
  };

  const getConversationForUser = useCallback((id) => conversationMap.find((row) => (row.participant_ids || []).includes(id)) || null, [conversationMap]);

  const basePositionForUser = useCallback((id) => {
    const conv = getConversationForUser(id);
    if (conv) {
      const anchor = clusterAnchor(conv.conversation_id);
      const participants = conv.participant_ids || [];
      const index = Math.max(0, participants.indexOf(id));
      if (conv.conversation_kind === "direct") {
        return { x: anchor.x + (index === 0 ? -1.5 : 1.5), y: anchor.y };
      }
      const angle = (Math.PI * 2 * index) / Math.max(3, participants.length) - Math.PI / 2;
      return { x: anchor.x + Math.cos(angle) * 3.2, y: anchor.y + Math.sin(angle) * 3.2 };
    }
    return positions[id] || stablePosition(id);
  }, [getConversationForUser, positions]);

  const displayPositionForUser = useCallback((id) => {
    const conv = getConversationForUser(id);
    if (conv) return basePositionForUser(id);
    const queue = queueRows.find((row) => row.requester_user_id === id && row.queue_status === "waiting");
    if (queue) {
      const host = basePositionForUser(queue.host_user_id);
      const side = hashString(id) % 2 === 0 ? 1 : -1;
      return { x: clamp(host.x + side * 7.5, 7, 93), y: clamp(host.y + 6 + queue.queue_position * 3.7, 15, 90) };
    }
    const waitlist = queueRows.find((row) => row.requester_user_id === id && row.queue_status === "waitlist");
    if (waitlist) {
      const host = basePositionForUser(waitlist.host_user_id);
      return { x: clamp(host.x + 11, 7, 93), y: clamp(host.y + 8 + waitlist.queue_position * 3.2, 15, 90) };
    }
    return positions[id] || stablePosition(id);
  }, [basePositionForUser, getConversationForUser, positions, queueRows]);

  const moveNear = async (targetId, distance) => {
    const target = displayPositionForUser(targetId);
    const angle = ((hashString(`${userId}:${targetId}`) % 360) / 180) * Math.PI;
    await moveSelfTo({ x: target.x + Math.cos(angle) * distance, y: target.y + Math.sin(angle) * distance });
  };

  const selectPerson = async (id) => {
    setSelectedUserId(id);
    if (id !== userId && entered) await moveNear(id, 8);
  };

  const requestConversation = async (targetId) => {
    if (!supabase || busy) return;
    setBusy("request");
    setApproachTargetId(targetId);
    await moveNear(targetId, 4.2);
    const { data, error } = await supabase.rpc("cpp_live_request_conversation", { p_target_user_id: targetId });
    if (error) setErrorMessage(error.message);
    else {
      const row = (data || [])[0];
      if (row?.request_status === "accepted" && row.thread_id) setActiveThreadId(row.thread_id);
    }
    setBusy(null);
    await refreshCoordination();
    broadcastRefresh();
  };

  const respondConversation = async (requestId, accept) => {
    if (!supabase || busy) return;
    setBusy("respond");
    const request = pendingRequests.find((row) => row.request_id === requestId);
    const { data, error } = await supabase.rpc("cpp_live_respond_conversation", { p_request_id: requestId, p_accept: accept });
    if (error) setErrorMessage(error.message);
    else {
      const row = (data || [])[0];
      if (accept && row?.thread_id) {
        setActiveThreadId(row.thread_id);
        if (request?.other_user_id) await moveNear(request.other_user_id, 3.5);
      }
    }
    setBusy(null);
    await refreshCoordination();
    broadcastRefresh();
  };

  const cancelRequest = async (requestId) => {
    if (!supabase || busy) return;
    setBusy("cancel-request");
    const { error } = await supabase.rpc("cpp_live_cancel_conversation_request", { p_request_id: requestId });
    if (error) setErrorMessage(error.message);
    setBusy(null);
    setApproachTargetId(null);
    await moveSelfTo(stablePosition(userId));
    await refreshCoordination();
    broadcastRefresh();
  };

  const joinQueue = async (targetId) => {
    if (!supabase || busy) return;
    setBusy("queue");
    const { error } = await supabase.rpc("cpp_live_join_person_queue", { p_target_user_id: targetId });
    if (error) setErrorMessage(error.message);
    setBusy(null);
    await refreshCoordination();
    broadcastRefresh();
  };

  const cancelQueue = async (queueId) => {
    if (!supabase || busy) return;
    setBusy("queue-cancel");
    const { error } = await supabase.rpc("cpp_live_cancel_person_queue", { p_queue_id: queueId });
    if (error) setErrorMessage(error.message);
    setBusy(null);
    await moveSelfTo(stablePosition(userId));
    await refreshCoordination();
    broadcastRefresh();
  };

  const startNextWaiting = async () => {
    if (!supabase || busy) return;
    setBusy("next");
    const { data, error } = await supabase.rpc("cpp_live_start_next_waiting");
    if (error) setErrorMessage(error.message);
    else if ((data || [])[0]?.thread_id) setActiveThreadId(data[0].thread_id);
    setBusy(null);
    await refreshCoordination();
    broadcastRefresh();
  };

  const endDirect = async (threadId) => {
    if (!supabase || busy) return;
    setBusy("end-direct");
    const { error } = await supabase.rpc("cpp_live_end_conversation", { p_thread_id: threadId });
    if (error) setErrorMessage(error.message);
    setBusy(null);
    setActiveThreadId(null);
    await moveSelfTo(stablePosition(userId));
    await refreshCoordination();
    broadcastRefresh();
  };

  const extendDirect = async (threadId) => {
    if (!supabase || busy) return;
    setBusy("extend-direct");
    const { error } = await supabase.rpc("cpp_live_extend_conversation", { p_thread_id: threadId });
    if (error) setErrorMessage(error.message);
    setBusy(null);
    await refreshCoordination();
    broadcastRefresh();
  };

  const openDirect = async (threadId) => {
    if (!supabase || busy) return;
    setBusy("open-direct");
    const { data: roomId, error } = await supabase.rpc("cpp_live_open_direct_conversation", { p_thread_id: threadId });
    if (error) setErrorMessage(error.message);
    else {
      setActiveThreadId(null);
      setActiveRoomId(roomId);
    }
    setBusy(null);
    await refreshCoordination();
    broadcastRefresh();
  };

  const joinOpenRoom = async (roomId) => {
    if (!supabase || busy) return;
    setBusy("join-open");
    const { error } = await supabase.rpc("cpp_live_join_open_room", { p_room_id: roomId });
    if (error) setErrorMessage(error.message); else setActiveRoomId(roomId);
    setBusy(null);
    await refreshCoordination();
    broadcastRefresh();
  };

  const leaveRoom = async (roomId) => {
    if (!supabase || busy) return;
    setBusy("leave-room");
    const { error } = await supabase.rpc("cpp_live_leave_group_room", { p_room_id: roomId });
    if (error) setErrorMessage(error.message);
    setBusy(null);
    setActiveRoomId(null);
    await moveSelfTo(stablePosition(userId));
    await refreshCoordination();
    broadcastRefresh();
  };

  const sendDirectMessage = async () => {
    if (!supabase || !activeThreadId || !directDraft.trim() || busy) return;
    setBusy("direct-message");
    const body = directDraft.trim();
    const { error } = await supabase.rpc("cpp_live_send_message", { p_thread_id: activeThreadId, p_body: body });
    if (error) setErrorMessage(error.message); else setDirectDraft("");
    setBusy(null);
    await refreshMessages(activeThreadId);
    broadcastRefresh();
  };

  const sendRoomMessage = async () => {
    if (!supabase || !activeRoomId || !roomDraft.trim() || busy) return;
    setBusy("room-message");
    const body = roomDraft.trim();
    const { error } = await supabase.rpc("cpp_live_send_group_message", { p_room_id: activeRoomId, p_body: body });
    if (error) setErrorMessage(error.message); else setRoomDraft("");
    setBusy(null);
    await refreshRoomMessages(activeRoomId);
    broadcastRefresh();
  };

  if (booting) return <CenteredCard>CPP LIVEを準備しています…</CenteredCard>;
  if (!userId) return <CenteredCard><h1 className="text-xl font-black text-neutral-950">PARARIへのログインが必要です</h1><Link href="/login?returnTo=/my/cpp/live" className="mt-6 inline-block rounded-full bg-neutral-900 px-5 py-2.5 text-sm font-bold text-white">ログインする</Link></CenteredCard>;
  if (!context) return <CenteredCard><div className="text-xs font-black tracking-[0.16em] text-neutral-400">CPP MATCHING · LIVE</div><h1 className="mt-3 text-xl font-black text-neutral-950">まだCPPへの入室許可がありません</h1><p className="mt-3 text-sm leading-7 text-neutral-600">CPP-R または CPP-C のメンバーシップが発行されるとLIVE空間に入れます。</p></CenteredCard>;

  if (!entered) {
    return (
      <main className="min-h-screen bg-neutral-100 px-4 py-14">
        <div className="mx-auto max-w-2xl rounded-[2.2rem] border border-neutral-200 bg-white p-8 text-center shadow-sm sm:p-12">
          <div className="text-xs font-black tracking-[0.18em] text-neutral-400">CPP MATCHING · LIVE</div>
          <h1 className="mt-4 text-4xl font-black tracking-tight text-neutral-950">CPP LIVE</h1>
          <p className="mt-5 text-lg font-bold text-neutral-700">現在 {lobbyCount} 人が参加中</p>
          <p className="mx-auto mt-4 max-w-lg text-sm leading-7 text-neutral-500">入室するまでは、あなたはLIVE参加者として表示されません。入室後は全員がお互いに見える状態になります。</p>
          {errorMessage ? <div className="mt-5 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{errorMessage}</div> : null}
          <button type="button" onClick={() => void enterLive()} disabled={Boolean(busy)} className="mt-8 rounded-full bg-neutral-950 px-8 py-4 text-sm font-black text-white shadow-sm disabled:opacity-40">{busy === "enter" ? "入室しています…" : `LIVEに入る · ${DEFAULT_STAY_MINUTES}分`}</button>
          <div className="mt-6 flex justify-center gap-2"><Link href="/my/cpp/members" className="rounded-full border border-neutral-300 px-4 py-2 text-xs font-bold text-neutral-600">BROWSE</Link><Link href="/my/cpp/social-profile" className="rounded-full border border-neutral-300 px-4 py-2 text-xs font-bold text-neutral-600">SOCIAL PROFILE</Link></div>
        </div>
      </main>
    );
  }

  const selected = profiles.find((row) => row.user_id === selectedUserId) || null;
  const selectedConversation = selected ? getConversationForUser(selected.user_id) : null;
  const selectedOutgoing = selected ? pendingRequests.find((row) => row.direction === "outgoing" && row.other_user_id === selected.user_id) : null;
  const selectedIncoming = selected ? pendingRequests.find((row) => row.direction === "incoming" && row.other_user_id === selected.user_id) : null;
  const selectedThread = selected ? threads.find((row) => row.other_user_id === selected.user_id) : null;
  const selectedQueue = selected ? queueRows.find((row) => row.host_user_id === selected.user_id && row.requester_user_id === userId) : null;
  const incoming = pendingRequests.filter((row) => row.direction === "incoming");
  const activeThread = threads.find((row) => row.thread_id === activeThreadId) || null;
  const activeRoom = rooms.find((row) => row.room_id === activeRoomId) || null;
  const myConfirmedQueue = queueRows.filter((row) => row.host_user_id === userId && row.queue_status === "waiting").sort((a, b) => a.queue_position - b.queue_position);
  const remainingStay = liveUntil ? Math.max(0, Math.ceil((new Date(liveUntil).getTime() - clock) / 1000)) : 0;
  const selfBusy = conversationMap.some((row) => (row.participant_ids || []).includes(userId));

  return (
    <main className="min-h-screen bg-neutral-100 px-3 py-4 sm:px-6 sm:py-6">
      <div className="mx-auto max-w-7xl">
        <header className="rounded-[1.6rem] border border-neutral-200 bg-white px-4 py-3 shadow-sm sm:px-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><div className="text-[10px] font-black tracking-[0.16em] text-neutral-400">CPP LIVE</div><div className="mt-1 text-lg font-black text-neutral-950">今ここにいる人</div></div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-neutral-100 px-3 py-2 text-xs font-black text-neutral-700">残り {formatDuration(remainingStay)}</span>
              <button type="button" onClick={() => void extendStay()} disabled={Boolean(busy)} className="rounded-full border border-neutral-300 bg-white px-3 py-2 text-xs font-bold text-neutral-700">＋30分</button>
              <button type="button" onClick={() => void setAvailability(availability === "away" ? "available" : "away")} disabled={Boolean(busy) || selfBusy} className={`rounded-full px-3 py-2 text-xs font-black ${availability === "away" ? "bg-neutral-200 text-neutral-600" : "bg-emerald-100 text-emerald-700"}`}>{availability === "away" ? "離席中" : selfBusy ? "会話中" : "話せます"}</button>
              <button type="button" onClick={() => void leaveLive()} disabled={Boolean(busy)} className="rounded-full border border-neutral-300 bg-white px-3 py-2 text-xs font-bold text-neutral-500">LIVEから出る</button>
            </div>
          </div>
        </header>

        {errorMessage ? <div className="mt-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{errorMessage}</div> : null}

        {myConfirmedQueue.length > 0 && !selfBusy ? (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
            <div><div className="text-[10px] font-black tracking-[0.12em] text-amber-700">NEXT</div><div className="mt-1 text-sm font-black text-neutral-900">次は {myConfirmedQueue[0].display_name} さんです</div></div>
            <button type="button" onClick={() => void startNextWaiting()} disabled={Boolean(busy)} className="rounded-full bg-neutral-950 px-4 py-2 text-xs font-black text-white">話す</button>
          </div>
        ) : null}

        {incoming.length > 0 ? (
          <div className="mt-3 space-y-2">{incoming.map((request) => <div key={request.request_id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-white px-4 py-3 shadow-sm"><div><div className="text-[10px] font-black tracking-[0.12em] text-amber-700">TALK REQUEST</div><div className="mt-1 text-sm font-black text-neutral-900">{request.display_name}さんが話しかけています</div></div><div className="flex gap-2"><button type="button" onClick={() => void respondConversation(request.request_id, true)} disabled={Boolean(busy) || selfBusy} className="rounded-full bg-neutral-950 px-4 py-2 text-xs font-black text-white disabled:opacity-35">話す</button><button type="button" onClick={() => void respondConversation(request.request_id, false)} disabled={Boolean(busy)} className="rounded-full border border-neutral-300 px-4 py-2 text-xs font-bold text-neutral-500">今回は話さない</button></div></div>)}</div>
        ) : null}

        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
          <section className="relative min-h-[650px] overflow-hidden rounded-[2rem] border border-neutral-200 bg-white shadow-sm">
            <div className="absolute inset-x-0 top-0 z-40 flex items-center justify-between border-b border-neutral-100 bg-white/90 px-5 py-3 backdrop-blur"><span className="text-xs font-bold text-neutral-500">参加中 {profiles.length} 人</span><span className="text-[10px] font-bold text-neutral-400">ピンク＝個別　・　グリーン＝OPEN</span></div>
            <div className="absolute inset-0 top-12 bg-[radial-gradient(circle_at_center,_rgba(0,0,0,0.035)_1px,_transparent_1px)] [background-size:28px_28px]" />

            {conversationMap.map((conv) => {
              const anchor = clusterAnchor(conv.conversation_id);
              const size = conv.conversation_kind === "direct" ? { w: 86, h: 58 } : { w: 108, h: 88 };
              const border = conv.conversation_mode === "open" ? "border-emerald-400" : "border-pink-400";
              return <div key={`frame:${conv.conversation_id}`} className={`pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-1/2 rounded-[2rem] border-[3px] ${border} bg-white/20`} style={{ left: `${anchor.x}%`, top: `${anchor.y}%`, width: `${size.w}px`, height: `${size.h}px` }} />;
            })}

            {profiles.map((profile) => {
              const pos = displayPositionForUser(profile.user_id);
              const isSelf = profile.user_id === userId;
              const isResearcher = profile.organization_key === "CPP-R";
              const q = queueRows.find((row) => row.requester_user_id === profile.user_id && row.queue_status === "waiting");
              const waitlist = queueRows.find((row) => row.requester_user_id === profile.user_id && row.queue_status === "waitlist");
              return (
                <button key={profile.user_id} type="button" onClick={() => void selectPerson(profile.user_id)} className="absolute z-30 -translate-x-1/2 -translate-y-1/2 text-center focus:outline-none" style={{ left: `${pos.x}%`, top: `${pos.y}%`, transition: "left .45s ease, top .45s ease" }}>
                  <span className={`mx-auto flex h-9 w-9 items-center justify-center rounded-full transition ${isResearcher ? "bg-neutral-950" : "border-[3px] border-neutral-950 bg-white"} ${selectedUserId === profile.user_id ? "scale-125 shadow-lg" : "hover:scale-110"} ${isSelf ? "ring-4 ring-neutral-300 ring-offset-2" : ""}`}>{!isResearcher ? <span className="h-2 w-2 rounded-full bg-neutral-950" /> : null}</span>
                  <span className="mt-1.5 inline-flex max-w-28 items-center gap-1 rounded-full bg-white/95 px-2 py-1 text-[10px] font-black text-neutral-800 shadow-sm"><span className="truncate">{profile.display_name}</span>{isSelf ? <span className="text-neutral-400">YOU</span> : null}{q ? <span className="rounded-full bg-amber-100 px-1.5 text-[9px] text-amber-700">{q.queue_position}</span> : null}{waitlist ? <span className="text-neutral-400">…</span> : null}</span>
                </button>
              );
            })}
          </section>

          <aside className="space-y-3">
            {activeThread ? <DirectChat thread={activeThread} messages={directMessages} draft={directDraft} setDraft={setDirectDraft} onSend={sendDirectMessage} onEnd={() => endDirect(activeThread.thread_id)} onExtend={() => extendDirect(activeThread.thread_id)} onOpen={() => openDirect(activeThread.thread_id)} canOpen={activeThread.live_owner_user_id === userId} clock={clock} busy={busy} /> : null}
            {!activeThread && activeRoom && activeRoom.my_status === "active" ? <RoomChat room={activeRoom} messages={roomMessages} draft={roomDraft} setDraft={setRoomDraft} onSend={sendRoomMessage} onLeave={() => leaveRoom(activeRoom.room_id)} busy={busy} /> : null}

            {!activeThread && !activeRoom && selected ? (
              <div>
                <SocialProfileCard displayName={selected.display_name} photoUrl={selected.photo_url} affiliation={selected.affiliation} roleTitle={selected.role_title} topics={selected.topics} intro={selected.intro} />
                <div className="mt-3 flex flex-wrap gap-2">
                  {selected.user_id === userId ? <Link href="/my/cpp/social-profile" className="rounded-full bg-neutral-950 px-4 py-2.5 text-xs font-black text-white">名札を編集</Link> : selectedThread ? <button type="button" onClick={() => setActiveThreadId(selectedThread.thread_id)} className="rounded-full bg-neutral-950 px-4 py-2.5 text-xs font-black text-white">会話を開く</button> : selectedConversation?.conversation_mode === "open" ? <><button type="button" onClick={() => void joinOpenRoom(selectedConversation.conversation_id)} disabled={Boolean(busy) || selfBusy} className="rounded-full bg-emerald-600 px-4 py-2.5 text-xs font-black text-white disabled:opacity-35">OPEN会話に入る</button>{selectedQueue ? <QueueButton row={selectedQueue} onCancel={cancelQueue} busy={busy} /> : <button type="button" onClick={() => void joinQueue(selected.user_id)} disabled={Boolean(busy)} className="rounded-full border border-neutral-300 bg-white px-4 py-2.5 text-xs font-bold text-neutral-700">この人を待つ</button>}</> : selectedConversation ? (selectedQueue ? <QueueButton row={selectedQueue} onCancel={cancelQueue} busy={busy} /> : <button type="button" onClick={() => void joinQueue(selected.user_id)} disabled={Boolean(busy)} className="rounded-full bg-amber-100 px-4 py-2.5 text-xs font-black text-amber-800">順番を待つ</button>) : selectedIncoming ? <><button type="button" onClick={() => void respondConversation(selectedIncoming.request_id, true)} disabled={Boolean(busy) || selfBusy} className="rounded-full bg-neutral-950 px-4 py-2.5 text-xs font-black text-white disabled:opacity-35">話す</button><button type="button" onClick={() => void respondConversation(selectedIncoming.request_id, false)} disabled={Boolean(busy)} className="rounded-full border border-neutral-300 px-4 py-2.5 text-xs font-bold text-neutral-500">今回は話さない</button></> : selectedOutgoing ? <><span className="rounded-full bg-amber-100 px-4 py-2.5 text-xs font-black text-amber-800">返事待ち</span><button type="button" onClick={() => void cancelRequest(selectedOutgoing.request_id)} disabled={Boolean(busy)} className="rounded-full border border-neutral-300 px-4 py-2.5 text-xs font-bold text-neutral-500">取り消す</button></> : <button type="button" onClick={() => void requestConversation(selected.user_id)} disabled={Boolean(busy) || selfBusy || availability === "away"} className="rounded-full bg-neutral-950 px-4 py-2.5 text-xs font-black text-white disabled:opacity-35">話しかける</button>}
                </div>
              </div>
            ) : null}

            {!activeThread && !activeRoom && !selected ? <div className="rounded-[2rem] border border-dashed border-neutral-300 bg-white p-7 text-center"><div className="text-base font-black text-neutral-900">人をクリックしてください</div><p className="mt-2 text-sm leading-7 text-neutral-500">クリックすると、その人の名札を見に近づきます。</p></div> : null}
          </aside>
        </div>
      </div>
    </main>
  );
}

function DirectChat({ thread, messages, draft, setDraft, onSend, onEnd, onExtend, onOpen, canOpen, clock, busy }) {
  const seconds = thread.session_expires_at ? Math.max(0, Math.ceil((new Date(thread.session_expires_at).getTime() - clock) / 1000)) : 0;
  const canExtend = thread.extension_count < 1 && thread.waiting_count === 0 && seconds > 0;
  return <section className="overflow-hidden rounded-[2rem] border-[3px] border-pink-400 bg-white shadow-sm"><div className="flex items-center justify-between gap-3 border-b border-pink-100 px-4 py-3"><div><div className="text-[10px] font-black tracking-[0.12em] text-pink-500">PRIVATE</div><div className="text-sm font-black text-neutral-950">{thread.display_name}</div></div><div className="rounded-full bg-pink-50 px-3 py-1.5 text-xs font-black text-pink-700">{formatDuration(seconds)}</div></div><div className="max-h-64 space-y-2 overflow-y-auto bg-neutral-50 p-3">{messages.length ? messages.map((m) => <div key={m.message_id} className={`rounded-xl px-3 py-2 text-xs ${m.sender_user_id === thread.other_user_id ? "mr-8 border border-neutral-200 bg-white text-neutral-800" : "ml-8 bg-neutral-950 text-white"}`}><div className="whitespace-pre-wrap break-words">{m.body}</div><div className="mt-1 text-[9px] opacity-50">{formatTime(m.created_at)}</div></div>) : <div className="py-8 text-center text-xs text-neutral-400">個別会話が始まりました。</div>}</div><form onSubmit={(e) => { e.preventDefault(); void onSend(); }} className="border-t border-neutral-100 p-3"><textarea rows={2} value={draft} onChange={(e) => setDraft(e.target.value.slice(0, 2000))} placeholder="メッセージ" className="w-full resize-none rounded-xl border border-neutral-300 px-3 py-2 text-xs outline-none"/><div className="mt-2 flex flex-wrap justify-between gap-2"><div className="flex flex-wrap gap-2">{canOpen ? <button type="button" onClick={onOpen} disabled={Boolean(busy)} className="rounded-full bg-emerald-600 px-3 py-2 text-[11px] font-black text-white">OPENにする</button> : null}{canExtend ? <button type="button" onClick={onExtend} disabled={Boolean(busy)} className="rounded-full border border-neutral-300 bg-white px-3 py-2 text-[11px] font-bold text-neutral-600">＋5分</button> : thread.waiting_count > 0 ? <span className="rounded-full bg-amber-50 px-3 py-2 text-[10px] font-bold text-amber-700">待っている人がいます</span> : null}<button type="button" onClick={onEnd} disabled={Boolean(busy)} className="rounded-full border border-neutral-300 bg-white px-3 py-2 text-[11px] font-bold text-neutral-500">離れる</button></div><button type="submit" disabled={!draft.trim() || Boolean(busy)} className="rounded-full bg-neutral-950 px-4 py-2 text-[11px] font-black text-white disabled:opacity-35">送信</button></div></form></section>;
}

function RoomChat({ room, messages, draft, setDraft, onSend, onLeave, busy }) {
  return <section className="overflow-hidden rounded-[2rem] border-[3px] border-emerald-400 bg-white shadow-sm"><div className="flex items-center justify-between gap-3 border-b border-emerald-100 px-4 py-3"><div><div className="text-[10px] font-black tracking-[0.12em] text-emerald-600">OPEN</div><div className="text-sm font-black text-neutral-950">{(room.participants || []).filter((p) => p.status === "active").map((p) => p.display_name).join(" · ")}</div></div><button type="button" onClick={onLeave} disabled={Boolean(busy)} className="rounded-full border border-neutral-300 px-3 py-1.5 text-[10px] font-bold text-neutral-500">離れる</button></div><div className="max-h-64 space-y-2 overflow-y-auto bg-neutral-50 p-3">{messages.length ? messages.map((m) => <div key={m.message_id} className="rounded-xl border border-neutral-200 bg-white px-3 py-2 text-xs text-neutral-800"><div className="mb-1 text-[9px] font-black text-neutral-400">{m.sender_name}</div><div className="whitespace-pre-wrap break-words">{m.body}</div></div>) : <div className="py-8 text-center text-xs text-neutral-400">OPEN会話です。参加者が加わることがあります。</div>}</div><form onSubmit={(e) => { e.preventDefault(); void onSend(); }} className="border-t border-neutral-100 p-3"><textarea rows={2} value={draft} onChange={(e) => setDraft(e.target.value.slice(0, 2000))} placeholder="メッセージ" className="w-full resize-none rounded-xl border border-neutral-300 px-3 py-2 text-xs outline-none"/><div className="mt-2 flex justify-end"><button type="submit" disabled={!draft.trim() || Boolean(busy)} className="rounded-full bg-emerald-600 px-4 py-2 text-[11px] font-black text-white disabled:opacity-35">送信</button></div></form></section>;
}

function QueueButton({ row, onCancel, busy }) {
  return <button type="button" onClick={() => void onCancel(row.queue_id)} disabled={Boolean(busy)} className={`rounded-full px-4 py-2.5 text-xs font-black ${row.queue_status === "waiting" ? "bg-amber-100 text-amber-800" : "bg-neutral-100 text-neutral-600"}`}>{row.queue_status === "waiting" ? `順番確定 ${row.queue_position}` : `キャンセル待ち ${row.queue_position}`} · 取消</button>;
}

function stablePosition(value) {
  const x = hashString(`${value}:x`);
  const y = hashString(`${value}:y`);
  return { x: 12 + (x % 76), y: 20 + (y % 62) };
}

function clusterAnchor(value) {
  const x = hashString(`${value}:cluster:x`);
  const y = hashString(`${value}:cluster:y`);
  return { x: 18 + (x % 64), y: 24 + (y % 54) };
}

function hashString(value) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) { hash ^= value.charCodeAt(i); hash = Math.imul(hash, 16777619); }
  return hash >>> 0;
}

function clamp(value, min, max) { return Math.min(max, Math.max(min, value)); }
function formatDuration(seconds) { const s = Math.max(0, Math.floor(seconds)); const m = Math.floor(s / 60); const r = s % 60; return `${m}:${String(r).padStart(2, "0")}`; }
function formatTime(value) { return new Intl.DateTimeFormat("ja-JP", { hour: "2-digit", minute: "2-digit" }).format(new Date(value)); }
function CenteredCard({ children }) { return <main className="min-h-screen bg-neutral-100 px-4 py-16"><div className="mx-auto max-w-xl rounded-[2rem] border border-neutral-200 bg-white p-8 text-center text-neutral-600 shadow-sm">{children}</div></main>; }
