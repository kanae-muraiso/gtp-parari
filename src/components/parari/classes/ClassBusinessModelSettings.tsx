"use client";
import {useState} from "react";
import {serviceKinds,type ClassBusinessModel,type ServiceKind} from "@/lib/classBusinessModel";
import type {ServiceLabels} from "@/lib/classServiceLabels";
export default function ClassBusinessModelSettings({model,labels,onApply,preview,busy=false}:{model:ClassBusinessModel;labels:ServiceLabels;onApply:(model:ClassBusinessModel)=>void;preview:boolean;busy?:boolean}){
 const [draft,setDraft]=useState<ClassBusinessModel>(model);
 const descriptions={course:"定期的に開催する継続型サービス",workshop:"回数・期間が決まった講習",event:"開催ごとに参加者を募集"};
 function toggle(kind:ServiceKind){
  setDraft(old=>{
   const kinds=old.kinds.includes(kind)?old.kinds.filter(k=>k!==kind):[...old.kinds,kind];
   if(!kinds.length)return old;
   return {...old,kinds,primary:kinds.includes(old.primary)?old.primary:kinds[0]};
  });
 }
 return <section className="grid gap-4 rounded-2xl border border-emerald-200 bg-white p-4 sm:p-5">
  <h3 className="text-xl font-bold">事業の形態</h3>
  <p className="text-base text-neutral-600">提供するサービスを選び、その中から事業の中心を決めます。あとで変更できます。</p>
  {serviceKinds.map(kind=><label key={kind} className="flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border p-3">
    <input type="checkbox" className="h-5 w-5 shrink-0" checked={draft.kinds.includes(kind)} onChange={()=>toggle(kind)} disabled={busy}/>
    <span className="grid gap-1"><strong className="text-base">{labels[kind]}</strong><span className="text-base text-neutral-600">{descriptions[kind]}</span></span>
  </label>)}
  <label className="grid gap-2 text-base font-semibold">事業の中心となるサービス
    <select className="min-h-11 rounded-xl border p-2 text-base" value={draft.primary} disabled={busy} onChange={e=>setDraft(old=>({...old,primary:e.target.value as ServiceKind}))}>
      {draft.kinds.map(kind=><option key={kind} value={kind}>{labels[kind]}</option>)}
    </select>
  </label>
  <fieldset className="grid gap-3 rounded-xl border p-3">
    <legend className="px-1 text-lg font-bold">事業への入会制度</legend>
    <label className="flex min-h-11 items-center gap-2 text-base"><input type="radio" name="membershipModel" checked={draft.membership} onChange={()=>setDraft(old=>({...old,membership:true}))}/> 入会制度を設ける</label>
    <label className="flex min-h-11 items-center gap-2 text-base"><input type="radio" name="membershipModel" checked={!draft.membership} onChange={()=>setDraft(old=>({...old,membership:false}))}/> 入会制度を設けない</label>
    <p className="text-base text-neutral-600">入会の有無と各サービスの参加申込は別の設計です。参加者の資格・既存契約はこの設定だけでは変更しません。</p>
  </fieldset>
  <p className="text-base text-neutral-600">{preview?"開発プレビューではこのブラウザだけに設計案を反映します。本番DBには書き込みません。":"事業の設計案として保存します。公開中の募集・入会者の権限は変更されません。"}</p>
  <button type="button" disabled={busy} onClick={()=>onApply(draft)} className="min-h-12 rounded-xl bg-emerald-800 px-4 text-base font-semibold text-white disabled:opacity-50">{preview?"設計案を反映する":"設計案を保存する"}</button>
 </section>;
}
