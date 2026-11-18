"use client";
import { useRef, useState } from "react";
import type { SchoolClass } from "@/lib/classes";

export type ClassOffer = { id: string; name: string; information: string; class_ids: string[]; enabled: boolean; route_override?: "direct" | "briefing" | null };
const routeLabel = (route: string) => route === "direct" ? "そのまま入会を申し込む" : "説明会・体験から始める";
const field = "block w-full rounded border p-2 text-sm";
const button = "w-fit rounded bg-neutral-900 px-3 py-2 text-sm text-white disabled:opacity-50";

export default function ClassRecruitmentOffers({ classes, products = [], offers, busy, save, commonRoute = "briefing", publicationOnly = false, onDraftChange, onSaved }: {
  classes: SchoolClass[]; products?: { id: string; name: string }[]; offers: ClassOffer[]; busy: boolean;
  save: (input: object) => Promise<boolean>; commonRoute?: "direct" | "briefing"; publicationOnly?: boolean;
  onDraftChange?: () => void; onSaved?: () => void;
}) {
  const [editing, setEditing] = useState<{ offer?: ClassOffer; productId?: string } | null>(null);
  const [route, setRoute] = useState("");
  const draftId = useRef("");
  const current = editing?.offer;
  const productClasses = editing?.productId ? classes.filter(item => item.product_id === editing.productId) : classes;
  const initialIds = current?.class_ids ?? productClasses.map(item => item.id);

  function edit(offer?: ClassOffer, productId?: string) {
    draftId.current = "";
    setRoute(offer?.route_override ?? "");
    setEditing({ offer, productId: offer ? undefined : productId });
  }

  return <section data-setup-block="offer" className="grid gap-3 rounded-lg border p-4" aria-label="クラスごとの入会方法">
    <h4 className="font-semibold">クラスごとの入会方法</h4>
    {!publicationOnly && <p className="text-sm text-neutral-600">内容ごとに申込方法を変えられます。曜日・時間が違う同じ内容のクラスは、一つの申込ページにまとめられます。</p>}
    {!publicationOnly && products.map(product => {
      const slots = classes.filter(item => item.product_id === product.id);
      const linked = offers.filter(offer => slots.some(item => offer.class_ids.includes(item.id)));
      return <div key={product.id} className="grid gap-2 rounded-lg bg-neutral-50 p-3 text-sm">
        <strong>{product.name}</strong>
        {linked.length ? linked.map(offer => <div key={offer.id} className="flex flex-wrap items-center gap-2">
          <span>{offer.name} · {routeLabel(offer.route_override ?? commonRoute)}{offer.route_override ? "" : "（事業共通）"}</span>
          <button type="button" disabled={busy || editing !== null} className="underline" onClick={() => edit(offer, product.id)}>設定を編集</button>
        </div>) : <p>{routeLabel(commonRoute)}（事業共通）</p>}
        <button type="button" disabled={busy || editing !== null || !slots.length} className="w-fit underline" onClick={() => edit(undefined, product.id)}>この内容の申込ページを作る</button>
        {!slots.length && <p>先に開催日・時間を登録してください。</p>}
      </div>;
    })}
    {!publicationOnly && <button type="button" className="w-fit text-sm underline" disabled={busy || editing !== null} onClick={() => edit()}>複数の内容をまとめた申込ページを作る</button>}
    {offers.filter(offer => publicationOnly || !products.some(product => classes.some(item => item.product_id === product.id && offer.class_ids.includes(item.id)))).map(offer => <div key={offer.id} className="grid gap-2 rounded border p-3 text-sm">
      <strong>{offer.name}</strong><p>{routeLabel(offer.route_override ?? commonRoute)} · {offer.enabled ? "受付公開中" : "下書き"}</p>
      {publicationOnly ? <button className={button} type="button" disabled={busy} onClick={() => void save({ action: "offer", id: offer.id, name: offer.name, information: offer.information,
        classIds: offer.class_ids, routeOverride: offer.route_override ?? null, enabled: !offer.enabled })}>{offer.enabled ? "この受付を非公開にする" : "この受付を公開する"}</button>
        : <button className="w-fit underline" type="button" disabled={busy || editing !== null} onClick={() => edit(offer)}>設定を編集</button>}
      {offer.enabled && <a className="underline" href={"/class-intake/" + offer.id} target="_blank" rel="noreferrer">この申込ページを開く</a>}
    </div>)}
    {editing && <form key={current?.id ?? editing.productId ?? "new"} data-setup-offer-form className="grid gap-3 rounded-lg border p-3" onChange={() => onDraftChange?.()} onSubmit={async event => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      draftId.current ||= crypto.randomUUID();
      if (await save({ action: "offer", id: current?.id ?? draftId.current, name: form.get("name"), information: form.get("information"),
        classIds: form.getAll("classId"), routeOverride: route || null, enabled: current?.enabled ?? false })) {
        setEditing(null); draftId.current = ""; onSaved?.();
      }
    }}>
      <label className="text-sm">申込ページの名前<input name="name" className={field} required maxLength={120} defaultValue={current?.name ?? products.find(product => product.id === editing.productId)?.name} /></label>
      <label className="text-sm">この内容の入会方法<select name="routeOverride" className={field} value={route} onChange={event => setRoute(event.target.value)}>
        <option value="">事業共通の方法を使う</option><option value="direct">そのまま入会を申し込む</option><option value="briefing">説明会・体験から始める</option>
      </select></label>
      <p className="text-sm">{routeLabel(route || commonRoute)} → 入会対応 → 名簿登録</p>
      <fieldset className="grid gap-1 rounded border p-2 text-sm"><legend>対象の曜日・時間</legend>
        {productClasses.map(item => <label key={item.id}><input type="checkbox" name="classId" value={item.id} defaultChecked={initialIds.includes(item.id)} /> {item.productName ? item.productName + " · " : ""}{item.name}</label>)}
      </fieldset>
      <label className="text-sm">この申込ページの案内<textarea name="information" className={field} maxLength={4000} defaultValue={current?.information} /></label>
      <p className="text-sm text-neutral-600">説明会の受付日時、入会時の費用、規約、説明会後の申込書・メールは事業共通の設定を使います。公開は「募集を始める」で行います。</p>
      <button type="submit" disabled={busy} className={button}>この内容の入会方法を保存</button>
      {!current && <p className="text-xs text-neutral-600">保存すると新しい申込ページの下書きができます。</p>}
    </form>}
  </section>;
}
