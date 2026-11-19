"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
type Registration = { returnHref?: string | null; interviewReserved?: boolean; mailed?: boolean | null; school: string; name: string; schoolId: string; startsOn: string | null; enrolled: boolean; connected: boolean; role: "guardian" | "learner" };
export default function ClassRegistrationPage() {
  const [data, setData] = useState<Registration>();
  const [error, setError] = useState("");
  const [returnTo, setReturnTo] = useState("/class-registration");
  const [wrongAccount, setWrongAccount] = useState(false);
  const [login, setLogin] = useState(false);
  const [busy, setBusy] = useState(false);
  async function request(write = false, signal?: AbortSignal) {
    let token = window.location.hash.slice(1);
    if (!token) token = sessionStorage.getItem("parari:class-registration") ?? "";
    if (token) { setReturnTo("/class-registration#" + token); sessionStorage.setItem("parari:class-registration", token); window.history.replaceState(null, "", "/class-registration#" + encodeURIComponent(token)); }
    const session = await supabase?.auth.getSession();
    const access = session?.data.session?.access_token;
    const result = await fetch("/api/classes/registration", { method: write ? "POST" : "GET", cache: "no-store", signal,
      headers: { "X-Class-Registration": token, ...(access ? { Authorization: `Bearer ${access}` } : {}), ...(write ? { "Content-Type": "application/json" } : {}) },
      ...(write ? { body: JSON.stringify({ agree: true }) } : {}) });
    const body = await result.json();
    if (!body.ok) { setLogin(body.loginRequired === true); setWrongAccount(body.wrongAccount === true); throw Error(body.message); }
    setData(body);
  }
  useEffect(() => { const controller = new AbortController(); void request(false, controller.signal).catch(cause => { if (!controller.signal.aborted) setError(cause.message); }); return () => controller.abort(); }, []);
  return <main className="mx-auto grid max-w-xl gap-5 px-5 py-10">
    <h1 className="text-2xl font-bold">クラスとPARARIアカウントの接続</h1>
    {data && <section className="grid gap-3 rounded-2xl border bg-blue-50 p-5">
      <h2 className="font-bold">{data.school}</h2><p>{data.name}さん{data.role === "guardian" ? "の保護者" : ""}の登録</p>
      {data.connected ? <><p role="status">アカウントを接続しました。</p>
        {data.enrolled ? <><p>入会済みです。「所属先」からも教室を開けます。</p><Link className="underline" href={`/my/classes/${data.schoolId}`}>クラスの予定を開く</Link></>
          : <p>{data.interviewReserved ? "面接予約済みです。予約確認メールの日時・会場をご確認ください。" : "申込受付済み・入会確認待ちです。教室での確認が済むと「所属先」に教室が表示されます。"}</p>}
        {data.enrolled && data.mailed === false && <p>初回案内は「クラスの予定」でご確認ください。</p>}
        {data.startsOn && <p>参加開始予定日 {data.startsOn}</p>}</>
        : <form onSubmit={async event => { event.preventDefault(); setBusy(true); setError(""); try { await request(true); } catch(cause) { setError(cause instanceof Error ? cause.message : "接続できませんでした。"); } finally { setBusy(false); } }} className="grid gap-3">
          <label><input type="checkbox" required /> このアカウントを申込情報に接続し、クラスの予定を確認します</label>
          <button disabled={busy} className="w-fit rounded-lg bg-blue-800 px-4 py-2 text-white">接続する</button>
        </form>}
    </section>}
    {data?.returnHref && <Link href={data.returnHref} className="w-fit text-sm underline">募集案内を見直す</Link>}
    {error && <p role="alert">{error}</p>}
    {wrongAccount && <button type="button" className="w-fit rounded border px-4 py-2" onClick={async () => { await supabase.auth.signOut(); window.location.assign("/login?returnTo=" + encodeURIComponent(returnTo)); }}>案内を受け取ったアカウントでログインし直す</button>}
    {login && <Link className="w-fit rounded-lg bg-blue-800 px-4 py-2 text-white" href={"/login?returnTo=" + encodeURIComponent(returnTo)}>PARARIに登録・ログイン</Link>}
    {!data && !error && <p role="status">案内を読み込んでいます…</p>}
  </main>;
}
