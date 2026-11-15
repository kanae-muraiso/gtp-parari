"use client";
import { useRef, useState } from "react";
import type { SchoolClass } from "@/lib/classes";

export type ClassOffer = { id: string; name: string; information: string; class_ids: string[]; enabled: boolean };
export default function ClassRecruitmentOffers({ classes, offers, busy, save }: {
  classes: SchoolClass[]; offers: ClassOffer[]; busy: boolean; save: (input: object) => Promise<boolean>;
}) {
  const [selected, setSelected] = useState("");
  const draftId = useRef("");
  const current = offers.find(offer => offer.id === selected);
  const field = "block w-full rounded border p-2 text-sm";
  return <section className="grid gap-3 border-t pt-4" aria-label="対象クラス別の募集">
    <h4 className="font-semibold">対象クラス別の募集</h4>
    <label className="text-sm">募集を選ぶ<select className={field} value={selected} onChange={event => { setSelected(event.target.value); draftId.current = ""; }}>
      <option value="">新しい募集</option>{offers.map(offer => <option key={offer.id} value={offer.id}>{offer.name}（{offer.enabled ? "公開設定済み" : "下書き"}）</option>)}
    </select></label>
    <form key={current?.id ?? "new"} className="grid gap-2" onSubmit={async event => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      draftId.current ||= crypto.randomUUID();
      const id = current?.id ?? draftId.current;
      if (await save({ action: "offer", id, name: form.get("name"), information: form.get("information"), classIds: form.getAll("classId"), enabled: form.has("enabled") })) {
        setSelected(id);
        draftId.current = "";
      }
    }}>
      <label className="text-sm">募集名<input name="name" className={field} required maxLength={120} defaultValue={current?.name} /></label>
      <fieldset className="grid gap-1 rounded border p-2 text-sm"><legend>対象クラス</legend>
        {classes.map(item => <label key={item.id}><input type="checkbox" name="classId" value={item.id}
          defaultChecked={current?.class_ids.includes(item.id) ?? classes.length === 1} /> {item.name}</label>)}
      </fieldset>
      <label className="text-sm">この募集の案内<textarea name="information" className={field} maxLength={4000} defaultValue={current?.information} /></label>
      <label className="text-sm"><input type="checkbox" name="enabled" defaultChecked={current?.enabled} /> この募集を公開する</label>
      <button type="submit" disabled={busy} className="w-fit rounded bg-neutral-900 px-3 py-2 text-sm text-white">募集を保存</button>
    </form>
    {current?.enabled && <a href={"/class-intake/" + current.id} target="_blank" rel="noreferrer" className="text-sm underline">この募集専用の申込ページ</a>}
  </section>;
}
