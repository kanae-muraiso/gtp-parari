"use client";
import Link from "next/link";
import { cppMessageHref } from "@/lib/cppMessageNavigation";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import type { MessageTarget } from "@/components/parari/cpp/messages/CppMessageAction";
type Thread = { thread_id: string; other_id: string; display_name: string; last_body: string; updated_at: string; unread: number; pending_exception: boolean; waiting_for_reply: boolean; blocked_by_me: boolean };
type Message = { id: number; sender_id: string; body: string; exception_delivery: boolean; created_at: string };
export default function MessagesPage() { return <Suspense fallback={<p className="p-8">読み込んでいます…</p>}><Inbox /></Suspense>; }
function Inbox() {
  const params = useSearchParams();
  const scope = params.get("from") === "alumni" ? "alumni" : "cpp";
  const [me, setMe] = useState("");
  const [eligible, setEligible] = useState(false);
  const [ready, setReady] = useState(false);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [other, setOther] = useState(params.get("to") ?? "");
  const [target, setTarget] = useState<MessageTarget | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [body, setBody] = useState("");
  const [override, setOverride] = useState(false);
  const [busy, setBusy] = useState(false);
  const [older, setOlder] = useState(false);
  const [error, setError] = useState("");
  const drafts = useRef<Record<string,string>>({});
  const historyInitialized = useRef(false);
  const selection = useRef(other); selection.current = other;
  const thread = threads.find((t) => t.other_id === other);
  const threadId = thread?.thread_id;
  const load = useCallback(async () => {
    if (!supabase) { setError("接続設定を確認できません。"); return; }
    const [auth, settings, inbox] = await Promise.all([supabase.auth.getUser(),supabase.rpc("cpp_message_settings"),supabase.rpc("cpp_message_inbox")]);
    if (!auth.data.user || settings.error || inbox.error) { setError("ログイン状態を確認してください。"); return; }
    setMe(auth.data.user.id); setEligible(settings.data?.[0]?.eligible ?? false); setThreads(inbox.data ?? []); setReady(true);
  }, []);
  useEffect(() => { void load(); const timer = setInterval(() => { if (document.visibilityState === "visible") void load(); },15000); return () => clearInterval(timer); }, [load]);
  useEffect(() => { const to = params.get("to"); if (to) setOther(to); }, [params]);
  useEffect(() => {
    let active = true; setTarget(null); setMessages([]); setBody(drafts.current[other] ?? ""); setOverride(false); setOlder(false); setError("");
    if (other && supabase) void supabase.rpc("cpp_message_targets", { p_user_ids: [other] }).then(({ data, error }) => { if (active) { setTarget(data?.[0] ?? null); if (error) setError(error.message); } });
    return () => { active = false; };
  }, [other]);
  const refreshHistory = useCallback(async () => {
    if (!supabase || !threadId || document.visibilityState !== "visible") return;
    const selected = other;
    const result = await supabase.rpc("cpp_message_history", { p_thread: threadId });
    if (selection.current !== selected) return;
    if (result.error) { setError(result.error.message); return; }
    const rows = (result.data ?? []) as Message[];
    setMessages((old) => Array.from(new Map([...old,...rows].map((m) => [m.id,m])).values()).sort((a,b) => a.id-b.id));
    if (!historyInitialized.current) { setOlder(rows.length === 100); historyInitialized.current = true; }
    if (rows.length) {
      const read = await supabase.rpc("cpp_message_mark_read", { p_thread: threadId, p_last_id: rows[0].id });
      if (!read.error) { window.dispatchEvent(new Event("cpp-messages-changed")); setThreads((list) => list.map((t) => t.thread_id === threadId ? { ...t, unread: 0 } : t)); }
    }
  }, [threadId,other]);
  useEffect(() => { historyInitialized.current = false; void refreshHistory(); const timer = setInterval(() => void refreshHistory(),15000); return () => clearInterval(timer); }, [refreshHistory]);
  const send = async () => {
    if (!supabase || busy) return;
    setBusy(true); setError("");
    const selected = other;
    const result = await supabase.rpc("cpp_message_send", { p_recipient: other, p_body: body, p_override: override });
    if (result.error) { setError(result.error.message); const t = await supabase.rpc("cpp_message_targets", { p_user_ids: [selected] }); if (selection.current === selected) setTarget(t.data?.[0] ?? null); }
    else { drafts.current[selected] = ""; setBody(""); setOverride(false); await load(); await refreshHistory(); window.dispatchEvent(new Event("cpp-messages-changed")); }
    setBusy(false);
  };
  const block = async () => {
    if (!supabase || busy) return;
    setBusy(true); setError("");
    const result = await supabase.rpc("cpp_message_block", { p_user: other, p_block: !(thread?.blocked_by_me || target?.blocked_by_me) });
    if (result.error) setError(result.error.message);
    else { await load(); const t = await supabase.rpc("cpp_message_targets", { p_user_ids: [other] }); setTarget(t.data?.[0] ?? null); }
    setBusy(false);
  };
  const loadOlder = async () => {
    if (!supabase || !threadId || busy || !messages.length) return;
    setBusy(true); const selected = other;
    const result = await supabase.rpc("cpp_message_history", { p_thread: threadId, p_before: messages[0].id });
    if (selection.current === selected) {
      if (result.error) setError(result.error.message);
      else { const rows = (result.data ?? []) as Message[]; setMessages((old) => Array.from(new Map([...rows,...old].map((m) => [m.id,m])).values()).sort((a,b) => a.id-b.id)); setOlder(rows.length === 100); }
    }
    setBusy(false);
  };
  const blocked = thread?.blocked_by_me || target?.blocked_by_me;
  const requiresOverride = !thread && target && !target.accepting;
  return <main className="min-h-screen bg-neutral-100 px-4 py-8"><div className="mx-auto max-w-6xl">
    <header className="flex flex-wrap items-center justify-between gap-3"><h1 className="text-2xl font-black">メッセージ</h1><div className="flex gap-4 text-sm font-bold"><Link href="/cpp/alumni/members" className="underline">同窓会の名札から送る</Link><Link href={cppMessageHref(scope, { settings: true })} className="underline">メッセージ設定</Link></div></header>
    <p className="mt-3 text-sm text-neutral-600">テキストの個人間メッセージです。現在は同窓会登録者同士で利用できます。</p>
    {error ? <p role="alert" className="mt-4 rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p> : null}
    {!ready ? <p className="mt-6">{error ? <Link href={`/login?returnTo=${encodeURIComponent(cppMessageHref(scope, { to: params.get("to") ?? undefined }))}`} className="underline">ログイン</Link> : "読み込んでいます…"}</p> : <>
    {!eligible ? <p className="mt-5 rounded-xl bg-amber-50 p-4 text-sm">送受信には<Link href="/cpp/alumni" className="font-bold underline">同窓会への登録</Link>が必要です。過去の会話は閲覧できます。</p> : null}
    <div className="mt-6 grid gap-5 lg:grid-cols-[300px_1fr]"><aside className="rounded-3xl bg-white p-4 shadow-sm"><h2 className="px-2 py-2 font-bold">受信箱</h2>{threads.length ? <ul className="divide-y">{threads.map((t) => <li key={t.thread_id}><button type="button" disabled={busy} onClick={() => setOther(t.other_id)} className={`w-full rounded-xl p-3 text-left ${other === t.other_id ? "bg-sky-50" : "hover:bg-neutral-50"}`}><div className="flex justify-between gap-2"><span className="font-bold">{t.display_name}</span>{Number(t.unread) > 0 ? <span className="rounded-full bg-red-600 px-2 text-xs text-white">{t.unread}</span> : null}</div><p className="mt-2 truncate text-xs text-neutral-500">{t.last_body}</p>{t.waiting_for_reply ? <p className="mt-2 text-xs text-amber-700">返信待ち</p> : null}</button></li>)}</ul> : <p className="p-3 text-sm text-neutral-500">まだ会話はありません。</p>}</aside>
    <section className="min-w-0 rounded-3xl bg-white p-5 shadow-sm">{other ? <>
      <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-bold">{thread?.display_name || target?.display_name || "相手を確認しています…"}</h2>{other !== me && (thread || target) ? <button type="button" disabled={busy} onClick={() => void block()} className="rounded-full border border-neutral-300 px-4 py-2 text-xs font-bold disabled:opacity-50">{blocked ? "ブロックを解除" : "この人をブロック"}</button> : null}</div>
      {target ? <p className="mt-2 text-xs text-neutral-500">{target.accepting ? "メッセージ受付中" : "メッセージ受付停止中"}</p> : null}
      <div className="mt-5 max-h-[55vh] space-y-4 overflow-y-auto rounded-2xl bg-neutral-50 p-4" aria-label="会話履歴">{older ? <button type="button" disabled={busy} onClick={() => void loadOlder()} className="text-xs font-bold underline">以前のメッセージを読む</button> : null}{messages.map((m) => <article key={m.id} className={`rounded-2xl p-4 ${m.sender_id === me ? "ml-6 bg-sky-50" : "mr-6 bg-white"}`}><p className="text-xs font-bold text-neutral-500">{m.sender_id === me ? "あなた" : thread?.display_name || target?.display_name} · {new Date(m.created_at).toLocaleString("ja-JP")}</p>{m.exception_delivery && m.sender_id !== me ? <p className="mt-2 text-xs font-bold text-red-600">受付停止中に送られたメッセージです</p> : null}<p className="mt-2 whitespace-pre-wrap break-words text-sm leading-7">{m.body}</p></article>)}{!messages.length ? <p className="text-sm text-neutral-500">最初のメッセージを入力してください。</p> : null}</div>
      {blocked ? <p className="mt-4 text-sm text-red-700">この相手をブロックしています。送受信は停止しています。</p> : thread?.waiting_for_reply ? <p className="mt-4 text-sm text-amber-700">最初の1通を送りました。返信があるまで追加送信はできません。</p> : eligible && (target || thread) && other !== me ? <form onSubmit={(event) => { event.preventDefault(); void send(); }} className="mt-5">
        {thread?.pending_exception ? <p className="mb-3 text-sm text-neutral-600">返信すると、この相手とは通常の会話に移ります。</p> : null}
        <label className="text-sm font-bold">メッセージ本文<textarea required maxLength={4000} value={body} disabled={busy} onChange={(event) => { drafts.current[other] = event.target.value; setBody(event.target.value); }} className="mt-2 block min-h-32 w-full rounded-xl border border-neutral-300 p-3 text-sm" /></label>
        {requiresOverride ? <label className="mt-4 flex items-start gap-3 rounded-xl bg-amber-50 p-4 text-sm leading-6"><input type="checkbox" checked={override} disabled={busy} onChange={(event) => setOverride(event.target.checked)} className="mt-1" /><span>この方はメッセージ受付停止中です。最初の1通だけ送ります。返信があるまで追加送信できないことを確認しました。</span></label> : null}
        <button disabled={busy || !body.trim() || Boolean(requiresOverride && !override)} className="mt-4 rounded-full bg-neutral-950 px-6 py-3 text-sm font-bold text-white disabled:opacity-40">{busy ? "処理中…" : "送信"}</button>
      </form> : <p className="mt-4 text-sm text-neutral-500">この相手への送信は現在利用できません。</p>}
    </> : <p className="py-10 text-center text-sm text-neutral-500">会話を選ぶか、同窓会の名札から相手を選んでください。</p>}</section></div></>}
  </div></main>;
}
