"use client";
import { useEffect, useState, type FormEvent } from "react";
import { classRequest } from "@/lib/classRequests";

type Data = { recruitment: { public_id: string; enabled: boolean; information: string; kind: string } | null;
  slots: { id: string; starts_at: string; capacity: number; closed: boolean }[] };
const field = "block w-full rounded border p-2";
const button = "w-fit rounded bg-neutral-900 px-3 py-2 text-sm text-white disabled:opacity-50";

export default function ClassRecruitmentPanel() {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    void classRequest<Data>("/recruitment", undefined, controller.signal).then(setData)
      .catch(cause => { if (!controller.signal.aborted) setError(cause.message); });
    return () => controller.abort();
  }, []);
  async function save(values: object) {
    setBusy(true);
    setError("");
    try { await classRequest("/recruitment", values); setData(await classRequest<Data>("/recruitment")); return true; }
    catch (cause) { setError(cause instanceof Error ? cause.message : "保存できませんでした。"); return false; }
    finally { setBusy(false); }
  }
  function configure(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    void save({ ...Object.fromEntries(form), action: "settings", enabled: form.has("enabled") });
  }
  return <section className="grid gap-3 rounded-2xl border bg-white p-5">
    <h3 className="font-bold">説明会・体験の募集</h3>
    {error && <p role="alert">{error}</p>}
    {!data && !error && <p role="status">読み込み中…</p>}
    {data && <><form onSubmit={configure} className="grid gap-2">
      <label>受付の種類<select name="kind" className={field} defaultValue={data.recruitment?.kind}>{["説明会", "体験", "見学"].map(kind => <option key={kind}>{kind}</option>)}</select></label>
      <label>案内・個人情報の取り扱い<textarea className={field} name="information" maxLength={4000} required defaultValue={data.recruitment?.information} /></label>
      <label><input name="enabled" type="checkbox" defaultChecked={data.recruitment?.enabled} /> 公開する</label>
      <button className={button} disabled={busy}>募集を保存</button>
    </form>
    {data.recruitment && <>
      {data.recruitment.enabled && <a className="underline" href={`/class-intake/${data.recruitment.public_id}`} target="_blank" rel="noreferrer">公開受付ページを開く</a>}
      <form className="grid gap-2" onSubmit={async event => {
        event.preventDefault();
        const form = event.currentTarget;
        const values = new FormData(form);
        const id = form.dataset.requestId || crypto.randomUUID();
        form.dataset.requestId = id;
        if (await save({ action: "slot", id, startsAt: values.get("startsAt") + ":00+09:00", capacity: Number(values.get("capacity")) })) {
          delete form.dataset.requestId; form.reset();
        }
      }}>
        <label>開催日時（日本時間）<input className={field} name="startsAt" type="datetime-local" required /></label>
        <label>定員<input className={field} name="capacity" type="number" min="1" max="100" defaultValue="1" required /></label>
        <button className={button} disabled={busy}>予約枠を追加</button>
      </form>
      {data.slots.map(slot => <p className="text-sm" key={slot.id}>{new Date(slot.starts_at).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })} ／ {slot.capacity}人{" "}
        {slot.closed ? "受付終了" : <button disabled={busy} className="underline" type="button" onClick={() => void save({ action: "close", id: slot.id })}>新規受付を終了</button>}</p>)}
    </>}</>}
  </section>;
}
