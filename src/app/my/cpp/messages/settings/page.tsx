"use client";
import Link from "next/link";
import { cppMessageHref } from "@/lib/cppMessageNavigation";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
type Block = { user_id: string; display_name: string };
export default function MessageSettings() {
  return <Suspense fallback={<p className="p-8">読み込んでいます…</p>}><MessageSettingsContent /></Suspense>;
}
function MessageSettingsContent() {
  const params = useSearchParams();
  const scope = params.get("from") === "alumni" ? "alumni" : "cpp";
  const [accepting, setAccepting] = useState(true);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const load = useCallback(async () => {
    if (!supabase) { setError("接続設定を確認できません。"); return; }
    const [settings, blocked] = await Promise.all([supabase.rpc("cpp_message_settings"),supabase.rpc("cpp_message_blocks")]);
    if (settings.error || blocked.error) { setError("ログイン状態を確認してください。" ); return; }
    setAccepting(settings.data?.[0]?.accepting ?? true); setBlocks(blocked.data ?? []); setReady(true);
  }, []);
  useEffect(() => { void load(); }, [load]);
  const update = async (other?: string) => {
    if (!supabase || busy) return;
    setBusy(true); setError(""); setMessage("");
    const result = other ? await supabase.rpc("cpp_message_block", { p_user: other, p_block: false }) : await supabase.rpc("cpp_message_set_accepting", { p_accepting: !accepting });
    if (result.error) setError(result.error.message);
    else { await load(); setMessage(other ? "ブロックを解除しました。" : "受付設定を保存しました。"); }
    setBusy(false);
  };
  return <main className="min-h-screen bg-neutral-100 px-4 py-10"><div className="mx-auto max-w-3xl space-y-6">
    <header><h1 className="text-2xl font-black">メッセージ設定</h1><Link href={cppMessageHref(scope)} className="mt-3 inline-block text-sm font-bold underline">受信箱へ</Link></header>
    {error ? <p role="alert" className="text-sm text-red-700">{error}</p> : null}{message ? <p role="status" className="text-sm text-emerald-700">{message}</p> : null}
    {ready ? <><section className="rounded-3xl bg-white p-6 shadow-sm"><h2 className="font-bold">新しい相手からの受付</h2><p className="mt-3 text-sm leading-7 text-neutral-600">名札に表示します。停止中でも、相手が確認して最初の1通を送ることができます。あなたが返信するまで追加の送信はできません。既存の会話と、自分からの送信は続けられます。LIVEの受付設定とは別です。</p><p className="mt-4 font-bold">{accepting ? "メッセージ受付中" : "メッセージ受付停止中"}</p><button type="button" disabled={busy} onClick={() => void update()} className="mt-4 rounded-full bg-neutral-950 px-5 py-3 text-sm font-bold text-white disabled:opacity-50">{accepting ? "受付を停止する" : "受付を再開する"}</button></section>
    <section className="rounded-3xl bg-white p-6 shadow-sm"><h2 className="font-bold">ブロックした相手</h2><p className="mt-3 text-sm text-neutral-600">ブロック中は相互の送受信を停止します。過去の会話は残ります。</p>{blocks.length ? <ul className="mt-4 divide-y">{blocks.map((b) => <li key={b.user_id} className="flex items-center justify-between gap-3 py-4"><span>{b.display_name}</span><button type="button" disabled={busy} onClick={() => void update(b.user_id)} className="rounded-full border px-4 py-2 text-xs font-bold disabled:opacity-50">解除</button></li>)}</ul> : <p className="mt-4 text-sm text-neutral-500">ブロックした相手はいません。</p>}</section></> : !error ? <p>読み込んでいます…</p> : <Link href={`/login?returnTo=${encodeURIComponent(cppMessageHref(scope, { settings: true }))}`} className="underline">ログイン</Link>}
  </div></main>;
}
