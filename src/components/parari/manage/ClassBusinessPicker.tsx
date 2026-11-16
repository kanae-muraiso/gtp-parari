"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { classRequest } from "@/lib/classRequests";

const types = { school: "教室・スクール", studio: "スタジオ・サークル", other: "その他" } as const;
type Business = { id: string; name: string; business_type: keyof typeof types };
const entry = "/my/manage?tab=class";
const field = "block w-full rounded-lg border px-3 py-2 text-sm";
const button = "w-fit rounded-lg bg-neutral-900 px-3 py-2 text-sm text-white disabled:opacity-50";

export default function ClassBusinessPicker() {
  const [list, setList] = useState<Business[]>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
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
  return <section className="grid gap-4 rounded-2xl border bg-white p-5">
    <h2 className="text-xl font-bold">事業一覧</h2>
    {!list && !error && <p role="status">事業を読み込んでいます…</p>}
    {list?.map(business => <Link className="grid gap-1 rounded-lg border p-3 hover:border-neutral-500" key={business.id}
      href={entry + "&business=" + business.id}>
      <span className="font-semibold">{business.name}</span><span className="text-sm text-neutral-600">{types[business.business_type]}</span>
    </Link>)}
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
