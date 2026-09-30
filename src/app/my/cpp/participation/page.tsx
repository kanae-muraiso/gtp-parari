"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Status = { is_alumni: boolean; choice: "alumni" | "researcher"; admitted: boolean; is_operator: boolean };
export default function ParticipationPage() {
  const [status, setStatus] = useState<Status | null>(null);
  const [choice, setChoice] = useState<Status["choice"]>("alumni");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const load = useCallback(async () => {
    if (!supabase) { setError("接続設定を確認できません。"); return; }
    const result = await supabase.rpc("cpp_alumni_participation_status");
    if (result.error || !result.data?.[0]) { setError("ログインしてから参加設定を開いてください。"); return; }
    const value = result.data[0] as Status;
    setStatus(value); setChoice(value.choice);
  }, []);
  useEffect(() => { void load(); }, [load]);
  const save = async () => {
    if (!supabase || busy) return;
    setBusy(true); setError(""); setSaved(false);
    const result = await supabase.rpc("cpp_set_alumni_participation", { p_choice: choice });
    if (result.error) setError(result.error.message);
    else { await load(); setSaved(true); window.dispatchEvent(new Event("cpp-participation-changed")); }
    setBusy(false);
  };
  return <main className="min-h-screen bg-neutral-100 px-4 py-10"><div className="mx-auto max-w-3xl">
    <h1 className="text-2xl font-black">CPPでの参加設定</h1>
    <p className="mt-3 text-sm leading-7 text-neutral-600">同窓会だけで交流するか、研究者としてCPPにも参加するかを選べます。企業としての参加はここでは設定できません。</p>
    {error ? <p role="alert" className="mt-4 text-red-700">{error}</p> : null}
    {saved ? <p role="status" className="mt-4 text-emerald-700">参加設定を保存しました。</p> : null}
    {!status ? <Link href="/login?returnTo=/my/cpp/participation" className="mt-5 inline-block underline">ログイン</Link> : status.is_operator ? <p className="mt-6">運営用アカウントは、右上の設定から表示モードを切り替えてください。</p> : !status.is_alumni ? <p className="mt-6">この設定は同窓会メンバー向けです。<Link href="/cpp/alumni" className="ml-2 underline">同窓会へ</Link></p> : <section className="mt-6 rounded-3xl bg-white p-6 shadow-sm">
      <fieldset disabled={busy} className="space-y-4"><legend className="mb-4 font-bold">参加方法</legend>
        <label className="block rounded-2xl border p-4"><input type="radio" name="participation" checked={choice === "alumni"} onChange={() => { setChoice("alumni"); setSaved(false); }} /> <span className="font-bold">同窓会のみ</span><span className="mt-2 block text-sm leading-7 text-neutral-600">同窓会の名札とメッセージを利用します。研究者プロフィールは下書きに戻り、BROWSEとLIVEへの研究者参加を停止します。入力した内容は残ります。</span></label>
        <label className="block rounded-2xl border p-4"><input type="radio" name="participation" checked={choice === "researcher"} onChange={() => { setChoice("researcher"); setSaved(false); }} /> <span className="font-bold">同窓会＋研究者として参加</span><span className="mt-2 block text-sm leading-7 text-neutral-600">同窓会での交流に加えて、研究者プロフィールを準備できます。参加承認後は企業の閲覧とCPP LIVEを利用できます。研究者の詳細プロフィールを閲覧できるのは、許可された企業会員などに限られます。</span></label>
      </fieldset>
      <p className="mt-5 text-sm text-neutral-600">LIVEに参加している間は変更できません。先に退出してください。</p>
      <button type="button" disabled={busy || choice === status.choice} onClick={() => void save()} className="mt-5 rounded-full bg-blue-700 px-6 py-3 text-sm font-bold text-white disabled:opacity-50">{busy ? "保存中…" : "参加設定を保存"}</button>
      {status.choice === "researcher" ? <div className="mt-6 border-t pt-5"><p className="text-sm">{status.admitted ? "研究者として入室できます。プロフィールの公開は編集ページで設定してください。" : "研究者登録・プロフィールの準備を進めてください。BROWSEとLIVEは参加承認後に利用できます。"}</p><Link href="/cpp/try" className="mt-3 inline-block font-bold text-blue-700 underline">研究者登録・プロフィールの準備へ</Link></div> : null}
    </section>}
    <Link href="/my/cpp/home" className="mt-6 inline-block text-sm font-bold underline">CPPホームへ</Link>
  </div></main>;
}
