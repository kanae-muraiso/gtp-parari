"use client";
import { useEffect, useState, type FormEvent } from "react";
import { useParams } from "next/navigation";

type Intake = { school: string; information: string; kind: string; slots: { id: string; starts_at: string }[] };
const field = "block w-full rounded-lg border p-2";

export default function ClassIntakePage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<Intake | null>(null);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");
  const [busy, setBusy] = useState(false);
  const path = "/api/classes/intake?id=" + encodeURIComponent(id);
  useEffect(() => {
    const controller = new AbortController();
    void fetch(path, { signal: controller.signal }).then(response => response.json()).then(result => {
      if (!result.ok) throw new Error(result.message);
      setData(result);
    }).catch(cause => { if (!controller.signal.aborted) setError(cause.message); });
    return () => controller.abort();
  }, [path]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...Object.fromEntries(new FormData(event.currentTarget)), agree: true, information: data?.information }) });
      const result = await response.json();
      if (!result.ok) throw new Error(result.message);
      setDone(result.confirmation ? "予約を受け付けました。確認メールをご覧ください。" : "予約を受け付けました。確認メールを送信できなかったため、日時をお控えください。");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "予約できませんでした。"); }
    finally { setBusy(false); }
  }
  return <main className="mx-auto max-w-xl space-y-4 px-4 py-10">
    {data && <><h1 className="text-xl font-bold">{data.school}の{data.kind}予約</h1>
      <p className="whitespace-pre-wrap rounded-xl bg-emerald-50 p-4">{data.information}</p>
      {done ? <p role="status">{done}</p> : data.slots.length ? <form className="grid gap-3" onSubmit={submit}>
        <label>日時<select name="slot" className={field} required>{data.slots.map(slot => <option key={slot.id} value={slot.id}>{new Date(slot.starts_at).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })}（日本時間）</option>)}</select></label>
        <label>受講する方のお名前<input name="name" className={field} maxLength={120} required /></label>
        <label>申し込む方のお名前<input name="applicant" className={field} maxLength={120} required /></label>
        <label>連絡先メール<input name="email" className={field} type="email" maxLength={254} required /></label>
        <label><input type="checkbox" required /> 案内と個人情報の取り扱いを確認し、同意します</label>
        <button className="w-fit rounded-lg bg-neutral-900 px-4 py-2 text-white" disabled={busy}>予約する</button>
      </form> : <p>現在予約できる日時はありません。</p>}
    </>}
    {error && <p role="alert">{error}</p>}
    {!data && !error && <p role="status">受付を読み込んでいます…</p>}
  </main>;
}
