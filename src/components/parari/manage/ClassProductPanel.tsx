"use client";

import { useEffect, useState } from "react";
import { classRequest } from "@/lib/classRequests";
import { defaultClassSlotSettings, describeClassProduct, type ClassSlotDefaults, type ClassProduct, type NamedClassProduct } from "@/lib/classProduct";
import type { SchoolClass } from "@/lib/classes";

const field = "block w-full rounded-lg border border-neutral-300 px-3 py-2";
const panel = "grid gap-4 rounded-2xl border border-neutral-200 bg-white p-5";
const button = "w-fit rounded-lg bg-neutral-900 px-4 py-2 text-sm text-white disabled:opacity-50";

export default function ClassProductPanel({ classes, initialProduct, initialClass, onSaved, allowProductSelection = true }: {
  classes: SchoolClass[]; initialProduct?: string | null; initialClass?: string; onSaved?: () => void; allowProductSelection?: boolean;
}) {
  const [product, setProduct] = useState<ClassProduct | null>(null);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [retry, setRetry] = useState(0);
  const [products, setProducts] = useState<NamedClassProduct[]>([]);
  const [productId, setProductId] = useState("");
  const [name, setName] = useState("");
  const base: ClassProduct = { classIds: [], description: "", capacity: 10, monthlyFee: 0, monthlyVisits: 4,
    booking: "fixed", extraFee: null, makeup: "none", makeupExpiry: "next_month" };

  useEffect(() => {
    const request = new AbortController();
    void classRequest<{ design: ClassProduct | null; products: NamedClassProduct[] }>("?product=1", undefined, request.signal)
      .then(({ design, products }) => {
        if (request.signal.aborted) return;
        const initial = products.find(item => item.id === initialProduct);
        setProducts(products);
        setProductId(initial?.id ?? "");
        setName(initial?.name ?? "");
        setProduct(initial?.design ?? { ...(initialClass && design?.classIds.includes(initialClass) ? design : base),
          classIds: initialClass ? [initialClass] : [] });
      }).catch(cause => { if (!request.signal.aborted) setError(cause.message); });
    return () => request.abort();
  }, [initialProduct, initialClass, retry]);

  if (!product) return <section className={panel}>
    <p role={error ? "alert" : "status"}>{error || "商品設定を読み込んでいます…"}</p>
    {error && <button className={button} onClick={() => { setError(""); setRetry(value => value + 1); }}>再読み込み</button>}
  </section>;

  function patch<K extends keyof ClassProduct>(key: K, value: ClassProduct[K]) {
    setProduct(current => current ? { ...current, [key]: value } : current);
    setSaved(false);
  }
  const slotDefaults = product.slotDefaults ?? defaultClassSlotSettings;
  function patchSlotDefaults(values: Partial<ClassSlotDefaults>) {
    patch("slotDefaults", { ...slotDefaults, ...values });
  }
  const available = classes.filter(item => !item.product_id || item.product_id === productId);
  const selected = available.filter(item => product.classIds.includes(item.id));
  return <form className={panel} onSubmit={async event => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const id = productId || crypto.randomUUID();
      setProductId(id);
      const result = await classRequest<{ design: ClassProduct }>("", { action: "saveContentProduct", productId: id, name,
        design: { ...product, slotDefaults, classIds: selected.map(item => item.id) } });
      setProducts(current => [...current.filter(item => item.id !== id), { id, name, design: result.design }]);
      onSaved?.();
      setProduct(result.design);
      setSaved(true);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "保存できませんでした。"); }
    finally { setBusy(false); }
  }}>
    <h3 className="font-bold">{allowProductSelection ? "商品設定" : initialProduct ? "商品設定を編集" : "商品を作成"}</h3>
    <fieldset disabled={busy} className="grid min-w-0 gap-4">
      {allowProductSelection && <label>商品を選ぶ<select className={field} value={products.some(item => item.id === productId) ? productId : ""} onChange={event => {
        const existing = products.find(item => item.id === event.target.value);
        setProductId(existing?.id ?? ""); setName(existing?.name ?? ""); setProduct(existing?.design ?? base); setSaved(false);
      }}>
        <option value="">新しい商品</option>{products.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
      </select></label>}
      <label>商品名<input className={field} value={name} required maxLength={120} placeholder="中学英語 / 初級など"
        onChange={event => { setName(event.target.value); setSaved(false); }} /></label>
      <fieldset className="grid gap-2"><legend className="mb-1 text-sm font-medium">同じ内容を教える開催枠</legend>
        {available.map(item => <label key={item.id} className="text-sm">
          <input type="checkbox" checked={product.classIds.includes(item.id)} onChange={event => patch("classIds",
            event.target.checked ? [...product.classIds, item.id] : product.classIds.filter(id => id !== item.id))} /> {item.name} · {item.starts_at.slice(0, 5)}{item.location ? " · " + item.location : ""}
        </label>)}
      </fieldset>
      <label>内容<textarea className={field} rows={3} maxLength={1000} value={product.description} onChange={event => patch("description", event.target.value)} /></label>
      <label>通い方<select className={field} value={product.walkInFee != null ? "walkIn" : product.booking} onChange={event => {
        const value = event.target.value;
        setSaved(false);
        setProduct(current => current ? { ...current, walkInFee: value === "walkIn" ? 0 : null,
          booking: value === "walkIn" ? "fixed" : value as ClassProduct["booking"] } : current);
      }}>
        <option value="fixed">固定の開催枠に所属</option><option value="multiple">複数の指定枠に所属</option>
        <option value="flexible">同じ商品の空席を毎回予約</option><option value="walkIn">自由参加（予約不要）</option>
      </select></label>
      <fieldset className="grid gap-2">
        <legend className="mb-2 text-sm font-semibold">開催枠の標準設定</legend>
        <div className="grid gap-3 sm:grid-cols-3">
          <label>所要時間（分）<input className={field} type="number" min={5} max={480} required
            value={slotDefaults.duration || ""} onChange={event => patchSlotDefaults({ duration: Number(event.target.value) })} /></label>
          <label>方法<select className={field} value={slotDefaults.delivery}
            onChange={event => patchSlotDefaults({ delivery: event.target.value as ClassSlotDefaults["delivery"] })}>
            <option value="onsite">対面</option><option value="online">オンライン</option><option value="hybrid">対面とオンライン</option>
          </select></label>
          {slotDefaults.delivery !== "online" && <label>会場<input className={field} maxLength={200} required={slotDefaults.delivery === "hybrid"}
            value={slotDefaults.location} onChange={event => patchSlotDefaults({ location: event.target.value })} /></label>}
        </div>
        <p className="text-sm text-neutral-600">新しい開催枠や頻度に、ここで設定した内容と{product.walkInFee != null ? "基本参加費" : "月謝"}を使います。</p>
      </fieldset>
      {product.walkInFee != null ? <>
        <label>当日の基本参加費（円）<input className={field} type="number" min={0} max={1000000} required
          value={product.walkInFee} onChange={event => patch("walkInFee", Number(event.target.value))} /></label>
        <p className="text-sm">保存すると、事業名・クラス名・日程・会場・参加費を案内ページに掲載します。</p>
      </> : <>
      <div className="grid gap-3 sm:grid-cols-3">
        <label>各回の定員<input className={field} type="number" min={1} max={1000} required value={product.capacity || ""} onChange={event => patch("capacity", Number(event.target.value))} /></label>
        <label>月謝（円）<input className={field} type="number" min={0} max={1000000} required value={product.monthlyFee} onChange={event => patch("monthlyFee", Number(event.target.value))} /></label>
        <label>{product.booking === "flexible" ? "月謝に含まれる予約回数" : "月の標準受講回数"}<input className={field} type="number" min={1} max={100} required value={product.monthlyVisits || ""} onChange={event => patch("monthlyVisits", Number(event.target.value))} /></label>
      </div>
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
      </>}
      {selected.length > 0 && <section className="rounded-lg bg-neutral-50 p-4">
        <h4 className="mb-2 font-medium">受講条件の案内文</h4>
        <p className="whitespace-pre-line text-sm leading-6">{describeClassProduct(product, selected.map(item => item.name))}</p>
      </section>}
      <button className={button}>商品設定を保存</button>
    </fieldset>
    {saved && <p role="status">商品設定を保存しました。</p>}
    {error && <p role="alert">{error}</p>}
  </form>;
}
