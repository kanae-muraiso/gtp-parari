"use client";

import { useCallback, useEffect, useState } from "react";
import CppSectionNav from "@/components/parari/cpp/CppSectionNav";
import { supabase } from "@/lib/supabaseClient";
import { CPP_TEST_MARKER, createCppTestClient, type CppTestScenario } from "@/lib/cppTestSession";

type User = { user_id: string; username: string; protected: boolean };
export default function CppModeSettingsPage() {
  const [rows, setRows] = useState<User[]>([]);
  const [username, setUsername] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [authorized, setAuthorized] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [testChoice, setTestChoice] = useState<"alumni" | "researcher">("alumni");
  const [testApproved, setTestApproved] = useState(false);
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
  const startTest = async () => {
    if (!supabase || busy) return;
    setBusy(true); setError(""); setMessage("");
    let testClient: ReturnType<typeof createCppTestClient> | undefined;
    try {
      const { data } = await supabase.auth.getSession();
      if (!data.session) throw new Error("ログインを確認してください。");
      const scenario: CppTestScenario = testChoice === "alumni" ? "alumni" : testApproved ? "researcher_approved" : "researcher_pending";
      const result = await fetch("/api/cpp/admin/alumni-test", {
        method: "POST",
        headers: { Authorization: `Bearer ${data.session.access_token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ scenario }),
        signal: AbortSignal.timeout(45000),
      });
      const payload = await result.json();
      if (!result.ok) throw new Error(payload.error || "テストの準備に失敗しました。");
      testClient = createCppTestClient();
      const verified = await testClient.auth.verifyOtp({ token_hash: payload.tokenHash, type: "email" });
      if (verified.error || !verified.data.session || verified.data.user?.id !== payload.userId) throw new Error("テスト用ログインを開始できませんでした。");
      sessionStorage.setItem(CPP_TEST_MARKER, "active");
      window.location.assign("/my/cpp/participation");
    } catch (error) {
      testClient?.auth.stopAutoRefresh();
      setError(error instanceof Error ? error.message : "テストの準備に失敗しました。");
      setBusy(false);
    }
  };
  return <><CppSectionNav /><main className="min-h-screen bg-neutral-100 px-4 py-10"><div className="mx-auto max-w-3xl rounded-3xl bg-white p-7 shadow-sm">
    <h1 className="text-2xl font-black">モード利用者の設定</h1>
    <p className="mt-3 text-sm leading-7 text-neutral-600">研究者・会社・管理者の3つのモードを利用できる人を設定します。追加する人には、この設定を変更する権限も付与されます。</p>
    {loading ? <p className="mt-5">読み込んでいます…</p> : null}
    {error ? <p role="alert" className="mt-5 text-sm text-red-700">{error}</p> : null}
    {message ? <p role="status" className="mt-5 text-sm text-emerald-700">{message}</p> : null}
    {authorized ? <>
      <section className="mt-7 rounded-2xl border border-blue-200 bg-blue-50 p-5">
        <h2 className="text-lg font-bold">一般の同窓会員としてテスト</h2>
        <p className="mt-3 text-sm leading-7 text-neutral-700">管理者ごとに専用アカウントを用意します。ご本人のプロフィールを変更せず、一般会員と同じ権限で登録・編集・閲覧を確認できます。</p>
        <fieldset disabled={busy} className="mt-4 space-y-3">
          <legend className="mb-2 text-sm font-bold">テスト開始時の参加方法</legend>
          <label className="block text-sm"><input type="radio" name="test-choice" checked={testChoice === "alumni"} onChange={() => setTestChoice("alumni")} /> 同窓会のみ</label>
          <label className="block text-sm"><input type="radio" name="test-choice" checked={testChoice === "researcher"} onChange={() => setTestChoice("researcher")} /> 同窓会＋研究者として参加</label>
          {testChoice === "researcher" ? <label className="block pl-5 text-sm"><input type="checkbox" checked={testApproved} onChange={(event) => setTestApproved(event.target.checked)} /> 参加承認済みの状態で始める</label> : null}
        </fieldset>
        <p className="mt-4 text-xs leading-6 text-neutral-600">開始時に参加方法と承認状態を設定し直します。テスト中の入力は専用アカウントに残り、名札は「テスト会員」として表示されます。画面下のボタンで管理者に戻れます。</p>
        <button type="button" disabled={busy} onClick={() => void startTest()} className="mt-4 rounded-full bg-blue-700 px-5 py-3 text-sm font-bold text-white disabled:opacity-50">{busy ? "処理中…" : "この立場でテストを開始"}</button>
      </section>
      <form onSubmit={(event) => { event.preventDefault(); void change(); }} className="mt-7 flex flex-wrap items-end gap-3">
        <label className="flex-1 text-sm font-bold">PARARIユーザー名<input required value={username} onChange={(event) => setUsername(event.target.value)} disabled={busy} className="mt-2 block w-full rounded-xl border border-neutral-300 px-4 py-3" placeholder="ユーザー名を正確に入力" /></label>
        <button disabled={busy} className="rounded-full bg-neutral-950 px-5 py-3 text-sm font-bold text-white disabled:opacity-50">追加</button>
      </form>
      <ul className="mt-7 divide-y divide-neutral-100">{rows.map((user) => <li key={user.user_id} className="flex items-center justify-between gap-4 py-4"><span className="font-bold">{user.username}</span>{user.protected ? <span className="text-xs font-bold text-red-600">保護された管理者・削除不可</span> : <button type="button" disabled={busy} onClick={() => void change(user)} className="rounded-full border border-neutral-300 px-4 py-2 text-xs font-bold disabled:opacity-50">モード権限を削除</button>}</li>)}</ul>
    </> : null}
  </div></main></>;
}
