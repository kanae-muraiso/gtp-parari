"use client";

import { useEffect, useState } from "react";
import { classRequest } from "@/lib/classRequests";
import { describeClassProduct, type ClassProduct } from "@/lib/classProduct";
import type { SchoolClass } from "@/lib/classes";

const field = "block w-full rounded-lg border border-neutral-300 px-3 py-2";
const panel = "grid gap-4 rounded-2xl border border-neutral-200 bg-white p-5";
const button = "w-fit rounded-lg bg-neutral-900 px-4 py-2 text-sm text-white disabled:opacity-50";

export default function ClassProductPanel({ classes }: { classes: SchoolClass[] }) {
  const [product, setProduct] = useState<ClassProduct | null>(null);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [retry, setRetry] = useState(0);
  const first = classes[0]?.id;

  useEffect(() => {
    const request = new AbortController();
    void classRequest<{ design: ClassProduct | null }>("?product=1", undefined, request.signal).then(({ design }) => {
      if (!request.signal.aborted) setProduct(design ?? { classIds: first ? [first] : [], description: "",
        capacity: 10, monthlyFee: 0, monthlyVisits: 4, booking: "fixed", extraFee: null, makeup: "none", makeupExpiry: "next_month" });
    }).catch(cause => { if (!request.signal.aborted) setError(cause.message); });
    return () => request.abort();
  }, [first, retry]);

  if (!product) return <section className={panel}>
    <p role={error ? "alert" : "status"}>{error || "商品設定を読み込んでいます…"}</p>
    {error && <button className={button} onClick={() => { setError(""); setRetry(value => value + 1); }}>再読み込み</button>}
  </section>;

  function patch<K extends keyof ClassProduct>(key: K, value: ClassProduct[K]) {
    setProduct(current => current ? { ...current, [key]: value } : current);
    setSaved(false);
  }
  const selected = classes.filter(item => product.classIds.includes(item.id));
  return <form className={panel} onSubmit={async event => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = await classRequest<{ design: ClassProduct }>("", { action: "saveProduct", design: { ...product, classIds: selected.map(item => item.id) } });
      setProduct(result.design);
      setSaved(true);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "保存できませんでした。"); }
    finally { setBusy(false); }
  }}>
    <h3 className="font-bold">クラス商品の設計</h3>
    <fieldset disabled={busy} className="grid min-w-0 gap-4">
      <fieldset className="grid gap-2"><legend className="mb-1 text-sm font-medium">対象クラス</legend>
        {classes.map(item => <label key={item.id} className="text-sm">
          <input type="checkbox" checked={product.classIds.includes(item.id)} onChange={event => patch("classIds",
            event.target.checked ? [...product.classIds, item.id] : product.classIds.filter(id => id !== item.id))} /> {item.name}
        </label>)}
      </fieldset>
      <label>内容<textarea className={field} rows={3} maxLength={1000} value={product.description} onChange={event => patch("description", event.target.value)} /></label>
      <div className="grid gap-3 sm:grid-cols-3">
        <label>各回の定員<input className={field} type="number" min={1} max={1000} required value={product.capacity || ""} onChange={event => patch("capacity", Number(event.target.value))} /></label>
        <label>月謝（円）<input className={field} type="number" min={0} max={1000000} required value={product.monthlyFee} onChange={event => patch("monthlyFee", Number(event.target.value))} /></label>
        <label>月の受講回数<input className={field} type="number" min={1} max={100} required value={product.monthlyVisits || ""} onChange={event => patch("monthlyVisits", Number(event.target.value))} /></label>
      </div>
      <label>通い方<select className={field} value={product.booking} onChange={event => patch("booking", event.target.value as ClassProduct["booking"])}>
        <option value="fixed">固定クラス</option><option value="multiple">複数クラスに所属</option><option value="flexible">空席を毎回予約</option>
      </select></label>
      <label><input type="checkbox" checked={product.extraFee !== null} onChange={event => patch("extraFee", event.target.checked ? 0 : null)} /> 別料金で追加受講を受け付ける</label>
      {product.extraFee !== null && <label>追加受講１回の料金（円）<input className={field} type="number" min={1} max={1000000} required
        value={product.extraFee || ""} onChange={event => patch("extraFee", Number(event.target.value))} /></label>}
      <label>欠席時の振替<select className={field} value={product.makeup} onChange={event => patch("makeup", event.target.value as ClassProduct["makeup"])}>
        <option value="none">振替なし</option><option value="approval">先生が承認して付与</option><option value="notice">事前連絡のある欠席に付与</option>
      </select></label>
      {product.makeup !== "none" && <label>振替期限<select className={field} value={product.makeupExpiry}
        onChange={event => patch("makeupExpiry", event.target.value as ClassProduct["makeupExpiry"])}>
        <option value="same_month">欠席した月の末日</option><option value="next_month">欠席した月の翌月末</option>
      </select></label>}
      {selected.length > 0 && <section className="rounded-lg bg-neutral-50 p-4">
        <h4 className="mb-2 font-medium">受講条件の案内文</h4>
        <p className="whitespace-pre-line text-sm leading-6">{describeClassProduct(product, selected.map(item => item.name))}</p>
      </section>}
      <button className={button} disabled={!selected.length}>商品設定を保存</button>
    </fieldset>
    {saved && <p role="status">商品設定を保存しました。</p>}
    {error && <p role="alert">{error}</p>}
  </form>;
}
