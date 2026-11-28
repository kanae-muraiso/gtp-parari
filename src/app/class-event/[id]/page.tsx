"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import ClassEventSchedule from "@/components/parari/manage/ClassEventSchedule";
import ClassHomePageContent from "@/components/parari/classes/ClassHomePageContent";
import { classEventDate, type ClassEvent } from "@/lib/classEvents";

type View = { event: ClassEvent; schoolName: string; canRegister: boolean; registered: boolean; paymentUrl: string | null; squareEntryId?: string | null; authoredPage?: {id:string;content:string}|null };
const field = "rounded-lg border border-neutral-300 px-3 py-2";
const button = "w-fit rounded-lg bg-neutral-900 px-4 py-2 text-sm font-bold text-white disabled:opacity-50";

export default function ClassEventPage() {
  const { id } = useParams<{ id: string }>();
  const [token, setToken] = useState<string | null | undefined>();
  const [view, setView] = useState<View | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [login, setLogin] = useState(false);
  const [busy, setBusy] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [waitingForEmail, setWaitingForEmail] = useState(false);

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((_event, session) => setToken(session?.access_token ?? null));
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (token === undefined) return;
    const controller = new AbortController();
    void fetch("/api/classes/events?event=" + encodeURIComponent(id), {
      cache: "no-store", signal: controller.signal, headers: token ? { Authorization: "Bearer " + token } : {},
    }).then(async response => {
      const data = await response.json();
      if (controller.signal.aborted) return;
      setLogin(response.status === 401);
      if (!response.ok) { setView(null); setError(data.message); return; }
      setView(data);
      setError("");
    }).catch(() => { if (!controller.signal.aborted) setError("イベントを読み込めませんでした。"); });
    return () => controller.abort();
  }, [id, token, refresh]);

  async function register(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/application/" + (token ? "submit" : "guest-submit"), {
        method: "POST", headers: { "Content-Type": "application/json", ...(token ? { Authorization: "Bearer " + token } : {}) },
        body: JSON.stringify({ applicationId: id, applicantName: form.get("name"), applicantEmail: form.get("email") }),
      });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.message || "申し込めませんでした。");
      if (!token && data.email_delivery === "failed") throw new Error("確認メールを送れませんでした。時間をおいてお試しください。");
      if (token && typeof data.checkout_url === "string") { window.location.assign(data.checkout_url); return; }
      if (token) {
        setMessage("お申し込みを受け付けました。");
        setRefresh(value => value + 1);
      } else {
        setWaitingForEmail(true);
        setMessage("確認メールを送信しました。メールのリンクを開くと申込が完了します。");
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "申し込めませんでした。");
    } finally { setBusy(false); }
  }

  async function pay() {
    if (!token || !view?.squareEntryId) return;
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/application/payment/checkout", { method:"POST", headers:{"Content-Type":"application/json",Authorization:"Bearer "+token}, body:JSON.stringify({entryId:view.squareEntryId}) });
      const data = await response.json();
      if (!response.ok || !data.ok || typeof data.url !== "string") throw new Error(data.message || "決済を開始できませんでした。");
      window.location.assign(data.url);
    } catch(cause) { setError(cause instanceof Error ? cause.message : "決済を開始できませんでした。"); }
    finally { setBusy(false); }
  }
  const event = view?.event;
  return <main className="min-h-screen bg-neutral-100 px-4 py-8">
    <article className="mx-auto grid max-w-xl gap-4 rounded-2xl border border-neutral-200 bg-white p-6">
      {event && view ? <>
        <header className="grid gap-1">
          <p className="text-sm text-neutral-600">{view.schoolName}</p>
          <h1 className="text-2xl font-bold">{event.title}</h1>
        </header>
        <ClassEventSchedule settings={event.class_event} />
        {view.authoredPage ? <section aria-label="主催者からのご案内" className="rounded-xl border p-4">
          <ClassHomePageContent content={view.authoredPage.content}/>
        </section> : event.description && <p className="whitespace-pre-wrap">{event.description}</p>}
        <p>{event.payment_amount ? `${event.class_event.sessions ? "受講料（全日程）" : "参加費"} ${event.payment_amount.toLocaleString("ja-JP")}円${event.payment_method === "on_site" ? "（当日払い）" : ""}` : event.class_event.sessions ? "受講料無料" : "参加費無料"}</p>
        {event.class_event.sessions && <p className="text-sm">一度のお申し込みで全日程に参加できます。</p>}
        {view.registered ? <>
          <p className="font-medium">申込受付済み</p>
          {view.squareEntryId && <button className={button} disabled={busy} onClick={()=>void pay()}>Squareで参加費を支払う</button>}
          {view.paymentUrl && <a className={button} href={view.paymentUrl} rel="noreferrer">参加費を支払う</a>}
        </> : event.status === "closed" ? <p>受付は終了しました。</p> :
          !event.class_event.registration ? <p>申込不要です。</p> :
          view.canRegister ? <>
            <p className="text-sm">申込締切 {classEventDate(event.class_event.deadline)}{event.definition.capacity && ` · 定員 ${event.definition.capacity}人`}</p>
            {!waitingForEmail && <form className="grid gap-3 border-t pt-4" onSubmit={register}>
              {!token && <>
                <label className="grid gap-1 text-sm">氏名<input className={field} name="name" autoComplete="name" maxLength={120} required /></label>
                <label className="grid gap-1 text-sm">メールアドレス<input className={field} name="email" type="email" autoComplete="email" required /></label>
              </>}
              <button className={button} disabled={busy}>{busy ? "受付中…" : "申し込む"}</button>
            </form>}
          </> : <p>現在、申込は受け付けていません。</p>}
      </> : !error && <p role="status">イベントを読み込んでいます…</p>}
      {error && <p className="text-sm text-red-700" role="alert">{error}</p>}
      {message && <p className="text-sm text-green-800" role="status">{message}</p>}
      {login && <Link className={button} href={`/login?returnTo=${encodeURIComponent(`/class-event/${id}`)}`}>ログイン</Link>}
    </article>
  </main>;
}
