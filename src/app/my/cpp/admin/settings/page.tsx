"use client";

import { useCallback, useEffect, useState } from "react";
import CppSectionNav from "@/components/parari/cpp/CppSectionNav";
import { supabase } from "@/lib/supabaseClient";

type User = { user_id: string; username: string; protected: boolean };
export default function CppModeSettingsPage() {
  const [rows, setRows] = useState<User[]>([]);
  const [username, setUsername] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [authorized, setAuthorized] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    if (!supabase) { setError("接続設定を確認できません。"); setLoading(false); return; }
    const { data, error } = await supabase.rpc("cpp_mode_users");
    setAuthorized(!error); setLoading(false);
    if (error) { setError(error.message); setRows([]); return; }
    setRows(data ?? []);
  }, []);
  useEffect(() => { void load(); }, [load]);
  const change = async (user?: User) => {
    if (!supabase || busy) return;
    setBusy(true); setError(""); setMessage("");
    const { error } = user
      ? await supabase.rpc("cpp_remove_mode_user", { p_user_id: user.user_id })
      : await supabase.rpc("cpp_add_mode_user", { p_username: username.trim() });
    if (error) setError(error.message);
    else { setUsername(""); setMessage(user ? "モード切替権限を削除しました。アカウントは残っています。" : "モード切替権限を追加しました。"); await load(); }
    setBusy(false);
  };
  return <><CppSectionNav /><main className="min-h-screen bg-neutral-100 px-4 py-10"><div className="mx-auto max-w-3xl rounded-3xl bg-white p-7 shadow-sm">
    <h1 className="text-2xl font-black">モード利用者の設定</h1>
    <p className="mt-3 text-sm leading-7 text-neutral-600">研究者・会社・管理者の3つのモードを利用できる人を設定します。追加する人には、この設定を変更する権限も付与されます。</p>
    {loading ? <p className="mt-5">読み込んでいます…</p> : null}
    {error ? <p role="alert" className="mt-5 text-sm text-red-700">{error}</p> : null}
    {message ? <p role="status" className="mt-5 text-sm text-emerald-700">{message}</p> : null}
    {authorized ? <>
      <form onSubmit={(event) => { event.preventDefault(); void change(); }} className="mt-7 flex flex-wrap items-end gap-3">
        <label className="flex-1 text-sm font-bold">PARARIユーザー名<input required value={username} onChange={(event) => setUsername(event.target.value)} disabled={busy} className="mt-2 block w-full rounded-xl border border-neutral-300 px-4 py-3" placeholder="ユーザー名を正確に入力" /></label>
        <button disabled={busy} className="rounded-full bg-neutral-950 px-5 py-3 text-sm font-bold text-white disabled:opacity-50">追加</button>
      </form>
      <ul className="mt-7 divide-y divide-neutral-100">{rows.map((user) => <li key={user.user_id} className="flex items-center justify-between gap-4 py-4"><span className="font-bold">{user.username}</span>{user.protected ? <span className="text-xs font-bold text-red-600">保護された管理者・削除不可</span> : <button type="button" disabled={busy} onClick={() => void change(user)} className="rounded-full border border-neutral-300 px-4 py-2 text-xs font-bold disabled:opacity-50">モード権限を削除</button>}</li>)}</ul>
    </> : null}
  </div></main></>;
}
