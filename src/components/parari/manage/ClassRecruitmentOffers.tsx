"use client";
import { useRef, useState } from "react";
import type { SchoolClass } from "@/lib/classes";

export type ClassOffer = { id: string; name: string; information: string; class_ids: string[]; enabled: boolean; direct_completion?: "review" | "automatic" | null; link_only?: boolean; route_override?: "direct" | "briefing" | null; audience_override?: "adult" | "minor" | null };
const routeLabel = (route: string) => route === "direct" ? "そのまま申込" : "対面の体験・説明会から申込";
const field = "block w-full rounded border p-2 text-sm";
const button = "w-fit rounded bg-neutral-900 px-3 py-2 text-sm text-white disabled:opacity-50";

export default function ClassRecruitmentOffers({ classes, products = [], offers, busy, save, commonRoute = "briefing", commonAudience = "adult", commonInformation = "", publicationOnly = false, singleCourse = false, onDraftChange, onSaved, onEditingChange }: {
  classes: SchoolClass[]; products?: { id: string; name: string; audience?: "adult" | "minor" }[]; offers: ClassOffer[]; busy: boolean;
  save: (input: object) => Promise<boolean>; commonRoute?: "direct" | "briefing"; commonAudience?: "adult" | "minor"; commonInformation?: string; publicationOnly?: boolean; singleCourse?: boolean;
  onDraftChange?: () => void; onSaved?: () => void; onEditingChange?: (editing: boolean) => void;
}) {
  const [editing, setEditing] = useState<{ offer?: ClassOffer; productId?: string } | null>(null);
  const [route, setRoute] = useState("direct");
  const draftId = useRef("");
  const current = editing?.offer;
  const productClasses = editing?.productId ? classes.filter(item => item.product_id === editing.productId) : classes;
  const initialIds = current?.class_ids ?? productClasses.map(item => item.id);

  function edit(offer?: ClassOffer, productId?: string) {
    draftId.current = "";
    onEditingChange?.(true);
    setRoute(offer?.route_override ?? commonRoute);
    setEditing({ offer, productId: offer ? undefined : productId });
  }

  return <section data-setup-block="offer" className="grid gap-3 rounded-lg border p-4" aria-label="クラスごとの入会方法">
    <h4 className="font-semibold">クラスごとの入会方法</h4>
    {!publicationOnly && <p className="text-sm text-neutral-600">受講対象は「クラスの内容・料金」の設定を自動で引き継ぎます。ここでは入会方法を2つから選びます。同じ内容の曜日・時間はまとめて設定します。</p>}
    {!publicationOnly && products.map(product => {
      const slots = classes.filter(item => item.product_id === product.id);
      const linked = offers.filter(offer => slots.some(item => offer.class_ids.includes(item.id)));
      return <div key={product.id} className="grid gap-2 rounded-lg bg-neutral-50 p-3 text-sm">
        <strong>{product.name}</strong>
        {linked.length ? linked.map(offer => <div key={offer.id} className="flex flex-wrap items-center gap-2">
          <span>{offer.name} · {product.audience === "minor" ? "未成年向け" : product.audience === "adult" ? "成人向け" : "受講対象はクラス設定で確認"} · {routeLabel(offer.route_override ?? commonRoute)}{offer.route_override ? "" : "（事業共通）"}</span>
          <button type="button" disabled={busy || editing !== null} className="underline" onClick={() => edit(offer, product.id)}>設定を編集</button>
        </div>) : <p>{product.audience === "minor" ? "未成年向け" : product.audience === "adult" ? "成人向け" : "受講対象はクラス設定で確認"} · {routeLabel(commonRoute)}（標準設定）</p>}
        {!linked.length && <button type="button" disabled={busy || editing !== null || !slots.length} className="w-fit underline" onClick={() => edit(undefined, product.id)}>入会方法を設定</button>}
        {!slots.length && <p>先に開催日・時間を登録してください。</p>}
      </div>;
    })}
    {!publicationOnly && !singleCourse && <details className="text-sm"><summary className="cursor-pointer">複数のクラスをまとめる場合</summary><button type="button" className="mt-2 w-fit underline" disabled={busy || editing !== null} onClick={() => edit()}>複数の内容をまとめた申込ページを作る</button></details>}
    {offers.filter(offer => publicationOnly || !products.some(product => classes.some(item => item.product_id === product.id && offer.class_ids.includes(item.id)))).map(offer => <div key={offer.id} className="grid gap-2 rounded border p-3 text-sm">
      <strong>{offer.name}</strong><p> {routeLabel(offer.route_override ?? commonRoute)}{offer.link_only ? "（URLで案内）" : ""} · {offer.enabled ? "受付公開中" : "下書き"}</p>
      {publicationOnly ? <button className={button} type="button" disabled={busy} onClick={() => void save({ action: "offer", id: offer.id, name: offer.name, information: offer.information,
        classIds: offer.class_ids, routeOverride: offer.route_override ?? null, audienceOverride: offer.audience_override ?? null, enabled: !offer.enabled })}>{offer.enabled ? "この受付を非公開にする" : "この受付を公開する"}</button>
        : <button className="w-fit underline" type="button" disabled={busy || editing !== null} onClick={() => edit(offer)}>設定を編集</button>}
      {offer.enabled && offer.link_only && <label>面接後に渡す入会URL
        <input className={field} readOnly value={typeof window === "undefined" ? "" : window.location.origin + "/class-intake/" + offer.id} onFocus={event => event.currentTarget.select()} />
      </label>}
      {offer.enabled && <a className="underline" href={"/class-intake/" + offer.id} target="_blank" rel="noreferrer">この申込ページを開く</a>}
    </div>)}
    {editing && <form key={current?.id ?? editing.productId ?? "new"} data-setup-offer-form className="grid gap-3 rounded-lg border p-3" onChange={() => onDraftChange?.()} onSubmit={async event => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      draftId.current ||= crypto.randomUUID();
      if (await save({ action: "offer", id: current?.id ?? draftId.current, name: form.get("name"), information: form.get("information"),
        classIds: form.getAll("classId"), routeOverride: route,
        directCompletion: form.has("linkOnly") ? "review" : form.get("directCompletion") || null, linkOnly: form.has("linkOnly"),
        enabled: current?.enabled ?? false })) {
        setEditing(null); onEditingChange?.(false); draftId.current = ""; onSaved?.();
      }
    }}>
      <p className="text-sm">受講対象はクラス設定から自動で反映します。変更する場合は「クラスの内容・料金」で編集してください。</p>
      <label className="text-sm">入会方法<select name="routeOverride" className={field} value={route} onChange={event => setRoute(event.target.value)}>
        <option value="direct">そのまま申込</option><option value="briefing">対面の体験・説明会から申込</option>
      </select></label>
      {route === "direct" && <>
        <label className="text-sm">入会の確定方法<select className={field} name="directCompletion" defaultValue={current?.direct_completion ?? ""}>
          <option value="">事業の標準設定を使う</option><option value="review">先生が確認して入会</option><option value="automatic">本人確認後に自動で入会</option>
        </select></label>
        <label className="text-sm"><input type="checkbox" name="linkOnly" defaultChecked={current?.link_only} /> 面接後など、入会URLを渡した方から受け付ける</label>
        <p className="text-sm text-neutral-600">この場合はURLを普段の連絡手段で渡してください。教室トップページには掲載されず、申込後は先生が確認して入会を確定します。</p>
      </>}
      <label className="text-sm">申込ページの名前<input name="name" className={field} required maxLength={120} defaultValue={current?.name ?? products.find(product => product.id === editing.productId)?.name} /></label>
      <fieldset className="grid gap-1 rounded border p-2 text-sm"><legend>対象の曜日・時間</legend>
        {productClasses.map(item => <label key={item.id}><input type="checkbox" name="classId" value={item.id} defaultChecked={initialIds.includes(item.id)} /> {item.productName ? item.productName + " · " : ""}{item.name}</label>)}
      </fieldset>
      <label className="text-sm">このクラスだけの補足案内（空欄なら共通案内）<textarea name="information" className={field} maxLength={4000} placeholder={commonInformation ? "空欄なら共通案内を表示します" : "共通案内は下で設定できます"} defaultValue={current?.information} /></label>
      <p className="text-sm text-neutral-600">未成年向けは保護者の氏名・メール・電話・住所が必須で、連絡は本人と保護者の両方に届きます。対面の体験・説明会は日時を予約し、参加後に主催者が入会を案内します。予約カレンダー、規約、入会時の費用、メールの文面は事業内で共通です。公開は「募集を始める」で行います。</p>
      <button type="submit" disabled={busy} className={button}>この内容の入会方法を保存</button>
      {!current && <p className="text-xs text-neutral-600">保存すると新しい申込ページの下書きができます。</p>}
    </form>}
  </section>;
}
