"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { classRequest } from "@/lib/classRequests";

const types = { school: "教室・スクール", studio: "スタジオ・サークル", other: "その他" } as const;
type Business = { id: string; name: string; business_type: keyof typeof types; archived_at?: string | null };
const entry = "/my/manage?tab=class";
const field = "block w-full rounded-lg border px-3 py-2 text-sm";
const button = "w-fit rounded-lg bg-neutral-900 px-3 py-2 text-sm text-white disabled:opacity-50";

export default function ClassBusinessPicker() {
  const [list, setList] = useState<Business[]>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState<Business>();
  const [notice, setNotice] = useState("");
  const [adding, setAdding] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const draft = useRef("");
  useEffect(() => {
    const controller = new AbortController();
    void classRequest<{ businesses: Business[] }>("?businesses=1", undefined, controller.signal).then(({ businesses }) => {
      if (!controller.signal.aborted) setList(businesses);
    }).catch(error => { if (!controller.signal.aborted) setError(error.message); });
    return () => controller.abort();
  }, [attempt]);
  const active = list?.filter(business => !business.archived_at);
  const archived = list?.filter(business => business.archived_at);

  async function changeArchive(business: Business, deleting: boolean) {
    if (busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await classRequest("", { action: deleting ? "archiveBusiness" : "restoreBusiness", id: business.id });
      setList(current => current?.map(item => item.id === business.id
        ? { ...item, archived_at: deleting ? new Date().toISOString() : null } : item));
      setDeleting(undefined);
      setNotice(deleting ? "「" + business.name + "」を削除しました。" : "「" + business.name + "」を復元しました。");
    } catch (error) {
      setError(error instanceof Error ? error.message : "事業を更新できませんでした。");
    } finally {
      setBusy(false);
    }
  }

  return <section className="grid gap-4 rounded-2xl border bg-white p-5">
    <h2 className="text-xl font-bold">事業一覧</h2>
    {!list && !error && <p role="status">事業を読み込んでいます…</p>}
    {active?.map(business => <div key={business.id} className="flex flex-wrap items-center gap-2 rounded-lg border p-3">
      <Link className="grid flex-1 gap-1 hover:underline" href={entry + "&business=" + business.id}>
        <span className="font-semibold">{business.name}</span><span className="text-sm text-neutral-600">{types[business.business_type]}</span>
      </Link>
      <button className="rounded-lg border px-3 py-2 text-sm text-red-800 disabled:opacity-50" type="button"
        aria-label={business.name + "を削除"} disabled={busy} onClick={() => { setNotice(""); setError(""); setDeleting(business); }}>削除</button>
      {deleting?.id === business.id && <div className="grid w-full gap-2 rounded border border-red-200 bg-red-50 p-3 text-sm">
        <p>「{business.name}」を削除しますか？公開中の募集を止め、受講者の画面からも事業を外します。記録は「削除済みの事業」から復元できます。</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={busy} className="rounded-lg bg-red-800 px-3 py-2 text-white disabled:opacity-50"
            onClick={() => void changeArchive(business, true)}>削除する</button>
          <button type="button" disabled={busy} className="rounded-lg border px-3 py-2" onClick={() => setDeleting(undefined)}>キャンセル</button>
        </div>
      </div>}
    </div>)}
    {archived && archived.length > 0 && <details className="grid gap-2 rounded-lg border p-3 text-sm">
      <summary className="cursor-pointer">削除済みの事業（{archived.length}件）</summary>
      {archived.map(business => <div key={business.id} className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <span>{business.name}</span>
        <button className="rounded-lg border px-3 py-2 disabled:opacity-50" type="button" disabled={busy}
          aria-label={business.name + "を復元"} onClick={() => void changeArchive(business, false)}>復元</button>
      </div>)}
    </details>}
    {notice && <p role="status" className="text-sm">{notice}</p>}
    {list && <button className={button} type="button" onClick={() => setAdding(value => !value)}>{adding ? "閉じる" : "事業を追加"}</button>}
    {adding && <form className="grid max-w-sm gap-3" onSubmit={async event => {
      event.preventDefault();
      if (busy) return;
      const form = new FormData(event.currentTarget);
      setBusy(true);
      setError("");
      draft.current ||= crypto.randomUUID();
      try {
        const { id } = await classRequest<{ id: string }>("", { action: "createBusiness", id: draft.current,
          name: form.get("name"), businessType: form.get("type") });
        window.location.assign(entry + "&business=" + id);
      } catch (error) {
        setError(error instanceof Error ? error.message : "事業を登録できませんでした。");
        setBusy(false);
      }
    }}>
      <label>事業名<input className={field} name="name" required maxLength={120} /></label>
      <label>事業形態<select className={field} name="type" required defaultValue="">
        <option value="">選択してください</option>{Object.entries(types).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select></label>
      <button className={button} disabled={busy}>事業を登録</button>
    </form>}
    {error && <p role="alert">{error} {!list && <button type="button" className="underline" onClick={() => { setError(""); setAttempt(value => value + 1); }}>再読み込み</button>}</p>}
  </section>;
}
